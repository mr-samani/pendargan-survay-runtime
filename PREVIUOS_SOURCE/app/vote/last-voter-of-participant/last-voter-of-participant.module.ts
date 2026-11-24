import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LastVoterOfParticipantRoutingModule } from './last-voter-of-participant-routing.module';
import { LastVoterOfParticipantComponent } from './last-voter-of-participant.component';
import { TranslateModule } from '@ngx-translate/core';
import { SharedModule } from '@app/shared/shared.module';
import { HeaderComponent } from '../header/header.component';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { VoterDetailsModule } from '@app/mobile-app/voter-details/voter-details.module';

@NgModule({
  declarations: [LastVoterOfParticipantComponent],
  imports: [
    CommonModule,
    LastVoterOfParticipantRoutingModule,
    VoterDetailsModule,
    TranslateModule,
    SharedModule,
    HeaderComponent,
    MaterialCommonModule,
  ],
})
export class LastVoterOfParticipantModule {}
