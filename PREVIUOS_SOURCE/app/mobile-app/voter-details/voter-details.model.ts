import { GetVoterFullDetail } from '@core/models/backend-dto/voter-details/GetVoterFullDetail';

export class VoterDetailsResponseAndHeader {
  responseHeader!: Record<string, string>;
  result!: GetVoterFullDetail;
}
