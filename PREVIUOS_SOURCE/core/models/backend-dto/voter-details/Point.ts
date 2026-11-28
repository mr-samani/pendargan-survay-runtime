import { GeometryFactory } from './GeometryFactory';
import { Coordinate } from './Coordinate';
import { Envelope } from './Envelope';
import { Dimension } from './Dimension';
import { Geometry } from './Geometry';
import { OgcGeometryType } from './OgcGeometryType';
import { CoordinateSequence } from './CoordinateSequence';
import { PrecisionModel } from './PrecisionModel';

export class Point {
  factory!: GeometryFactory;
  userData!: any | undefined;
  srid!: number;
  precisionModel!: PrecisionModel;
  readonly numGeometries!: number;
  readonly isSimple!: boolean;
  readonly isValid!: boolean;
  readonly area!: number;
  readonly length!: number;
  centroid!: Point;
  interiorPoint!: Point;
  pointOnSurface!: Point;
  envelope!: Geometry;
  envelopeInternal!: Envelope;
  readonly isRectangle!: boolean;
  coordinateSequence!: CoordinateSequence;
  readonly coordinates!: Coordinate[] | undefined;
  readonly numPoints!: number;
  readonly isEmpty!: boolean;
  dimension!: Dimension;
  boundaryDimension!: Dimension;
  x!: number;
  y!: number;
  coordinate!: Coordinate;
  readonly geometryType!: string | undefined;
  ogcGeometryType!: OgcGeometryType;
  boundary!: Geometry;
  z!: number;
  m!: number;

  constructor(data?: Point) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
