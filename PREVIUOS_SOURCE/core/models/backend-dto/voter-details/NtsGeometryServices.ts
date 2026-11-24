import { CoordinateEqualityComparer } from './CoordinateEqualityComparer';
import { CoordinateSequenceFactory } from './CoordinateSequenceFactory';
import { GeometryOverlay } from './GeometryOverlay';
import { PrecisionModel } from './PrecisionModel';

export class NtsGeometryServices {
  geometryOverlay!: GeometryOverlay;
  coordinateEqualityComparer!: CoordinateEqualityComparer;
  readonly defaultSRID!: number;
  defaultCoordinateSequenceFactory!: CoordinateSequenceFactory;
  defaultPrecisionModel!: PrecisionModel;

  constructor(data?: NtsGeometryServices) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
