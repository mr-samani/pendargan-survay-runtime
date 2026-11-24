export class GetAllPollRegionCapacityChildByPollId {
  uniqueId!: string;
  title!: string | undefined;
  parentUniqueId!: string | undefined;
  hasChildren!: boolean;
  hasCapacity!: boolean;
  dynamicDataFilterClusterUniqueId!: string;
  remainedPercent!: number | undefined;
  remainedCount!: number | undefined;

  constructor(data?: GetAllPollRegionCapacityChildByPollId) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
