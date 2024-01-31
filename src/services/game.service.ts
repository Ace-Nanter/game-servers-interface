import { Status } from 'src/models/status.type';

export interface GameService {
  getServerStatus(): Promise<Status>;
  getPlayersOnline(): Promise<string[]>;
  startServer(): Promise<void>;
  stopServer(): Promise<void>;
}
