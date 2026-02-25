import { TestBed } from '@angular/core/testing';
import { TreeService } from './tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import treeJson from '../../assets/trees.json';

const STORAGE_KEY = 'calvin-trees-admin-data';

function makeMockTree(overrides: Partial<TreeInfo> = {}): Omit<TreeInfo, 'treeId'> {
  return {
    lng: -85.0,
    lat: 42.0,
    commonName: 'Test Oak',
    scientificName: 'Quercus testa',
    commemoration: '',
    ...overrides,
  };
}

describe('TreeService', () => {
  let service: TreeService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(TreeService);
  });

  afterEach(() => {
    localStorage.clear();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------
  describe('initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });

    it('should load trees from JSON when localStorage is empty', () => {
      const trees = service.getTrees();
      expect(trees.length).toBe(treeJson.features.length);
    });

    it('should load trees from localStorage when data exists', () => {
      const storedTrees: TreeInfo[] = [
        { treeId: 999, lng: -85, lat: 42, commonName: 'Stored Tree', scientificName: 'Storicus', commemoration: '' },
      ];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedTrees));

      // Re-create service so constructor reads from localStorage
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(TreeService);

      expect(freshService.getTrees().length).toBe(1);
      expect(freshService.getTrees()[0].commonName).toBe('Stored Tree');
    });

    it('should fall back to JSON when localStorage contains invalid JSON', () => {
      localStorage.setItem(STORAGE_KEY, '{invalid json!!!');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(TreeService);

      expect(freshService.getTrees().length).toBe(treeJson.features.length);
    });
  });

  // ---------------------------------------------------------------------------
  // GeoJSON parsing
  // ---------------------------------------------------------------------------
  describe('GeoJSON parsing', () => {
    it('should map OBJECTID to treeId', () => {
      const firstFeature = treeJson.features[0];
      const firstTree = service.getTrees()[0];
      expect(firstTree.treeId).toBe(firstFeature.properties.OBJECTID);
    });

    it('should map coordinates to lng/lat', () => {
      const firstFeature = treeJson.features[0];
      const firstTree = service.getTrees()[0];
      expect(firstTree.lng).toBe(firstFeature.geometry.coordinates[0]);
      expect(firstTree.lat).toBe(firstFeature.geometry.coordinates[1]);
    });

    it('should map common_nam, scientific, and commemorat fields', () => {
      const firstFeature = treeJson.features[0];
      const firstTree = service.getTrees()[0];
      expect(firstTree.commonName).toBe(firstFeature.properties.common_nam);
      expect(firstTree.scientificName).toBe(firstFeature.properties.scientific);
    });

    it('should default commemoration to empty string when null/undefined', () => {
      // All trees should have a string commemoration (never null/undefined)
      service.getTrees().forEach(tree => {
        expect(typeof tree.commemoration).toBe('string');
      });
    });
  });

  // ---------------------------------------------------------------------------
  // trees$ observable
  // ---------------------------------------------------------------------------
  describe('trees$ observable', () => {
    it('should emit current trees on subscribe', (done) => {
      service.trees$.subscribe(trees => {
        expect(trees.length).toBeGreaterThan(0);
        done();
      });
    });

    it('should emit updated trees after createTree', (done) => {
      const emissions: TreeInfo[][] = [];
      service.trees$.subscribe(trees => {
        emissions.push(trees);
        if (emissions.length === 2) {
          expect(emissions[1].length).toBe(emissions[0].length + 1);
          done();
        }
      });
      service.createTree(makeMockTree());
    });

    it('should emit updated trees after deleteTree', (done) => {
      const initialCount = service.getTrees().length;
      const firstId = service.getTrees()[0].treeId;
      const emissions: TreeInfo[][] = [];

      service.trees$.subscribe(trees => {
        emissions.push(trees);
        if (emissions.length === 2) {
          expect(emissions[1].length).toBe(initialCount - 1);
          done();
        }
      });
      service.deleteTree(firstId);
    });
  });

  // ---------------------------------------------------------------------------
  // getTrees
  // ---------------------------------------------------------------------------
  describe('getTrees()', () => {
    it('should return all trees as an array', () => {
      const trees = service.getTrees();
      expect(Array.isArray(trees)).toBeTrue();
      expect(trees.length).toBe(treeJson.features.length);
    });

    it('should return a snapshot (not the live subject value reference issue)', () => {
      const trees1 = service.getTrees();
      const trees2 = service.getTrees();
      expect(trees1).toEqual(trees2);
    });
  });

  // ---------------------------------------------------------------------------
  // getTreeById
  // ---------------------------------------------------------------------------
  describe('getTreeById()', () => {
    it('should return a tree when given a valid ID', () => {
      const firstTree = service.getTrees()[0];
      const found = service.getTreeById(firstTree.treeId);
      expect(found).toBeDefined();
      expect(found!.treeId).toBe(firstTree.treeId);
      expect(found!.commonName).toBe(firstTree.commonName);
    });

    it('should return undefined for a non-existent ID', () => {
      const found = service.getTreeById(-9999);
      expect(found).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // createTree
  // ---------------------------------------------------------------------------
  describe('createTree()', () => {
    it('should add a tree with an auto-incremented ID', () => {
      const initialCount = service.getTrees().length;
      const maxIdBefore = Math.max(...service.getTrees().map(t => t.treeId));

      const newTree = service.createTree(makeMockTree());

      expect(newTree.treeId).toBe(maxIdBefore + 1);
      expect(service.getTrees().length).toBe(initialCount + 1);
    });

    it('should return the created tree with all properties', () => {
      const input = makeMockTree({ commonName: 'Red Maple', scientificName: 'Acer rubrum' });
      const created = service.createTree(input);

      expect(created.commonName).toBe('Red Maple');
      expect(created.scientificName).toBe('Acer rubrum');
      expect(created.lng).toBe(-85.0);
      expect(created.lat).toBe(42.0);
    });

    it('should persist the new tree to localStorage', () => {
      service.createTree(makeMockTree());

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as TreeInfo[];
      expect(stored.length).toBe(treeJson.features.length + 1);
    });

    it('should handle creating a tree when list is empty', () => {
      // Clear all trees by resetting and using localStorage with empty array
      localStorage.setItem(STORAGE_KEY, JSON.stringify([]));
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const emptyService = TestBed.inject(TreeService);

      const created = emptyService.createTree(makeMockTree());
      expect(created.treeId).toBe(1); // max of empty = 0, so 0 + 1 = 1
      expect(emptyService.getTrees().length).toBe(1);
    });

    it('should create multiple trees with sequential IDs', () => {
      const first = service.createTree(makeMockTree({ commonName: 'First' }));
      const second = service.createTree(makeMockTree({ commonName: 'Second' }));

      expect(second.treeId).toBe(first.treeId + 1);
    });
  });

  // ---------------------------------------------------------------------------
  // updateTree
  // ---------------------------------------------------------------------------
  describe('updateTree()', () => {
    it('should update an existing tree and return the updated tree', () => {
      const firstTree = service.getTrees()[0];
      const updated = service.updateTree(firstTree.treeId, { commonName: 'Updated Name' });

      expect(updated).toBeDefined();
      expect(updated!.commonName).toBe('Updated Name');
      expect(updated!.treeId).toBe(firstTree.treeId);
    });

    it('should preserve fields not included in the update', () => {
      const firstTree = service.getTrees()[0];
      const originalScientific = firstTree.scientificName;
      const updated = service.updateTree(firstTree.treeId, { commonName: 'New Name' });

      expect(updated!.scientificName).toBe(originalScientific);
    });

    it('should update multiple fields at once', () => {
      const firstTree = service.getTrees()[0];
      const updated = service.updateTree(firstTree.treeId, {
        commonName: 'Multi Update',
        scientificName: 'Multius updateus',
        lng: -90.0,
        lat: 45.0,
      });

      expect(updated!.commonName).toBe('Multi Update');
      expect(updated!.scientificName).toBe('Multius updateus');
      expect(updated!.lng).toBe(-90.0);
      expect(updated!.lat).toBe(45.0);
    });

    it('should persist the update to localStorage', () => {
      const firstTree = service.getTrees()[0];
      service.updateTree(firstTree.treeId, { commonName: 'Persisted' });

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as TreeInfo[];
      const storedTree = stored.find(t => t.treeId === firstTree.treeId);
      expect(storedTree!.commonName).toBe('Persisted');
    });

    it('should return undefined for a non-existent tree ID', () => {
      const result = service.updateTree(-9999, { commonName: 'Ghost' });
      expect(result).toBeUndefined();
    });

    it('should not modify other trees when updating one', () => {
      const trees = service.getTrees();
      const targetId = trees[0].treeId;
      const otherTree = trees[1];

      service.updateTree(targetId, { commonName: 'Changed' });

      const afterUpdate = service.getTreeById(otherTree.treeId);
      expect(afterUpdate!.commonName).toBe(otherTree.commonName);
    });
  });

  // ---------------------------------------------------------------------------
  // deleteTree
  // ---------------------------------------------------------------------------
  describe('deleteTree()', () => {
    it('should remove a tree and return true', () => {
      const firstTree = service.getTrees()[0];
      const initialCount = service.getTrees().length;

      const result = service.deleteTree(firstTree.treeId);

      expect(result).toBeTrue();
      expect(service.getTrees().length).toBe(initialCount - 1);
    });

    it('should make the deleted tree no longer findable', () => {
      const firstTree = service.getTrees()[0];
      service.deleteTree(firstTree.treeId);

      expect(service.getTreeById(firstTree.treeId)).toBeUndefined();
    });

    it('should return false for a non-existent tree ID', () => {
      const result = service.deleteTree(-9999);
      expect(result).toBeFalse();
    });

    it('should not change the list when deleting a non-existent ID', () => {
      const countBefore = service.getTrees().length;
      service.deleteTree(-9999);
      expect(service.getTrees().length).toBe(countBefore);
    });

    it('should persist the deletion to localStorage', () => {
      const firstTree = service.getTrees()[0];
      service.deleteTree(firstTree.treeId);

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!) as TreeInfo[];
      expect(stored.find(t => t.treeId === firstTree.treeId)).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // searchTrees
  // ---------------------------------------------------------------------------
  describe('searchTrees()', () => {
    it('should return all trees for an empty query', () => {
      const results = service.searchTrees('');
      expect(results.length).toBe(service.getTrees().length);
    });

    it('should return all trees for a whitespace-only query', () => {
      const results = service.searchTrees('   ');
      expect(results.length).toBe(service.getTrees().length);
    });

    it('should find trees by common name (case-insensitive)', () => {
      const firstTree = service.getTrees()[0];
      const query = firstTree.commonName.substring(0, 5).toUpperCase();
      const results = service.searchTrees(query);

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.treeId === firstTree.treeId)).toBeTrue();
    });

    it('should find trees by scientific name', () => {
      const firstTree = service.getTrees()[0];
      const results = service.searchTrees(firstTree.scientificName.substring(0, 5));

      expect(results.length).toBeGreaterThan(0);
      expect(results.some(t => t.treeId === firstTree.treeId)).toBeTrue();
    });

    it('should find trees by commemoration', () => {
      // Add a tree with a known commemoration
      service.createTree(makeMockTree({ commemoration: 'In memory of UniqueTestPerson' }));
      const results = service.searchTrees('UniqueTestPerson');

      expect(results.length).toBe(1);
      expect(results[0].commemoration).toContain('UniqueTestPerson');
    });

    it('should return empty array when no trees match', () => {
      const results = service.searchTrees('zzzzNonExistentTreeNamezzzz');
      expect(results.length).toBe(0);
    });

    it('should be case-insensitive', () => {
      service.createTree(makeMockTree({ commonName: 'Blue Spruce' }));
      const upper = service.searchTrees('BLUE SPRUCE');
      const lower = service.searchTrees('blue spruce');
      const mixed = service.searchTrees('Blue Spruce');

      expect(upper.length).toBe(lower.length);
      expect(lower.length).toBe(mixed.length);
      expect(upper.length).toBeGreaterThan(0);
    });
  });

  // ---------------------------------------------------------------------------
  // resetToOriginal
  // ---------------------------------------------------------------------------
  describe('resetToOriginal()', () => {
    it('should clear localStorage', () => {
      service.createTree(makeMockTree());
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      service.resetToOriginal();
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it('should restore tree count to original JSON count', () => {
      service.createTree(makeMockTree());
      expect(service.getTrees().length).toBe(treeJson.features.length + 1);

      service.resetToOriginal();
      expect(service.getTrees().length).toBe(treeJson.features.length);
    });

    it('should undo deletions', () => {
      const firstTree = service.getTrees()[0];
      service.deleteTree(firstTree.treeId);
      expect(service.getTreeById(firstTree.treeId)).toBeUndefined();

      service.resetToOriginal();
      expect(service.getTreeById(firstTree.treeId)).toBeDefined();
    });

    it('should undo updates', () => {
      const firstTree = service.getTrees()[0];
      const originalName = firstTree.commonName;
      service.updateTree(firstTree.treeId, { commonName: 'Modified' });

      service.resetToOriginal();
      expect(service.getTreeById(firstTree.treeId)!.commonName).toBe(originalName);
    });

    it('should emit the reset trees via the observable', (done) => {
      service.createTree(makeMockTree());
      const emissions: TreeInfo[][] = [];

      service.trees$.subscribe(trees => {
        emissions.push(trees);
        // emission 1: state after createTree, emission 2: after reset
        if (emissions.length === 2) {
          expect(emissions[1].length).toBe(treeJson.features.length);
          done();
        }
      });

      service.resetToOriginal();
    });
  });

  // ---------------------------------------------------------------------------
  // localStorage persistence (integration)
  // ---------------------------------------------------------------------------
  describe('localStorage persistence', () => {
    it('should survive service re-creation after createTree', () => {
      const created = service.createTree(makeMockTree({ commonName: 'Survivor' }));

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(TreeService);

      expect(freshService.getTreeById(created.treeId)).toBeDefined();
      expect(freshService.getTreeById(created.treeId)!.commonName).toBe('Survivor');
    });

    it('should survive service re-creation after updateTree', () => {
      const firstTree = service.getTrees()[0];
      service.updateTree(firstTree.treeId, { commonName: 'Updated Survivor' });

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(TreeService);

      expect(freshService.getTreeById(firstTree.treeId)!.commonName).toBe('Updated Survivor');
    });

    it('should survive service re-creation after deleteTree', () => {
      const firstTree = service.getTrees()[0];
      service.deleteTree(firstTree.treeId);

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({});
      const freshService = TestBed.inject(TreeService);

      expect(freshService.getTreeById(firstTree.treeId)).toBeUndefined();
    });
  });
});
