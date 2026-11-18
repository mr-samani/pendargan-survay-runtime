import { HttpClient } from '@angular/common/http';
import { inject, isDevMode } from '@angular/core';
import { firstValueFrom } from 'rxjs/internal/firstValueFrom';
import { catchError, tap } from 'rxjs/operators';
import { AppConsts } from './models/app-consts';

export function AppInitializer() {
  const http = inject(HttpClient);

  let url = (isDevMode() ? 'appconfig.json' : 'appconfig.production.json') + '?v=' + Math.random();

  return firstValueFrom(
    http.get(url).pipe(
      tap((data) => {
        AppConsts.init(data);
      }),
      catchError((err) => {
        alert('Can not load appconfig file!');
        return err;
      }),
    ),
  );
}
