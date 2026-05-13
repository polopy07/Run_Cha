import { Injectable } from '@nestjs/common';

@Injectable()
export class TerritoryDecayService {
  run() {
    return { processed: 0 };
  }
}
