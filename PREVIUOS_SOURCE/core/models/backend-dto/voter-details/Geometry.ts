import { GeometryFactory } from './GeometryFactory';
import { Coordinate } from './Coordinate';
import { Envelope } from './Envelope';
import { Dimension } from './Dimension';
import { OgcGeometryType } from './OgcGeometryType';
import { Point } from './Point';
import { PrecisionModel } from './PrecisionModel';

export class Geometry {
  factory!: GeometryFactory;
  userData!: any | undefined;
  srid!: number;
  readonly geometryType!: string | undefined;
  ogcGeometryType!: OgcGeometryType;
  precisionModel!: PrecisionModel;
  coordinate!: Coordinate;
  readonly coordinates!: Coordinate[] | undefined;
  readonly numPoints!: number;
  readonly numGeometries!: number;
  readonly isSimple!: boolean;
  readonly isValid!: boolean;
  readonly isEmpty!: boolean;
  readonly area!: number;
  readonly length!: number;
  centroid!: Point;
  interiorPoint!: Point;
  pointOnSurface!: Point;
  dimension!: Dimension;
  boundary!: Geometry;
  boundaryDimension!: Dimension;
  envelope!: Geometry;
  envelopeInternal!: Envelope;
  readonly isRectangle!: boolean;

  constructor(data?: Geometry) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
