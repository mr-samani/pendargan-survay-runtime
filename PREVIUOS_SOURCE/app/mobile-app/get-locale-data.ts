export abstract class AppLocalData {
  static language: string;
  static data: IAppData;
}

export interface IAppData {
  locale: string;
  userAccountData: string;
  deviceId: string;
}
