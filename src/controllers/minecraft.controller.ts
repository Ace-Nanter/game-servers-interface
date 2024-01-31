import { Controller, Get, HttpCode, Post } from '@nestjs/common';
import { MinecraftService } from 'src/services/minecraft.service';

@Controller('minecraft')
export class MinecraftController {
  // eslint-disable-next-line no-unused-vars
  constructor(private readonly minecraftService: MinecraftService) {}

  @Get('status')
  async getServerStatus(): Promise<string> {
    return this.minecraftService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return this.minecraftService.getPlayersOnline();
  }

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return this.minecraftService.startServer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return this.minecraftService.stopServer();
  }
}
