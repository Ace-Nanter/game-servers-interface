import { DockerService } from './docker.service';
import { Status } from '../models/status.type';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StatusService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    return await this.dockerService.getContainerStatus();
  }

  async getPlayersOnline(): Promise<string[]> {
    return ['Ace Nanter'];
  }
}
