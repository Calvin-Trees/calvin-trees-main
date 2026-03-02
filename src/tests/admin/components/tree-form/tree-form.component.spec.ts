import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { ModalController } from '@ionic/angular';
import { TreeFormComponent } from '../../../../app/admin/components/tree-form/tree-form.component';
import { TreeInfo } from '../../../../app/shared/interfaces/tree-info.interface';

describe('TreeFormComponent', () => {
  let component: TreeFormComponent;
  let fixture: ComponentFixture<TreeFormComponent>;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;

  const MOCK_TREE: TreeInfo = {
    treeId: 42,
    lng: -85.59,
    lat: 42.94,
    commonName: 'White Oak',
    scientificName: 'Quercus alba',
    commemoration: 'Test dedication',
  };

  beforeEach(async () => {
    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['dismiss']);
    modalCtrlSpy.dismiss.and.returnValue(Promise.resolve(true));

    await TestBed.configureTestingModule({
      imports: [TreeFormComponent, ReactiveFormsModule],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    })
      .overrideComponent(TreeFormComponent, {
        set: {
          providers: [{ provide: ModalController, useValue: modalCtrlSpy }],
        },
      })
      .compileComponents();
  });

  function createComponent(mode: 'create' | 'edit' = 'create', tree?: TreeInfo): void {
    fixture = TestBed.createComponent(TreeFormComponent);
    component = fixture.componentInstance;
    component.mode = mode;
    if (tree) {
      component.tree = tree;
    }
    fixture.detectChanges(); // triggers ngOnInit
  }

  // ---------------------------------------------------------------------------
  // Create mode
  // ---------------------------------------------------------------------------
  describe('create mode', () => {
    beforeEach(() => createComponent('create'));

    it('should create', () => {
      expect(component).toBeTruthy();
    });

    it('should set title to "Add Tree"', () => {
      expect(component.title).toBe('Add Tree');
    });

    it('should initialize form with empty/default values', () => {
      expect(component.form.get('commonName')!.value).toBe('');
      expect(component.form.get('scientificName')!.value).toBe('');
      expect(component.form.get('commemoration')!.value).toBe('');
      expect(component.form.get('lat')!.value).toBe(42.9308076);
      expect(component.form.get('lng')!.value).toBe(-85.5871801);
    });

    it('should have form invalid when required fields are empty', () => {
      expect(component.form.valid).toBeFalse();
    });

    it('should have form valid when required fields are filled', () => {
      component.form.patchValue({
        commonName: 'Test',
        scientificName: 'Testus',
      });
      expect(component.form.valid).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // Edit mode
  // ---------------------------------------------------------------------------
  describe('edit mode', () => {
    beforeEach(() => createComponent('edit', MOCK_TREE));

    it('should set title to "Edit Tree"', () => {
      expect(component.title).toBe('Edit Tree');
    });

    it('should populate form with tree data', () => {
      expect(component.form.get('commonName')!.value).toBe('White Oak');
      expect(component.form.get('scientificName')!.value).toBe('Quercus alba');
      expect(component.form.get('commemoration')!.value).toBe('Test dedication');
      expect(component.form.get('lat')!.value).toBe(42.94);
      expect(component.form.get('lng')!.value).toBe(-85.59);
    });

    it('should have form valid with pre-populated data', () => {
      expect(component.form.valid).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  describe('validation', () => {
    beforeEach(() => createComponent('create'));

    it('should require commonName', () => {
      const ctrl = component.form.get('commonName')!;
      ctrl.setValue('');
      expect(ctrl.hasError('required')).toBeTrue();
    });

    it('should require scientificName', () => {
      const ctrl = component.form.get('scientificName')!;
      ctrl.setValue('');
      expect(ctrl.hasError('required')).toBeTrue();
    });

    it('should require lat', () => {
      const ctrl = component.form.get('lat')!;
      ctrl.setValue('');
      expect(ctrl.hasError('required')).toBeTrue();
    });

    it('should require lng', () => {
      const ctrl = component.form.get('lng')!;
      ctrl.setValue('');
      expect(ctrl.hasError('required')).toBeTrue();
    });

    it('should NOT require commemoration', () => {
      const ctrl = component.form.get('commemoration')!;
      ctrl.setValue('');
      expect(ctrl.valid).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // save()
  // ---------------------------------------------------------------------------
  describe('save()', () => {
    beforeEach(() => createComponent('create'));

    it('should dismiss with saved:true and tree data when form is valid', () => {
      component.form.patchValue({
        commonName: 'Red Maple',
        scientificName: 'Acer rubrum',
        commemoration: 'Donor gift',
        lat: 43.0,
        lng: -86.0,
      });

      component.save();

      expect(modalCtrlSpy.dismiss).toHaveBeenCalledWith({
        saved: true,
        tree: {
          commonName: 'Red Maple',
          scientificName: 'Acer rubrum',
          commemoration: 'Donor gift',
          lat: 43.0,
          lng: -86.0,
        },
      });
    });

    it('should default commemoration to empty string when blank', () => {
      component.form.patchValue({
        commonName: 'Test',
        scientificName: 'Testus',
        commemoration: '',
      });

      component.save();

      const dismissArgs = modalCtrlSpy.dismiss.calls.mostRecent().args[0];
      expect(dismissArgs.tree.commemoration).toBe('');
    });

    it('should NOT dismiss when form is invalid', () => {
      component.form.patchValue({ commonName: '', scientificName: '' });
      component.save();
      expect(modalCtrlSpy.dismiss).not.toHaveBeenCalled();
    });

    it('should mark all controls as touched when form is invalid', () => {
      component.save();
      expect(component.form.get('commonName')!.touched).toBeTrue();
      expect(component.form.get('scientificName')!.touched).toBeTrue();
    });
  });

  // ---------------------------------------------------------------------------
  // cancel()
  // ---------------------------------------------------------------------------
  describe('cancel()', () => {
    beforeEach(() => createComponent('create'));

    it('should dismiss with saved:false', () => {
      component.cancel();
      expect(modalCtrlSpy.dismiss).toHaveBeenCalledWith({ saved: false });
    });
  });
});
