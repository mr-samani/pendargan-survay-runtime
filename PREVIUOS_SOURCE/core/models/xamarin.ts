export class GetLocationOutput {
  longitude!: number;

  latitude!: number;

  accuracyMeters!: number;
}

export class GetLostDataInputDto {
  unexpectedlyClosedId!: string;
  unexpectedlyClosedFilePath?: string;
}
