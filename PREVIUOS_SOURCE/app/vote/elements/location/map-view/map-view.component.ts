import { AfterViewInit, Component, ElementRef, Inject, Injector, viewChild } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { VoteBaseComponent } from '@app/vote/vote-base.component';
import { TranslateModule } from '@ngx-translate/core';
import { MatButtonModule } from '@angular/material/button';
import { MapViewModel } from './MapViewModel';
import { Platform } from '@angular/cdk/platform';
import { AppConsts } from '@core/app-consts';
import maplibregl from 'maplibre-gl';

@Component({
  selector: 'app-map-view',
  templateUrl: './map-view.component.html',
  styleUrls: ['./map-view.component.scss'],
  imports: [MatDialogModule, TranslateModule, MatButtonModule],
})
export class MapViewDialogComponent extends VoteBaseComponent implements AfterViewInit {
  map!: maplibregl.Map;

  latitude?: number;
  longitude?: number;
  zoom?: number;
  geoBtn?: HTMLButtonElement;
  /** تعداد تلاش برای دریافت موقعیت مکانی در صورت تایم اوت شدن */
  retryGetLocationCount = 0;

  mapContainer = viewChild<ElementRef<HTMLDivElement>>('map');
  constructor(
    injector: Injector,
    @Inject(MAT_DIALOG_DATA) data: MapViewModel,
    private matDialogRef: MatDialogRef<MapViewDialogComponent>,
    private platform: Platform,
  ) {
    super(injector);
    this.latitude = data.latitude;
    this.longitude = data.longitude;

    this.zoom = data.zoom ?? 18;
  }

  ngAfterViewInit() {
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
      zoom: 12,
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

    if (this.latitude && this.longitude) {
      const pos = {
        lat: this.latitude,
        lng: this.longitude,
      };
      this.map.setCenter(pos);
      if (this.zoom) this.map.setZoom(this.zoom);

      const marker = new maplibregl.Marker({
        draggable: false,
      });
      marker.setLngLat(pos);
      marker.addTo(this.map);
    }

    this.map.addControl(new maplibregl.NavigationControl());
    this.map.addControl(
      new maplibregl.GeolocateControl({
        showUserLocation: true,
        positionOptions: {
          enableHighAccuracy: true,
          timeout: 5000,
        },
      }),
      'top-left',
    );

    this.map.on('moveend', () => {
      const center = this.map.getBounds()?.getCenter();
      if (center) {
        this.latitude = center.lat;
        this.longitude = center.lng;
        this.zoom = this.map.getZoom();
      }
    });

    this.map.on('locationfound', (event: any) => {
      this.geoBtn!.disabled = false;
      this.geoBtn!.innerHTML = '<img width="24" src="assets/images/location-crosshairs.svg"/>';

      //this.layers = [L.circle(event.latlng, { radius: event.accuracy })];
      this.map.setCenter(event.latlng);
      // var Test = L.popup().setContent('Your Location').setLatLng(event.latlng).addTo(this.map!);
    });
    // this.map.on('locationerror', (event: any): void => {
    //   this.geoBtn!.disabled = false;
    //   this.geoBtn!.innerHTML = '<img width="24" src="assets/images/location-crosshairs.svg"/>';
    //   if (event.code == 1) {
    //     this.alert.show({
    //       title: this.translateService.instant('LocationAccessDenied'),
    //       confirmButtonText: this.translateService.instant('Ok'),
    //     });
    //   } else if (event.code == 2) {
    //     // کروم برای دریافت موقعیت مکانی از
    //     // googleapis.com استفاده می کند که بدلیل تحریم ها در حال حاظر در دسترس نیست
    //     if (event.message.includes('Failed to query location from network service')) {
    //       this.getCurrentLocationFromIP();
    //     } else {
    //       this.alert.show({
    //         title: this.translateService.instant('ErrorOnGetLocation'),
    //         confirmButtonText: this.translateService.instant('Ok'),
    //       });
    //     }
    //   } else if (event.code == 3) {
    //     this.alert
    //       .show({
    //         title: this.translateService.instant('ErrorOnGetLocationTimeOut'),
    //         confirmButtonText: this.translateService.instant('Retry'),
    //         cancelButtonText: this.translateService.instant('Cancel'),
    //         showCancelButton: true,
    //       })
    //       .then((r) => {
    //         if (r.isConfirmed) {
    //           this.retryGetLocationCount++;
    //           if (this.retryGetLocationCount > 2) {
    //             this.getCurrentLocationFromIP();
    //           } else {
    //             this.getCurrentLocation(10000);
    //           }
    //         }
    //       });
    //   }
    // });
  }

  ok() {
    if (this.latitude && this.longitude) {
      this.matDialogRef.close({
        latitude: this.latitude,
        longitude: this.longitude,
        zoom: this.zoom,
      });
    } else {
      const c = this.map?.getCenter();
      this.matDialogRef.close({
        latitude: c?.lat,
        longitude: c?.lng,
        zoom: this.map?.getZoom(),
      });
    }
  }

  // getCurrentLocation(timeout = 5000) {
  //   this.geoBtn!.disabled = true;
  //   this.geoBtn!.innerHTML = '<img width="24" src="assets/images/loading-gps.svg"/>';
  //   if (!AppConsts.isMobile) {
  //     this.map?.locate({
  //       setView: true,
  //       enableHighAccuracy: true,
  //       timeout: timeout,
  //       watch: false,
  //     });
  //   } else {
  //     this.dataService
  //       .post<GetLocationOutput>(AppConsts.hybridUrl + AppConsts.pwaUrls.getPwaLocation, {
  //         requiredAccuracyMeters: 10,
  //         hasForcePresentLocation: false,
  //         forcePresentLocationRange: false,
  //       })
  //       .pipe(
  //         finalize(() => {
  //           this.geoBtn!.disabled = false;
  //           this.geoBtn!.innerHTML = '<img width="24" src="assets/images/location-crosshairs.svg"/>';
  //         }),
  //       )
  //       .subscribe((resp) => {
  //         let result = resp.result;
  //         const position = L.latLng(result.latitude, result.longitude);
  //         this.layers = [L.circle(position, { radius: result.accuracyMeters })];
  //         this.map?.setView(position);
  //       });
  //   }
  // }

  /**
   * در صورتی که امکان دریافت موقعیت مکانی از مرورگر وجود نداشته باشد
   * از طریق IP موقعیت مکانی حدودی را دریافت می کند
   */
  // getCurrentLocationFromIP() {
  //   this.geoBtn!.disabled = true;
  //   this.geoBtn!.innerHTML = '<img width="24" src="assets/images/loading-gps.svg"/>';
  //   this.dataService
  //     .get('https://api.ipgeolocation.io/ipgeo?apiKey=fef0dd31058c46399a99d4f277bb40b8', {})
  //     .pipe(
  //       finalize(() => {
  //         this.geoBtn!.disabled = false;
  //         this.geoBtn!.innerHTML = '<img width="24" src="assets/images/location-crosshairs.svg"/>';
  //       }),
  //     )
  //     .subscribe({
  //       next: (resp) => {
  //         const result: IPGeoLocationOutput = resp as any;
  //         const position = L.latLng(+result.latitude, +result.longitude);
  //         this.layers = [L.circle(position, { radius: 10 })];
  //         this.map?.setView(position);
  //       },
  //       error: (er) => {
  //         this.alert.show({
  //           title: this.translateService.instant('ErrorOnGetLocation'),
  //           confirmButtonText: this.translateService.instant('Ok'),
  //         });
  //       },
  //     });
  // }
}
