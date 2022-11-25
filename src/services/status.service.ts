import { DockerService } from './docker.service';
import { Status } from './../interfaces/status.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StatusService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    // eslint-disable-next-line no-console
    console.log(await this.dockerService.getContainerStatus());
    return 'STARTED';
  }

  async getPlayersOnline(): Promise<string[]> {
    return ['Ace Nanter'];
  }
}
