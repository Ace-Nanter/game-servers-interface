import { StatusService } from './../services/status.service';
import { Controller, Get } from '@nestjs/common';

@Controller('status')
export class StatusController {
  // eslint-disable-next-line no-unused-vars
  constructor(private statusService: StatusService) {}

  @Get('server')
  async getServerStatus(): Promise<string> {
    return await this.statusService.getServerStatus();
  }

  @Get('players')
  async getPlayersOnline(): Promise<string[]> {
    return await this.statusService.getPlayersOnline();
  }
}
