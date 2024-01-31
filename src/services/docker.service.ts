import { HttpService } from '@nestjs/axios/dist';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common/services';
import { catchError, firstValueFrom } from 'rxjs';
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
   * @param containerName Container's name to stop
   */
  async stopContainer(containerName: string): Promise<void> {
    Logger.log(`Stopping container ${containerName}...`);

    return firstValueFrom(this.httpService.post(`/containers/${containerName}/stop`))
      .then(() => {
        Logger.log(`Container ${containerName} stopped`);
      })
      .catch((error) => Promise.reject(error));
  }
}
