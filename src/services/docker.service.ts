import { HttpService } from '@nestjs/axios/dist';
import { Injectable } from '@nestjs/common';
import { catchError, firstValueFrom } from 'rxjs';
import { config } from './../config';

@Injectable()
export class DockerService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly httpService: HttpService) {}

  /**
   * Retrieves container status : started or stopped
   * @returns Container status: 'STARTED' or 'STOPPED'
   */
  async getContainerStatus(): Promise<string> {
    const containerName = config.CONTAINER_NAME;
    const { data } = await firstValueFrom(
      this.httpService.get(`/containers/${containerName}/json`).pipe(
        catchError((error) => {
          console.error(error);
          throw 'An error happened!';
        }),
      ),
    );
    return JSON.stringify(data);
  }

  /**
   * Starts container
   */
  async startContainer(): Promise<void> {
    //     const containerName = config.CONTAINER_NAME;
    //     await
    // this.httpService.get<>(`/containers/${containerName}/json`).pipe(
    // catchError((error) => {
    //   console.error(error.response.data);
    //   throw 'An error happened!';
    // }),
    // ),
  }

  /**
   * Stops container
   */
  async stopContainer(): Promise<void> {
    // const containerName = config.CONTAINER_NAME;
    // const { data } = await firstValueFrom(
    //   this.httpService.get<>(`/containers/${containerName}/json`).pipe(
    //     catchError((error) => {
    //       console.error(error.response.data);
    //       throw 'An error happened!';
    //     }),
    //   ),
    // );
    // return JSON.stringify(data);
  }
}
