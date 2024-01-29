import { DockerService } from './docker.service';
import { Injectable, Logger } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';
import { Rcon } from '../utils/rcon.utils';

@Injectable()
export class MinecraftService implements GameService {
  private rconOptions = {
    tcp: true,
    challenge: false,
  };

  // eslint-disable-next-line no-unused-vars
  constructor(private dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    if (this.isDockerEnabled()) {
      // Docker way
      return this.dockerService.getContainerStatus(config.minecraft.container_name);
    } else {
      return await new Promise<Status>((resolve, reject) => {
        const client = this.getClient();

        client.on('auth', () => client.send('info'));
        client.on('server', () => {
          resolve('STARTED');
          client.disconnect();
        });
        client.on('error', (str: string) => reject(str));

        client.connect();
      });
    }
  }

  async getPlayersOnline(): Promise<string[]> {
    return await new Promise<string[]>((resolve, reject) => {
      const client = this.getClient();

      client.on('auth', function () {
        client.send('list');
      });

      client.on('server', function (response: string) {
        client.disconnect();

        if (!response) {
          reject('An error occured');
        } else {
          const playerList = response.trim().split(':')[1].split(',');

          if (playerList.length === 0) {
            Logger.debug('No players connected');
            resolve([]);
          } else {
            resolve(playerList);
          }
        }
      });

      client.on('error', function (str: string) {
        reject(str);
      });

      client.connect();
    });
  }

  startServer(): Promise<void> {
    if (!this.isDockerEnabled()) return Promise.reject('Error: Docker not enabled for game minecraft!');

    return this.dockerService.startContainer(config.minecraft.container_name);
  }
  stopServer(): Promise<void> {
    // TODO : if not Docker : error. Else broadcast, then save, then Docker stop
    if (!this.isDockerEnabled()) return Promise.reject('Error: Docker not enabled for game minecraft!');

    return this.dockerService.stopContainer(config.minecraft.container_name);
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.minecraft.container_name;
  }

  private getClient(): Rcon {
    return new Rcon(
      config.minecraft.rcon_host,
      config.minecraft.rcon_port,
      config.minecraft.rcon_password,
      this.rconOptions,
    );
  }
}
