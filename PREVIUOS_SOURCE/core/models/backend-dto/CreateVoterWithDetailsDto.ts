import { AllocationTypeEnum } from '@app/vote/allocation/allocation.model';
import { CreateVoterDto } from './CreateVoterDto';
import { PartialRegisterForPaymentDto } from './PartialRegisterForPaymentDto';
import { VoterAnswerDetailListAndSectionIdDto } from './VoterAnswerDetailListAndSectionIdDto';

export class CreateVoterWithDetailsDto {
  guid!: string;
  voterDetail!: CreateVoterDto;
  formSections!: VoterAnswerDetailListAndSectionIdDto[] | undefined;
  variablesLastValue!: { [key: string]: string } | undefined;
  allocationType!: AllocationTypeEnum | undefined;
  temporarySave!: boolean;
  acceptPreviousData!: boolean | undefined;
  partialRegisterForPayment!: PartialRegisterForPaymentDto | undefined;

  constructor(data?: CreateVoterWithDetailsDto) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}
