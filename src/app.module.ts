import { Module } from '@nestjs/common';
import { CommandsController } from './controllers/commands.controller';
import { CommandsService } from './services/commands.service';
import { DockerService } from './services/docker.service';
import { RconService } from './services/rcon.service';
import { StatusController } from './controllers/status.controller';
import { StatusService } from './services/status.service';

@Module({
  imports: [],
  controllers: [StatusController, CommandsController],
  providers: [DockerService, RconService, StatusService, CommandsService],
})
export class AppModule {}
