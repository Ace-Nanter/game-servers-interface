import { HttpService } from '@nestjs/axios/dist';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common/services';
import { catchError, firstValueFrom } from 'rxjs';
import config from 'src/config';
import { ContainerInfos } from 'src/models/container-infos.interface';
import { Status } from 'src/models/status.type';

@Injectable()
export class DockerService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly httpService: HttpService) {}

  /**
   * Retrieves a container status
   * @param containerName Container's name of which status should be retrieved
   * @returns A Status
   */
  async getContainerStatus(containerName: string): Promise<Status> {
    const { data } = await firstValueFrom(
      this.httpService.get(`/containers/${containerName}/json`).pipe(
        catchError((error) => {
          Logger.error(error);
          throw 'An error happened!';
        }),
      ),
    );

    const containerInfo = data as ContainerInfos;
    switch (containerInfo.State.Status) {
      case 'running':
        return 'STARTED';
      case 'exited':
        return 'STOPPED';
      default:
        return 'UNKNOWN';
    }
  }

  /**
   * Starts container
   * @param containerName Container's name to start
   */
  async startContainer(containerName: string): Promise<void> {
    Logger.log(`Starting container ${containerName}...`);

    return firstValueFrom(this.httpService.post(`/containers/${containerName}/start`))
      .then(() => {
        Logger.log(`Container ${containerName} started`);
      })
      .catch((error) => Promise.reject(error));
  }

  /**
   * Stops container
   *
   * An explicit timeout is sent to Docker (`POST /containers/<name>/stop?t=<seconds>`):
   * without it Docker waits only 10 seconds and then SIGKILLs the container, which can
   * interrupt a game server saving its world or running a backup on shutdown. The
   * timeout is configurable through `DOCKER_STOP_TIMEOUT_SECONDS` (120s by default, to
   * match the `stop_grace_period` of the game servers).
   *
   * @param containerName Container's name to stop
   */
  async stopContainer(containerName: string): Promise<void> {
    const timeout = config.DOCKER_STOP_TIMEOUT_SECONDS;
    Logger.log(`Stopping container ${containerName} (graceful timeout: ${timeout}s)...`);

    return firstValueFrom(
      this.httpService.post(`/containers/${containerName}/stop`, null, {
        params: { t: timeout },
      }),
    )
      .then(() => {
        Logger.log(`Container ${containerName} stopped`);
      })
      .catch((error) => Promise.reject(error));
  }
}
