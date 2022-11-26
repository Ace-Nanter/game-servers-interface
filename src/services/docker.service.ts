import { HttpService } from '@nestjs/axios/dist';
import { Injectable } from '@nestjs/common';
import { Logger } from '@nestjs/common/services';
import { tap, catchError, firstValueFrom } from 'rxjs';
import { ContainerInfos } from 'src/models/container-infos.interface';
import { Status } from 'src/models/status.type';
import { config } from './../config';

@Injectable()
export class DockerService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly httpService: HttpService) {}

  /**
   * Retrieves container status : started or stopped
   * @returns Container status: 'STARTED', 'STOPPED', 'UNKNOWN'
   */
  async getContainerStatus(): Promise<Status> {
    const { data } = await firstValueFrom(
      this.httpService.get(`/containers/${config.CONTAINER_NAME}/json`).pipe(
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
   */
  async startContainer(): Promise<void> {
    Logger.log('Starting container...');
    try {
      await firstValueFrom(this.httpService.post(`/containers/${config.CONTAINER_NAME}/start`));
    } catch (error) {
      Logger.error(error);
      return Promise.reject(error);
    }

    Logger.log('Container started');

    return Promise.resolve();
  }

  /**
   * Stops container
   */
  async stopContainer(): Promise<void> {
    Logger.log('Stopping container...');
    await firstValueFrom(
      this.httpService.post(`/containers/${config.CONTAINER_NAME}/stop`).pipe(
        tap(() => {
          Logger.log('Container stopped');
        }),
        catchError((error) => {
          Logger.error(error);
          throw 'An error happened!';
        }),
      ),
    );

    return;
  }
}
