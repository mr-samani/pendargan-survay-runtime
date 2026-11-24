import {
  Component,
  ElementRef,
  forwardRef,
  HostListener,
  Injector,
  Input,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
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
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { isNullOrEmpty } from '@core/helper/null-or-empty.helper';

@Component({
  standalone: false,
  selector: 'point',
  templateUrl: './point.component.html',
  styleUrls: ['./point.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PointComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PointComponent),
      multi: true,
    },
  ],
})
export class PointComponent extends CustomControlBase implements ControlValueAccessor, OnInit, OnDestroy, Validator {
  @Input() item!: QuestionModel;
  @Input() disabled = false;

  @ViewChild('rangeThumb') rangeThumb!: ElementRef<HTMLDivElement>;
  @ViewChild('slider') rangeInput!: ElementRef<HTMLDivElement>;

  valueChangeSubscription?: Subscription;
  thumbLeft = 0;
  rangeLineWidth = '100%';
  constructor(injector: Injector) {
    super(injector);
  }

  ngOnInit(): void {
    if (isNullOrEmpty(this.item.maximumAnswer)) {
      this.item.maximumAnswer = 100;
    }
    if (isNullOrEmpty(this.item.minimumAnswer)) {
      this.item.minimumAnswer = 0;
    }

    if (this.item.isEditableInitialValue === false && this.item.hasInitialValue === true) {
      this.disabled = true;
      this.myControl.disable();
    } else {
      this.disabled = false;
      this.myControl.enable();
    }
    if (this.item.isRequired) {
      this.myControl.setValidators([
        Validators.required,
        Validators.min(this.item.minimumAnswer!),
        Validators.max(this.item.maximumAnswer!),
      ]);
      this.myControl.updateValueAndValidity();
    }
    if (!this.item.decimalStep) {
      this.item.decimalStep = 1;
    }
    this.valueChangeSubscription = this.myControl.valueChanges
      .pipe(distinctUntilChanged())
      .subscribe((_) => this.onSliderChange());
  }

  ngOnDestroy(): void {
    if (this.valueChangeSubscription) {
      this.valueChangeSubscription.unsubscribe();
    }
  }

  validate(control: AbstractControl<any, any>): ValidationErrors | null {
    this.item.invalid = this.myControl.invalid;
    return this.myControl.errors;
  }

  writeValue(value: any): void {
    if (isNullOrEmpty(value) == false) {
      let min = +(this.item.minimumAnswer ?? 0);
      let max = +(this.item.maximumAnswer ?? 0);
      if (+value < min) this.myControl.setValue(min);
      else if (+value > max) this.myControl.setValue(max);
      else this.myControl.setValue(+value);
    } else {
      this.myControl.reset();
    }
  }

  @HostListener('window:resize')
  onSliderChange() {
    let min = +(this.item.minimumAnswer ?? 0);
    let max = +(this.item.maximumAnswer ?? 0);
    let val = +(this.myControl.value ?? min);
    const thumbPosition = (val - min) / (max - min);
    const space = this.rangeInput.nativeElement.offsetWidth - this.rangeThumb.nativeElement.offsetWidth;
    // Calculate and set the left position of the range thumb
    this.thumbLeft = thumbPosition * space;

    // Set the width of the range line based on the input value
    let w = ((val - min) * 100) / (max - min);
    this.rangeLineWidth = w + '%';

    this.item.answer = val;
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }

  clear() {
    if (this.disabled) {
      return;
    }
    this.myControl.reset();
    this.item.answer = '';
    this.logicService.changeAnswer(this.item);
    this._onChange(this.item.answer);
  }
}
