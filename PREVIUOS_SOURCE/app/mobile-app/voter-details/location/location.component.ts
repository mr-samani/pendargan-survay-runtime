import { Component, Input, Inject, DOCUMENT, AfterViewInit, viewChild, ElementRef } from '@angular/core';
import { FormQuestionAnswerDto } from '../models/voter-details';
import { TranslateService } from '@ngx-translate/core';
import { ToastrService } from 'ngx-toastr';
import { AppConsts } from '@core/app-consts';
import { Platform } from '@angular/cdk/platform';
import maplibregl from 'maplibre-gl';

@Component({
  standalone: false,
  selector: 'view-location',
  templateUrl: './location.component.html',
})
export class ViewLocationQuestionComponent implements AfterViewInit {
  @Input() item!: FormQuestionAnswerDto;

  position?: { lat: number; lng: number };

  previewLink = '';

  externalMapViewerLink = 'https://www.google.com/maps/search/?api=1&query=';
  mapContainer = viewChild<ElementRef<HTMLDivElement>>('map');
  map!: maplibregl.Map;
  constructor(
    private translateService: TranslateService,
    private notify: ToastrService,
    @Inject(DOCUMENT) private _document: Document,
    protected platform: Platform,
  ) {}

  ngAfterViewInit(): void {
    const container = this.mapContainer()?.nativeElement;
    if (!container) return;

    const isTouchPlatform = AppConsts.isMobile || this.platform.ANDROID || this.platform.IOS;
    const center = new maplibregl.LngLat(51.378057, 35.701317);
    if (maplibregl.getRTLTextPluginStatus() == 'unavailable') {
      maplibregl.setRTLTextPlugin('assets/mapbox/mapbox-gl-rtl-text.js', true);
    }
    this.map = new maplibregl.Map({
      style: AppConsts.mapStyle,
      attributionControl: false,
      container: container,
      zoom: 18,
      pitch: 0,
      center,
      minZoom: 4,
      maxZoom: 21,
      trackResize: true,
    });
    this.map.on('load', () => {
      const style = this.map.getStyle();
      if (style.glyphs) {
        delete style.glyphs;
        this.map.setStyle(style);
      }
    });

    try {
      if (this.item.voterAnswerDetailDto && this.item.voterAnswerDetailDto.length > 0) {
        const answer = this.item.voterAnswerDetailDto[0].answerDescription?.split(',') || '';
        const latitude = +answer[0];
        const longitude = +answer[1];
        const zoom = answer[2] ? +answer[2] : 18;
        this.position = { lat: latitude, lng: longitude };
        this.previewLink = this.externalMapViewerLink + this.position.lat + ',' + this.position.lng;

        if (this.position) {
          this.map.setCenter(this.position);
          if (zoom) this.map.setZoom(zoom);
          const marker = new maplibregl.Marker({
            draggable: false,
          });
          marker.setLngLat(this.position);
          marker.addTo(this.map);
        }
      }
    } catch (error) {
      console.log('Error in parse location question:', error);
    }
  }

  openLink() {
    if (!this.position) return;
    // "https://neshan.org/maps/@" + this.position.lat + "," + this.position.lng+"",13.0z,0.0p";
    window.open(this.externalMapViewerLink + this.position.lat + ',' + this.position.lng, '_blank');
  }

  copyLink() {
    this.notify.success(this.translateService.instant('CopiedToClipboard'));
  }
}
