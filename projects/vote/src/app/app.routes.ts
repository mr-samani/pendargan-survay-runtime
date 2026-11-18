import { Routes } from '@angular/router';
import { VoteComponent } from './vote/vote.component';
import { VoteResolver } from './vote/vote-resolver';

export const routes: Routes = [
  { path: '', redirectTo: '/mrs/1p6odgkd', pathMatch: 'full' },
  {
    path: ':tenancyName',
    children: [{ path: ':shortLink', component: VoteComponent, resolve: { data: VoteResolver } }],
  },
];
