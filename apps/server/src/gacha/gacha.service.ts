import { Injectable } from '@nestjs/common';

@Injectable()
export class GachaService {
  draw() {
    return { result: null };
  }
}
