import { Status } from './../interfaces/status.interface';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DockerService {
  getContainerStatus(): Status {
    return 'OFFLINE';
  }
}
