import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { HttpException, HttpStatus } from '@nestjs/common';
import config from 'src/config';
import { DockerService } from './docker.service';
import { EnshroudedService, replayLogPlayers } from './enshrouded.service';
import { queryA2SInfo } from 'src/utils/steam-query.utils';

jest.mock('src/utils/steam-query.utils', () => ({
  queryA2SInfo: jest.fn(),
}));

const queryA2SInfoMock = queryA2SInfo as jest.Mock;

describe('EnshroudedService', () => {
  const getContainerStatus = jest.fn();
  const startContainer = jest.fn();
  const stopContainer = jest.fn();
  const dockerService = {
    getContainerStatus,
    startContainer,
    stopContainer,
  } as unknown as DockerService;

  const service = new EnshroudedService(dockerService);

  const initialDockerEnabled = config.ENABLE_DOCKER_CLIENT;
  const initialContainerName = config.enshrouded.container_name;
  const initialQueryHost = config.enshrouded.query_host;
  const initialQueryPort = config.enshrouded.query_port;
  const initialQueryTimeoutMs = config.enshrouded.query_timeout_ms;
  const initialLogPath = config.enshrouded.log_path;

  let logDir: string;

  beforeAll(async () => {
    logDir = await mkdtemp(join(tmpdir(), 'enshrouded-log-'));
  });

  beforeEach(async () => {
    getContainerStatus.mockReset().mockResolvedValue('STARTED');
    startContainer.mockReset().mockResolvedValue(undefined);
    stopContainer.mockReset().mockResolvedValue(undefined);
    queryA2SInfoMock.mockReset().mockResolvedValue({
      protocol: 17,
      name: "Le serveur d'Obélix",
      map: '',
      folder: 'Enshrouded',
      game: 'Enshrouded',
      appId: 0,
      players: 0,
      maxPlayers: 10,
      bots: 0,
      serverType: 'd',
      environment: 'l',
      visibility: true,
      vac: false,
      version: '0.0.15.0',
    });

    config.ENABLE_DOCKER_CLIENT = true;
    config.enshrouded.container_name = 'enshrouded-server';
    config.enshrouded.query_host = 'enshrouded-server';
    config.enshrouded.query_port = 15637;
    config.enshrouded.query_timeout_ms = 3000;
    config.enshrouded.log_path = '';
  });

  afterAll(async () => {
    config.ENABLE_DOCKER_CLIENT = initialDockerEnabled;
    config.enshrouded.container_name = initialContainerName;
    config.enshrouded.query_host = initialQueryHost;
    config.enshrouded.query_port = initialQueryPort;
    config.enshrouded.query_timeout_ms = initialQueryTimeoutMs;
    config.enshrouded.log_path = initialLogPath;

    await rm(logDir, { recursive: true, force: true });
  });

  describe('getPlayerCount', () => {
    it('queries A2S_INFO with the configured host, port and timeout', async () => {
      await expect(service.getPlayerCount()).resolves.toEqual({ online: 0, max: 10 });

      expect(queryA2SInfoMock).toHaveBeenCalledTimes(1);
      expect(queryA2SInfoMock).toHaveBeenCalledWith('enshrouded-server', 15637, { timeoutMs: 3000 });
    });
  });

  describe('getPlayersOnline', () => {
    it('answers 501 with a pointer to the player count when no log path is configured', async () => {
      const error = await service.getPlayersOnline().catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
      expect(error.message).toContain('ENSHROUDED_LOG_PATH');
      expect(error.message).toContain('/enshrouded/players/count');
      expect(queryA2SInfoMock).not.toHaveBeenCalled();
    });

    it('returns an empty list without reading the log when A2S says 0 player online', async () => {
      config.enshrouded.log_path = join(logDir, 'does-not-exist.log');

      await expect(service.getPlayersOnline()).resolves.toEqual([]);
      expect(queryA2SInfoMock).toHaveBeenCalledTimes(1);
    });

    it('replays the log and returns the currently connected players in connection order', async () => {
      config.enshrouded.log_path = join(logDir, 'players.log');
      queryA2SInfoMock.mockResolvedValue({ players: 1, maxPlayers: 10 });
      // Real lines, including the traps measured on the actual server.
      await writeFile(
        config.enshrouded.log_path,
        [
          "[I 08:24:32,203] [twitch_drop] Request succeeded Player '0(0)' drops:",
          "[I 08:24:35,407] [server] Machine '1': Player '0(0)' logged in",
          "[I 08:24:35,412] [server] Player 'Jean Dupont' logged in with Permissions:",
          "[I 08:36:36,339] [server] Player 'Natla' logged in with Permissions:",
          '[I 08:36:36,365] [ecss] Replication Checkpoint 1 Set for Player 0 in Tick 1,859,697',
          '[I 08:37:09,100]   m#1(129): up 58 (84), down 36 (54), remote 58 (82), limit 548, lost 14, ping 24 ms, OperatingNormally',
          "[I 08:37:11,389] [server] Remove Entity for Player 'Jean Dupont'",
          "[I 08:37:11,395] [server] Remove Player 'Jean Dupont'",
          '[I 36:34:35,942] [online] Disconnecting peer 0(8)',
        ].join('\n') + '\n',
      );

      await expect(service.getPlayersOnline()).resolves.toEqual(['Natla']);
    });

    it('restarts the state from zero at a server boot line', async () => {
      config.enshrouded.log_path = join(logDir, 'restart.log');
      queryA2SInfoMock.mockResolvedValue({ players: 2, maxPlayers: 10 });
      await writeFile(
        config.enshrouded.log_path,
        [
          "[I 09:07:39,493] [server] Player 'Jarno' logged in with Permissions:",
          "[I 09:13:16,725] [server] Remove Player 'Jarno'",
          '[I 00:00:00,059] Current UTC date: 2026.11.19 00:13:38',
          "[I 08:24:35,412] [server] Player 'Dovakh' logged in with Permissions:",
          "[I 08:36:36,339] [server] Player 'Natla' logged in with Permissions:",
        ].join('\n') + '\n',
      );

      await expect(service.getPlayersOnline()).resolves.toEqual(['Dovakh', 'Natla']);
    });

    it('fails explicitly when the log file is missing', async () => {
      config.enshrouded.log_path = join(logDir, 'missing.log');
      queryA2SInfoMock.mockResolvedValue({ players: 3, maxPlayers: 10 });

      const error = await service.getPlayersOnline().catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(error.message).toContain('missing.log');
      expect(error.message).toContain('ENSHROUDED_LOG_PATH');
    });
  });

  describe('replayLogPlayers', () => {
    it('ignores the anonymous handle and noise lines, and handles duplicate joins', () => {
      const lines = [
        "[I 08:24:32,203] [twitch_drop]\tPlayer '0(0)'\tCampaign04_Reward02",
        "[I 08:24:35,407] [server] Machine '1': Player '0(0)' logged in",
        "[I 08:24:35,412] [server] Player 'Jarno' logged in with Permissions:",
        '[I 08:36:30,021] [session] Sending new communication allowed mask 00000002 to player 1(1)',
        "[I 08:36:36,339] [server] Player 'Natla' logged in with Permissions:",
        "[I 08:36:36,339] [server] Player 'Natla' logged in with Permissions:", // duplicate join
        "[I 08:37:11,389] [server] Remove Entity for Player 'Jarno'", // duplicate of the line below
        "[I 08:37:11,395] [server] Remove Player 'Jarno'",
        '[I 09:07:21,000] [online] Disconnecting peer 0(2)',
        "[I 09:13:16,725] [server] Remove Player 'Unknown'", // leave of a player who never joined
      ];

      expect(replayLogPlayers(lines)).toEqual(['Natla']);
    });

    it('returns players in connection order after a leave of the first one', () => {
      const lines = [
        "[I 08:24:35,412] [server] Player 'Jarno' logged in with Permissions:",
        "[I 08:36:36,339] [server] Player 'Natla' logged in with Permissions:",
        "[I 20:54:25,474] [server] Player 'Dovakh' logged in with Permissions:",
        "[I 08:37:11,395] [server] Remove Player 'Jarno'",
      ];

      expect(replayLogPlayers(lines)).toEqual(['Natla', 'Dovakh']);
    });
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
});
