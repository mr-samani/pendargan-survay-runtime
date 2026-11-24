export class GisDataInputDto {
  pollUniqueId?: string;
  pollId?: number | string;
  dynamicDataId?: number | string;
  dynamicDataUniqueId?: number | string;
  gisShouldRefresh?: boolean;
  showVoters: boolean = false;
  onlyShowVoters: boolean = false;
}
