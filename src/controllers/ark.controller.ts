import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { ArkService } from '../services/ark.service';

@Controller('ark')
export class ArkController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly arkService: ArkService) {}

  @Get('status')
  async getServerStatus(): Promise<string> {
    return await this.arkService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return await this.arkService.getPlayersOnline();
  }

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return this.arkService.startServer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return this.arkService.stopServer();
  }
}
