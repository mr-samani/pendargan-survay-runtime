import { Component, Injector } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BaseComponent } from './base.component';

import { SharedModule } from './shared/shared.module';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, SharedModule],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent extends BaseComponent {
  constructor(injector: Injector) {
    super(injector);
  }
}
