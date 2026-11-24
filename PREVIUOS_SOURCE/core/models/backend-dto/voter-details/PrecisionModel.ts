import { PrecisionModels } from './PrecisionModels';

export class PrecisionModel {
  readonly isFloating!: boolean;
  readonly maximumSignificantDigits!: number;
  scale!: number;
  readonly gridSize!: number;
  precisionModelType!: PrecisionModels;

  constructor(data?: PrecisionModel) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
