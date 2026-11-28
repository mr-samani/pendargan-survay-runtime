import { Component } from '@angular/core';
import { NotFoundModule } from '@app/shared/no-result-found/not-found.module';
import { LanguageService } from '@core/services/language.service';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-not-found',
  imports: [NotFoundModule, TranslateModule],
  templateUrl: './not-found.component.html',
  styleUrl: './not-found.component.scss',
})
export class NotFoundComponent {
  constructor(languageService: LanguageService, translateService: TranslateService) {
    languageService.setPageLanguageAndDirection(translateService.currentLang);
  }
}
