import { Routes } from '@angular/router';

export const routes: Routes = [
  // { path: '', redirectTo: 'app', pathMatch: 'full' },
  { path: 'vote', loadChildren: () => import('./vote/vote.module').then((m) => m.VoteModule) },
  { path: 'app', loadChildren: () => import('./mobile-app/mobile-app.module').then((m) => m.MobileAppModule) },
  // widget polls
  { path: 'polls', loadChildren: () => import('./widget-polls/widget-polls.module').then((m) => m.WidgetPollsModule) },
  {
    path: 'payment-result',
    loadChildren: () => import('./payment-result/payment-result.module').then((m) => m.PaymentResultModule),
  },

  { path: 't', loadChildren: () => import('./text-number/text-number.module').then((m) => m.TextNumberModule) },

  // { path: '', redirectTo: 'v', pathMatch: 'full' },
  { path: '', loadChildren: () => import('./vote/vote.module').then((m) => m.VoteModule) },

  {
    path: '**',
    loadComponent: () => import('./not-found/not-found.component').then((c) => c.NotFoundComponent),
  },
];
