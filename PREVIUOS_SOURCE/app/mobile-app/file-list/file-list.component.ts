import { ChangeDetectorRef, Component, Injector, OnInit } from '@angular/core';
import { appAnimation } from '@core/animations/routerTransition';
import { MobileAppBaseComponent } from '../mobile-app-base-component';
import { FileData, GetFilesInputDto } from './file-list.model';
import { MatDialog } from '@angular/material/dialog';
import { FileDetailComponent } from './file-detail/file-detail.component';
import { AppConsts } from '@core/app-consts';
import { catchError, finalize, of } from 'rxjs';
import { EventEnum } from '@core/models/enums';
import { isImage, isVideo } from '@core/helper/file.helper';
import { Title } from '@angular/platform-browser';

@Component({
  standalone: false,
  templateUrl: './file-list.component.html',
  styleUrls: ['./file-list.component.scss'],
  animations: [appAnimation()],
})
export class FileListComponent extends MobileAppBaseComponent implements OnInit {
  fileList: FileData[] = [];

  trackingCode: string;
  pollUniqueId: string;
  pollId: number;
  loading = true;
  constructor(
    injector: Injector,
    private matDialog: MatDialog,
    private ch: ChangeDetectorRef,
    browserTitle: Title,
  ) {
    super(injector);
    this.trackingCode = this.route.snapshot.queryParams['trackingCode'];
    this.pollUniqueId = this.route.snapshot.queryParams['pollUniqueId'];
    this.pollId = this.route.snapshot.queryParams['pollId'];

    const title = this.route.snapshot.queryParams['title'];
    this.headerService.headerTitle = title ?? this.translateService.instant('FileList');

    browserTitle.setTitle(this.headerService.headerTitle + ' - ' + (title ?? ''));
  }

  ngOnInit(): void {
    this.getList();
    app.event.on(EventEnum.PwaReloadListEvent, () => {
      this.getList();
    });
  }

  openFileDetail(item: FileData) {
    this.matDialog.open(FileDetailComponent, {
      data: item,
      width: '80vw',
      direction: this.languageService.direction,
      panelClass: 'custom-dialog',
    });
  }

  getList() {
    this.fileList = [];
    this.loading = true;
    this.mainSpinnerService.showLoading = true;
    const input = new GetFilesInputDto();
    input.pollUniqueId = this.pollUniqueId;
    input.pollId = this.pollId;
    input.trackingCode = this.trackingCode;
    this.dataService
      .post(AppConsts.hybridUrl + AppConsts.pwaUrls.fileList, input)
      .pipe(
        finalize(() => {
          this.loading = false;
          this.mainSpinnerService.showLoading = false;
        }),
        catchError((error) => {
          if (error.status === 404) {
            this.translateService.get('NotFoundAnyItems').subscribe((notfound) => {
              this.alert
                .show({
                  title: '404',
                  text: notfound,
                  confirmButtonText: this.translateService.instant('Ok'),
                })
                .then((result) => {
                  this.publicService.closeWindow();
                });
            });
          } else {
            this.handleApiError(error, true);
          }
          return of(null);
        }),
      )
      .subscribe((response: any) => {
        this.fileList = response && response.result ? response.result : [];
        for (let file of this.fileList) {
          if (file && file.fileName) {
            const ext = file.fileName.split('.').pop()?.toLowerCase() ?? '';
            file.isImage = isImage(ext);
            file.isVideo = isVideo(ext);
          }
        }

        this.ch.detectChanges();
      });
  }
}
