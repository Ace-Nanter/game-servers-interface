import { Status } from './../interfaces/status.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StatusService {
  getServerStatus(): Status {
    return 'ONLINE';
  }

  getPlayersOnline(): string[] {
    return ['Ace Nanter'];
  }
}
