import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { PalworldService } from './../services/palworld.service';

@Controller('palworld')
export class PalworldController {
  // eslint-disable-next-line no-unused-vars
  constructor(private palworldService: PalworldService) {}

  @Get('status')
  async getServerStatus(): Promise<string> {
    return await this.palworldService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return await this.palworldService.getPlayersOnline();
  }

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return this.palworldService.startServer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return this.palworldService.stopServer();
  }
}
