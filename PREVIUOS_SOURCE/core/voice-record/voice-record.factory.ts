import { Injector } from '@angular/core';
import { AppConsts } from '@core/app-consts';
import { XamarinVoiceRecorder } from './xamarin-voice-recorder';
import { KBrowserVoiceRecorder } from './kbrowser-voice-recorder';
import { WebVoiceRecorder } from './web-voice-recorder';
declare var appCommand: any;

export function voiceRecordFactory(injector: Injector) {
  // XAmarin mobile
  if (AppConsts.isMobile) {
    return injector.get(XamarinVoiceRecorder);
  }
  // KBrowser
  else if (typeof appCommand === 'object') {
    return injector.get(KBrowserVoiceRecorder);
  }
  // WEB
  else {
    return injector.get(WebVoiceRecorder);
  }
}
