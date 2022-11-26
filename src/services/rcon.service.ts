import { Logger } from '@nestjs/common/services';
import { config } from './../config';
import { Injectable } from '@nestjs/common';
import { Rcon } from 'rcon-client/lib';

@Injectable()
export class RconService {
  private rcon: Rcon;

  constructor() {
    try {
      this.rcon = new Rcon({
        host: config.RCON_HOST,
        port: parseInt(config.RCON_PORT),
        password: config.RCON_PASSWORD,
      });

      this.rcon.on('connect', () => Logger.log('connected'));
      this.rcon.on('authenticated', () => Logger.log('authenticated'));
      this.rcon.on('end', () => Logger.log('end'));

      this.rcon.connect();
    } catch (error) {
      Logger.error(error);
    }
  }

  /**
   * Retrieves players connected to server
   * @returns A list of string containing connected players names
   */
  async getOnlinePlayers(): Promise<string[]> {
    const response = await this.rcon.send('list');
    const playerList = response.trim().split(':')[1];
    return Promise.resolve(playerList ? playerList.split(',') : []);
  }

  /**
   * Reconnect rcon client
   */
  async reconnect(): Promise<void> {
    this.rcon.connect();
  }

  /**
   * Disconnect rcon client
   */
  async disconnect(): Promise<void> {
    this.rcon.end();
  }
}
