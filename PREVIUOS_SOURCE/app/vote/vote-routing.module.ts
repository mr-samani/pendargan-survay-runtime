import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VoteComponent } from './vote.component';
import { TenancyNameResolver } from './tenancy-name.resolver';
import { SubmitResultComponent } from './submit-result/submit-result.component';
import { RunVoteLogComponent } from './run-vote-log/run-vote-log.component';

const VOTE_ROUTES: Routes = [
  {
    path: 'run-vote-log',
    component: RunVoteLogComponent,
  },
  // tenancy public page
  { path: 'polls', loadChildren: () => import('../polls/polls.module').then((m) => m.PollsModule) },

  {
    path: 'submit-result',
    component: SubmitResultComponent,
  },
  // Payment callbacks include the tenancy prefix, just like participation links.
  {
    path: 'payment-result',
    loadChildren: () => import('../payment-result/payment-result.module').then((m) => m.PaymentResultModule),
  },
  { path: ':shortLink', component: VoteComponent },
  // this link used in pwa mode => xamarin
  { path: '', component: VoteComponent },

  { path: 'edit-vote/:pollUniqueId/:voterId', component: VoteComponent },
  // بازگشت از صفحه پرداخت
  { path: 'continue-vote/:formReserveGuid', component: VoteComponent },

  // مشاهده پاسخنامه برای شرکت کننده
  {
    path: 'last-voter-details/:shortLink',
    loadChildren: () =>
      import('./last-voter-of-participant/last-voter-of-participant.module').then(
        (m) => m.LastVoterOfParticipantModule,
      ),
  },
  // ثبت فرم جدید هنگام مشاهده نتایج توسط شرکت کننده
  {
    path: 'new-vote/:shortLink/:formGuid',
    component: VoteComponent,
  },
];
/**
 * در ادرس شرکت در نظرسنجی
 * قسمت ابتدای ادرس نام بهره بردار می باشد
 * - نکته : برای لینک های قدیمی این قسمت وجود ندارد و هندل شده است
 */
const TENANCY_ROUTE: Routes = [
  {
    path: ':tenancyName',
    resolve: { tenancyName: TenancyNameResolver },
    children: [...VOTE_ROUTES],
  },
];

@NgModule({
  imports: [RouterModule.forChild([...VOTE_ROUTES, ...TENANCY_ROUTE])],
  exports: [RouterModule],
})
export class VoteRoutingModule {
  constructor() {
    // console.log([...TENANCY_ROUTE, ...VOTE_ROUTES]);
  }
}
