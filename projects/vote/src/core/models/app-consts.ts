export abstract class AppConsts {
  static readonly fileServerVariableName = '{FileServerUrl}';
  static readonly pollThemeBaseUrlVariableName = '{PollThemeBaseUrl}';

  public static isMobile: boolean;
  public static remoteBaseUrl: string;
  public static apiBaseUrl: string;
  public static hybridUrl: string;
  public static baseUiUrl: string;
  public static loginUrl: string;
  public static fileServerUrl: string;
  public static pollThemeBaseUrl: string;
  public static profilePictureUrl: string;
  public static recaptchaSiteKey: string;
  public static arCaptchaSiteKey: string;
  public static mapStyle: string;
  public static useArCaptcha: boolean;
  public static host: string;
  public static clientAuth: boolean;
  public static expressionCaseSensitive: boolean;
  public static minimalLogo: boolean;
  public static enableHighAccuracyGPS: boolean;
  public static otl: Otl;
  public static elastic: Elastic;

  public static init(data: AppConsts) {
    if (data) {
      for (var property in data) {
        if (data.hasOwnProperty(property)) (<any>this)[property] = (<any>data)[property];
      }
    }
  }
}

export interface Elastic {
  active: boolean;
  serverUrl: string;
  logLevel: string;
  environment: string;
  serviceName: string;
}

export interface Otl {
  active: boolean;
  url: string;
  key: string;
}
