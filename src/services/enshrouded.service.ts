import { DockerService } from './docker.service';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';

/**
 * Enshrouded server support.
 *
 * An Enshrouded dedicated server exposes no RCON and no status/query protocol,
 * so every available operation (status, start, stop) goes through the Docker
 * socket. The online player list simply cannot be retrieved.
 */
@Injectable()
export class EnshroudedService implements GameService {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    this.assertDockerEnabled();

    return this.dockerService.getContainerStatus(config.enshrouded.container_name);
  }

  /**
   * Not supported: an Enshrouded server does not expose any player list API.
   * Fails explicitly with 501 instead of returning a misleading empty list.
   */
  async getPlayersOnline(): Promise<string[]> {
    throw new HttpException(
      'Enshrouded servers expose no player list API (no RCON support)',
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  async startServer(): Promise<void> {
    this.assertDockerEnabled();

    return this.dockerService.startContainer(config.enshrouded.container_name);
  }

  async stopServer(): Promise<void> {
    this.assertDockerEnabled();

    // No RCON: the server saves its world on shutdown, so DockerService waits
    // for `stop_grace_period` before killing the container.
    return this.dockerService.stopContainer(config.enshrouded.container_name);
  }

  private assertDockerEnabled(): void {
    if (!this.isDockerEnabled()) {
      throw new HttpException('Error: Docker not enabled for game enshrouded!', HttpStatus.BAD_REQUEST);
    }
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.enshrouded.container_name;
  }
}
