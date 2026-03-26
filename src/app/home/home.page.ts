import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import { LngLat } from 'maplibre-gl';

import treeJson from '../../assets/trees.json';
import tour1Json from '../../assets/tour1_geojson.json';
import { AlertController, RadioGroupCustomEvent, RangeChangeEventDetail, RangeCustomEvent, SearchbarCustomEvent, ToastController } from '@ionic/angular';
import { treeImgs } from '../../assets/treeId2Img';
import { environment } from '../../environments/environment';
import { TreeService } from '../services/tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import { Subscription } from 'rxjs';
type AppMode = 'tour1' | 'wander' | 'randomTour';

interface TourInfo {
  id: number;
  localImgFile: string;
}

let HOW_CLOSE_IS_CLOSE = 10;   // how close to be to see tree popup, in meters.

// Bob Speelman's 12 favorite trees.
const Tour1: TourInfo[] = [
  { id: 54, localImgFile: 'IMG_2057.JPG' },
  { id: 23, localImgFile: 'IMG_2173.JPG' },
  { id: 13, localImgFile: 'IMG_2010.JPG' },
  { id: 24, localImgFile: 'IMG_2032.JPG' },
  { id: 25, localImgFile: 'IMG_2034.JPG' },
  { id: 43, localImgFile: 'IMG_2036.JPG' },
  { id: 98, localImgFile: 'IMG_2079.JPG' },
  { id: 93, localImgFile: 'IMG_2120.JPG' },
  { id: 82, localImgFile: 'IMG_2128.JPG' },
  { id: 88, localImgFile: 'IMG_2122.JPG' },
  { id: 75, localImgFile: 'IMG_2102.JPG' },
  { id: 84, localImgFile: 'IMG_2107.JPG' },
];


interface GeometryType {
  type: string;
  coordinates: number[][];
}


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false
})
export class HomePage implements AfterViewInit, OnInit, OnDestroy {

  public imageLoaded = false;
  public isTreePictureModalOpen = false;
  public currentTree: TreeInfo | null = null;    // for when clicking on a popup to see the tree's full image.

  // Debug helpers (safe to leave on; mostly logs in devtools)
  public debugGeo = true;
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
  public tour1Trees: TreeInfo[] = [];
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
  private readonly MAX_RETRIES: number = 3;
  private readonly TIMEOUT_MS: number = 10000; // 10 seconds

  // Compass (device orientation) — direction the phone is pointing
  public compassActive = false;
  public compassError: string | null = null;
  private deviceOrientationHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);
  private deviceOrientationAbsoluteHandler = (event: DeviceOrientationEvent) => this.onDeviceOrientation(event);

  public showAllTreesChecked = true;
  public searching = false;
  public searchResultTrees: TreeInfo[] = [];
  public searchResultStr: string[] = [];
  public selectedSearchResults: boolean[] = []
  public selectAllSelected = false;
  public showOnlySearchedForTrees = false;

  public mode: AppMode = 'wander';
  public tour1Json: any = tour1Json.routes[0].geometry;
  public mapStyle: string = `https://api.maptiler.com/maps/streets/style.json?key=${environment.maptilerApiKey}`;

  @ViewChild('map') map: MapComponent | null = null;

  public treesDb: TreeInfo[] = [];

  private treeSubscription: Subscription | null = null;

  constructor(
    private toastController: ToastController,
    private treeService: TreeService,
    private alertController: AlertController
  ) {
    this.startGeolocationWatch();

    this.tour1Trees = Tour1.map((tourTree: TourInfo) => {
      const jsonTree = treeJson.features.find((json: any) => json.id === tourTree.id)!;
      return {
        treeId: jsonTree.properties.OBJECTID,
        lng: jsonTree.geometry.coordinates[0],
        lat: jsonTree.geometry.coordinates[1],
        scientificName: jsonTree.properties.scientific,
        commonName: jsonTree.properties.common_nam,
        commemoration: jsonTree.properties.commemorat,
      }
    });
  }

  ngOnInit(): void {
    this.treeSubscription = this.treeService.trees$.subscribe(trees => {
      this.treesDb = trees;
      this.highlightNearbyTrees();
    });
  }

  ngOnDestroy(): void {
    this.treeSubscription?.unsubscribe();
    if (this.geolocationWatchId !== null) {
      window.navigator.geolocation.clearWatch(this.geolocationWatchId);
    }
    this.stopCompass();
  }

  /**
   * Get compass heading in degrees 0–360 from a DeviceOrientationEvent.
   * Uses webkitCompassHeading on iOS (absolute) and alpha elsewhere (normalized).
   */
  private getCompassHeadingFromEvent(event: DeviceOrientationEvent): number | null {
    const raw = (event as DeviceOrientationEvent & { webkitCompassHeading?: number }).webkitCompassHeading;
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return (raw % 360 + 360) % 360;
    }
    const alpha = event.alpha;
    if (typeof alpha !== 'number' || Number.isNaN(alpha)) return null;
    // alpha can be 0–360 or -180–180 depending on browser
    return (alpha % 360 + 360) % 360;
  }

  private onDeviceOrientation(event: DeviceOrientationEvent): void {
    const headingDeg = this.getCompassHeadingFromEvent(event);
    if (headingDeg !== null) {
      this.heading = [headingDeg];
      this.compassError = null;
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
    // Leave heading as-is; geolocation will update it when moving if available
  }

  /**
   * Enable compass (device orientation) for "direction phone is pointing".
   * On iOS 13+ this must be called from a user gesture (e.g. button tap);
   * permission will be requested and the compass used for heading and map bearing.
   */
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
    // No permission API (Android, desktop, or older iOS): start listening
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      this.compassError = 'Compass not supported on this device';
      return;
    }
    this.startCompassListeners();
  }

  /** Turn off compass; heading will fall back to GPS direction-of-travel when moving. */
  public disableCompass(): void {
    this.stopCompass();
  }

  /**
   * Starts the geolocation watch with timeout configuration
   */
  private startGeolocationWatch(): void {
    // Clear any existing watch
    if (this.geolocationWatchId !== null) {
      window.navigator.geolocation.clearWatch(this.geolocationWatchId);
    }

    this.geolocationWatchId = window.navigator.geolocation.watchPosition(
      (position) => {
        // Reset retry count on success
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
        // update center of map.
        this.center = new LngLat(position.coords.longitude, position.coords.latitude);

        // Update single-point "user location" list for marker rendering
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
      },
      (error) => {
        if (this.debugGeo) {
          // eslint-disable-next-line no-console
          console.warn('[geo] error', { code: error.code, message: error.message });
        }
        this.handleGeolocationError(error);
      },
      {
        enableHighAccuracy: true,
        timeout: this.TIMEOUT_MS,
        maximumAge: 0
      }
    );
  }

  /**
   * Handles geolocation errors with specific handling for different error types
   */
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
    // Unknown error
    else {
      this.errorMsg = error.message;
      this.statusMsg = 'Location error occurred';
    }
  }

  /**
   * Handles when location permission is denied
   */
  private async handlePermissionDenied(): Promise<void> {
    this.errorMsg = 'Permission denied';
    this.statusMsg = 'Location permission denied. Using default location.';

    // Ensure map centers on default location when permission is denied
    this.center = new LngLat(this.defaultLng, this.defaultLat);
    this.highlightNearbyTrees();

    // Show a visible toast notification to the user
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

  /**
   * Handles transient errors
   */
  private async handleTransientError(errorType: 'timeout' | 'unavailable'): Promise<void> {
    this.retryCount++;

    // Error-specific messages
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
      const retryDelay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 5000); // max 5 seconds
      this.statusMsg = `${config.retryMessage} (${this.retryCount}/${this.MAX_RETRIES})`;

      // Wait before retrying
      setTimeout(() => {
        this.startGeolocationWatch();
      }, retryDelay);
    } else {
      // Max retries reached
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

  /**
   * Handles timeout errors with retry mechanism
   */
  private async handleTimeout(): Promise<void> {
    await this.handleTransientError('timeout');
  }

  /**
   * Handles position unavailable errors with retry mechanism
   */
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
        // Note: getSource/getLayer exist on the MapLibre map instance.
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

      // Load tracking_dot.png image into the map when style loads
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
      // Also do an immediate check
      refreshMapDebugState('afterViewInit');
    }, 0);
  }

  showAllTreesSelected() {
    this.showAllTreesChecked = !this.showAllTreesChecked;
  }

  // when the "Show markers for selected trees" button is clicked.
  showMarkersForOnlySelectedTrees() {
    // clear all markers
    this.showAllTreesChecked = false;

    // indicate we are showing only searched-for trees.
    this.showOnlySearchedForTrees = true;

    // close the search box and results list.
    this.searching = false;
    setTimeout(() => this.map!.mapInstance.resize(), 0);
  }

  highlightNearbyTrees() {
    let db2Use: TreeInfo[] = [];
    if (this.mode === 'wander') {
      db2Use = this.treesDb;
    } else if (this.mode === 'tour1') {
      db2Use = this.tour1Trees;
    } else if (this.mode === 'randomTour') {
      db2Use = this.randomTourCurrentTarget;
    }

    this.nearbyTrees = db2Use.filter(tree =>
      this.center.distanceTo(new LngLat(tree.lng, tree.lat)) < HOW_CLOSE_IS_CLOSE
    );

    this.nearbyTrees.forEach(tree => {
      const res = treeImgs.find((t: any) => t.treeId === tree.treeId);
      tree.localImgFile = res ? `assets/tree_imgs/IMG_${res.imgId}.JPG` : '';
    });

    // Random tour: update distance and check if user reached the current target tree
    if (this.randomTourActive && this.randomTourCurrentTarget.length > 0) {
      const target = this.randomTourCurrentTarget[0];
      const distToTarget = this.center.distanceTo(new LngLat(target.lng, target.lat));
      this.distanceToTarget = Math.round(distToTarget);
      if (!this.randomTourProximityAlertShown && distToTarget < HOW_CLOSE_IS_CLOSE) {
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
      const res = treeImgs.find((t: any) => t.treeId === tree.treeId);
      tree.localImgFile = res ? `assets/tree_imgs/IMG_${res.imgId}.JPG` : '';
      this.randomTourCurrentTarget = [tree];
    } else {
      this.randomTourCurrentTarget = [];
    }
  }

  private onReachedRandomTourTree(): void {
    const tree = this.randomTourTrees[this.randomTourCurrentIndex];
    const res = treeImgs.find((t: any) => t.treeId === tree.treeId);
    this.arrivalTree = {
      ...tree,
      localImgFile: res ? `assets/tree_imgs/IMG_${res.imgId}.JPG` : '',
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
    HOW_CLOSE_IS_CLOSE = dist;
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

  // toggle search toolbar.
  searchClicked() {
    this.searchResultTrees = [];
    this.searchResultStr = []
    this.selectedSearchResults = [];
    this.searching = !this.searching;
    this.selectAllSelected = false;
  }

  doSearch(event: Event) {
    const ev = event as SearchbarCustomEvent;
    if (!ev) {
      return;
    }
    const searchTerm = ev.target!.value!.toLowerCase();

    this.searchResultTrees = [];       // the trees in the search results
    this.searchResultStr = [];    // the strings to display for search results
    this.selectedSearchResults = [];
    // don't show markers until we've finished searching.
    this.showOnlySearchedForTrees = false;

    if (searchTerm === '') {
      return;
    }
    this.treesDb.forEach((tree) => {
      let found = false;
      if (tree.commonName.toLowerCase().indexOf(searchTerm) != -1) {
        this.searchResultStr.push(tree.commonName);
        found = true;
      } else if (tree.scientificName.toLowerCase().indexOf(searchTerm) != -1) {
        this.searchResultStr.push(tree.scientificName);
        found = true;
      } else if (tree.commemoration.toLowerCase().indexOf(searchTerm) != -1) {
        this.searchResultStr.push(tree.commemoration);
        found = true;
      }
      if (found) {
        this.searchResultTrees.push(tree);
        // set selection box for this tree to "not checked".
        this.selectedSearchResults.push(false);
      }
    });
  }

  onSearchCancel() {
    this.searching = false;
    this.searchResultTrees = [];
    this.searchResultStr = [];
    this.selectedSearchResults = [];
    this.selectAllSelected = false;
    this.showOnlySearchedForTrees = false;
  }

  // i-th search result checkbox has been checked or unchecked.
  searchSelectionChanged(i: number) {
    this.selectedSearchResults[i] = !this.selectedSearchResults[i];
    // if all the boxes have been manually selected, then turn on the
    // Select All checkbox.
    if (!this.selectAllSelected && this.selectedSearchResults.every(x => x)) {
      this.selectAllSelected = true;
    }
    // if any the boxes has been manually unselected, then turn off the
    // Select All checkbox.
    if (this.selectAllSelected && !this.selectedSearchResults.every(x => x)) {
      this.selectAllSelected = false;
    }
  }

  areNoSearchResultsSelected(): boolean {
    return !this.selectedSearchResults.some(x => x);
  }

  selectAllCheckboxChanged() {
    this.selectAllSelected = !this.selectAllSelected;
    if (this.selectAllSelected) {
      for (let i = 0; i < this.selectedSearchResults.length; i++) {
        this.selectedSearchResults[i] = true;
      }
    } else if (!this.selectAllSelected) {
      for (let i = 0; i < this.selectedSearchResults.length; i++) {
        this.selectedSearchResults[i] = false;
      }
    }
  }
}



/*
To get tree info:
https://services2.arcgis.com/DBcRJmfPI2l07jMS/ArcGIS/rest/services/Calvin_Campus_Speelman_Arboretum_WFL1/FeatureServer/7/113?f=json
last number is 1 - 113.

Get attachments for a tree:
https://services2.arcgis.com/DBcRJmfPI2l07jMS/ArcGIS/rest/services/Calvin_Campus_Speelman_Arboretum_WFL1/FeatureServer/7/78/attachments?f=json

The id field indicates how to access the image.  end url with attachment/{{id}}
*/
