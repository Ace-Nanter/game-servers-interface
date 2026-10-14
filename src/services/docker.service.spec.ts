import { HttpService } from '@nestjs/axios/dist';
import { of, throwError } from 'rxjs';
import { DockerService } from './docker.service';
import config from 'src/config';

describe('DockerService', () => {
  const post = jest.fn();
  const httpService = { post } as unknown as HttpService;
  const dockerService = new DockerService(httpService);

  beforeEach(() => {
    post.mockReset();
    post.mockReturnValue(of({ data: {} }));
  });

  describe('stopContainer', () => {
    it('sends an explicit graceful-stop timeout to Docker', async () => {
      await dockerService.stopContainer('enshrouded-server');

      expect(post).toHaveBeenCalledTimes(1);
      expect(post).toHaveBeenCalledWith('/containers/enshrouded-server/stop', null, {
        params: { t: config.DOCKER_STOP_TIMEOUT_SECONDS },
      });
    });

    it('waits at least 120s before Docker SIGKILLs the container', () => {
      // The game servers (Enshrouded world save, Ark BACKUP_ON_STOP) need the time
      // to save on shutdown: Docker's own default of 10s would kill them mid-backup.
      expect(config.DOCKER_STOP_TIMEOUT_SECONDS).toBeGreaterThanOrEqual(120);
    });

    it('rejects when Docker answers with an error', async () => {
      post.mockReturnValue(throwError(() => new Error('docker is down')));

      await expect(dockerService.stopContainer('enshrouded-server')).rejects.toThrow('docker is down');
    });
  });

  describe('startContainer', () => {
    it('posts to the container start endpoint', async () => {
      await dockerService.startContainer('enshrouded-server');

      expect(post).toHaveBeenCalledWith('/containers/enshrouded-server/start');
    });
  });
});
