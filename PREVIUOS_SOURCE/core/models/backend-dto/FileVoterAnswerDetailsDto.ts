export class FileVoterAnswerDetailsDto {
  fileId!: number | undefined;
  fileUniqueId!: string | undefined;
  order!: number | undefined;

  constructor(data?: FileVoterAnswerDetailsDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
