import { Controller, HttpCode, Post } from '@nestjs/common';
import { CommandsService } from 'src/services/commands.service';

@Controller('commands')
export class CommandsController {
  // eslint-disable-next-line no-unused-vars
  constructor(private commandsService: CommandsService) {}

  @Post('start')
  @HttpCode(204)
  async startContainer(): Promise<void> {
    return await this.commandsService.startContainer();
  }

  @Post('stop')
  @HttpCode(204)
  async stopContainer(): Promise<void> {
    return await this.commandsService.stopContainer();
  }
}
