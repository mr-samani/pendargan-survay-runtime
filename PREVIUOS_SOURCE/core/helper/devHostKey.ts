import { NgZone } from '@angular/core';
import { fromEvent } from 'rxjs/internal/observable/fromEvent';
import { filter, take } from 'rxjs/operators';

export function startDevHotkey(ngZone: NgZone) {
    return new Promise((resolve, reject) => {
        // runOutsideAngular: جلوگیری از هر بار trigger شدن CD
        ngZone.runOutsideAngular(() => {
            function isTypingInInput(e: KeyboardEvent): boolean {
                const tgt = e.target as HTMLElement | null;
                if (!tgt) return false;
                const tag = tgt.tagName?.toLowerCase();
                if (tag === 'input' || tag === 'textarea') return true;
                // contenteditable
                if ((tgt as HTMLElement).isContentEditable) return true;
                return false;
            }
            fromEvent<KeyboardEvent>(document, 'keydown')
                .pipe(
                    filter((e) => !isTypingInInput(e)),
                    filter((e) => e.ctrlKey && e.altKey && e.shiftKey && e.code === 'KeyM'),
                    // فقط یکبار   (بدون نیاز به unsubscribe بعدی)
                    take(1),
                )
                .subscribe(() => {
                    ngZone.run(() => {
                        resolve(true);
                    });
                });
        });
    });
}
