export class GetAllPollQuotaByGuidInputDto {
  guid!: string;
  parentRegionUniqueId!: string | undefined;

  constructor(data?: GetAllPollQuotaByGuidInputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (this as any)[property] = (data as any)[property];
      }
    }
  }
}
