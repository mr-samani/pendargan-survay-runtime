import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LastVoterOfParticipantComponent } from './last-voter-of-participant.component';

const routes: Routes = [{ path: '', component: LastVoterOfParticipantComponent }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class LastVoterOfParticipantRoutingModule {}
