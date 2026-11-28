import { Coordinate } from './Coordinate';
import { Ordinates } from './Ordinates';

export class CoordinateSequence {
  readonly dimension!: number;
  readonly measures!: number;
  readonly spatial!: number;
  ordinates!: Ordinates;
  readonly hasZ!: boolean;
  readonly hasM!: boolean;
  readonly zOrdinateIndex!: number;
  readonly mOrdinateIndex!: number;
  first!: Coordinate;
  last!: Coordinate;
  readonly count!: number;

  constructor(data?: CoordinateSequence) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
