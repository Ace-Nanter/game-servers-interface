import { HttpModule } from '@nestjs/axios';
import { DynamicModule, Module } from '@nestjs/common';
import config from './config';
import { MinecraftController } from './controllers/minecraft.controller';
import { PalworldController } from './controllers/palworld.controller';
import { DockerService } from './services/docker.service';
import { MinecraftService } from './services/minecraft.service';
import { PalworldService } from './services/palworld.service';
import { ArkController } from './controllers/ark.controller';
import { ArkService } from './services/ark.service';

@Module({
  imports: [
    HttpModule.register({
      baseURL: 'http://localhost',
      socketPath: '/var/run/docker.sock',
    }),
  ],
})
export class AppModule {
  static forRoot(): DynamicModule {
    const controllers = [];
    const providers = [];

    providers.push(DockerService);

    if (config.minecraft.rcon_host && config.minecraft.rcon_port) {
      controllers.push(MinecraftController);
      providers.push(MinecraftService);
    }

    if (config.palworld.rcon_host && config.palworld.rcon_port) {
      controllers.push(PalworldController);
      providers.push(PalworldService);
    }

    if (config.ark.rcon_host && config.ark.rcon_port) {
      controllers.push(ArkController);
      providers.push(ArkService);
    }

    return {
      module: AppModule,
      controllers: controllers,
      providers: providers,
    };
  }
}
