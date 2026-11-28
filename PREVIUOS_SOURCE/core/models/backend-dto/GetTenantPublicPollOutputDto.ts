import { DateTime } from 'luxon';

export class GetTenantPublicPollOutputDto {
  polls!: GetTenantPublicPollItemOutputDto[] | undefined;
  tenantTitle!: string | undefined;
  tenantLogoId!: string | undefined;
}
export class GetTenantPublicPollItemOutputDto {
  pollUniqueId!: string;
  pollTitle!: string | undefined;
  pollDescription!: string | undefined;
  pollStartTime!: DateTime | undefined;
  pollEndTime!: DateTime | undefined;
  pollLogoId!: string | undefined;
  pollToken!: string | undefined;
  votingUrl!: string | undefined;

  constructor(data?: GetTenantPublicPollItemOutputDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
