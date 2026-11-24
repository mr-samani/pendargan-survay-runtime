import { Injectable, Injector } from '@angular/core';
import { VoteSharedService } from './vote-service';
@Injectable()
export class LocalStoreService {
  vote: VoteSharedService;
  constructor(private injector: Injector) {
    this.vote = injector.get(VoteSharedService);
  }
}
