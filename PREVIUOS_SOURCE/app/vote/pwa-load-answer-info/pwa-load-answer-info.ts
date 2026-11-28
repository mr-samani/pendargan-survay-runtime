import { DIALOG_DATA } from '@angular/cdk/dialog';
import { Component, DOCUMENT, inject, Inject, OnInit, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { TranslateModule } from '@ngx-translate/core';
@Component({
    standalone: true,
    templateUrl: './pwa-load-answer-info.html',
    styleUrls: ['./pwa-load-answer-info.scss'],
    imports: [MatDialogModule, MatButtonModule, TranslateModule],
})
export class PwaLoadAnswerInfoDialogComponent implements OnInit {
    lang = signal('');
    protected readonly _document = inject(DOCUMENT);
    protected readonly _data = inject(DIALOG_DATA);

    ngOnInit(): void {
        this.lang.set(this._data.lang);
        //fixed bug  remove popover for show ngxalert
        let popover = this._document.querySelector('.cdk-overlay-popover');
        if (popover) popover.removeAttribute('popover');
    }
}
