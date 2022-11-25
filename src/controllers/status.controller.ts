import { StatusService } from './../services/status.service';
import { Controller, Get } from '@nestjs/common';

@Controller('status')
export class StatusController {
  // eslint-disable-next-line no-unused-vars
  constructor(private statusService: StatusService) {}

  @Get('server')
  getServerStatus(): string {
    return this.statusService.getServerStatus();
  }

  @Get('players')
  getPlayersOnline(): string[] {
    return this.statusService.getPlayersOnline();
  }
}
