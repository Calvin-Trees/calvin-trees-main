import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule, ToastController } from '@ionic/angular';
import { BehaviorSubject } from 'rxjs';
import { LngLat } from 'maplibre-gl';

import { HomePage } from '../../app/home/home.page';
import { TreeService } from '../../app/services/tree.service';
import { TreeInfo } from '../../app/shared/interfaces/tree-info.interface';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEFAULT_LNG = -85.5871801;
const DEFAULT_LAT = 42.9308076;

const NEARBY_TREE: TreeInfo = {
  treeId: 100,
  lng: DEFAULT_LNG,
  lat: DEFAULT_LAT,
  commonName: 'Nearby Oak',
  scientificName: 'Quercus proxima',
  commemoration: 'Test nearby',
};

const FAR_TREE: TreeInfo = {
  treeId: 200,
  lng: -73.9857,
  lat: 40.7484,
  commonName: 'Far Elm',
  scientificName: 'Ulmus distans',
  commemoration: '',
};

const MOCK_TREES: TreeInfo[] = [
  NEARBY_TREE,
  FAR_TREE,
  { treeId: 300, lng: DEFAULT_LNG + 0.00001, lat: DEFAULT_LAT + 0.00001, commonName: 'Sugar maple', scientificName: 'Acer saccharum', commemoration: 'Memory of Alice' },
];

// ---------------------------------------------------------------------------
// Geolocation mock
// ---------------------------------------------------------------------------

let geoSuccessCallback: PositionCallback;
let geoErrorCallback: PositionErrorCallback;

function simulateGeoPosition(lng: number, lat: number, heading: number | null = null): void {
  geoSuccessCallback({
    coords: {
      longitude: lng,
      latitude: lat,
      accuracy: 5,
      heading,
      altitude: null,
      altitudeAccuracy: null,
      speed: null,
    },
    timestamp: Date.now(),
  } as GeolocationPosition);
}

function simulateGeoError(code: number, message = 'test error'): void {
  geoErrorCallback({
    code,
    message,
    PERMISSION_DENIED: 1,
    POSITION_UNAVAILABLE: 2,
    TIMEOUT: 3,
  } as GeolocationPositionError);
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let treesSubject: BehaviorSubject<TreeInfo[]>;
  let treeServiceSpy: jasmine.SpyObj<TreeService>;
  let toastCtrlSpy: jasmine.SpyObj<ToastController>;
  let alertCtrlSpy: jasmine.SpyObj<AlertController>;

  beforeEach(async () => {
    // Install fake timers to prevent real setTimeout from firing (retries, ngAfterViewInit, etc.)
    jasmine.clock().install();

    // Must mock geolocation BEFORE component construction
    spyOn(navigator.geolocation, 'watchPosition').and.callFake(
      (success: PositionCallback, error?: PositionErrorCallback | null) => {
        geoSuccessCallback = success;
        if (error) geoErrorCallback = error;
        return 42;
      }
    );
    spyOn(navigator.geolocation, 'clearWatch');

    treesSubject = new BehaviorSubject<TreeInfo[]>(MOCK_TREES);
    treeServiceSpy = jasmine.createSpyObj('TreeService', ['getTrees', 'searchTrees'], {
      trees$: treesSubject.asObservable(),
    });
    treeServiceSpy.getTrees.and.returnValue(MOCK_TREES);

    const fakeToast = { present: jasmine.createSpy('present').and.returnValue(Promise.resolve()) };
    toastCtrlSpy = jasmine.createSpyObj('ToastController', ['create']);
    toastCtrlSpy.create.and.returnValue(Promise.resolve(fakeToast as any));

    const fakeAlert = { present: jasmine.createSpy('present').and.returnValue(Promise.resolve()) };
    alertCtrlSpy = jasmine.createSpyObj('AlertController', ['create']);
    alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

    await TestBed.configureTestingModule({
      declarations: [HomePage],
      imports: [FormsModule, IonicModule.forRoot()],
      providers: [
        { provide: TreeService, useValue: treeServiceSpy },
        { provide: ToastController, useValue: toastCtrlSpy },
        { provide: AlertController, useValue: alertCtrlSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  afterEach(() => {
    jasmine.clock().uninstall();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initialization & defaults
  // ---------------------------------------------------------------------------
  describe('initialization', () => {
    it('should start in wander mode', () => {
      expect(component.mode).toBe('wander');
    });

    it('should default center to Calvin campus', () => {
      expect(component.center.lng).toBeCloseTo(DEFAULT_LNG, 5);
      expect(component.center.lat).toBeCloseTo(DEFAULT_LAT, 5);
    });

    it('should subscribe to trees$ and populate treesDb', () => {
      expect(component.treesDb.length).toBe(MOCK_TREES.length);
    });

    it('should populate tour1Trees from treeJson', () => {
      expect(component.tour1Trees.length).toBe(12);
    });

    it('should default showAllTreesChecked to true', () => {
      expect(component.showAllTreesChecked).toBeTrue();
    });

    it('should default searching to false', () => {
      expect(component.searching).toBeFalse();
    });

    it('should default randomTourActive to false', () => {
      expect(component.randomTourActive).toBeFalse();
    });

    it('should call watchPosition on construction', () => {
      expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // cardinalDirection getter
  // ---------------------------------------------------------------------------
  describe('cardinalDirection', () => {
    it('should return "--" when heading is undefined', () => {
      component.heading = undefined;
      expect(component.cardinalDirection).toBe('--');
    });

    it('should return "N" for heading 0', () => {
      component.heading = [0];
      expect(component.cardinalDirection).toBe('N');
    });

    it('should return "E" for heading 90', () => {
      component.heading = [90];
      expect(component.cardinalDirection).toBe('E');
    });

    it('should return "S" for heading 180', () => {
      component.heading = [180];
      expect(component.cardinalDirection).toBe('S');
    });

    it('should return "W" for heading 270', () => {
      component.heading = [270];
      expect(component.cardinalDirection).toBe('W');
    });

    it('should return "NE" for heading 45', () => {
      component.heading = [45];
      expect(component.cardinalDirection).toBe('NE');
    });

    it('should return "SW" for heading 225', () => {
      component.heading = [225];
      expect(component.cardinalDirection).toBe('SW');
    });
  });

  // ---------------------------------------------------------------------------
  // headingDegrees getter
  // ---------------------------------------------------------------------------
  describe('headingDegrees', () => {
    it('should return null when heading is undefined', () => {
      component.heading = undefined;
      expect(component.headingDegrees).toBeNull();
    });

    it('should return rounded degrees', () => {
      component.heading = [123.7];
      expect(component.headingDegrees).toBe(124);
    });

    it('should return 0 for heading 0', () => {
      component.heading = [0];
      expect(component.headingDegrees).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // highlightNearbyTrees
  // ---------------------------------------------------------------------------
  describe('highlightNearbyTrees()', () => {
    it('should find nearby trees in wander mode', () => {
      component.mode = 'wander';
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.some(t => t.treeId === NEARBY_TREE.treeId)).toBeTrue();
    });

    it('should not include far trees', () => {
      component.mode = 'wander';
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.some(t => t.treeId === FAR_TREE.treeId)).toBeFalse();
    });

    it('should use tour1Trees when in tour1 mode', () => {
      component.mode = 'tour1';
      const t1 = component.tour1Trees[0];
      component.center = new LngLat(t1.lng, t1.lat);
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.some(t => t.treeId === t1.treeId)).toBeTrue();
    });

    it('should use randomTourCurrentTarget when in randomTour mode', () => {
      component.mode = 'randomTour';
      const target: TreeInfo = { ...NEARBY_TREE, treeId: 999 };
      component.randomTourCurrentTarget = [target];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.some(t => t.treeId === 999)).toBeTrue();
    });

    it('should return empty nearby list when no trees are close', () => {
      component.mode = 'wander';
      component.center = new LngLat(0, 0);
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.length).toBe(0);
    });

    it('should use empty db for unrecognized modes', () => {
      (component as any).mode = 'unknownMode';
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.length).toBe(0);
    });
  });

  // ---------------------------------------------------------------------------
  // modeChanged
  // ---------------------------------------------------------------------------
  describe('modeChanged()', () => {
    it('should switch mode on radio change', () => {
      const event = { detail: { value: 'tour1' } } as any;
      component.modeChanged(event);
      expect(component.mode).toBe('tour1');
    });

    it('should end random tour when switching away from randomTour', () => {
      component.randomTourActive = true;
      component.mode = 'randomTour';
      const event = { detail: { value: 'wander' } } as any;
      component.modeChanged(event);
      expect(component.randomTourActive).toBeFalse();
      expect(component.mode).toBe('wander');
    });

    it('should not end random tour when staying on randomTour', () => {
      component.randomTourActive = true;
      component.mode = 'randomTour';
      const event = { detail: { value: 'randomTour' } } as any;
      component.modeChanged(event);
      expect(component.mode).toBe('randomTour');
    });
  });

  // ---------------------------------------------------------------------------
  // Random Tour
  // ---------------------------------------------------------------------------
  describe('random tour', () => {
    it('startRandomTour should present an alert', async () => {
      await component.startRandomTour();
      expect(alertCtrlSpy.create).toHaveBeenCalled();
    });

    it('Start Tour handler should initialize tour with clamped count', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });

      await component.startRandomTour();

      const startBtn = capturedButtons.find((b: any) => b.text === 'Start Tour');
      expect(startBtn).toBeTruthy();
      startBtn.handler({ count: '3' });

      expect(component.randomTourActive).toBeTrue();
      expect(component.randomTourTrees.length).toBe(3);
      expect(component.mode).toBe('randomTour');
      expect(component.randomTourCurrentIndex).toBe(0);
      expect(component.randomTourCurrentTarget.length).toBe(1);
    });

    it('initRandomTour should clamp count to max 10', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '99' });
      // Only 3 mock trees, so it should be capped at min(10, 3) = 3
      expect(component.randomTourTrees.length).toBeLessThanOrEqual(10);
    });

    it('initRandomTour should default to 5 for invalid input', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: 'abc' });
      // parseInt('abc') is NaN → fallback to 5, but only 3 mock trees
      expect(component.randomTourTrees.length).toBe(3);
    });

    it('endRandomTour should reset all random tour state', () => {
      component.randomTourActive = true;
      component.randomTourTrees = [NEARBY_TREE];
      component.randomTourCurrentIndex = 5;
      component.randomTourCurrentTarget = [NEARBY_TREE];
      component.mode = 'randomTour';

      component.endRandomTour();

      expect(component.randomTourActive).toBeFalse();
      expect(component.randomTourTrees.length).toBe(0);
      expect(component.randomTourCurrentIndex).toBe(0);
      expect(component.randomTourCurrentTarget.length).toBe(0);
      expect(component.mode).toBe('wander');
    });

    it('endRandomTour should call highlightNearbyTrees', () => {
      spyOn(component, 'highlightNearbyTrees');
      component.endRandomTour();
      expect(component.highlightNearbyTrees).toHaveBeenCalled();
    });

    it('Cancel button in startRandomTour should not start a tour', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });

      await component.startRandomTour();

      const cancelBtn = capturedButtons.find((b: any) => b.text === 'Cancel');
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn.role).toBe('cancel');
      expect(component.randomTourActive).toBeFalse();
    });

    it('initRandomTour should clamp count to minimum 1', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '0' });
      expect(component.randomTourTrees.length).toBeGreaterThanOrEqual(1);
    });

    it('randomTourCurrentTarget should contain the first tree after init', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '2' });

      expect(component.randomTourCurrentTarget.length).toBe(1);
      expect(component.randomTourCurrentTarget[0].treeId).toBe(component.randomTourTrees[0].treeId);
    });

    it('selected trees should all come from treesDb', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '3' });

      const dbIds = component.treesDb.map(t => t.treeId);
      component.randomTourTrees.forEach(t => {
        expect(dbIds).toContain(t.treeId);
      });
    });

    it('selected trees should have no duplicates', async () => {
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '3' });

      const ids = component.randomTourTrees.map(t => t.treeId);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Random Tour: proximity detection & advancement
  // ---------------------------------------------------------------------------
  describe('random tour proximity & advancement', () => {
    beforeEach(async () => {
      // Start a tour with 2 trees via the alert handler
      let capturedButtons: any[] = [];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });
      await component.startRandomTour();
      capturedButtons.find((b: any) => b.text === 'Start Tour').handler({ count: '2' });
      // Reset alert spy for proximity checks
      alertCtrlSpy.create.calls.reset();
    });

    it('should trigger proximity alert when user reaches current target', async () => {
      const target = component.randomTourCurrentTarget[0];
      let capturedOpts: any = {};
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      // Move user to the target tree location
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      expect(alertCtrlSpy.create).toHaveBeenCalled();
      expect(capturedOpts.header).toBe('Tree 1 of 2');
      expect(capturedOpts.message).toContain('You found');
    });

    it('should not trigger proximity alert twice for the same tree', () => {
      const target = component.randomTourCurrentTarget[0];
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();
      alertCtrlSpy.create.calls.reset();

      // Call again at the same location
      component.highlightNearbyTrees();
      expect(alertCtrlSpy.create).not.toHaveBeenCalled();
    });

    it('should not trigger proximity alert when user is far from target', () => {
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

      component.center = new LngLat(0, 0);
      component.highlightNearbyTrees();

      expect(alertCtrlSpy.create).not.toHaveBeenCalled();
    });

    it('advancing should move to the next tree', () => {
      const firstTarget = component.randomTourCurrentTarget[0].treeId;
      (component as any).advanceRandomTour();

      expect(component.randomTourCurrentIndex).toBe(1);
      expect(component.randomTourCurrentTarget.length).toBe(1);
      expect(component.randomTourCurrentTarget[0].treeId).not.toBe(firstTarget);
    });

    it('advancing should reset proximity alert flag', () => {
      (component as any).randomTourProximityAlertShown = true;
      (component as any).advanceRandomTour();
      expect((component as any).randomTourProximityAlertShown).toBeFalse();
    });

    it('advancing past the last tree should clear target', () => {
      (component as any).advanceRandomTour(); // index 1
      (component as any).advanceRandomTour(); // index 2, past end
      expect(component.randomTourCurrentTarget.length).toBe(0);
    });

    it('last tree alert should show "Finish Tour" button', async () => {
      // Advance to last tree (index 1)
      (component as any).advanceRandomTour();
      expect(component.randomTourCurrentIndex).toBe(1);

      let capturedOpts: any;
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      // Simulate reaching the last tree
      const target = component.randomTourCurrentTarget[0];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      expect(capturedOpts.header).toBe('Tree 2 of 2');
      expect(capturedOpts.message).toContain('last tree');
      expect(capturedOpts.buttons.length).toBe(1);
      expect(capturedOpts.buttons[0].text).toBe('Finish Tour');
    });

    it('non-last tree alert should show Next Tree and End Tour buttons', async () => {
      let capturedOpts: any;
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      // Reach the first tree (not the last)
      const target = component.randomTourCurrentTarget[0];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      expect(capturedOpts.buttons.length).toBe(2);
      const labels = capturedOpts.buttons.map((b: any) => b.text);
      expect(labels).toContain('Next Tree');
      expect(labels).toContain('End Tour');
    });

    it('Next Tree button handler should advance the tour', async () => {
      let capturedOpts: any;
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      const target = component.randomTourCurrentTarget[0];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      const nextBtn = capturedOpts.buttons.find((b: any) => b.text === 'Next Tree');
      nextBtn.handler();

      expect(component.randomTourCurrentIndex).toBe(1);
    });

    it('End Tour button handler in proximity alert should end the tour', async () => {
      let capturedOpts: any;
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      const target = component.randomTourCurrentTarget[0];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      const endBtn = capturedOpts.buttons.find((b: any) => b.text === 'End Tour');
      endBtn.handler();

      expect(component.randomTourActive).toBeFalse();
      expect(component.mode).toBe('wander');
    });

    it('Finish Tour button on last tree should end the tour', async () => {
      (component as any).advanceRandomTour(); // move to last tree

      let capturedOpts: any;
      const fakeAlert = { present: jasmine.createSpy().and.returnValue(Promise.resolve()) };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedOpts = opts;
        return Promise.resolve(fakeAlert as any);
      });

      const target = component.randomTourCurrentTarget[0];
      component.center = new LngLat(target.lng, target.lat);
      component.highlightNearbyTrees();

      capturedOpts.buttons[0].handler(); // "Finish Tour"

      expect(component.randomTourActive).toBeFalse();
      expect(component.mode).toBe('wander');
    });
  });

  // ---------------------------------------------------------------------------
  // Geolocation callbacks
  // ---------------------------------------------------------------------------
  describe('geolocation', () => {
    it('should update center on position success', () => {
      simulateGeoPosition(-80.0, 40.0);
      expect(component.center.lng).toBeCloseTo(-80.0, 5);
      expect(component.center.lat).toBeCloseTo(40.0, 5);
    });

    it('should update lastGeo on position success', () => {
      simulateGeoPosition(-80.0, 40.0);
      expect(component.lastGeo).not.toBeNull();
      expect(component.lastGeo!.lng).toBeCloseTo(-80.0, 5);
    });

    it('should increment geoUpdateCount on each update', () => {
      const before = component.geoUpdateCount;
      simulateGeoPosition(-80.0, 40.0);
      expect(component.geoUpdateCount).toBe(before + 1);
      simulateGeoPosition(-80.0, 40.0);
      expect(component.geoUpdateCount).toBe(before + 2);
    });

    it('should update heading from GPS when compass is not active', () => {
      component.compassActive = false;
      simulateGeoPosition(-80.0, 40.0, 90);
      expect(component.heading).toEqual([90]);
    });

    it('should NOT update heading from GPS when compass IS active', () => {
      component.compassActive = true;
      component.heading = [45];
      simulateGeoPosition(-80.0, 40.0, 180);
      expect(component.heading).toEqual([45]);
    });

    it('should populate userLocationTrees with current position', () => {
      simulateGeoPosition(-80.0, 40.0);
      expect(component.userLocationTrees.length).toBe(1);
      expect(component.userLocationTrees[0].lng).toBeCloseTo(-80.0, 5);
      expect(component.userLocationTrees[0].commonName).toBe('You are here');
    });

    it('should set error message on permission denied (code 1)', () => {
      simulateGeoError(1);
      expect(component.errorMsg).toBe('Permission denied');
      expect(component.statusMsg).toContain('Location permission denied');
    });

    it('should show retry status on timeout (code 3)', () => {
      simulateGeoError(3);
      expect(component.statusMsg).toContain('Retrying');
    });

    it('should show retry status on position unavailable (code 2)', () => {
      simulateGeoError(2);
      expect(component.statusMsg).toContain('Retrying');
    });

    it('should set error on unknown geo error code', () => {
      simulateGeoError(99, 'Something weird');
      expect(component.errorMsg).toBe('Something weird');
      expect(component.statusMsg).toBe('Location error occurred');
    });

    it('should fall back to default location after max retries', () => {
      // Exhaust retries (3 retries + 1 final)
      simulateGeoError(3); // retry 1
      simulateGeoError(3); // retry 2
      simulateGeoError(3); // retry 3
      simulateGeoError(3); // max exceeded
      expect(component.errorMsg).toBe('Timeout');
      expect(component.statusMsg).toContain('Using default location');
    });
  });

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------
  describe('search', () => {
    it('searchClicked should toggle searching state', () => {
      expect(component.searching).toBeFalse();
      component.searchClicked();
      expect(component.searching).toBeTrue();
      component.searchClicked();
      expect(component.searching).toBeFalse();
    });

    it('searchClicked should clear previous results', () => {
      component.searchResultTrees = [NEARBY_TREE];
      component.searchResultStr = ['test'];
      component.selectedSearchResults = [true];
      component.searchClicked();
      expect(component.searchResultTrees.length).toBe(0);
      expect(component.searchResultStr.length).toBe(0);
      expect(component.selectedSearchResults.length).toBe(0);
    });

    it('doSearch should find trees by common name', () => {
      const event = { target: { value: 'oak' } } as any;
      component.doSearch(event);
      expect(component.searchResultTrees.length).toBeGreaterThan(0);
      expect(component.searchResultTrees.some(t => t.commonName === 'Nearby Oak')).toBeTrue();
    });

    it('doSearch should find trees by scientific name', () => {
      const event = { target: { value: 'acer' } } as any;
      component.doSearch(event);
      expect(component.searchResultTrees.some(t => t.scientificName === 'Acer saccharum')).toBeTrue();
    });

    it('doSearch should find trees by commemoration', () => {
      const event = { target: { value: 'alice' } } as any;
      component.doSearch(event);
      expect(component.searchResultTrees.length).toBe(1);
    });

    it('doSearch should return empty for no match', () => {
      const event = { target: { value: 'zzzzNotFoundzzzz' } } as any;
      component.doSearch(event);
      expect(component.searchResultTrees.length).toBe(0);
    });

    it('doSearch should return empty for empty query', () => {
      const event = { target: { value: '' } } as any;
      component.doSearch(event);
      expect(component.searchResultTrees.length).toBe(0);
    });

    it('doSearch should populate searchResultStr with matching field value', () => {
      const event = { target: { value: 'nearby' } } as any;
      component.doSearch(event);
      expect(component.searchResultStr.length).toBeGreaterThan(0);
    });

    it('doSearch should initialize selectedSearchResults to false', () => {
      const event = { target: { value: 'oak' } } as any;
      component.doSearch(event);
      expect(component.selectedSearchResults.every(v => v === false)).toBeTrue();
    });

    it('doSearch should return early if event is null', () => {
      component.doSearch(null as any);
      expect(component.searchResultTrees.length).toBe(0);
    });

    it('doSearch should match by commonName before scientificName', () => {
      // 'Nearby Oak' matches by commonName → searchResultStr should show commonName
      const event = { target: { value: 'nearby' } } as any;
      component.doSearch(event);
      expect(component.searchResultStr[0]).toBe('Nearby Oak');
    });

    it('onSearchCancel should clear all search state', () => {
      component.searching = true;
      component.searchResultTrees = [NEARBY_TREE];
      component.searchResultStr = ['test'];
      component.selectedSearchResults = [true];
      component.selectAllSelected = true;
      component.showOnlySearchedForTrees = true;

      component.onSearchCancel();

      expect(component.searching).toBeFalse();
      expect(component.searchResultTrees.length).toBe(0);
      expect(component.searchResultStr.length).toBe(0);
      expect(component.selectedSearchResults.length).toBe(0);
      expect(component.selectAllSelected).toBeFalse();
      expect(component.showOnlySearchedForTrees).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // Search selection management
  // ---------------------------------------------------------------------------
  describe('search selection', () => {
    beforeEach(() => {
      component.selectedSearchResults = [false, false, false];
      component.selectAllSelected = false;
    });

    it('searchSelectionChanged should toggle the i-th item', () => {
      component.searchSelectionChanged(1);
      expect(component.selectedSearchResults[1]).toBeTrue();
      component.searchSelectionChanged(1);
      expect(component.selectedSearchResults[1]).toBeFalse();
    });

    it('should auto-enable selectAll when all items are manually selected', () => {
      component.searchSelectionChanged(0);
      component.searchSelectionChanged(1);
      component.searchSelectionChanged(2);
      expect(component.selectAllSelected).toBeTrue();
    });

    it('should auto-disable selectAll when any item is deselected', () => {
      component.selectedSearchResults = [true, true, true];
      component.selectAllSelected = true;
      component.searchSelectionChanged(1);
      expect(component.selectAllSelected).toBeFalse();
    });

    it('selectAllCheckboxChanged should select all when toggled on', () => {
      component.selectAllSelected = false;
      component.selectAllCheckboxChanged();
      expect(component.selectAllSelected).toBeTrue();
      expect(component.selectedSearchResults.every(v => v === true)).toBeTrue();
    });

    it('selectAllCheckboxChanged should deselect all when toggled off', () => {
      component.selectedSearchResults = [true, true, true];
      component.selectAllSelected = true;
      component.selectAllCheckboxChanged();
      expect(component.selectAllSelected).toBeFalse();
      expect(component.selectedSearchResults.every(v => v === false)).toBeTrue();
    });

    it('areNoSearchResultsSelected should return true when none selected', () => {
      component.selectedSearchResults = [false, false, false];
      expect(component.areNoSearchResultsSelected()).toBeTrue();
    });

    it('areNoSearchResultsSelected should return false when at least one selected', () => {
      component.selectedSearchResults = [false, true, false];
      expect(component.areNoSearchResultsSelected()).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // Show all trees toggle
  // ---------------------------------------------------------------------------
  describe('showAllTreesSelected()', () => {
    it('should toggle showAllTreesChecked', () => {
      expect(component.showAllTreesChecked).toBeTrue();
      component.showAllTreesSelected();
      expect(component.showAllTreesChecked).toBeFalse();
      component.showAllTreesSelected();
      expect(component.showAllTreesChecked).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // showMarkersForOnlySelectedTrees
  // ---------------------------------------------------------------------------
  describe('showMarkersForOnlySelectedTrees()', () => {
    it('should set correct state flags', () => {
      component.showAllTreesChecked = true;
      component.showOnlySearchedForTrees = false;
      component.searching = true;

      component.showMarkersForOnlySelectedTrees();

      expect(component.showAllTreesChecked).toBeFalse();
      expect(component.showOnlySearchedForTrees).toBeTrue();
      expect(component.searching).toBeFalse();
    });
  });

  // ---------------------------------------------------------------------------
  // handlePopupOpen / handleClickOnPopup
  // ---------------------------------------------------------------------------
  describe('popup handling', () => {
    it('handlePopupOpen should set statusMsg when vibrate not available', () => {
      const origVibrate = navigator.vibrate;
      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });

      component.handlePopupOpen(NEARBY_TREE);
      expect(component.statusMsg).toBe('No haptics');

      Object.defineProperty(navigator, 'vibrate', { value: origVibrate, configurable: true });
    });

    it('handlePopupOpen should call vibrate when available', () => {
      const spy = jasmine.createSpy('vibrate').and.returnValue(true);
      Object.defineProperty(navigator, 'vibrate', { value: spy, configurable: true });

      component.handlePopupOpen(NEARBY_TREE);
      expect(spy).toHaveBeenCalledWith(200);

      Object.defineProperty(navigator, 'vibrate', { value: undefined, configurable: true });
    });

    it('handleClickOnPopup should set currentTree and open modal', () => {
      component.handleClickOnPopup(NEARBY_TREE);
      expect(component.currentTree).toBe(NEARBY_TREE);
      expect(component.isTreePictureModalOpen).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // distanceToTreeChanged
  // ---------------------------------------------------------------------------
  describe('distanceToTreeChanged()', () => {
    it('should update distance threshold from range event', () => {
      const event = { detail: { value: 25 } } as any;
      component.distanceToTreeChanged(event);
      // Verify behavior: nearby tree (0m away) should still be found at 25m threshold
      component.highlightNearbyTrees();
      expect(component.nearbyTrees.some(t => t.treeId === NEARBY_TREE.treeId)).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // Compass
  // ---------------------------------------------------------------------------
  describe('compass', () => {
    it('disableCompass should set compassActive to false', () => {
      component.compassActive = true;
      component.disableCompass();
      expect(component.compassActive).toBeFalse();
    });

    it('disableCompass should clear compassError', () => {
      component.compassError = 'some error';
      component.disableCompass();
      expect(component.compassError).toBeNull();
    });

    it('enableCompass should set error when DeviceOrientationEvent is undefined', async () => {
      const orig = window.DeviceOrientationEvent;
      Object.defineProperty(window, 'DeviceOrientationEvent', { value: undefined, configurable: true });

      await component.enableCompass();
      expect(component.compassError).toBe('Compass not supported on this device');

      Object.defineProperty(window, 'DeviceOrientationEvent', { value: orig, configurable: true });
    });

    it('enableCompass should start listeners when DeviceOrientationEvent exists (no requestPermission)', async () => {
      // Standard browser without requestPermission API
      const FakeEvent = function () {};
      Object.defineProperty(window, 'DeviceOrientationEvent', { value: FakeEvent, configurable: true });

      await component.enableCompass();
      expect(component.compassActive).toBeTrue();
      expect(component.compassError).toBeNull();

      component.disableCompass();
    });
  });

  // ---------------------------------------------------------------------------
  // ngOnDestroy
  // ---------------------------------------------------------------------------
  describe('ngOnDestroy()', () => {
    it('should clear geolocation watch', () => {
      component.ngOnDestroy();
      expect(navigator.geolocation.clearWatch).toHaveBeenCalled();
    });

    it('should unsubscribe from tree subscription', () => {
      const sub = (component as any).treeSubscription;
      expect(sub.closed).toBeFalse();
      component.ngOnDestroy();
      expect(sub.closed).toBeTrue();
    });
  });
});
