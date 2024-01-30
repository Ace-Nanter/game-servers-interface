import { DockerService } from './docker.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';
import { Rcon } from '../utils/rcon.utils';

@Injectable()
export class MinecraftService implements GameService {
  private static readonly RCON_OPTIONS = {
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
      return await new Promise<Status>((resolve) => {
        const client = this.getClient();

        client.on('auth', () => client.send('info'));

        client.on('server', () => {
          resolve('STARTED');
          client.disconnect();
        });

        client.on('error', () => {
          resolve('STOPPED');
        });

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
          reject(new HttpException('No response received from server', HttpStatus.INTERNAL_SERVER_ERROR));
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

      client.on('error', function (error: string) {
        reject(new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      client.connect();
    });
  }

  async startServer(): Promise<void> {
    if (!this.isDockerEnabled()) {
      return Promise.reject(new HttpException('Error: Docker not enabled for game minecraft!', HttpStatus.BAD_REQUEST));
    }

    return this.dockerService.startContainer(config.minecraft.container_name);
  }

  async stopServer(): Promise<void> {
    if (!this.isDockerEnabled()) {
      return Promise.reject(new HttpException('Error: Docker not enabled for game minecraft!', HttpStatus.BAD_REQUEST));
    }

    const connectedPlayers = await this.getPlayersOnline();
    if (connectedPlayers.length > 0) {
      return Promise.reject(new HttpException('Players are still connected!', HttpStatus.CONFLICT));
    }

    return new Promise((resolve, reject) => {
      const client = this.getClient();
      client.on('auth', function () {
        client.send(`say Le serveur va s'arrêter dans une minute`);
        setTimeout(() => {
          client.send(`say Le serveur va s'arrêter dans 30 secondes`);
        }, 30000);

        setTimeout(() => {
          client.send(`say Le serveur va s'arrêter dans 10 secondes`);
        }, 50000);

        setTimeout(() => {
          client.send('save-all');
        }, 60000);
      });

      client.on('server', function (resp: string) {
        Logger.log(resp);

        if (resp === 'Complete Save') {
          client.send(`stop`);
        }
      });

      client.on('error', function (error: string) {
        Logger.error(error);
        reject(new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      client.on('end', function () {
        Logger.log(`Stopping ${config.minecraft.container_name} container`);
        this.dockerService.stopContainer(config.minecraft.container_name);
      });

      client.connect();
      resolve();
    });
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.minecraft.container_name;
  }

  private getClient(): Rcon {
    return new Rcon(
      config.minecraft.rcon_host,
      config.minecraft.rcon_port,
      config.minecraft.rcon_password,
      MinecraftService.RCON_OPTIONS,
    );
  }
}
