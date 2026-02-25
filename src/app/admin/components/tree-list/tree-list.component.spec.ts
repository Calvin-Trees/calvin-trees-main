import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BehaviorSubject } from 'rxjs';
import { TreeListComponent } from './tree-list.component';
import { TreeService } from '../../../services/tree.service';
import { TreeInfo } from '../../../shared/interfaces/tree-info.interface';

const MOCK_TREES: TreeInfo[] = [
  { treeId: 1, lng: -85.58, lat: 42.93, commonName: 'American chestnut', scientificName: 'Castanea dentata', commemoration: '' },
  { treeId: 2, lng: -85.59, lat: 42.94, commonName: 'Yellow wood', scientificName: 'Cladrastis kentuckea', commemoration: 'In memory of John' },
  { treeId: 3, lng: -85.60, lat: 42.95, commonName: 'Red maple', scientificName: 'Acer rubrum', commemoration: '' },
];

describe('TreeListComponent', () => {
  let component: TreeListComponent;
  let fixture: ComponentFixture<TreeListComponent>;
  let treesSubject: BehaviorSubject<TreeInfo[]>;
  let treeServiceSpy: jasmine.SpyObj<TreeService>;

  beforeEach(async () => {
    treesSubject = new BehaviorSubject<TreeInfo[]>(MOCK_TREES);

    treeServiceSpy = jasmine.createSpyObj('TreeService', ['searchTrees'], {
      trees$: treesSubject.asObservable(),
    });

    // searchTrees stub: filter by query like the real service
    treeServiceSpy.searchTrees.and.callFake((query: string) => {
      const lower = query.toLowerCase();
      return MOCK_TREES.filter(
        t =>
          t.commonName.toLowerCase().includes(lower) ||
          t.scientificName.toLowerCase().includes(lower) ||
          t.commemoration.toLowerCase().includes(lower)
      );
    });

    await TestBed.configureTestingModule({
      imports: [TreeListComponent, FormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(TreeListComponent, {
        set: {
          providers: [{ provide: TreeService, useValue: treeServiceSpy }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(TreeListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // triggers ngOnInit
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Initial loading
  // ---------------------------------------------------------------------------
  describe('initial loading', () => {
    it('should load trees from the service on init', () => {
      expect(component.trees.length).toBe(3);
    });

    it('should show all trees as filtered when no search query', () => {
      expect(component.filteredTrees.length).toBe(3);
    });

    it('should update trees when service emits new data', () => {
      const newTrees = [MOCK_TREES[0]];
      treesSubject.next(newTrees);
      expect(component.trees.length).toBe(1);
      expect(component.filteredTrees.length).toBe(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Search / filtering
  // ---------------------------------------------------------------------------
  describe('search and filtering', () => {
    it('should show all trees when search query is empty', () => {
      component.searchQuery = '';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(3);
    });

    it('should show all trees when search query is whitespace', () => {
      component.searchQuery = '   ';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(3);
    });

    it('should filter trees by common name', () => {
      component.searchQuery = 'chestnut';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(1);
      expect(component.filteredTrees[0].commonName).toBe('American chestnut');
    });

    it('should filter trees by scientific name', () => {
      component.searchQuery = 'Acer';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(1);
      expect(component.filteredTrees[0].scientificName).toBe('Acer rubrum');
    });

    it('should filter trees by commemoration', () => {
      component.searchQuery = 'John';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(1);
      expect(component.filteredTrees[0].treeId).toBe(2);
    });

    it('should return no results for non-matching query', () => {
      component.searchQuery = 'zzzzNotFoundzzzz';
      component.onSearchChange();
      expect(component.filteredTrees.length).toBe(0);
    });

    it('should delegate search to treeService.searchTrees', () => {
      component.searchQuery = 'maple';
      component.onSearchChange();
      expect(treeServiceSpy.searchTrees).toHaveBeenCalledWith('maple');
    });
  });

  // ---------------------------------------------------------------------------
  // Event emissions
  // ---------------------------------------------------------------------------
  describe('event emissions', () => {
    it('should emit editTree when onEdit is called', () => {
      spyOn(component.editTree, 'emit');
      const tree = MOCK_TREES[0];
      component.onEdit(tree);
      expect(component.editTree.emit).toHaveBeenCalledWith(tree);
    });

    it('should emit deleteTree when onDelete is called', () => {
      spyOn(component.deleteTree, 'emit');
      const tree = MOCK_TREES[1];
      component.onDelete(tree);
      expect(component.deleteTree.emit).toHaveBeenCalledWith(tree);
    });
  });

  // ---------------------------------------------------------------------------
  // Cleanup
  // ---------------------------------------------------------------------------
  describe('cleanup', () => {
    it('should unsubscribe from trees$ on destroy', () => {
      // Access the private subscription via casting
      const sub = (component as any).subscription;
      expect(sub).toBeTruthy();
      expect(sub.closed).toBeFalse();

      component.ngOnDestroy();
      expect(sub.closed).toBeTrue();
    });
  });
});
