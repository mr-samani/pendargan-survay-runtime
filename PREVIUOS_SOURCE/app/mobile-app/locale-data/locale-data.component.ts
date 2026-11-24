import { Component } from '@angular/core';
import { AppLocalData } from '../get-locale-data';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-locale-data',
  imports: [TranslateModule],
  templateUrl: './locale-data.component.html',
  styleUrl: './locale-data.component.scss',
})
export class LocaleDataComponent {
  data = AppLocalData.data;
}
