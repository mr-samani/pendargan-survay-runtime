import { Component, forwardRef, Injector, Input, OnInit } from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
  Validators,
} from '@angular/forms';
import { QuestionModel } from '@core/models/QuestionModel';
import { CustomControlBase } from '../custom-control-base.comopnent';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';
import { MapViewModel } from './map-view/MapViewModel';

@Component({
  standalone: false,
  selector: 'location',
  templateUrl: './location.component.html',
  styleUrls: ['./location.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => LocationQuestionComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => LocationQuestionComponent),
      multi: true,
    },
  ],
})
export class LocationQuestionComponent extends CustomControlBase implements ControlValueAccessor, OnInit, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  latitude?: number;
  longitude?: number;
  zoom?: number;
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (this.item.isRequired) {
      this.myControl.setValidators([Validators.required]);
      this.myControl.updateValueAndValidity();
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value) == false) {
      this.myControl.setValue(value);
      let answer: string[] = value.split(/،|,/)?.filter((x2: string) => !isNullOrEmpty(x2)) || [];
      this.latitude = +answer[0];
      this.longitude = +answer[1];
      this.zoom = answer[2] ? +answer[2] : 18;
    } else {
      this.myControl.reset();
    }
  }

  async openLocationSelectorDialog() {
    if (this.disabled) {
      return;
    }
    const { MapViewDialogComponent } = await import('./map-view/map-view.component');

    this.matDialog
      .open(MapViewDialogComponent, {
        data: <MapViewModel>{
          latitude: this.latitude,
          longitude: this.longitude,
          zoom: this.zoom,
        },
        width: '90vw',
        minWidth: '90vw',
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.latitude = result.latitude;
          this.longitude = result.longitude;
          this.zoom = result.zoom;
          this.item.answer = this.latitude + ',' + this.longitude + ',' + this.zoom;
          this.myControl.setValue(this.item.answer);
          this._onChange(this.item.answer);
          // نیاز به اجرای فرمول ها نیست
          this.logicService.changeAnswer(this.item, false);
          // چون فرمول ها اجرا نمی شوند باید دستی پروگرس بار آپدیت شود
          this.logicService.updateProgressBar();
        }
      });
  }
}
