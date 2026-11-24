export class Coordinate {
  x!: number;
  y!: number;
  z!: number;
  m!: number;
  coordinateValue!: Coordinate;
  readonly isValid!: boolean;

  constructor(data?: Coordinate) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
