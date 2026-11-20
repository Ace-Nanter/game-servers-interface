import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import config from 'src/config';
import { DockerService } from './docker.service';
import { EnshroudedService, WEBHOOK_EVENTS } from './enshrouded.service';

describe('EnshroudedService', () => {
  const getContainerStatus = jest.fn();
  const startContainer = jest.fn();
  const stopContainer = jest.fn();
  const dockerService = {
    getContainerStatus,
    startContainer,
    stopContainer,
  } as unknown as DockerService;

  let service: EnshroudedService;

  const initialDockerEnabled = config.ENABLE_DOCKER_CLIENT;
  const initialContainerName = config.enshrouded.container_name;

  const SERVER_NAME = "Le serveur d'Obélix";

  /** Discord-style payload sent by mbround18/enshrouded-docker. */
  const discordPayload = (event: string, message: string) => ({
    notification_type: event,
    message: message,
    content: `🔔 ${SERVER_NAME}`,
    embeds: [
      {
        title: `${SERVER_NAME}: ${event}`,
        description: message,
        color: 0,
      },
    ],
  });

  const join = (player: string) =>
    discordPayload(WEBHOOK_EVENTS.PLAYER_JOINED, `Player ${player} has joined the adventure!`);
  const leave = (player: string) =>
    discordPayload(WEBHOOK_EVENTS.PLAYER_LEFT, `Player ${player} has left the adventure.`);

  const expectPlayers = async (expected: string[]) => {
    await expect(service.getPlayersOnline()).resolves.toEqual(expected);
  };

  beforeEach(() => {
    getContainerStatus.mockReset().mockResolvedValue('STARTED');
    startContainer.mockReset().mockResolvedValue(undefined);
    stopContainer.mockReset().mockResolvedValue(undefined);

    config.ENABLE_DOCKER_CLIENT = true;
    config.enshrouded.container_name = 'enshrouded-server';

    service = new EnshroudedService(dockerService);
  });

  afterAll(() => {
    config.ENABLE_DOCKER_CLIENT = initialDockerEnabled;
    config.enshrouded.container_name = initialContainerName;
  });

  describe('getServerStatus', () => {
    it('reads the container status from Docker', async () => {
      await expect(service.getServerStatus()).resolves.toBe('STARTED');
      expect(getContainerStatus).toHaveBeenCalledWith('enshrouded-server');
    });

    it('fails with 400 when Docker is not enabled', async () => {
      config.ENABLE_DOCKER_CLIENT = false;

      await expect(service.getServerStatus()).rejects.toThrow('Error: Docker not enabled for game enshrouded!');
      expect(getContainerStatus).not.toHaveBeenCalled();
    });
  });

  describe('startServer', () => {
    it('starts the container through Docker', async () => {
      await service.startServer();

      expect(startContainer).toHaveBeenCalledWith('enshrouded-server');
    });

    it('fails with 400 when Docker is not enabled', async () => {
      config.ENABLE_DOCKER_CLIENT = false;

      await expect(service.startServer()).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(startContainer).not.toHaveBeenCalled();
    });
  });

  describe('stopServer', () => {
    it('stops the container through Docker without querying the player list', async () => {
      await service.stopServer();

      expect(stopContainer).toHaveBeenCalledWith('enshrouded-server');
    });

    it('fails with 400 when Docker is not enabled', async () => {
      config.ENABLE_DOCKER_CLIENT = false;

      await expect(service.stopServer()).rejects.toMatchObject({ status: HttpStatus.BAD_REQUEST });
      expect(stopContainer).not.toHaveBeenCalled();
    });
  });

  describe('getPlayersOnline (webhook state)', () => {
    it('answers an empty list until the first webhook event arrives', async () => {
      await expectPlayers([]);
    });

    it('returns names in join order once webhook events arrive', async () => {
      service.handleWebhookPayload(join('Obélix'));
      service.handleWebhookPayload(join('Idéfix'));

      await expectPlayers(['Obélix', 'Idéfix']);
    });
  });

  describe('handleWebhookPayload: player events from the Discord payload format', () => {
    it('adds the player extracted from the join message', async () => {
      service.handleWebhookPayload(join('Obélix'));

      await expectPlayers(['Obélix']);
    });

    it('removes the player extracted from the leave message', async () => {
      service.handleWebhookPayload(join('Obélix'));
      service.handleWebhookPayload(join('Idéfix'));
      service.handleWebhookPayload(leave('Obélix'));

      await expectPlayers(['Idéfix']);
    });

    it('matches the event by title suffix, whatever the server NAME is', async () => {
      service.handleWebhookPayload({
        content: '🔔 Some other free-form NAME',
        embeds: [
          {
            title: `A totally different NAME: ${WEBHOOK_EVENTS.PLAYER_JOINED}`,
            description: 'Player Panoramix has joined the adventure!',
            color: 0,
          },
        ],
      });

      await expectPlayers(['Panoramix']);
    });

    it('never uses the content field as the title: a content-only payload is rejected with 400', async () => {
      service.handleWebhookPayload(join('Obélix'));

      expect(() =>
        service.handleWebhookPayload({
          content: `🔔 ${SERVER_NAME}`,
          embeds: [],
        }),
      ).toThrow(BadRequestException);

      // The 400 must not have touched the state either.
      await expectPlayers(['Obélix']);
    });

    it('answers 202 semantics (accepts) without state change when the message carries no player name', async () => {
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

      service.handleWebhookPayload(discordPayload(WEBHOOK_EVENTS.PLAYER_JOINED, 'The server is unavailable.'));

      await expectPlayers([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  describe('handleWebhookPayload: player events from the generic payload format', () => {
    it('adds the player from notification_type / message', async () => {
      service.handleWebhookPayload({
        notification_type: WEBHOOK_EVENTS.PLAYER_JOINED,
        message: 'Player Obélix has joined the adventure!',
        data: null,
      });

      await expectPlayers(['Obélix']);
    });

    it('removes the player from notification_type / message', async () => {
      service.handleWebhookPayload(join('Obélix'));

      service.handleWebhookPayload({
        notification_type: WEBHOOK_EVENTS.PLAYER_LEFT,
        message: 'Player Obélix has left the adventure.',
        data: null,
      });

      await expectPlayers([]);
    });
  });

  describe('handleWebhookPayload: server lifecycle events', () => {
    it('Server Started resets the player list', async () => {
      service.handleWebhookPayload(join('Obélix'));

      service.handleWebhookPayload(
        discordPayload(WEBHOOK_EVENTS.SERVER_STARTED, 'The server has started successfully.'),
      );

      await expectPlayers([]);
    });

    it('Server Stopped resets the player list', async () => {
      service.handleWebhookPayload(join('Obélix'));

      service.handleWebhookPayload(discordPayload(WEBHOOK_EVENTS.SERVER_STOPPED, 'The server has been stopped.'));

      await expectPlayers([]);
    });

    it('Server Stopping is ignored', async () => {
      service.handleWebhookPayload(join('Obélix'));

      service.handleWebhookPayload(
        discordPayload(WEBHOOK_EVENTS.SERVER_STOPPING, 'The server is shutting down gracefully.'),
      );

      await expectPlayers(['Obélix']);
    });
  });

  describe('handleWebhookPayload: idempotence and unknown players', () => {
    it('a duplicate join does not create a second entry', async () => {
      service.handleWebhookPayload(join('Obélix'));
      service.handleWebhookPayload(join('Obélix'));

      await expectPlayers(['Obélix']);
    });

    it('a leave for an unknown player is a no-op', async () => {
      service.handleWebhookPayload(join('Obélix'));

      service.handleWebhookPayload(leave('Idéfix'));

      await expectPlayers(['Obélix']);
    });
  });

  describe('getPlayerCount', () => {
    it('reports the webhook count with no max and the last event time', async () => {
      expect(await service.getPlayerCount()).toEqual({ online: 0, source: 'webhook', lastEventAt: null });

      service.handleWebhookPayload(join('Obélix'));
      service.handleWebhookPayload(join('Idéfix'));

      const count = await service.getPlayerCount();
      expect(count).toMatchObject({ online: 2, source: 'webhook' });
      expect(typeof count.lastEventAt).toBe('string');
      expect(new Date(count.lastEventAt as string).toString()).not.toBe('Invalid Date');
    });
  });

  describe('handleWebhookPayload: unusable payloads', () => {
    it('rejects a payload with neither embeds nor notification_type with 400', () => {
      expect(() => service.handleWebhookPayload({ content: '🔔 hello' })).toThrow(BadRequestException);
    });

    it('rejects a non-object payload with 400', () => {
      expect(() => service.handleWebhookPayload('not an object')).toThrow(BadRequestException);
      expect(() => service.handleWebhookPayload(null)).toThrow(BadRequestException);
      expect(() => service.handleWebhookPayload([1, 2, 3])).toThrow(BadRequestException);
    });

    it('rejects an embed without a title when notification_type is missing', () => {
      expect(() => service.handleWebhookPayload({ embeds: [{ description: 'orphan description' }] })).toThrow(
        BadRequestException,
      );
    });

    it('never throws 500 for deeply malformed payloads', () => {
      expect(() => service.handleWebhookPayload({ embeds: 'nope' })).toThrow(BadRequestException);
      expect(() =>
        service.handleWebhookPayload({ notification_type: WEBHOOK_EVENTS.PLAYER_JOINED, message: 42 }),
      ).not.toThrow(HttpException);
    });
  });

  describe('player name extraction edge cases', () => {
    it('uses the lenient fallback when the strict message shape drifts', async () => {
      service.handleWebhookPayload({
        notification_type: WEBHOOK_EVENTS.PLAYER_JOINED,
        message: 'Player Obélix has joined the server early',
      });

      await expectPlayers(['Obélix']);
    });

    it('does not invent a name from an unrelated message', async () => {
      const warn = jest.spyOn(service['logger'], 'warn').mockImplementation(() => undefined);

      service.handleWebhookPayload({
        notification_type: WEBHOOK_EVENTS.PLAYER_LEFT,
        message: 'Player roster unavailable',
      });

      await expectPlayers([]);
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });
  });
});
