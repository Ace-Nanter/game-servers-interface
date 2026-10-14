import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { EnshroudedService } from '../services/enshrouded.service';

@Controller('enshrouded')
export class EnshroudedController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly enshroudedService: EnshroudedService) {}

  @Get('status')
  async getServerStatus(): Promise<string> {
    return await this.enshroudedService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return await this.enshroudedService.getPlayersOnline();
  }

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return this.enshroudedService.startServer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return this.enshroudedService.stopServer();
  }
}
