import { BadRequestException, HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { DockerService } from './docker.service';
import { GameService } from './game.service';

/**
 * Event names sent by mbround18/enshrouded-docker as the title suffix of its
 * webhook notifications (`<NAME>: <Event>`, the NAME prefix being free-form).
 */
export const WEBHOOK_EVENTS = {
  PLAYER_JOINED: 'Player Joined',
  PLAYER_LEFT: 'Player Left',
  SERVER_STARTED: 'Server Started',
  SERVER_STOPPING: 'Server Stopping',
  SERVER_STOPPED: 'Server Stopped',
} as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[keyof typeof WEBHOOK_EVENTS];

/** Strict message shape sent by the game image for player join notifications. */
const PLAYER_JOINED_MESSAGE = /^Player (.+?) has joined the adventure!?$/;
/** Strict message shape sent by the game image for player leave notifications. */
const PLAYER_LEFT_MESSAGE = /^Player (.+?) has left the adventure\.?$/;
/** Lenient fallbacks used when the strict message shape does not match. */
const PLAYER_JOINED_FALLBACK = /Player (.+?) has joined/;
const PLAYER_LEFT_FALLBACK = /Player (.+?) has left/;

export interface WebhookNotification {
  title: string;
  message: string;
}

/**
 * Normalizes the two payload formats the game image can send into a common
 * `{ title, message }` shape. The Discord format carries the event in
 * `embeds[0].title` / `embeds[0].description`; the generic format carries it
 * in `notification_type` / `message`. The free-form `content` field is never
 * used as the title.
 *
 * Throws a BadRequestException for payloads that carry no exploitable event,
 * so callers answer 400 instead of silently dropping unparseable input.
 */
export function normalizeWebhookPayload(payload: unknown): WebhookNotification {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new BadRequestException('Unrecognized Enshrouded webhook payload: expected a JSON object');
  }

  const body = payload as Record<string, unknown>;

  const embeds = body.embeds;
  if (Array.isArray(embeds) && embeds.length > 0) {
    const first = embeds[0];
    if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
      const embed = first as Record<string, unknown>;
      if (typeof embed.title === 'string' && embed.title.trim() !== '') {
        return {
          title: embed.title,
          message: typeof embed.description === 'string' ? embed.description : '',
        };
      }
    }
  }

  if (typeof body.notification_type === 'string' && body.notification_type.trim() !== '') {
    return {
      title: body.notification_type,
      message: typeof body.message === 'string' ? body.message : '',
    };
  }

  throw new BadRequestException(
    'Unrecognized Enshrouded webhook payload: no usable embed[0].title or notification_type',
  );
}

/**
 * Extracts the event from a webhook title. Matches the `<NAME>: <Event>`
 * suffix and also accepts the bare event name (generic payloads), so no
 * server NAME can ever be hard-coded here.
 */
export function extractWebhookEvent(title: string): WebhookEvent | null {
  for (const event of Object.values(WEBHOOK_EVENTS)) {
    if (title === event || title.endsWith(`: ${event}`)) {
      return event;
    }
  }
  return null;
}

function extractPlayerName(message: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = pattern.exec(message);
    const name = match?.[1];
    if (typeof name === 'string' && name.trim() !== '') {
      return name;
    }
  }
  return null;
}

/**
 * Enshrouded server support.
 *
 * An Enshrouded dedicated server exposes no RCON and no status/query protocol,
 * so status/start/stop go through the Docker socket. The online player list is
 * maintained in memory from the webhook notifications the game image posts to
 * this API (`WEBHOOK_URL` option of mbround18/enshrouded-docker): join and
 * leave events add/remove names, started/stopped events reset the list.
 */
@Injectable()
export class EnshroudedService implements GameService {
  private readonly logger = new Logger(EnshroudedService.name);

  private players: string[] = [];
  private lastEventAt: string | null = null;
  private serverStatus: Status | null = null;

  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    this.assertDockerEnabled();

    return this.dockerService.getContainerStatus(config.enshrouded.container_name);
  }

  /**
   * Player names known from the webhook notifications, in join order.
   * Returns an empty list until the first webhook event arrives.
   */
  async getPlayersOnline(): Promise<string[]> {
    return [...this.players];
  }

  /** Webhook-based count: no `max` is available through this channel. */
  async getPlayerCount(): Promise<{ online: number; source: 'webhook'; lastEventAt: string | null }> {
    return { online: this.players.length, source: 'webhook', lastEventAt: this.lastEventAt };
  }

  /**
   * Applies one webhook notification (already JSON-decoded by the body
   * parser). Answers 400 for unparseable payloads, 202 otherwise; a payload
   * whose title matches an event but whose message carries no extractable
   * player name is accepted without touching the state.
   */
  handleWebhookPayload(payload: unknown): void {
    const notification = normalizeWebhookPayload(payload);
    this.applyNotification(notification.title, notification.message, new Date().toISOString());
  }

  async startServer(): Promise<void> {
    this.assertDockerEnabled();

    return this.dockerService.startContainer(config.enshrouded.container_name);
  }

  async stopServer(): Promise<void> {
    this.assertDockerEnabled();

    // No RCON: the server saves its world on shutdown, so DockerService waits
    // for `stop_grace_period` before killing the container.
    return this.dockerService.stopContainer(config.enshrouded.container_name);
  }

  private applyNotification(title: string, message: string, receivedAt: string): void {
    this.lastEventAt = receivedAt;

    const event = extractWebhookEvent(title);

    switch (event) {
      case WEBHOOK_EVENTS.PLAYER_JOINED: {
        const name = extractPlayerName(message, [PLAYER_JOINED_MESSAGE, PLAYER_JOINED_FALLBACK]);
        if (name === null) {
          this.logger.warn(
            `Webhook title matched "${WEBHOOK_EVENTS.PLAYER_JOINED}" but no player name could be extracted; state unchanged`,
          );
          return;
        }
        if (!this.players.includes(name)) {
          this.players.push(name);
        }
        return;
      }
      case WEBHOOK_EVENTS.PLAYER_LEFT: {
        const name = extractPlayerName(message, [PLAYER_LEFT_MESSAGE, PLAYER_LEFT_FALLBACK]);
        if (name === null) {
          this.logger.warn(
            `Webhook title matched "${WEBHOOK_EVENTS.PLAYER_LEFT}" but no player name could be extracted; state unchanged`,
          );
          return;
        }
        this.players = this.players.filter((player) => player !== name);
        return;
      }
      case WEBHOOK_EVENTS.SERVER_STARTED:
        this.players = [];
        this.serverStatus = 'STARTED';
        return;
      case WEBHOOK_EVENTS.SERVER_STOPPED:
        this.players = [];
        this.serverStatus = 'STOPPED';
        return;
      case WEBHOOK_EVENTS.SERVER_STOPPING:
        // Transitional event: it carries no reliable state, ignore it.
        return;
      default:
        this.logger.warn(`Ignoring webhook notification with unknown event title: "${title}"`);
    }
  }

  private assertDockerEnabled(): void {
    if (!this.isDockerEnabled()) {
      throw new HttpException('Error: Docker not enabled for game enshrouded!', HttpStatus.BAD_REQUEST);
    }
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.enshrouded.container_name;
  }
}
