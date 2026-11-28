import { Coordinate } from './Coordinate';

export class Envelope {
  readonly isNull!: boolean;
  readonly width!: number;
  readonly height!: number;
  readonly diameter!: number;
  readonly minX!: number;
  readonly maxX!: number;
  readonly minY!: number;
  readonly maxY!: number;
  readonly area!: number;
  readonly minExtent!: number;
  readonly maxExtent!: number;
  centre!: Coordinate;

  constructor(data?: Envelope) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
