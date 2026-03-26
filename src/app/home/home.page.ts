import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MapComponent, NgxMapLibreGLModule } from '@maplibre/ngx-maplibre-gl';
import { LngLat } from 'maplibre-gl';
import { DecimalPipe } from '@angular/common';

import { AlertController, IonicModule, RadioGroupCustomEvent, RangeCustomEvent, SearchbarCustomEvent, ToastController } from '@ionic/angular';
import { treeImgs } from '../../assets/treeId2Img';
import { environment } from '../../environments/environment';
import { TreeService } from '../services/tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import { ShowTreeMarkersComponent } from '../show-tree-markers/show-tree-markers.component';
import { Subscription } from 'rxjs';

type AppMode = 'wander' | 'randomTour';

interface SearchResult {
  tree: TreeInfo;
  displayStr: string;
  selected: boolean;
}

/** Look up the local image path for a tree by its ID. */
function getTreeImagePath(treeId: number): string {
  const res = treeImgs.find((t) => t.treeId === treeId);
  return res ? `assets/tree_imgs/IMG_${res.imgId}.JPG` : '';
}


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    IonicModule,
    NgxMapLibreGLModule,
    ShowTreeMarkersComponent,
    DecimalPipe,
  ]
})
export class HomePage implements AfterViewInit, OnInit, OnDestroy {

  public isTreePictureModalOpen = false;
  public currentTree: TreeInfo | null = null;

  // Debug helpers (safe to leave on; mostly logs in devtools)
  public debugGeo = false;
  public geoUpdateCount = 0;
  public mapDebug = true;
  public mapDebugState: {
    hasMapInstance: boolean;
    hasUserSource: boolean;
    hasUserLayer: boolean;
    hasDebugFixedSource: boolean;
    hasDebugFixedLayer: boolean;
  } = {
    hasMapInstance: false,
    hasUserSource: false,
    hasUserLayer: false,
    hasDebugFixedSource: false,
    hasDebugFixedLayer: false,
  };
  public lastGeo:
    | {
        lng: number;
        lat: number;
        accuracy: number | null;
        heading: number | null;
        timestamp: number;
      }
    | null = null;

  public nearbyTrees: TreeInfo[] = [];
  public userLocationTrees: TreeInfo[] = [];

  // Random Tour state
  public randomTourActive = false;
  public randomTourTrees: TreeInfo[] = [];
  public randomTourCurrentIndex = 0;
  public randomTourCurrentTarget: TreeInfo[] = [];
  private randomTourProximityAlertShown = false;

  // Tour UI state
  public distanceToTarget: number | null = null;
  public showTourArrival = false;
  public arrivalTree: TreeInfo | null = null;

  private defaultLng = -85.5871801;
  private defaultLat = 42.9308076;
  public center: LngLat = new LngLat(this.defaultLng, this.defaultLat);
  heading: [number] | undefined = undefined;
  errorMsg: string = '';
  statusMsg: string = '';

  // Cardinal direction from heading (N, NE, E, SE, S, SW, W, NW)
  get cardinalDirection(): string {
    if (!this.heading) return '--';
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const index = Math.round(this.heading[0] / 45) % 8;
    return directions[index];
  }

  // Heading in degrees for display
  get headingDegrees(): number | null {
    return this.heading ? Math.round(this.heading[0]) : null;
  }

  // Retry mechanism properties
  private geolocationWatchId: number | null = null;
  private retryCount: number = 0;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly MAX_RETRIES: number = 3;
  private readonly TIMEOUT_MS: number = 10000;

  // Compass (device orientation)
  public compassActive = false;
  public compassError: string | null = null;
  private deviceOrientationHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);
  private deviceOrientationAbsoluteHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);

  public showAllTreesChecked = true;
  public searching = false;
  public searchResults: SearchResult[] = [];
  public selectAllSelected = false;
  public showOnlySearchedForTrees = false;

  public howCloseIsClose = 10;
  public mode: AppMode = 'wander';
  public mapStyle: string = `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`;

  @ViewChild('map') map: MapComponent | null = null;

  public treesDb: TreeInfo[] = [];

  private treeSubscription: Subscription | null = null;

  get selectedSearchTrees(): TreeInfo[] {
    return this.searchResults.filter(r => r.selected).map(r => r.tree);
  }

  constructor(
    private toastController: ToastController,
    private treeService: TreeService,
    private alertController: AlertController,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.startGeolocationWatch();
    this.treeSubscription = this.treeService.trees$.subscribe(trees => {
      this.treesDb = trees;
      this.highlightNearbyTrees();
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.treeSubscription?.unsubscribe();
    if (this.geolocationWatchId !== null) {
      window.navigator.geolocation.clearWatch(this.geolocationWatchId);
    }
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
    }
    this.stopCompass();
  }

  private getCompassHeadingFromEvent(event: DeviceOrientationEvent): number | null {
    const raw = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return (raw % 360 + 360) % 360;
    }
    const alpha = event.alpha;
    if (typeof alpha !== 'number' || Number.isNaN(alpha)) return null;
    return (alpha % 360 + 360) % 360;
  }

  private onDeviceOrientation(event: DeviceOrientationEvent): void {
    const headingDeg = this.getCompassHeadingFromEvent(event);
    if (headingDeg !== null) {
      this.heading = [headingDeg];
      this.compassError = null;
      this.cdr.markForCheck();
    }
  }

  private startCompassListeners(): void {
    window.addEventListener('deviceorientation', this.deviceOrientationHandler, true);
    if (typeof (window as any).ondeviceorientationabsolute !== 'undefined') {
      window.addEventListener('deviceorientationabsolute', this.deviceOrientationAbsoluteHandler, true);
    }
    this.compassActive = true;
    this.compassError = null;
  }

  private stopCompass(): void {
    window.removeEventListener('deviceorientation', this.deviceOrientationHandler, true);
    window.removeEventListener('deviceorientationabsolute', this.deviceOrientationAbsoluteHandler, true);
    this.compassActive = false;
    this.compassError = null;
  }

  public async enableCompass(): Promise<void> {
    this.compassError = null;
    const DevOrient = (window as any).DeviceOrientationEvent;
    if (typeof DevOrient?.requestPermission === 'function') {
      try {
        const result = await DevOrient.requestPermission();
        if (result === 'granted') {
          this.startCompassListeners();
        } else {
          this.compassError = 'Compass permission denied';
        }
      } catch (e) {
        this.compassError = e instanceof Error ? e.message : 'Compass permission failed';
      }
      return;
    }
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      this.compassError = 'Compass not supported on this device';
      return;
    }
    this.startCompassListeners();
  }

  public disableCompass(): void {
    this.stopCompass();
  }

  private startGeolocationWatch(): void {
    if (this.geolocationWatchId !== null) {
      window.navigator.geolocation.clearWatch(this.geolocationWatchId);
    }

    this.geolocationWatchId = window.navigator.geolocation.watchPosition(
      (position) => {
        this.retryCount = 0;
        this.geoUpdateCount++;

        this.lastGeo = {
          lng: position.coords.longitude,
          lat: position.coords.latitude,
          accuracy: typeof position.coords.accuracy === 'number' ? position.coords.accuracy : null,
          heading: typeof position.coords.heading === 'number' ? position.coords.heading : null,
          timestamp: position.timestamp
        };

        if (this.debugGeo) {
          // eslint-disable-next-line no-console
          console.debug('[geo] update', {
            count: this.geoUpdateCount,
            lng: this.lastGeo.lng,
            lat: this.lastGeo.lat,
            accuracy: this.lastGeo.accuracy,
            heading: this.lastGeo.heading,
            timestamp: this.lastGeo.timestamp
          });
        }

        if (!this.compassActive && typeof position.coords.heading === 'number') {
          this.heading = [position.coords.heading];
        }
        this.center = new LngLat(position.coords.longitude, position.coords.latitude);

        this.userLocationTrees = [
          {
            treeId: -1,
            lng: position.coords.longitude,
            lat: position.coords.latitude,
            commonName: 'You are here',
            scientificName: '',
            commemoration: '',
          }
        ];

        this.highlightNearbyTrees();
        this.cdr.markForCheck();
      },
      (error) => {
        if (this.debugGeo) {
          // eslint-disable-next-line no-console
          console.warn('[geo] error', { code: error.code, message: error.message });
        }
        this.handleGeolocationError(error);
        this.cdr.markForCheck();
      },
      {
        enableHighAccuracy: true,
        timeout: this.TIMEOUT_MS,
        maximumAge: 0
      }
    );
  }

  private handleGeolocationError(error: GeolocationPositionError): void {
    if (error.code === 1) {
      this.handlePermissionDenied();
    }
    else if (error.code === 2) {
      this.handlePositionUnavailable();
    }
    else if (error.code === 3) {
      this.handleTimeout();
    }
    else {
      this.errorMsg = error.message;
      this.statusMsg = 'Location error occurred';
    }
  }

  private async handlePermissionDenied(): Promise<void> {
    this.errorMsg = 'Permission denied';
    this.statusMsg = 'Location permission denied. Using default location.';

    this.center = new LngLat(this.defaultLng, this.defaultLat);
    this.highlightNearbyTrees();

    const toast = await this.toastController.create({
      message: 'Location permission denied. Using default location.',
      duration: 5000,
      position: 'top',
      color: 'warning',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    await toast.present();
  }

  private async handleTransientError(errorType: 'timeout' | 'unavailable'): Promise<void> {
    this.retryCount++;

    const errorConfig = {
      timeout: {
        errorName: 'Timeout',
        retryMessage: 'Location timeout. Retrying...',
        finalStatusMessage: 'Location timeout. Using default location.',
        toastMessage: 'Location timeout. Using default location.'
      },
      unavailable: {
        errorName: 'Unavailable',
        retryMessage: 'Location unavailable. Retrying...',
        finalStatusMessage: 'Location unavailable. Using default location.',
        toastMessage: 'Location unavailable. Using default location.'
      }
    };

    const config = errorConfig[errorType];

    if (this.retryCount <= this.MAX_RETRIES) {
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000);
      this.statusMsg = `${config.retryMessage} (${this.retryCount}/${this.MAX_RETRIES})`;

      this.retryTimeoutId = setTimeout(() => {
        this.startGeolocationWatch();
      }, retryDelay);
    } else {
      this.errorMsg = config.errorName;
      this.statusMsg = config.finalStatusMessage;
      this.center = new LngLat(this.defaultLng, this.defaultLat);
      this.highlightNearbyTrees();

      const toast = await this.toastController.create({
        message: config.toastMessage,
        duration: 5000,
        position: 'top',
        color: 'warning',
        buttons: [
          {
            text: 'OK',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    }
  }

  private async handleTimeout(): Promise<void> {
    await this.handleTransientError('timeout');
  }

  private async handlePositionUnavailable(): Promise<void> {
    await this.handleTransientError('unavailable');
  }

  ngAfterViewInit() {
    setTimeout(() => {
      const mapInstance = this.map?.mapInstance;

      if (!mapInstance) {
        this.mapDebugState = {
          hasMapInstance: false,
          hasUserSource: false,
          hasUserLayer: false,
          hasDebugFixedSource: false,
          hasDebugFixedLayer: false,
        };
        if (this.mapDebug) {
          // eslint-disable-next-line no-console
          console.warn('[map] no map instance yet');
        }
        return;
      }

      mapInstance.resize();

      const refreshMapDebugState = (tag: string) => {
        const hasUserSource = !!mapInstance.getSource('user-location-source');
        const hasUserLayer = !!mapInstance.getLayer('user-location-layer');
        const hasDebugFixedSource = !!mapInstance.getSource('debug-fixed-source');
        const hasDebugFixedLayer = !!mapInstance.getLayer('debug-fixed-layer');

        this.mapDebugState = {
          hasMapInstance: true,
          hasUserSource,
          hasUserLayer,
          hasDebugFixedSource,
          hasDebugFixedLayer,
        };

        if (this.mapDebug) {
          // eslint-disable-next-line no-console
          console.debug('[map] state', tag, this.mapDebugState);
        }
      };

      mapInstance.once('load', () => {
        const img = new Image();
        img.onload = () => {
          mapInstance.addImage('tracking-dot', img);
        };
        img.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error('[map] Error loading tracking_dot.png:', error);
        };
        img.src = 'assets/tracking_dot.png';
        refreshMapDebugState('load');
      });
      mapInstance.on('styledata', () => refreshMapDebugState('styledata'));
      refreshMapDebugState('afterViewInit');
    }, 0);
  }

  showAllTreesSelected() {
    this.showAllTreesChecked = !this.showAllTreesChecked;
  }

  showMarkersForOnlySelectedTrees() {
    this.showAllTreesChecked = false;
    this.showOnlySearchedForTrees = true;
    this.searching = false;
    setTimeout(() => this.map!.mapInstance.resize(), 0);
  }

  highlightNearbyTrees() {
    const db2Use = this.mode === 'randomTour' ? this.randomTourCurrentTarget : this.treesDb;

    this.nearbyTrees = db2Use
      .filter(tree => this.center.distanceTo(new LngLat(tree.lng, tree.lat)) < this.howCloseIsClose)
      .map(tree => ({ ...tree, localImgFile: getTreeImagePath(tree.treeId) }));

    if (this.randomTourActive && this.randomTourCurrentTarget.length > 0) {
      const target = this.randomTourCurrentTarget[0];
      const distToTarget = this.center.distanceTo(new LngLat(target.lng, target.lat));
      this.distanceToTarget = Math.round(distToTarget);
      if (!this.randomTourProximityAlertShown && distToTarget < this.howCloseIsClose) {
        this.randomTourProximityAlertShown = true;
        this.onReachedRandomTourTree();
      }
    }
  }

  public modeChanged(event: Event) {
    const ev = event as RadioGroupCustomEvent;
    if (this.randomTourActive && ev.detail.value !== 'randomTour') {
      this.endRandomTour();
      return;
    }
    this.mode = ev.detail.value;
  }

  public async startRandomTour(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Random Tour',
      message: 'How many trees would you like to visit?',
      inputs: [
        {
          name: 'count',
          type: 'number',
          placeholder: '1-10',
          min: 1,
          max: 10,
          value: 5,
        }
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Start Tour',
          handler: (data) => {
            const count = Math.min(10, Math.max(1, parseInt(data.count, 10) || 5));
            this.initRandomTour(count);
          }
        }
      ]
    });
    await alert.present();
  }

  private initRandomTour(count: number): void {
    const allTrees = [...this.treesDb];
    const n = allTrees.length;
    const selected: TreeInfo[] = [];

    for (let i = 0; i < count && i < n; i++) {
      const j = i + Math.floor(Math.random() * (n - i));
      [allTrees[i], allTrees[j]] = [allTrees[j], allTrees[i]];
      selected.push(allTrees[i]);
    }

    this.randomTourTrees = selected;
    this.randomTourCurrentIndex = 0;
    this.randomTourActive = true;
    this.randomTourProximityAlertShown = false;
    this.mode = 'randomTour';
    this.updateRandomTourTarget();
  }

  private updateRandomTourTarget(): void {
    if (this.randomTourCurrentIndex < this.randomTourTrees.length) {
      const tree = { ...this.randomTourTrees[this.randomTourCurrentIndex] };
      tree.localImgFile = getTreeImagePath(tree.treeId);
      this.randomTourCurrentTarget = [tree];
    } else {
      this.randomTourCurrentTarget = [];
    }
  }

  private onReachedRandomTourTree(): void {
    const tree = this.randomTourTrees[this.randomTourCurrentIndex];
    this.arrivalTree = {
      ...tree,
      localImgFile: getTreeImagePath(tree.treeId),
    };
    this.showTourArrival = true;
  }

  public dismissArrival(): void {
    this.showTourArrival = false;
    this.arrivalTree = null;
  }

  public advanceAndDismiss(): void {
    this.dismissArrival();
    this.advanceRandomTour();
  }

  private advanceRandomTour(): void {
    this.randomTourCurrentIndex++;
    this.randomTourProximityAlertShown = false;
    this.updateRandomTourTarget();
  }

  public endRandomTour(): void {
    this.randomTourActive = false;
    this.randomTourTrees = [];
    this.randomTourCurrentIndex = 0;
    this.randomTourCurrentTarget = [];
    this.randomTourProximityAlertShown = false;
    this.distanceToTarget = null;
    this.mode = 'wander';
    this.highlightNearbyTrees();
  }

  public distanceToTreeChanged(event: Event) {
    const ev = event as RangeCustomEvent;
    const dist = ev.detail.value as number;
    this.howCloseIsClose = dist;
    this.highlightNearbyTrees();
  }

  handlePopupOpen(tree: TreeInfo) {
    if (!window.navigator || !window.navigator.vibrate) {
      this.statusMsg = 'No haptics';
    } else {
      window.navigator?.vibrate(200);
    }
  }

  handleClickOnPopup(tree: TreeInfo): void {
    this.currentTree = tree;
    this.isTreePictureModalOpen = true;
  }

  searchClicked() {
    this.searchResults = [];
    this.searching = !this.searching;
    this.selectAllSelected = false;
  }

  doSearch(event: Event) {
    const ev = event as SearchbarCustomEvent;
    if (!ev) {
      return;
    }
    const searchTerm = (ev.target!.value ?? '').trim();

    this.searchResults = [];
    this.showOnlySearchedForTrees = false;

    if (searchTerm === '') {
      return;
    }

    const lowerTerm = searchTerm.toLowerCase();
    const matchedTrees = this.treeService.searchTrees(searchTerm);
    this.searchResults = matchedTrees.map(tree => ({
      tree,
      displayStr: this.getSearchDisplayStr(tree, lowerTerm),
      selected: false,
    }));
  }

  private getSearchDisplayStr(tree: TreeInfo, lowerTerm: string): string {
    if (tree.commonName.toLowerCase().includes(lowerTerm)) return tree.commonName;
    if (tree.scientificName.toLowerCase().includes(lowerTerm)) return tree.scientificName;
    return tree.commemoration;
  }

  onSearchCancel() {
    this.searching = false;
    this.searchResults = [];
    this.selectAllSelected = false;
    this.showOnlySearchedForTrees = false;
  }

  searchSelectionChanged(i: number) {
    this.searchResults = this.searchResults.map((r, idx) =>
      idx === i ? { ...r, selected: !r.selected } : r
    );
    this.selectAllSelected = this.searchResults.every(r => r.selected);
  }

  areNoSearchResultsSelected(): boolean {
    return !this.searchResults.some(r => r.selected);
  }

  selectAllCheckboxChanged() {
    this.selectAllSelected = !this.selectAllSelected;
    this.searchResults = this.searchResults.map(r => ({ ...r, selected: this.selectAllSelected }));
  }
}
