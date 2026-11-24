import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MobileAppComponent } from './mobile-app.component';

const routes: Routes = [
  {
    path: '',
    component: MobileAppComponent,
    children: [
      { path: '', redirectTo: 'poll-list', pathMatch: 'full' },
      {
        path: 'voter-details',
        loadChildren: () => import('./voter-details/voter-details.module').then((m) => m.VoterDetailsModule),
      },
      {
        path: 'voter-list',
        loadChildren: () => import('./voter-list/voter-list.module').then((m) => m.VoterListModule),
      },
      {
        path: 'allocation',
        loadChildren: () => import('./allocation-list/allocation.module').then((m) => m.QuestionerAllocationsModule),
      },
      {
        path: 'questioner-conditions',
        loadChildren: () =>
          import('./questioner-conditions-list/questioner-conditions.module').then((m) => m.QuestionerConditionsModule),
      },
      {
        path: 'file-list',
        loadChildren: () => import('./file-list/file-list.module').then((m) => m.FileListModule),
      },
      {
        path: 'map-routes',
        loadChildren: () => import('./map-routes/map-routes.module').then((m) => m.MapRoutesModule),
      },
      {
        path: 'reform',
        loadComponent: () => import('./re-form/re-form.component').then((c) => c.ReFormComponent),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
