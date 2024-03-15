import { DockerService } from './docker.service';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import config from 'src/config';
import { Status } from 'src/models/status.type';
import { GameService } from './game.service';
import { Rcon } from '../utils/rcon.utils';

@Injectable()
export class ArkService implements GameService {
  private static readonly RCON_OPTIONS = {
    tcp: true,
    challenge: false,
  };

  private static readonly PLAYER_PATTERN = new RegExp('\\d+\\. (.*), \\d+');

  // eslint-disable-next-line no-unused-vars
  constructor(private readonly dockerService: DockerService) {}

  async getServerStatus(): Promise<Status> {
    if (this.isDockerEnabled()) {
      // Docker way
      return this.dockerService.getContainerStatus(config.ark.container_name);
    } else {
      return await new Promise<Status>((resolve) => {
        const client = this.getClient();

        client.on('auth', () => client.send('GetChat'));

        client.on('response', () => {
          resolve('STARTED');
          client.disconnect();
        });

        client.on('error', (e) => {
          Logger.warn(e);
          resolve('STOPPED');
        });

        client.connect();
      });
    }
  }

  async getPlayersOnline(): Promise<string[]> {
    return await new Promise<string[]>((resolve, reject) => {
      const client = this.getClient();

      client.on('auth', () => {
        client.send('ListPlayers');
      });

      client.on('response', (resp: string) => {
        client.disconnect();

        if (!resp) {
          reject(new HttpException('No response received from server', HttpStatus.INTERNAL_SERVER_ERROR));
        } else {
          const playerList = resp
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line);

          if (playerList[0] == 'No Players Connected') {
            Logger.debug('No players connected');
            resolve([]);
          } else {
            resolve(
              playerList.map((player: string) => {
                const match = player.match(ArkService.PLAYER_PATTERN);
                return match ? match[1] : player;
              }),
            );
          }
        }
      });

      client.on('error', (error: string) => {
        Logger.error(error);
        reject(new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR));
      });

      client.connect();
    });
  }

  async startServer(): Promise<void> {
    if (!this.isDockerEnabled()) {
      return Promise.reject(new HttpException('Error: Docker not enabled for game ark!', HttpStatus.BAD_REQUEST));
    }

    return this.dockerService.startContainer(config.ark.container_name);
  }

  async stopServer(): Promise<void> {
    if (!this.isDockerEnabled()) {
      return Promise.reject(new HttpException('Error: Docker not enabled for game ark!', HttpStatus.BAD_REQUEST));
    }

    const connectedPlayers = await this.getPlayersOnline();
    if (connectedPlayers.length > 0) {
      return Promise.reject(new HttpException('Players are still connected!', HttpStatus.CONFLICT));
    }

    Logger.log(`Stopping ${config.ark.container_name} container`);
    return this.dockerService.stopContainer(config.ark.container_name);
  }

  private isDockerEnabled(): boolean {
    return !!config.ENABLE_DOCKER_CLIENT && !!config.ark.container_name;
  }

  private getClient(): Rcon {
    return new Rcon(config.ark.rcon_host, config.ark.rcon_port, config.ark.rcon_password, ArkService.RCON_OPTIONS);
  }
}
