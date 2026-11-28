export class PollTheme {
  version: number = 3;
  // عنوان نظرسنجی
  pollTitle = {
    fontFamily: 'iranSans',
    fontSize: 22,
    color: '#0e143e',
    bold: false,
    italic: false,
    align: 'center',
  };
  // پرسش
  question = {
    fontFamily: 'iranSans',
    fontSize: 14,
    color: '#0e143e',
    bold: false,
    italic: false,
  };
  // پاسخ
  answer = {
    fontFamily: 'iranSans',
    fontSize: 12,
    color: '#00789a',
    bold: false,
    italic: false,
  };
  // دکمه صفحه بعد
  nextButton = {
    backgroundColor: '#1180f3',
    color: '#ffffff',
  };
  // دکمه صفحه قبل
  previousButton = {
    backgroundColor: '#fba117',
    color: '#ffffff',
  };
  // هدر بالای صفحه
  header = {
    showHeaderOnlyFirstPage: false,
    hasHeaderInDesktop: true,
    hasHeaderInMobile: true,
    color: '#000000',
    fontSize: 14,
    backgroundColor: null,
    backgroundPosition: BackgroundPositionEnum.CenterCenter,
    backgroundImage: '',
    backgroundImageThumb: '',
    backgroundRepeat: false,
    backgroundSize: 'cover',
    thumbnail: '',
    height: 160,
    // --
    logoPosition: 'center',
    logoWidth: 100,
    // mobile
    mobileBackgroundColor: '#ffffff',
    mobileBackgroundImage: '',
    mobileBackgroundImageThumb: '',
    mobileBackgroundPosition: BackgroundPositionEnum.CenterCenter,
    mobileBackgroundRepeat: false,
    mobileBackgroundSize: 'cover',
    mobileThumbnail: '',
    mobileHeight: 200,
  };
  // کادر و پس زمینه
  main = {
    backgroundColor: '#f7f7f7',
    backgroundImage: '',
    backgroundImageThumb: '',
    color: '#000000',
    backgroundRepeat: false,
    backgroundSize: 'cover',
    backgroundPosition: BackgroundPositionEnum.CenterCenter,
    fontSize: 12,
    darkLevel: 0,
    opacity: 1,
    variableColor: '#e56a00',
    alertColor: '#ff0000',
    hintColor: '#0077ff',
  };
  // هدر پرسش های ماتریسی
  table = {
    color: '#ffffff',
    backgroundColor: '#1180f3',
  };
  // پروگرس بار
  progressBar = {
    hide: false,
    color: '#1180f3',
    backgroundColor: '#9fceff',
  };
  footer = {
    backgroundColor: '#f7f7f7',
    color: '#000000',
  };

  submitPollSetting = {
    html: ``,
    btnTitle: '',
    dontShowCloseButton: false,
  };
}

export enum BackgroundPositionEnum {
  TopRight = 'top right',
  TopCenter = 'top center',
  TopLeft = 'top left',
  CenterRight = 'center right',
  CenterCenter = 'center center',
  CenterLeft = 'center left',
  BottomRight = 'bottom right',
  BottomCenter = 'bottom center',
  BottomLeft = 'bottom left',
}
