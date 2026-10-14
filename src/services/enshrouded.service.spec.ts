import { HttpException, HttpStatus } from '@nestjs/common';
import config from 'src/config';
import { DockerService } from './docker.service';
import { EnshroudedService } from './enshrouded.service';

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

  beforeEach(() => {
    getContainerStatus.mockReset().mockResolvedValue('STARTED');
    startContainer.mockReset().mockResolvedValue(undefined);
    stopContainer.mockReset().mockResolvedValue(undefined);

    config.ENABLE_DOCKER_CLIENT = true;
    config.enshrouded.container_name = 'enshrouded-server';
  });

  afterAll(() => {
    config.ENABLE_DOCKER_CLIENT = initialDockerEnabled;
    config.enshrouded.container_name = initialContainerName;
  });

  describe('getPlayersOnline', () => {
    it('answers 501 Not Implemented instead of a misleading empty list', async () => {
      const error = await service.getPlayersOnline().catch((e) => e);

      expect(error).toBeInstanceOf(HttpException);
      expect(error.getStatus()).toBe(HttpStatus.NOT_IMPLEMENTED);
      expect(error.message).toBe('Enshrouded servers expose no player list API (no RCON support)');
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
