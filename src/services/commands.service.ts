import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

@Injectable()
export class CommandsService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  /**
   * Starts container
   */
  async startContainer(): Promise<void> {
    return await this.dockerService.startContainer();
  }

  /**
   * Stops container
   */
  async stopContainer(): Promise<void> {
    return await this.dockerService.stopContainer();
  }
}
