import { DockerService } from './docker.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';
import { Rcon } from '../utils/rcon.utils';

@Injectable()
export class PalworldService implements GameService {
  private static readonly RCON_OPTIONS = {
    tcp: true,
    challenge: false,
  };

  // eslint-disable-next-line no-unused-vars
  constructor(private dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    if (this.isDockerEnabled()) {
      // Docker way
      return this.dockerService.getContainerStatus(config.palworld.container_name);
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
        client.send('showPlayers');
      });

      client.on('server', function (resp: string) {
        client.disconnect();

        if (!resp) {
          reject(new HttpException('No response received from server', HttpStatus.INTERNAL_SERVER_ERROR));
        } else {
          const playerList = resp.split('\n');

          if (playerList.length === 1) {
            Logger.debug('No players connected');
            resolve([]);
          } else {
            resolve(playerList.slice(1).map((player) => player.split(',')[0]));
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
      return Promise.reject(new HttpException('Error: Docker not enabled for game palworld!', HttpStatus.BAD_REQUEST));
    }

    return this.dockerService.startContainer(config.palworld.container_name);
  }

  async stopServer(): Promise<void> {
    if (!this.isDockerEnabled()) {
      return Promise.reject(new HttpException('Error: Docker not enabled for game palworld!', HttpStatus.BAD_REQUEST));
    }

    const connectedPlayers = await this.getPlayersOnline();
    if (connectedPlayers.length > 0) {
      return Promise.reject(new HttpException('Players are still connected!', HttpStatus.CONFLICT));
    }

    return new Promise((resolve, reject) => {
      const client = this.getClient();
      client.on('auth', function () {
        client.send(`Broadcast Le_serveur_va_s'arreter_dans_une_minute`);
        setTimeout(() => {
          client.send(`Broadcast Le_serveur_va_s'arreter_dans_trente_secondes`);
        }, 30000);

        setTimeout(() => {
          client.send(`Broadcast Le_serveur_va_s'arreter_dans_vingt_secondes`);
        }, 40000);

        setTimeout(() => {
          client.send('Save');
        }, 50000);
      });

      client.on('server', function (resp: string) {
        Logger.log(resp);

        if (resp === 'Complete Save') {
          client.send(`Shutdown 10`);
        }
      });

      client.on('error', function (error: string) {
        Logger.error(error);
        reject(new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      client.on('end', function () {
        Logger.log(`Stopping ${config.palworld.container_name} container`);
        this.dockerService.stopContainer(config.palworld.container_name);
      });

      client.connect();
      resolve();
    });
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.palworld.container_name;
  }

  private getClient(): Rcon {
    return new Rcon(
      config.palworld.rcon_host,
      config.palworld.rcon_port,
      config.palworld.rcon_password,
      PalworldService.RCON_OPTIONS,
    );
  }
}
