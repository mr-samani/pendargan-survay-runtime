import { ChangeDetectorRef, Injector, Renderer2, inject, DOCUMENT } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { HasDescriptionTypeEnum } from '@core/models/enums';
import { PollLogoPositionEnum } from '@core/models/backend-dto/PollLogoPositionEnum';
import { FormQuestionTypesEnum } from '@core/models/backend-dto/FormQuestionTypesEnum';
import { FileSelectionTypeEnum } from './elements/file-upload-pwa/file-upload-pwa.model';
import { RatingQuestionTypeEnum } from './elements/rating/rating-question-type.enum';
import { LocalStoreService } from './services/local-store.service';
import { LogicService } from './services/logic.service';
import { VoteSharedService } from './services/vote-service';
import { DescriptionValueTypeEnum } from '@core/models/backend-dto/DescriptionValueTypeEnum';
import { BaseComponent } from '@app/base.component';
import { ILocationService } from '@core/location/location.interface';
import { LOCATION_SERVICE } from '@core/location/location.token';

import { IVoiceRecordService } from '@core/voice-record/voice-record.interface';
import { VOICE_RECORD_SERVICE } from '@core/voice-record/voice-record.token';

export class VoteBaseComponent extends BaseComponent {
  vote: VoteSharedService;

  localStoreService: LocalStoreService;
  logicService: LogicService;
  changeDetectorRef: ChangeDetectorRef;
  renderer: Renderer2;
  matDialog: MatDialog;

  locationService: ILocationService;
  _document: Document;
  voiceRecorderService: IVoiceRecordService;

  constructor(injector: Injector) {
    super(injector);
    this.vote = injector.get(VoteSharedService);
    this.localStoreService = injector.get(LocalStoreService);
    this.logicService = injector.get(LogicService);
    this.changeDetectorRef = injector.get(ChangeDetectorRef);
    this.renderer = injector.get(Renderer2);
    this.matDialog = injector.get(MatDialog);
    this.locationService = injector.get(LOCATION_SERVICE);
    this._document = inject(DOCUMENT);
    this.voiceRecorderService = injector.get(VOICE_RECORD_SERVICE);
  }

  public get FormQuestionTypesEnum(): typeof FormQuestionTypesEnum {
    return FormQuestionTypesEnum;
  }

  public get PollLogoPositionEnum(): typeof PollLogoPositionEnum {
    return PollLogoPositionEnum;
  }
  public get FileSelectionTypeEnum(): typeof FileSelectionTypeEnum {
    return FileSelectionTypeEnum;
  }
  public get HasDescriptionTypeEnum(): typeof HasDescriptionTypeEnum {
    return HasDescriptionTypeEnum;
  }
  public get RatingQuestionTypeEnum(): typeof RatingQuestionTypeEnum {
    return RatingQuestionTypeEnum;
  }

  public get DescriptionValueTypeEnum(): typeof DescriptionValueTypeEnum {
    return DescriptionValueTypeEnum;
  }
  isNumeric(str: any): boolean {
    str = str.toString();
    return (
      !isNaN(str) && // use type coercion to parse the _entirety_ of the string (`parseFloat` alone does not do this)...
      !isNaN(parseFloat(str))
    ); // ...and ensure strings of whitespace fail
  }
}
