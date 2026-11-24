export class GetFormSectionDto {
  formUniqueId!: string;
  title!: string | undefined;
  isPopUp!: boolean;
  uniqueId!: string;
  loopNumber!: number | undefined;
  uniqueIdPerForm: string | undefined;

  constructor(data?: GetFormSectionDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
