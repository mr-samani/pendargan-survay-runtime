import { HttpClient } from '@angular/common/http';
import { AfterViewInit, Component, ElementRef, Injector, viewChild, ViewEncapsulation } from '@angular/core';
import { MobileAppBaseComponent } from '@app/mobile-app/mobile-app-base-component';
import { Datum, RouteDataDto } from './route-dataDto';
import { GisDataInputDto } from './GisDataInputDto';
import { buildPathFromNearestNeighbor } from '../helpers/buildPathFromNearestNeighbor';
import { getCurrentLocationHelper } from '../helpers/get-current-location';
import { AppConsts } from '@core/app-consts';
import { catchError, finalize } from 'rxjs/operators';
import { of } from 'rxjs';
import { IResponse } from '@core/models/response';
import { Platform } from '@angular/cdk/platform';
import maplibregl from 'maplibre-gl';
import { FeatureCollection, Feature, Geometry, GeoJsonProperties } from 'geojson';
import { HeaderService } from '@app/mobile-app/layouts/header.service';

export class FilterDto {
  nameSpace: string = '';
  count?: number;
  hasFilter?: boolean;
  list: { isSelected?: boolean; value: string; count?: number }[] = [];
}

@Component({
  selector: 'app-map-routes',
  templateUrl: './map-routes.component.html',
  styleUrls: ['./map-routes.component.scss'],
  standalone: false,
  encapsulation: ViewEncapsulation.None,
})
export class MapRoutesComponent extends MobileAppBaseComponent implements AfterViewInit {
  map!: maplibregl.Map;
  mapData: FeatureCollection = {
    type: 'FeatureCollection',
    features: [],
  };

  filters: FilterDto[] = [];

  allJsonData: RouteDataDto[] = [];

  loadingCurrentLocation: boolean = false;

  searchedItem?: RouteDataDto;

  /** موقعیت مکانی کاربر */
  userFeature?: Feature;

  /**  در صفحه مسیر یابی یا صفحه فرم های پر شده
   *
   * ### this value get from query params in url (`OnlyShowVoters`)
   * - in routes map is `false` or `null` or `undefined`
   * - in voters  is `true`
   */
  onlyShowVoters = false;
  pollUniqueId = '';
  pollId = '';
  dynamicDataId = '';
  dynamicDataUniqueId = '';
  gisShouldRefresh = false;
  showVoters = false;

  loading = false;
  mapContainer = viewChild<ElementRef<HTMLDivElement>>('map');

  constructor(
    injector: Injector,
    private http: HttpClient,
    private platform: Platform,
  ) {
    super(injector);
    this.languageService.setPageLanguageAndDirection('fa');
    this.route.queryParams.subscribe((q) => {
      this.pollUniqueId = q['pollUniqueId'] || q['PollUniqueId'];
      this.pollId = q['pollId'] || q['PollId'];
      this.dynamicDataId = q['dynamicDataId'] || q['DynamicDataId'];
      this.dynamicDataUniqueId = q['dynamicDataUniqueId'] || q['DynamicDataUniqueId'];
      this.onlyShowVoters = q['onlyShowVoters'] === 'true' || q['OnlyShowVoters'] === 'true';
      this.gisShouldRefresh = q['gisShouldRefresh'] === 'true' || q['GisShouldRefresh'] === 'true';
      this.showVoters = q['showVoters'] === 'true' || q['ShowVoters'] === 'true';
    });
  }

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

      this.loadData();

      // inspect a cluster on click
      this.map.on('click', 'unclustered-point', (e) => {
        try {
          const feature: any = e.features?.[0];
          if (feature) {
            let data: RouteDataDto = feature.properties;
            const d: Datum[] = JSON.parse(feature.properties?.gisData) ?? [];
            let htmlContent: HTMLDivElement = document.createElement('div');
            for (let item of d) {
              const p = document.createElement('p');
              p.innerHTML = `<p><strong>${item.key}</strong>: <span>${item.value}</span></p>`;
              htmlContent.appendChild(p);
            }

            if (!this.onlyShowVoters) {
              const actionDiv = document.createElement('div');
              actionDiv.className = 'd-flex flex-wrap align-items-center justify-content-between gap-3';
              const fillFormBtn = document.createElement('button');
              fillFormBtn.innerText = 'تکمیل پرسشنامه';
              fillFormBtn.className = 'btn btn-primary';
              fillFormBtn.addEventListener('click', () => {
                this.viewForm(data);
              });
              const routeBtn = document.createElement('button');
              routeBtn.innerText = 'مسیر یابی';
              routeBtn.className = 'btn btn-danger';
              routeBtn.onclick = () => {
                this.openInDeviceMap(data);
              };
              actionDiv.appendChild(fillFormBtn);
              actionDiv.appendChild(routeBtn);

              htmlContent.appendChild(actionDiv);
            }

            new maplibregl.Popup()
              .setLngLat(feature.geometry.coordinates as [number, number])
              .setDOMContent(htmlContent)
              .addTo(this.map);
          }
        } catch (error) {
          console.error('Error on open marker popup', error);
        }
      });
    });

    this.map.on('click', 'points-layer', (e) => {
      const feature = e.features?.[0];
      if (feature) {
        new maplibregl.Popup()
          .setLngLat([1.6014465, 32.610253])
          .setHTML(`<strong>${feature.properties?.['name']}</strong>`)
          .addTo(this.map);
      }
    });
  }

  replaceLatinWithFa(expr: any): any {
    if (Array.isArray(expr)) {
      return expr.map((item) => {
        if (Array.isArray(item) && item[0] === 'get' && ['name:latin', 'name:nonlatin', 'name'].includes(item[1])) {
          return ['get', 'name:fa'];
        }
        return this.replaceLatinWithFa(item);
      });
    }
    return expr;
  }

  mapFeature(result: RouteDataDto[]): Feature<Geometry, GeoJsonProperties>[] {
    return result.map((item) => ({
      type: 'Feature',
      properties: item,
      geometry: {
        type: 'Point',
        coordinates: [+item.lon, +item.lat],
      },
    }));
  }
  loadData() {
    this.loading = true;
    const params: GisDataInputDto = {
      onlyShowVoters: this.onlyShowVoters,
      showVoters: this.showVoters,
      dynamicDataId: this.dynamicDataId,
      dynamicDataUniqueId: this.dynamicDataUniqueId,
      gisShouldRefresh: this.gisShouldRefresh,
      pollUniqueId: this.pollUniqueId,
      pollId: this.pollId,
    };
    let url = AppConsts.hybridUrl + AppConsts.pwaUrls.getGisDataAsync;
    this.http
      .post<IResponse<RouteDataDto[]>>(url, params)
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
      .subscribe((response) => {
        if (response && response.result && response.result.length > 0) {
          this.mapData.features = this.mapFeature(response.result);
          this.allJsonData = response.result;
          this.showMarkers();
          this.generateFilterItems(response.result ?? []);
        } else {
          this.alert
            .show({
              title: this.translateService.instant('NoAnyRouteDefined'),
              showConfirmButton: true,
              confirmButtonText: this.translateService.instant('Ok'),
            })
            .then((r) => {
              this.publicService.closeWindow();
            });
        }
      });
  }
  showMarkers() {
    if (this.map.getSource('clustered_points')) {
      (this.map.getSource('clustered_points') as any).setData(this.mapData);
    } else {
      this.map.addSource('clustered_points', {
        type: 'geojson',
        data: this.mapData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
      });
    }
    this.enableClustering();
    this.drawLine();
  }
  ngOnDestroy(): void {
    if (this.map) this.map.remove();
  }

  async enableClustering() {
    if (this.map.getLayer('clusters')) {
      this.map.removeLayer('clusters');
    }
    if (this.map.getLayer('cluster-count')) {
      this.map.removeLayer('cluster-count');
    }
    if (this.map.getLayer('unclustered-point')) {
      this.map.removeLayer('unclustered-point');
    }
    this.map.addLayer({
      id: 'clusters',
      type: 'circle',
      source: 'clustered_points',
      filter: ['has', 'point_count'],
      maxzoom: 14,
      paint: {
        // Use step expressions (https://maplibre.org/maplibre-style-spec/#expressions-step)
        // with three steps to implement three types of circles:
        //   * Blue, 20px circles when point count is less than 100
        //   * Yellow, 30px circles when point count is between 100 and 750
        //   * Pink, 40px circles when point count is greater than or equal to 750
        'circle-color': ['step', ['get', 'point_count'], '#51bbd6', 100, '#f1f075', 750, '#f28cb1'],
        'circle-radius': ['step', ['get', 'point_count'], 20, 100, 30, 750, 40],
      },
    });
    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: 'clustered_points',
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold', 'Open Sans Bold'],
        'text-size': 12,
      },
    });

    if (!this.map.hasImage('custom-marker')) {
      const libreResp = await this.map.loadImage('/assets/images/marker-user.png');
      this.map.addImage('custom-marker', libreResp.data);
    }

    this.map.addLayer({
      id: 'unclustered-point',
      type: 'symbol',
      source: 'clustered_points',
      filter: ['!', ['has', 'point_count']],
      layout: {
        'icon-image': 'custom-marker',
        'icon-size': 0.2,
        'icon-anchor': 'bottom',
        'icon-allow-overlap': true,
      },
    });
  }

  getCurrentLocation() {
    this.loadingCurrentLocation = true;
    getCurrentLocationHelper()
      .finally(() => (this.loadingCurrentLocation = false))
      .then((userCoords) => {
        if (userCoords) {
          this.userFeature = {
            type: 'Feature',
            id: 'userFeature',
            geometry: {
              type: 'Point',
              coordinates: userCoords,
            },
            properties: { name: 'کاربر' },
          };
          const txt = this.translateService.instant('YourCurrentLocation');
          new maplibregl.Marker({ color: 'red' })
            .setLngLat(userCoords)
            .setPopup(new maplibregl.Popup({ className: 'current-location-popup' }).setText(txt))
            .addTo(this.map);
          this.map.setCenter(userCoords);
          this.drawLine();
        }
      })
      .catch((err) => {
        console.warn('Error on get location:', err);
        this.notify.error(this.translateService.instant('NotPossibleToGetYourPosition'));
      });
  }

  drawLine() {
    if (this.onlyShowVoters) {
      return;
    }
    const allFeatures = this.mapData.features;
    if (this.userFeature) {
      let f = allFeatures.findIndex((x) => x.id == 'userFeature');
      if (f > -1) allFeatures.splice(f, 1);
      allFeatures.unshift(this.userFeature);
    }
    const pathFeature = buildPathFromNearestNeighbor(allFeatures);
    if (this.map.getLayer('nearest-lines')) {
      this.map.removeLayer('nearest-lines');
    }
    if (this.map.getSource('lines')) {
      this.map.removeSource('lines');
    }

    this.map.addSource('lines', {
      type: 'geojson',
      data: {
        type: 'FeatureCollection',
        features: [pathFeature],
      },
    });

    this.map.addLayer({
      id: 'nearest-lines',
      type: 'line',
      source: 'lines',
      paint: {
        'line-color': '#ff0000',
        'line-width': 2,
      },
    });

    // try add user location
    if (!this.userFeature) {
      this.getCurrentLocation();
    }
  }

  generateFilterItems(result: RouteDataDto[]) {
    if (this.onlyShowVoters) {
      return;
    }
    this.filters = [];
    for (let item of result) {
      item.filtersNameSpaceWithData?.forEach((el) => {
        let found = this.filters.find((x) => x.nameSpace == el.key);
        if (found == null) {
          found = { nameSpace: el.key, list: [{ value: el.value }] };
          this.filters.push(found);
        }

        if (found.list.find((x) => x.value == el.value) == null) {
          found.list.push({ value: el.value });
        }
      });
    }

    // for show count of each categories
    this.applyFilters();
  }

  filterMarkers(changedOption?: { isSelected?: boolean; value: string }) {
    if (changedOption) changedOption.isSelected = !changedOption.isSelected;

    const filtered = this.applyFilters();

    this.mapData.features = this.mapFeature(filtered);
    this.showMarkers();
  }

  private applyFilters(): RouteDataDto[] {
    // فیلترهای فعال برای فیلتر نهایی روی نقشه
    const activeFilters = this.filters
      .map((f) => ({
        nameSpace: f.nameSpace,
        selectedValues: f.list.filter((x) => x.isSelected).map((x) => x.value),
      }))
      .filter((f) => f.selectedValues.length > 0);

    // فیلتر نهایی برای نمایش روی نقشه (AND بین فیلترها)
    const filtered = this.allJsonData.filter((item) => {
      return activeFilters.every((filter) => {
        return item.filtersNameSpaceWithData.some(
          (f) => f.key === filter.nameSpace && filter.selectedValues.includes(f.value),
        );
      });
    });

    //  تعداد آیتم‌هایی که هر فیلتر به تنهایی match می‌کنه (بدون در نظر گرفتن بقیه فیلترها)
    for (const filter of this.filters) {
      let total = 0;

      for (const option of filter.list) {
        const matched = this.allJsonData.filter((item) =>
          item.filtersNameSpaceWithData.some((f) => f.key === filter.nameSpace && f.value === option.value),
        );

        option['count'] = matched.length;
        if (option.isSelected) {
          total += matched.length;
        }
      }

      filter.count = total;
      filter.hasFilter = filter.list.filter((x) => x.isSelected).length > 0;
    }

    return filtered;
  }

  clearFilter(filter: FilterDto) {
    filter.list.map((x) => (x.isSelected = false));
    this.filterMarkers();
  }

  onChangeFilter() {
    //clear filter
    this.filters.forEach((filter) => {
      filter.count = undefined;
      filter.list.map((x) => (x.isSelected = false));
    });
    if (this.searchedItem) {
      this.mapData.features = this.mapFeature([this.searchedItem]);
    } else {
      this.mapData.features = this.mapFeature(this.allJsonData);
    }
    this.showMarkers();
  }

  openInDeviceMap(data: RouteDataDto) {
    this.mainSpinnerService.showLoading = true;
    const url = AppConsts.hybridUrl + AppConsts.pwaUrls.openInDeviceMap;
    var params = {
      IdCode: data.identificationCode,
      Detail: (data as any).detail,
      Lat: data.lat,
      Lon: data.lon,
    };
    this.http
      .post(url, params)
      .pipe(
        finalize(() => (this.mainSpinnerService.showLoading = false)),
        catchError((error) => {
          this.handleApiError(error, true);
          return of(null);
        }),
      )
      .subscribe((result) => console.log('api result openInDeviceMap', result));
  }

  viewForm(data: RouteDataDto) {
    this.mainSpinnerService.showLoading = true;
    const url = AppConsts.hybridUrl + AppConsts.pwaUrls.openFormPage;
    var params = {
      IdCode: data.identificationCode,
      OpenPollList: data.openPollList,
      PollUniqueId: this.pollUniqueId,
      PollId: this.pollId,
      DynamicDataId: this.dynamicDataId,
      DynamicDataUniqueId: this.dynamicDataUniqueId,
    };
    this.http
      .post(url, params)
      .pipe(
        finalize(() => (this.mainSpinnerService.showLoading = false)),
        catchError((error) => {
          this.handleApiError(error, true);
          return of(null);
        }),
      )
      .subscribe((result) => console.log('api result openFormPage', result));
  }
}
