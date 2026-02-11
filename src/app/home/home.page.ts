import { AfterViewInit, Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MapComponent } from '@maplibre/ngx-maplibre-gl';
import { LngLat } from 'maplibre-gl';

import treeJson from '../../assets/trees.json';
import tour1Json from '../../assets/tour1_geojson.json';
import { RadioGroupCustomEvent, RangeChangeEventDetail, RangeCustomEvent, SearchbarCustomEvent, ToastController } from '@ionic/angular';
import { treeImgs } from '../../assets/treeId2Img';
import { environment } from '../../environments/environment';
import { TreeService } from '../services/tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import { Subscription } from 'rxjs';
type AppMode = 'tour1' | 'wander' | 'tour2';

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

  public nearbyTrees: TreeInfo[] = [];
  public tour1Trees: TreeInfo[] = [];

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
    private treeService: TreeService
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
        if (position.coords.heading) {
          this.heading = [position.coords.heading];
        }
        // update center of map.
        this.center = new LngLat(position.coords.longitude, position.coords.latitude);
        this.highlightNearbyTrees();
      },
      (error) => {
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
    setTimeout(() => this.map!.mapInstance.resize(), 0);
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
    const db2Use = this.mode === 'wander' ? this.treesDb : (this.mode === 'tour1' ? this.tour1Trees : []);
    this.nearbyTrees = db2Use.filter(tree =>
      this.center.distanceTo(new LngLat(tree.lng, tree.lat)) < HOW_CLOSE_IS_CLOSE // meters
    );


    // get the tree.localImgFile by mapping from the tree id to the img name using treeImgs
    // that was imported from treeId2Img.ts in assets/ directory.

    this.nearbyTrees.forEach(tree => {
      const res = treeImgs.find((t: any) => t.treeId === tree.treeId);
      tree.localImgFile = res ? `assets/tree_imgs/IMG_${res.imgId}.JPG` : '';
    });

    // For each tree, we need to get attachment numbers. To do this, build a URL ending in,
    // ...FeatureServer/7/{{tree.treeId}}/attachments?f=json. Using the REST API gives back a json object like this:
    // {
    //   "attachmentInfos" : [
    //     {
    //       "id": 70,
    //       "parentObjectId": 97,
    //       "name": "IMG_2084.JPG",
    //       "contentType": "image/jpeg",
    //       "size": 3880050,
    //       "keywords": "",
    //       "exifInfo": null
    //     }
    //   ]
    // }
    /*
       All old stuff when retriving images from the online databas, which used a l9ot of bandwidth.
          const response = await fetch(`${baseURL}/${tree.treeId}/attachments?f=json`);
    const baseURL = 'https://services2.arcgis.com/DBcRJmfPI2l07jMS/arcgis/rest/services/Calvin_Campus_Speelman_Arboretum_WFL1/FeatureServer/7';
      const treeAttachmentData = await response.json();
      // console.log(JSON.stringify(treeAttachmentData, null, 2));
      if (treeAttachmentData.attachmentInfos.length > 0) {
        // if (fs.existsSync(`assets/tree_imgs/${treeAttachmentData.attachmentInfos[0].name}`)) {
        // console.log('found local file ' + `assets/tree_imgs/${treeAttachmentData.attachmentInfos[0].name}`);
        tree.localImgFile = `assets/tree_imgs/${treeAttachmentData.attachmentInfos[0].name}`;
        // } else {
        // console.log('did NOT find local file ' + `assets/tree_imgs/${treeAttachmentData.attachmentInfos[0].name}`);
        tree.attachmentURL = `${baseURL}/${tree.treeId}/attachments/${treeAttachmentData.attachmentInfos[0].id}`;
        // }
      }
 */
  }

  public modeChanged(event: Event) {
    const ev = event as RadioGroupCustomEvent;
    this.mode = ev.detail.value;
  }

  public distanceToTreeChanged(event: Event) {
    const ev = event as RangeCustomEvent;
    const dist = ev.detail.value as number;
    HOW_CLOSE_IS_CLOSE = dist;
    this.highlightNearbyTrees
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
