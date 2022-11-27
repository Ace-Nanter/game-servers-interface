import { RconService } from './rcon.service';
import { Injectable } from '@nestjs/common';
import { DockerService } from './docker.service';

@Injectable()
export class CommandsService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService, private readonly rconService: RconService) {}

  /**
   * Starts container
   */
  async startContainer(): Promise<void> {
    setTimeout(() => {
      this.rconService.reconnect();
    }, 120000);
    return await this.dockerService.startContainer();
  }

  /**
   * Stops container
   */
  async stopContainer(): Promise<void> {
    await this.rconService.disconnect();
    return await this.dockerService.stopContainer();
  }
}
