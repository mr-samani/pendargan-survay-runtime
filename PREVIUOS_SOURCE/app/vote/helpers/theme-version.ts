import { FileServerUrlPipe } from '@core/pipe/file-server-url.pipe';
import { PollTheme } from './poll-theme';
import { defaultsDeep } from 'lodash-es';

export abstract class PollThemeVersionChecker {
  /**
   * validate theme
   * @param theme in load is string / in preview live in polltheme in json
   * @returns
   */
  public static checkTheme(theme?: string | PollTheme): PollTheme {
    try {
      if (!theme) {
        return new PollTheme();
      }
      if (typeof theme === 'string') {
        theme = new FileServerUrlPipe().transform(theme);
      } else if (typeof theme === 'object') {
        theme.main.backgroundImage = new FileServerUrlPipe().transform(theme.main.backgroundImage);
        theme.header.backgroundImage = new FileServerUrlPipe().transform(theme.header.backgroundImage);
        theme.header.mobileBackgroundImage = new FileServerUrlPipe().transform(theme.header.mobileBackgroundImage);
      }

      const parsed = typeof theme === 'string' ? JSON.parse(theme) : theme;
      const defaultValues = new PollTheme();
      const data: PollTheme = defaultsDeep(parsed, defaultValues); //{ ...defaultValues, ...parsed };
      return data;
    } catch {
      return new PollTheme();
    }
  }
}
