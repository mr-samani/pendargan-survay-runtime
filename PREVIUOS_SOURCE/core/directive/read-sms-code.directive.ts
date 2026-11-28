import { Directive, ElementRef, OnInit } from '@angular/core';

@Directive({
  standalone: false,
  // tslint:disable-next-line: directive-selector
  selector: '[AutoReadSmsCode]',
})
export class ReadSmsCodeDirective implements OnInit {
  constructor(private el: ElementRef) {}

  ngOnInit(): void {
    if ('OTPCredential' in window) {
      const ac = new AbortController();
      navigator.credentials
        .get({
          otp: { transport: ['sms'] },
          signal: ac.signal,
        } as any)
        .then((otp: any) => {
          if (otp) {
            this.el.nativeElement.value = otp.code;
          }
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }
}
