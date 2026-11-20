import { open } from 'fs/promises';
import { DockerService } from './docker.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';
import { queryA2SInfo } from 'src/utils/steam-query.utils';

/**
 * Enshrouded server support.
 *
 * An Enshrouded dedicated server exposes no RCON, so every container operation
 * (status, start, stop) goes through the Docker socket. Player data comes from
 * two other channels:
 * - the A2S Steam UDP query protocol for the live player count
 *   (`GET /enshrouded/players/count`),
 * - the server log file (`enshrouded_server.log`) for the player names
 *   (`GET /enshrouded/players`), replayed from its join/leave lines.
 */
@Injectable()
export class EnshroudedService implements GameService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    this.assertDockerEnabled();

    return this.dockerService.getContainerStatus(config.enshrouded.container_name);
  }

  /**
   * Live player count, queried with A2S_INFO on the server's game port.
   */
  async getPlayerCount(): Promise<{ online: number; max: number }> {
    const info = await queryA2SInfo(config.enshrouded.query_host, config.enshrouded.query_port, {
      timeoutMs: config.enshrouded.query_timeout_ms,
    });

    return { online: info.players, max: info.maxPlayers };
  }

  /**
   * Names of the currently connected players, rebuilt from the server log file.
   *
   * The A2S_PLAYER query cannot be used for this: the Enshrouded server answers
   * it with empty player names (verified live). The log instead contains one
   * JOIN line and one LEAVE line per player, replayed in order below.
   *
   * Requires `ENSHROUDED_LOG_PATH` (read-only mount of the server log);
   * otherwise 501 with a pointer to `GET /enshrouded/players/count`, which
   * always works once the query host/port are set.
   */
  async getPlayersOnline(): Promise<string[]> {
    const logPath = config.enshrouded.log_path;
    if (!logPath) {
      throw new HttpException(
        'Enshrouded player names are disabled: set ENSHROUDED_LOG_PATH to the server log file (read-only mount) to enable it. The player count is available at GET /enshrouded/players/count',
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    const { online } = await this.getPlayerCount();
    if (online === 0) {
      return [];
    }

    return replayLogPlayers(await readLogTail(logPath));
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

  private assertDockerEnabled(): void {
    if (!this.isDockerEnabled()) {
      throw new HttpException('Error: Docker not enabled for game enshrouded!', HttpStatus.BAD_REQUEST);
    }
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.enshrouded.container_name;
  }
}

const LOG_TAIL_MAX_BYTES = 2 * 1024 * 1024;
const LOG_TAIL_MAX_LINES = 20_000;

// JOIN : [I <uptime>] [server] Player '<name>' logged in with Permissions:
const LOG_JOIN_PATTERN = /^\[[IWE] \d+:\d{2}:\d{2},\d{3}\] \[server\] Player '([^']+)' logged in with Permissions:$/;
// LEAVE : [I <uptime>] [server] Remove Player '<name>'
const LOG_LEAVE_PATTERN = /^\[[IWE] \d+:\d{2}:\d{2},\d{3}\] \[server\] Remove Player '([^']+)'$/;
// Single wall-clock line emitted at server boot; marks a restart (the previous
// session's log is rotated away, so the state must restart from zero).
const LOG_BOOT_PATTERN = /Current UTC date: \d{4}\.\d{2}\.\d{2} \d{2}:\d{2}:\d{2}/;

/**
 * Replays the join/leave events of a log tail and returns the names of the
 * players currently connected, in connection order.
 *
 * Only the two exact lines above are trusted; everything else is noise:
 * `Machine 'N': Player '0(N)' logged in` and the `[twitch_drop]` lines carry an
 * anonymous handle, `Remove Entity for Player '<name>'` duplicates `Remove
 * Player` (2-12ms apart) and would double-count leaves, and
 * `[online] Disconnecting peer 0(N)` fires for aborted joins with no name.
 */
export function replayLogPlayers(lines: string[]): string[] {
  let bootIndex = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (LOG_BOOT_PATTERN.test(lines[i])) {
      bootIndex = i;
      break;
    }
  }

  const online: string[] = [];
  for (let i = bootIndex + 1; i < lines.length; i++) {
    const join = lines[i].match(LOG_JOIN_PATTERN);
    if (join) {
      if (!online.includes(join[1])) {
        online.push(join[1]);
      }
      continue;
    }

    const leave = lines[i].match(LOG_LEAVE_PATTERN);
    if (leave) {
      const index = online.indexOf(leave[1]);
      if (index !== -1) {
        online.splice(index, 1);
      }
    }
  }

  return online;
}

/**
 * Reads the last LOG_TAIL_MAX_BYTES / LOG_TAIL_MAX_LINES of the log file.
 * A missing or unreadable file fails explicitly instead of returning a
 * misleading empty list.
 */
async function readLogTail(logPath: string): Promise<string[]> {
  let handle;
  try {
    handle = await open(logPath, 'r');
    const { size } = await handle.stat();
    const start = Math.max(0, size - LOG_TAIL_MAX_BYTES);
    const length = size - start;
    const buffer = Buffer.alloc(length);
    await handle.read(buffer, 0, length, start);

    const lines = buffer.toString('utf8').split('\n');
    // Drop the (possibly partial) first line when the window starts mid-file.
    if (start > 0) {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }

    return lines.length > LOG_TAIL_MAX_LINES ? lines.slice(-LOG_TAIL_MAX_LINES) : lines;
  } catch (error) {
    throw new HttpException(
      `Enshrouded player names are unavailable: the log file ${logPath} cannot be read (${(error as Error).message}). Check ENSHROUDED_LOG_PATH and the read-only mount of the server log. The player count is available at GET /enshrouded/players/count`,
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  } finally {
    await handle?.close();
  }
}
