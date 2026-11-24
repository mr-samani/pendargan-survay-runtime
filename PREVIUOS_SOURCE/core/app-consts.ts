import { isNullOrEmpty } from './helper/null-or-empty.helper';

declare var appCommand: any;
export class ElasticConfig {
  active: boolean = false;
  serverUrl: string = '';
  serviceName: string = 'PendarganVote';
  environment: string = '';
  logLevel: 'trace' | 'debug' | 'info' | 'warn' | 'error' = 'info';

  constructor(data?: ElasticConfig) {
    if (data) {
      this.active = data.active === true && isNullOrEmpty(data.serverUrl) == false;
      this.serverUrl = data.serverUrl;
      this.serviceName = !isNullOrEmpty(data.serviceName) ? data.serviceName : 'PendarganVote';
      this.environment = !isNullOrEmpty(data.environment) ? data.environment : location.host;
      this.logLevel = !isNullOrEmpty(data.logLevel) ? data.logLevel : 'info';
    }
  }
}

export class OtlConfig {
  active: boolean = false;
  url: string = '';
  key: string = '';

  constructor(data?: OtlConfig) {
    if (data) {
      this.active = data.active === true && isNullOrEmpty(data.url) == false;
      this.url = data.url;
      this.key = data.key;
    }
  }
}

export class AppConsts {
  // read from assets/appconfig.json

  static readonly fileServerVariableName = '{FileServerUrl}';
  static readonly pollThemeBaseUrlVariableName = '{PollThemeBaseUrl}';
  static pollThemeBaseUrl: string;

  static apiBaseUrl = '';
  static remoteBaseUrl = '';
  static hybridUrl = '';
  static isMobile: boolean = false;
  static enableHighAccuracyGPS: boolean = false;
  static isKBrowser = typeof appCommand === 'object';
  static fileServerUrl = '';
  static profilePictureUrl = '';

  /** آدرس سایت اصلی (پروژه vote نیست) */
  static baseUiUrl = '';
  static recaptchaSiteKey = '';
  static arCaptchaSiteKey = '';
  static mapStyle = '';
  static useArCaptcha = false;
  static host: HostEnum;
  static loginUrl = '';
  static tenantId?: number;
  /** OpenTelemetry */
  static otl = new OtlConfig();

  static elastic = new ElasticConfig();
  /**
   * کوکی ها برای احراز هویت در سمت کلاینت ذخیره شوند یا خیر
   *
   *  همچنین برای سیگنال آر توکن در url ارسال شود یا خیر
   * - set true for test app in localhost
   * - set false for deploy on server and backend set cookie as httpOnly
   */
  static clientAuth: boolean;

  /**
   * true => use mathjs for evaluation
   * false => use function for evluation
   */
  static expressionCaseSensitive: boolean;

  /**
   * نمایش لوگو پندارگان در فوتر به صورت آیکن
   */
  static minimalLogo = false;

  /**
   * در ادرس شرکت در نظرسنجی
   * قسمت ابتدای ادرس نام بهره بردار می باشد
   * - نکته : برای لینک های قدیمی این قسمت وجود ندارد و هندل شده است
   */
  static tenancyName: string = '';

  static serverApis = {
    widgetPollList: '/PollPublicApis/GetWidgetAllActivePolls',
    tenantPublicPolls: '/PollPublicApis/GetTenantPublicPolls',
    questionerConditionsList: '/PollQuestionQuota/GetAllQuestionerConditions',
    getPollTokenInWidget: '/PollTokensVoting/GetPollTokenForWidget',

    loadPoll: '/FormVoting/GetAllFormDetailForView',

    savePoll: '/Voting/CreateOrEditVoterAndDetailsTask',

    getAllPollQuotaByGuid: '/RegionsAdditions/GetAllPollQuotaByGuid',

    uploadFile: '/TemporaryFileUploadsAdditions/TemporaryQuestionFileUpload',

    getDynamicOptionAutoCompleteList: '/QuestionData/getDynamicOptionAutoCompleteV2',

    getAllocationStatus: '/AllocationStatuses/GetAll',
    changeStatusAllocation: '/RequestForAllocations/ChangeStatusAllocation',

    getPollGuidByToken: '/PollTokensVoting/GetPollGuidByToken',
    GetPollGuidByVoterId: '/PollTokensAddition/GetPollGuidByVoterId',

    voterDetails: '/Voting/GetVoterFormQuestionAndAnswerDetail',

    getVoterForEdit: '/Voting/GetVoterForEdit',

    getVoterDetailByReservedGuid: '/Voting/GetVoterFormQuestionAndAnswerDetailByReservedGuid',
    rejectVoterByReservedGuid: '/Voting/RejectVoterByReservedGuid',
    validateVoterAnswerDetailData: '/VoterAnswerDetailValidation/ValidateVoterAnswerDetailData',

    sendCodeValidateVoterAnswerDetail: '/VoterAnswerDetailValidation/SendCodeValidateVoterAnswerDetail',
    getOrAddPollPaymentTransaction: '/PublicPollPaymentTransaction/GetOrAddPollPaymentTransaction',
    getTransactionInfo: '/PublicPollPaymentTransaction/GetTransactionInfo',
    cancelPollPaymentTransaction: '/PublicPollPaymentTransaction/CancelPollPaymentTransaction',

    // auto save
    addOrUpdateQuestionAnswerDetails: '/Voting/AddOrUpdateQuestionAnswerDetails',
    trackExpression: '/ExpressionTracker/TrackExpression',

    getLatestFilledForms: '/PollTokensVoting/GetLatestFilledForms',
  };

  /*----------------------Xamarin apis------------------------*/
  static pwaUrls = {
    // getPwaSettings: '/api/pwa/GetSettings',
    getPwaLocation: '/api/pwa/GetLocation',
    startPwaAcquiringLocation: '/api/pwa/StartAcquiringLocation',
    pwaGoBack: '/api/pwa/GoBack',
    startPwaVoiceRecorder: '/api/pwa/StartVoiceRecorder',
    stopPwaVoiceRecorder: '/api/pwa/StopVoiceRecorder',
    pwaUploadFile: '/api/pwa/UploadFile',
    pwaDeleteFile: '/api/pwa/DeleteFile',
    errorCodeResolver: '/api/pwa/ErrorCodeResolver',
    voterDetails: '/api/pwa/GetVoterAnswerDetails',
    voterList: '/api/pwa/GetVoters',
    allocationList: '/api/pwa/LoadDemographic',
    fileList: '/api/pwa/GetFiles',
    getLocale: '/api/pwa/GetLocale',
    onIdCodeClick: '/api/pwa/OnIdCodeClick',
    getGisDataAsync: '/api/pwa/GetGisDataAsync',
    openInDeviceMap: '/api/pwa/gis/OpenInDeviceMap',
    openFormPage: '/api/pwa/gis/OpenFormPage',
    getLostData: '/api/pwa/GetLostData',
    resendFile: '/api/pwa/resendFile',
  };
}

/**
 * for change logo
 */
export enum HostEnum {
  Pendargan = 'Pendargan',
  QuestionersClub = 'QuestionersClub',
  HoopoeInsighter = 'HoopoeInsighter',
}

abstract class BaseExceptionCodes {
  // Base codes must start from 10000
  static MobileSpecificCodeStart = 50000;
}
export abstract class MobileSpecificErrorCodes {
  private static Base = BaseExceptionCodes.MobileSpecificCodeStart;
  static AutoTimeDisabled = this.Base + 10;
  static AutoTimeNotFound = this.Base + 12;
}

export abstract class MobileVoterSpecificErrorCodes {
  private static Base = BaseExceptionCodes.MobileSpecificCodeStart;
  static EnteredIdentityNotFound = this.Base + 101;
  static IdCodeRequire = this.Base + 102;
}
