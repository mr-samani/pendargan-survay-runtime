import { CoordinateSequenceFactory } from './CoordinateSequenceFactory';
import { NtsGeometryServices } from './NtsGeometryServices';
import { PrecisionModel } from './PrecisionModel';

export class GeometryFactory {
  precisionModel!: PrecisionModel;
  coordinateSequenceFactory!: CoordinateSequenceFactory;
  readonly srid!: number;
  geometryServices!: NtsGeometryServices;

  constructor(data?: GeometryFactory) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
