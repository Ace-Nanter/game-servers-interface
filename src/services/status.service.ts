import { DockerService } from './docker.service';
import { Status } from '../models/status.type';
import { Injectable } from '@nestjs/common';
import { RconService } from './rcon.service';

@Injectable()
export class StatusService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService, private readonly rconService: RconService) {}

  async getServerStatus(): Promise<Status> {
    return await this.dockerService.getContainerStatus();
  }

  async getPlayersOnline(): Promise<string[]> {
    return await this.rconService.getOnlinePlayers();
  }
}
