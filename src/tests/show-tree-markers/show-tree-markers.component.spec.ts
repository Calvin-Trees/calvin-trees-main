import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShowTreeMarkersComponent } from '../../app/show-tree-markers/show-tree-markers.component';
import { TreeInfo } from '../../app/shared/interfaces/tree-info.interface';

const MOCK_TREES: TreeInfo[] = [
  { treeId: 1, lng: -85.58, lat: 42.93, commonName: 'Oak', scientificName: 'Quercus', commemoration: '' },
  { treeId: 2, lng: -85.59, lat: 42.94, commonName: 'Maple', scientificName: 'Acer', commemoration: 'In memory' },
];

describe('ShowTreeMarkersComponent', () => {
  let component: ShowTreeMarkersComponent;
  let fixture: ComponentFixture<ShowTreeMarkersComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShowTreeMarkersComponent],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(ShowTreeMarkersComponent, {
        set: {
          imports: [CommonModule],
          schemas: [CUSTOM_ELEMENTS_SCHEMA],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(ShowTreeMarkersComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Input defaults
  // ---------------------------------------------------------------------------
  describe('input defaults', () => {
    it('should default id to empty string', () => {
      expect(component.id).toBe('');
    });

    it('should default treesList to empty array', () => {
      expect(component.treesList).toEqual([]);
    });

    it('should default color to empty string', () => {
      expect(component.color).toBe('');
    });

    it('should default markerRadius to 5', () => {
      expect(component.markerRadius).toBe(5);
    });

    it('should default strokeColor to transparent', () => {
      expect(component.strokeColor).toBe('transparent');
    });

    it('should default strokeWidth to 0', () => {
      expect(component.strokeWidth).toBe(0);
    });

    it('should default circleOpacity to 0.95', () => {
      expect(component.circleOpacity).toBe(0.95);
    });
  });

  // ---------------------------------------------------------------------------
  // Input binding
  // ---------------------------------------------------------------------------
  describe('input binding', () => {
    it('should accept a treesList input', () => {
      component.treesList = MOCK_TREES;
      fixture.detectChanges();
      expect(component.treesList.length).toBe(2);
    });

    it('should accept color input', () => {
      component.color = '#ff0000';
      fixture.detectChanges();
      expect(component.color).toBe('#ff0000');
    });

    it('should accept id input', () => {
      component.id = 'nearby';
      fixture.detectChanges();
      expect(component.id).toBe('nearby');
    });

    it('should accept markerRadius input', () => {
      component.markerRadius = 10;
      fixture.detectChanges();
      expect(component.markerRadius).toBe(10);
    });

    it('should accept strokeColor and strokeWidth inputs', () => {
      component.strokeColor = '#000';
      component.strokeWidth = 2;
      fixture.detectChanges();
      expect(component.strokeColor).toBe('#000');
      expect(component.strokeWidth).toBe(2);
    });

    it('should accept circleOpacity input', () => {
      component.circleOpacity = 0.5;
      fixture.detectChanges();
      expect(component.circleOpacity).toBe(0.5);
    });
  });
});
