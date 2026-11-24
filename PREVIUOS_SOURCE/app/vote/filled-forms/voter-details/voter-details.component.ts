import { Component, inject, Inject, Injector, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { VoterDetailsModule } from '@app/mobile-app/voter-details/voter-details.module';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { MaterialCommonModule } from '@core/material-common/material-common.module';
import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';

@Component({
  templateUrl: './voter-details.component.html',
  styleUrls: ['./voter-details.component.scss'],
  imports: [MaterialCommonModule, VoterDetailsModule],
})
export class VoterDetailsDialog extends VoteBaseComponent implements OnInit {
  readonly data = inject<GetVoterFullDetail>(MAT_DIALOG_DATA);

  constructor(
    injector: Injector,
    private dialogRef: MatDialogRef<VoterDetailsDialog>,
  ) {
    super(injector);
  }

  ngOnInit(): void {
    //fixed bug  remove popover for show ngxalert
    let popover = this._document.querySelector('.cdk-overlay-popover');
    if (popover) popover.removeAttribute('popover');
  }
}
