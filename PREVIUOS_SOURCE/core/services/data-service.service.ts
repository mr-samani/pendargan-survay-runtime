import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpResponse } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { IResponse } from '../models/response';
import { NgxAlertModalService } from 'ngx-alert-modal';
import { TranslateService } from '@ngx-translate/core';

const httpOptions = {
  headers: new HttpHeaders({ 'Content-Type': 'application/json' }),
};
@Injectable({
  providedIn: 'root',
})
export class DataService {
  constructor(
    private http: HttpClient,
    private alert: NgxAlertModalService,
    private translateService: TranslateService,
  ) {}

  /**
   * post data to api Rest
   */
  post<T>(url: string, dataToPost: any = ''): Observable<IResponse<T>> {
    // for test
    // // if (url.includes(AppConsts.serverApis.loadPoll)) {
    // //   return this.http.get<IResponse<T>>('/assets/testdata.json');
    // // }

    // // else if (url.includes(AppConsts.serverApis.getPollGuidByToken)) {
    // //   return this.http.get<IResponse<T>>('/assets/GetPollGuidByToken.json');
    // // }
    return this.http
      .post<IResponse<T>>(url, dataToPost, {
        ...httpOptions,
        observe: 'response', // دریافت کل پاسخ (بدنه + هدرها)
      })
      .pipe(
        map((response: HttpResponse<IResponse<T>>) => {
          const modifiedResponse: IResponse<T> = {
            ...response.body!,
            responseHeader: this.extractHeaders(response.headers),
          };
          return modifiedResponse;
        }),
        catchError((err) => this.handleError(err)),
      );
  }
  private extractHeaders(headers: HttpHeaders): Record<string, string> {
    const headerObj: Record<string, string> = {};
    headers.keys().forEach((key) => {
      headerObj[key] = headers.get(key)!;
    });
    return headerObj;
  }
  /**
   * get data from api Rest
   */
  get(url: string, params: any = ''): Observable<IResponse<any>> {
    return this.http.get<IResponse<any>>(url, { params }).pipe(
      // retry(3), // retry a failed request up to 3 times
      map((response: IResponse<any>) => {
        return response;
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  /**
   * delete from server
   */
  delete(url: string, params: any = ''): Observable<IResponse<any>> {
    const urlParam = url + JSON.stringify(params);
    return this.http.delete<IResponse<any>>(urlParam, httpOptions).pipe(
      // retry(3), // retry a failed request up to 3 times
      map((response: IResponse<any>) => {
        return response;
      }),
      catchError((err) => this.handleError(err)),
    );
  }

  handleError(err: any) {
    let title = err.status;
    let msg = '';
    switch (err.status) {
      case 0:
        msg = this.translateService.instant('CommunicationWithServerIsNotPossible');
        break;
      case 404:
        msg = 'Server address not found!';
        break;
      case 503:
        msg = 'Service unavailabel!';
        break;
      case 400:
        msg = 'Bad request!';
        break;
      default:
        msg = 'Server is inaccessible!';
        break;
    }

    // block request return html text
    if (err.error && err.error.text) {
      msg = err.error.text;
    }

    if (!err.__abp && !err.error?.__abp) {
      this.alert.show({
        title: title != 0 ? title : '',
        html: msg,
        confirmButtonText: this.translateService.instant('Ok'),
      });
      err.messageIsShowed = true;
      return throwError(() => err);
    } else {
      return throwError(() => (err.__abp ? err : err.error));
    }
  }
}
