import { AfterViewInit, ChangeDetectionStrategy, ChangeDetectorRef, Component, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MapComponent, NgxMapLibreGLModule } from '@maplibre/ngx-maplibre-gl';
import { AttributionControl, LngLat } from 'maplibre-gl';
import { DecimalPipe } from '@angular/common';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import packageJson from '../../../package.json';

import { AlertController, IonicModule, RadioGroupCustomEvent, RangeCustomEvent, SearchbarCustomEvent, ToastController } from '@ionic/angular';
import { treeImgs } from '../../assets/treeId2Img';
import { environment } from '../../environments/environment';
import { TreeService } from '../services/tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import { ShowTreeMarkersComponent } from '../show-tree-markers/show-tree-markers.component';
import { Subscription } from 'rxjs';
import { speelmanTour, SpeelmanTree } from '../../assets/speelman-tour';
import { loadHomePreferences, saveHomePreferences } from './home-preferences.storage';

type AppMode = 'wander' | 'randomTour' | 'speelmanTour';

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


/**
 * Main map experience for browsing campus trees.
 *
 * This page coordinates geolocation, MapLibre marker layers, tree search,
 * nearby-tree detection, and the random/Speelman tour flows. Persistence and
 * tree search stay in TreeService; this class owns view state and map behavior.
 */
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
  public readonly appVersion = packageJson.version;

  private readonly toastController = inject(ToastController);
  private readonly treeService = inject(TreeService);
  private readonly alertController = inject(AlertController);
  private readonly cdr = inject(ChangeDetectorRef);

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
  public selectedPopupTree: TreeInfo | null = null;
  public userLocationTrees: TreeInfo[] = [];
  public userLocationGeoJson: {
    type: 'FeatureCollection';
    features: Array<{
      type: 'Feature';
      geometry: {
        type: 'Point';
        coordinates: [number, number];
      };
      properties: {
        treeId: number;
        label: string;
      };
    }>;
  } = {
      type: 'FeatureCollection',
      features: [],
    };

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
  public arrivalStory: string | null = null;
  public arrivalLocation: string | null = null;
  public testTourActive = false;

  // Speelman tour state
  public speelmanTourData: SpeelmanTree[] = speelmanTour;

  private defaultLng = -85.5871801;
  private defaultLat = 42.9308076;
  public center: LngLat = new LngLat(this.defaultLng, this.defaultLat);
  public mapCenter: LngLat = new LngLat(this.defaultLng, this.defaultLat);
  public followUserLocation = true;
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
  public compassHeadingActive = false;  // whether to apply compass bearing to map
  public compassError: string | null = null;
  private deviceOrientationHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);
  private deviceOrientationAbsoluteHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);

  public showAllTreesChecked = true;
  public searching = false;
  public searchResults: SearchResult[] = [];
  public selectAllSelected = false;
  public showOnlySearchedForTrees = false;
  public vibrateWhenNearTree = false;
  private nearbyTreeIdsInRange = new Set<number>();

  public howCloseIsClose = 10;
  public mode: AppMode = 'wander';
  public mapStyle: string = `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`;
  private mapLoaded = false;
  private startupRecenterDone = false;
  private mapPointerPauseHandler: (() => void) | null = null;
  private mapCanvasElement: HTMLCanvasElement | null = null;
  private suppressManualPauseUntil = 0;
  private programmaticRecenterActive = false;

  @ViewChild('map') map: MapComponent | null = null;

  public treesDb: TreeInfo[] = [];

  private treeSubscription: Subscription | null = null;
  private shouldRestoreCompass = false;

  get selectedSearchTrees(): TreeInfo[] {
    return this.searchResults.filter(r => r.selected).map(r => r.tree);
  }

  ngOnInit(): void {
    const preferences = loadHomePreferences();
    this.howCloseIsClose = preferences.proximityDistance;
    this.vibrateWhenNearTree = preferences.vibrateWhenNearTree;
    this.shouldRestoreCompass = preferences.compassEnabled;

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
    if (this.mapCanvasElement && this.mapPointerPauseHandler) {
      this.mapCanvasElement.removeEventListener('touchstart', this.mapPointerPauseHandler);
      this.mapCanvasElement.removeEventListener('mousedown', this.mapPointerPauseHandler);
    }
    this.stopCompass();
  }

  private getCompassHeadingFromEvent(event: DeviceOrientationEvent): number | null {
    // webkitCompassHeading is iOS Safari's proprietary property — clockwise degrees from
    // magnetic north. The standard alpha value works on Android but measures the opposite
    // rotation axis, so prefer the webkit value when available to keep both platforms consistent.
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
      if (this.compassHeadingActive && this.map?.mapInstance) {
        this.map.mapInstance.setBearing(headingDeg);
      }
      this.compassError = null;
      this.cdr.markForCheck();
    }
  }

  get isCompassDirectionPaused(): boolean {
    return this.compassActive && !this.followUserLocation && !this.compassHeadingActive;
  }

  private pauseCompassDirectionForManualNavigation(): void {
    if (this.programmaticRecenterActive || Date.now() < this.suppressManualPauseUntil) {
      return;
    }
    this.followUserLocation = false;
    this.compassHeadingActive = false;
    this.cdr.markForCheck();
  }

  private tryStartupRecenter(): void {
    // Wait for map + first location update so initial blue-dot placement is centered.
    if (!this.mapLoaded || this.startupRecenterDone || !this.lastGeo) return;
    this.startupRecenterDone = true;
    this.recenterToUserLocation();
  }

  private startCompassListeners(): void {
    window.addEventListener('deviceorientation', this.deviceOrientationHandler, true);
    // deviceorientationabsolute is a non-standard Chrome/Android event that provides
    // geographically absolute bearing instead of relative-to-initial. Only wire it up
    // when the browser exposes the event to avoid a silent no-op listener.
    if (typeof (window as any).ondeviceorientationabsolute !== 'undefined') {
      window.addEventListener('deviceorientationabsolute', this.deviceOrientationAbsoluteHandler, true);
    }
    this.compassActive = true;
    this.compassHeadingActive = true;
    this.compassError = null;
  }

  private stopCompass(): void {
    window.removeEventListener('deviceorientation', this.deviceOrientationHandler, true);
    window.removeEventListener('deviceorientationabsolute', this.deviceOrientationAbsoluteHandler, true);
    this.compassActive = false;
    this.compassHeadingActive = false;
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
        this.persistPreferences();
      } catch (e) {
        this.compassError = e instanceof Error ? e.message : 'Compass permission failed';
        this.persistPreferences();
      }
      return;
    }
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      this.compassError = 'Compass not supported on this device';
      this.persistPreferences();
      return;
    }
    this.startCompassListeners();
    this.persistPreferences();
  }

  public disableCompass(): void {
    this.stopCompass();
    this.persistPreferences();
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
        if (this.followUserLocation) {
          this.mapCenter = new LngLat(position.coords.longitude, position.coords.latitude);
        }

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
        this.userLocationGeoJson = {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [position.coords.longitude, position.coords.latitude],
              },
              properties: {
                treeId: -1,
                label: 'You are here',
              },
            },
          ],
        };

        this.highlightNearbyTrees();
        this.tryStartupRecenter();
        this.cdr.markForCheck();
      },
      (error) => {
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
    } else if (error.code === 2) {
      this.handleTransientError('unavailable');
    } else if (error.code === 3) {
      this.handleTransientError('timeout');
    } else {
      this.errorMsg = error.message;
      this.statusMsg = 'Location error occurred';
    }
  }

  private async showWarningToast(message: string): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 5000,
      position: 'top',
      color: 'warning',
      buttons: [{ text: 'OK', role: 'cancel' }]
    });
    await toast.present();
  }

  private async handlePermissionDenied(): Promise<void> {
    this.errorMsg = 'Permission denied';
    this.statusMsg = 'Location permission denied. Using default location.';

    this.center = new LngLat(this.defaultLng, this.defaultLat);
    this.mapCenter = new LngLat(this.defaultLng, this.defaultLat);
    this.highlightNearbyTrees();
    await this.showWarningToast('Location permission denied. Using default location.');
  }

  private async handleTransientError(errorType: 'timeout' | 'unavailable'): Promise<void> {
    this.retryCount++;

    const errorConfig = {
      timeout: {
        errorName: 'Timeout',
        retryMessage: 'Location timeout. Retrying...',
        finalMessage: 'Location timeout. Using default location.',
      },
      unavailable: {
        errorName: 'Unavailable',
        retryMessage: 'Location unavailable. Retrying...',
        finalMessage: 'Location unavailable. Using default location.',
      }
    };

    const config = errorConfig[errorType];

    if (this.retryCount <= this.MAX_RETRIES) {
      // Exponential backoff: 1s → 2s → 4s, capped at 5s so the user isn't waiting too long.
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000);
      this.statusMsg = `${config.retryMessage} (${this.retryCount}/${this.MAX_RETRIES})`;

      this.retryTimeoutId = setTimeout(() => {
        this.startGeolocationWatch();
      }, retryDelay);
    } else {
      this.errorMsg = config.errorName;
      this.statusMsg = config.finalMessage;
      this.center = new LngLat(this.defaultLng, this.defaultLat);
      this.mapCenter = new LngLat(this.defaultLng, this.defaultLat);
      this.highlightNearbyTrees();
      await this.showWarningToast(config.finalMessage);
    }
  }

  ngAfterViewInit() {
    if (this.shouldRestoreCompass) {
      void this.enableCompass();
    }

    // Defer one tick so MapLibre has time to initialize its canvas after Angular
    // renders the template. The mapInstance is null synchronously in ngAfterViewInit.
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

      // Detect user-initiated map movement to stop auto-follow. This must be
      // registered as soon as mapInstance exists so drag/recenter behavior is
      // consistent even while compass updates are flowing.
      mapInstance.on('movestart', (e: any) => {
        if (e.originalEvent) {
          this.pauseCompassDirectionForManualNavigation();
        }
      });
      mapInstance.on('dragstart', (e: any) => {
        if (e.originalEvent) {
          this.pauseCompassDirectionForManualNavigation();
        }
      });
      // Pause compass-follow immediately on first finger/mouse contact so
      // the map does not "fight" the initial drag gesture in compass mode.
      this.mapCanvasElement = mapInstance.getCanvas();
      this.mapPointerPauseHandler = () => {
        if (this.compassActive && (this.followUserLocation || this.compassHeadingActive)) {
          this.pauseCompassDirectionForManualNavigation();
        }
      };
      this.mapCanvasElement.addEventListener('touchstart', this.mapPointerPauseHandler, { passive: true });
      this.mapCanvasElement.addEventListener('mousedown', this.mapPointerPauseHandler, { passive: true });

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
        this.mapLoaded = true;
        const img = new Image();
        img.onload = () => {
          mapInstance.addImage('tracking-dot', img);
        };
        img.onerror = (error) => {
          // eslint-disable-next-line no-console
          console.error('[map] Error loading tracking_dot.png:', error);
        };
        img.src = 'assets/tracking_dot.png';
        mapInstance.addControl(new AttributionControl({ compact: true }));
        refreshMapDebugState('load');
        this.tryStartupRecenter();

        // Show popup when a tree marker is tapped; dismiss on empty area tap
        mapInstance.on('click', (e: any) => {
          const layersToCheck: string[] = [];
          if (mapInstance.getLayer('nearby-trees-layer')) layersToCheck.push('nearby-trees-layer');
          if (mapInstance.getLayer('all-trees-layer')) layersToCheck.push('all-trees-layer');
          if (mapInstance.getLayer('random-tour-target-layer')) layersToCheck.push('random-tour-target-layer');
          if (mapInstance.getLayer('search-trees-layer')) layersToCheck.push('search-trees-layer');

          if (layersToCheck.length > 0) {
            const pointerType = (e?.originalEvent as any)?.pointerType;
            const isTouchInteraction = pointerType === 'touch' || !!(e?.originalEvent as any)?.touches;
            const hitTolerancePx = isTouchInteraction ? 24 : 12;
            const queryBox: [[number, number], [number, number]] = [
              [e.point.x - hitTolerancePx, e.point.y - hitTolerancePx],
              [e.point.x + hitTolerancePx, e.point.y + hitTolerancePx],
            ];
            const features = mapInstance.queryRenderedFeatures(queryBox, { layers: layersToCheck });
            if (features.length > 0) {
              // Pick the nearest marker within the tolerance box so nearby
              // overlapping markers behave predictably.
              const nearestFeature = features.reduce((best: any, candidate: any) => {
                const [candidateLng, candidateLat] = (candidate.geometry as any).coordinates as [number, number];
                const candidatePoint = mapInstance.project([candidateLng, candidateLat]);
                const candidateDistSq = ((candidatePoint.x - e.point.x) ** 2) + ((candidatePoint.y - e.point.y) ** 2);

                if (!best || candidateDistSq < best.distSq) {
                  return { feature: candidate, distSq: candidateDistSq };
                }
                return best;
              }, null);

              const geom = nearestFeature.feature.geometry as any;
              const [lng, lat] = geom.coordinates;
              // 0.0001 degrees ≈ 11 m — MapLibre rounds rendered coordinates so an
              // exact equality check would miss real matches near rounding boundaries.
              const tree = this.treesDb.find(t =>
                Math.abs(t.lng - lng) < 0.0001 && Math.abs(t.lat - lat) < 0.0001
              );
              if (tree) {
                this.selectedPopupTree = { ...tree, localImgFile: getTreeImagePath(tree.treeId) };
                this.handlePopupOpen(tree);
                this.cdr.markForCheck();
                return;
              }
            }
          }
          this.selectedPopupTree = null;
          this.cdr.markForCheck();
        });
      });
      mapInstance.on('styledata', () => refreshMapDebugState('styledata'));
      refreshMapDebugState('afterViewInit');
    }, 0);
  }

  private persistPreferences(): void {
    saveHomePreferences({
      compassEnabled: this.compassActive,
      proximityDistance: this.howCloseIsClose,
      vibrateWhenNearTree: this.vibrateWhenNearTree,
    });
  }

  showAllTreesSelected() {
    this.showAllTreesChecked = !this.showAllTreesChecked;
  }

  showMarkersForOnlySelectedTrees() {
    this.showAllTreesChecked = false;
    this.showOnlySearchedForTrees = true;
    this.searching = false;
    // The search panel collapsing changes the map's rendered dimensions, but
    // MapLibre doesn't detect DOM resize automatically — explicit call required.
    setTimeout(() => this.map!.mapInstance.resize(), 0);
  }

  highlightNearbyTrees() {
    // In tour modes, check proximity against the current target only — this is what
    // triggers tour advancement when the user reaches the target tree.
    const db2Use = (this.mode === 'randomTour' || this.mode === 'speelmanTour')
      ? this.randomTourCurrentTarget : this.treesDb;

    const nextNearbyTrees = db2Use
      .filter(tree => this.center.distanceTo(new LngLat(tree.lng, tree.lat)) < this.howCloseIsClose)
      .map(tree => ({ ...tree, localImgFile: getTreeImagePath(tree.treeId) }));
    const nextNearbyTreeIds = new Set(nextNearbyTrees.map((tree) => tree.treeId));
    const hasNewNearbyTree = [...nextNearbyTreeIds].some((treeId) => !this.nearbyTreeIdsInRange.has(treeId));

    this.nearbyTrees = nextNearbyTrees;
    this.nearbyTreeIdsInRange = nextNearbyTreeIds;

    if (this.vibrateWhenNearTree && hasNewNearbyTree) {
      void this.triggerNearTreeHaptic();
    }

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
    if (this.randomTourActive && ev.detail.value !== 'randomTour' && ev.detail.value !== 'speelmanTour') {
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

    // Partial Fisher-Yates: swap a random unvisited element into position i each
    // iteration, stopping after `count` picks instead of shuffling the whole array.
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
    const speelmanEntry = this.mode === 'speelmanTour'
      ? this.speelmanTourData.find(s => s.treeId === tree.treeId)
      : null;
    this.arrivalStory = speelmanEntry?.story ?? null;
    this.arrivalLocation = speelmanEntry?.location ?? null;
    this.showTourArrival = true;
  }

  public dismissArrival(): void {
    this.showTourArrival = false;
    this.arrivalTree = null;
    this.arrivalStory = null;
    this.arrivalLocation = null;
  }

  public advanceAndDismiss(): void {
    this.dismissArrival();
    this.advanceRandomTour();
    if (this.testTourActive && this.randomTourCurrentIndex < this.randomTourTrees.length) {
      this.onReachedRandomTourTree();
    }
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
    this.testTourActive = false;
    this.arrivalStory = null;
    this.arrivalLocation = null;
    this.mode = 'wander';
    this.highlightNearbyTrees();
  }

  public startSpeelmanTour(): void {
    const trees = this.speelmanTourData
      .map(s => this.treesDb.find(t => t.treeId === s.treeId))
      .filter((t): t is TreeInfo => !!t);
    if (trees.length === 0) return;

    this.randomTourTrees = trees;
    this.randomTourCurrentIndex = 0;
    this.randomTourActive = true;
    this.randomTourProximityAlertShown = false;
    this.mode = 'speelmanTour';
    this.updateRandomTourTarget();
  }

  public startSpeelmanTestTour(): void {
    this.startSpeelmanTour();
    this.testTourActive = true;
    this.onReachedRandomTourTree();
  }

  public startTestTour(): void {
    const count = Math.min(5, this.treesDb.length);
    if (count === 0) return;
    this.initRandomTour(count);
    this.testTourActive = true;
    this.onReachedRandomTourTree();
  }

  public viewArrivalTreeDetail(): void {
    if (!this.arrivalTree) return;
    this.currentTree = this.arrivalTree;
    this.isTreePictureModalOpen = true;
  }

  public distanceToTreeChanged(event: Event) {
    const ev = event as RangeCustomEvent;
    const dist = ev.detail.value as number;
    this.howCloseIsClose = dist;
    this.highlightNearbyTrees();
    this.persistPreferences();
  }

  public vibrateWhenNearTreeChanged(): void {
    this.vibrateWhenNearTree = !this.vibrateWhenNearTree;
    this.persistPreferences();
  }

  public onMapMoveStart(event: any): void {
    // Ignore programmatic map moves; only user interactions should disable follow mode.
    if (event?.originalEvent) {
      this.pauseCompassDirectionForManualNavigation();
    }
  }

  public onMapMoveEnd(event: any): void {
    if (event?.originalEvent) this.cdr.markForCheck();
  }

  public onMapDragStart(event: any): void {
    if (event?.originalEvent) {
      this.pauseCompassDirectionForManualNavigation();
    }
  }

  public onMapDragEnd(event: any): void {
    if (event?.originalEvent) this.cdr.markForCheck();
  }

  public onMapZoomStart(event: any): void {
    if (event?.originalEvent) {
      this.pauseCompassDirectionForManualNavigation();
    }
  }

  public onMapZoomEnd(event: any): void {
    if (event?.originalEvent) this.cdr.markForCheck();
  }

  public recenterToUserLocation(): void {
    // Prevent the same tap gesture from immediately re-pausing follow mode.
    this.suppressManualPauseUntil = Date.now() + 700;
    const dotCoordinates = this.userLocationGeoJson.features[0]?.geometry.coordinates;
    const targetCenter = Array.isArray(dotCoordinates)
      ? new LngLat(dotCoordinates[0], dotCoordinates[1])
      : this.lastGeo
        ? new LngLat(this.lastGeo.lng, this.lastGeo.lat)
        : new LngLat(this.center.lng, this.center.lat);
    this.center = targetCenter;
    this.followUserLocation = true;
    this.mapCenter = targetCenter;
    const targetBearing = this.compassActive && this.heading ? this.heading[0] : undefined;
    const mapInstance = this.map?.mapInstance;
    if (mapInstance) {
      this.programmaticRecenterActive = true;
      mapInstance.stop();
      // Force center first so "Recenter" always moves camera back to blue dot.
      mapInstance.jumpTo({ center: targetCenter });
      mapInstance.easeTo({
        center: targetCenter,
        ...(typeof targetBearing === 'number' ? { bearing: targetBearing } : {}),
        duration: 250,
        essential: true,
      });
      mapInstance.once('moveend', () => {
        this.programmaticRecenterActive = false;
      });
      setTimeout(() => {
        this.programmaticRecenterActive = false;
      }, 1200);
    }
    if (this.compassActive) {
      this.compassHeadingActive = true;
    }
    this.cdr.markForCheck();
    setTimeout(() => {
      this.suppressManualPauseUntil = 0;
    }, 750);
  }

  handlePopupOpen(tree: TreeInfo) {
    this.statusMsg = tree.commonName;
  }

  public closePopup(): void {
    this.selectedPopupTree = null;
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

  private async triggerNearTreeHaptic(): Promise<void> {
    try {
      await Haptics.impact({ style: ImpactStyle.Medium });
      return;
    } catch {
      // Fallback for web/non-Capacitor runtimes
      if (window.navigator?.vibrate) {
        window.navigator.vibrate(200);
      }
    }
  }
}
