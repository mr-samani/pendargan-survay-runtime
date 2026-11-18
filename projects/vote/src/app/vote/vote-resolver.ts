import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import {
  GetPollGuidByTokenInputDto,
  type GetPollGuidByTokenOutputDto,
} from '@service-proxies/models';
import { PollTokensVotingService } from '@service-proxies/services';
import { map, type Observable } from 'rxjs';

export const VoteResolver: ResolveFn<Observable<GetPollGuidByTokenOutputDto>> = (route, state) => {
  const service = inject(PollTokensVotingService);
  const shortLink = route.params['shortLink'];
  const input = new GetPollGuidByTokenInputDto({
    pollTokenValue: shortLink,
  });
  return service.getPollGuidByToken(input).pipe(map((m) => m));
};
