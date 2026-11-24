import { Ordinates } from './Ordinates';

export class CoordinateSequenceFactory {
  ordinates!: Ordinates;

  constructor(data?: CoordinateSequenceFactory) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
