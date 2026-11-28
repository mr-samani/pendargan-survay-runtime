import { Injectable, Injector } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { HubConnection } from '@microsoft/signalr';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';

@Injectable()
export class SignalRService {
  constructor(
    private notify: ToastrService,
    private translate: TranslateService,
  ) {}

  init(uri: string, callback?: any) {
    let connection = new signalR.HubConnectionBuilder()
      .withUrl(uri, {
        transport: signalR.HttpTransportType.WebSockets,
        withCredentials: false,
        skipNegotiation: true,
      })
      .configureLogging(signalR.LogLevel.Critical)
      .withAutomaticReconnect()
      .build();
    connection.start().then((result) => {
      if (callback) {
        callback(connection);
      }
    });
    connection.onclose((e) => {
      if (e) {
        console.debug('Chat connection closed with error: ' + e);
      } else {
        console.debug('Chat disconnected');
      }
    });
  }

  invoke(connection: HubConnection, event: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      if (this.checkState(connection) === false) {
        reject('SignalR not connected');
      }
      connection
        .invoke(event, data)
        .then((result) => {
          resolve(result);
        })
        .catch((error) => {
          reject(error);
        });
    });
  }

  on(connection: HubConnection, event: string, callback: any) {
    if (this.checkState(connection) === false) {
      this.notify.warning(this.translate.instant('SignalRNotConnectedWarning'));
      return;
    }
    connection.on(event, (data) => {
      if (callback) {
        callback(data);
      }
    });
  }

  checkState(connection: HubConnection): boolean {
    if (connection && connection.state === signalR.HubConnectionState.Connected) {
      return true;
    } else {
      return false;
    }
  }
}
