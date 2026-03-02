import { ComponentFixture, TestBed } from '@angular/core/testing';
import { CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';
import { AdminPage } from '../../app/admin/admin.page';
import { TreeService } from '../../app/services/tree.service';
import { TreeInfo } from '../../app/shared/interfaces/tree-info.interface';

const AUTH_SESSION_KEY = 'calvin-trees-admin-auth';

const MOCK_TREE: TreeInfo = {
  treeId: 1,
  lng: -85.58,
  lat: 42.93,
  commonName: 'White Oak',
  scientificName: 'Quercus alba',
  commemoration: '',
};

describe('AdminPage', () => {
  let component: AdminPage;
  let fixture: ComponentFixture<AdminPage>;
  let treeServiceSpy: jasmine.SpyObj<TreeService>;
  let modalCtrlSpy: jasmine.SpyObj<ModalController>;
  let alertCtrlSpy: jasmine.SpyObj<AlertController>;

  beforeEach(async () => {
    sessionStorage.clear();

    treeServiceSpy = jasmine.createSpyObj('TreeService', [
      'createTree',
      'updateTree',
      'deleteTree',
      'resetToOriginal',
    ]);

    // Modal spy: create returns a fake modal with present() and onDidDismiss()
    modalCtrlSpy = jasmine.createSpyObj('ModalController', ['create']);

    // Alert spy: create returns a fake alert with present()
    alertCtrlSpy = jasmine.createSpyObj('AlertController', ['create']);

    await TestBed.configureTestingModule({
      declarations: [AdminPage],
      imports: [FormsModule, IonicModule.forRoot()],
      providers: [
        { provide: TreeService, useValue: treeServiceSpy },
        { provide: ModalController, useValue: modalCtrlSpy },
        { provide: AlertController, useValue: alertCtrlSpy },
      ],
      schemas: [CUSTOM_ELEMENTS_SCHEMA, NO_ERRORS_SCHEMA],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminPage);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  // ---------------------------------------------------------------------------
  // Authentication
  // ---------------------------------------------------------------------------
  describe('authentication', () => {
    it('should start unauthenticated when sessionStorage is empty', () => {
      fixture.detectChanges();
      expect(component.isAuthenticated).toBeFalse();
    });

    it('should start authenticated when sessionStorage has auth flag', () => {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      fixture.detectChanges(); // triggers ngOnInit -> checkAuth
      expect(component.isAuthenticated).toBeTrue();
    });

    it('should authenticate with correct passphrase', () => {
      fixture.detectChanges();
      component.passphraseInput = 'calvin';
      component.submitPassphrase();

      expect(component.isAuthenticated).toBeTrue();
      expect(component.passphraseError).toBe('');
      expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBe('true');
    });

    it('should reject incorrect passphrase', () => {
      fixture.detectChanges();
      component.passphraseInput = 'wrong';
      component.submitPassphrase();

      expect(component.isAuthenticated).toBeFalse();
      expect(component.passphraseError).toBe('Incorrect passphrase');
    });

    it('should clear error after correct passphrase following a failed attempt', () => {
      fixture.detectChanges();
      component.passphraseInput = 'wrong';
      component.submitPassphrase();
      expect(component.passphraseError).toBe('Incorrect passphrase');

      component.passphraseInput = 'calvin';
      component.submitPassphrase();
      expect(component.passphraseError).toBe('');
      expect(component.isAuthenticated).toBeTrue();
    });

    it('should reject empty passphrase', () => {
      fixture.detectChanges();
      component.passphraseInput = '';
      component.submitPassphrase();

      expect(component.isAuthenticated).toBeFalse();
      expect(component.passphraseError).toBe('Incorrect passphrase');
    });
  });

  // ---------------------------------------------------------------------------
  // Logout
  // ---------------------------------------------------------------------------
  describe('logout()', () => {
    it('should clear authentication state', () => {
      fixture.detectChanges();
      // Login first
      component.passphraseInput = 'calvin';
      component.submitPassphrase();
      expect(component.isAuthenticated).toBeTrue();

      component.logout();

      expect(component.isAuthenticated).toBeFalse();
      expect(component.passphraseInput).toBe('');
      expect(sessionStorage.getItem(AUTH_SESSION_KEY)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Create modal
  // ---------------------------------------------------------------------------
  describe('openCreateModal()', () => {
    it('should open a modal with mode "create"', async () => {
      fixture.detectChanges();
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: null, role: 'cancel' })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openCreateModal();

      expect(modalCtrlSpy.create).toHaveBeenCalledWith(
        jasmine.objectContaining({ componentProps: { mode: 'create' } })
      );
      expect(fakeModal.present).toHaveBeenCalled();
    });

    it('should call createTree when modal returns saved data', async () => {
      fixture.detectChanges();
      const savedTree = { commonName: 'Test', scientificName: 'Testus', commemoration: '', lat: 42, lng: -85 };
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: { saved: true, tree: savedTree } })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openCreateModal();

      expect(treeServiceSpy.createTree).toHaveBeenCalledWith(savedTree);
    });

    it('should NOT call createTree when modal is cancelled', async () => {
      fixture.detectChanges();
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: { saved: false } })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openCreateModal();

      expect(treeServiceSpy.createTree).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Edit modal
  // ---------------------------------------------------------------------------
  describe('openEditModal()', () => {
    it('should open a modal with mode "edit" and the tree', async () => {
      fixture.detectChanges();
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: null, role: 'cancel' })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openEditModal(MOCK_TREE);

      expect(modalCtrlSpy.create).toHaveBeenCalledWith(
        jasmine.objectContaining({
          componentProps: { mode: 'edit', tree: MOCK_TREE },
        })
      );
    });

    it('should call updateTree when modal returns saved data', async () => {
      fixture.detectChanges();
      const updates = { commonName: 'Updated', scientificName: 'Updatus', commemoration: '', lat: 43, lng: -86 };
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: { saved: true, tree: updates } })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openEditModal(MOCK_TREE);

      expect(treeServiceSpy.updateTree).toHaveBeenCalledWith(MOCK_TREE.treeId, updates);
    });

    it('should NOT call updateTree when modal is cancelled', async () => {
      fixture.detectChanges();
      const fakeModal = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
        onDidDismiss: jasmine.createSpy('onDidDismiss').and.returnValue(
          Promise.resolve({ data: null })
        ),
      };
      modalCtrlSpy.create.and.returnValue(Promise.resolve(fakeModal as any));

      await component.openEditModal(MOCK_TREE);

      expect(treeServiceSpy.updateTree).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Delete confirmation
  // ---------------------------------------------------------------------------
  describe('confirmDelete()', () => {
    it('should present an alert', async () => {
      fixture.detectChanges();
      const fakeAlert = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

      await component.confirmDelete(MOCK_TREE);

      expect(alertCtrlSpy.create).toHaveBeenCalled();
      expect(fakeAlert.present).toHaveBeenCalled();
    });

    it('should include the tree name in the alert message', async () => {
      fixture.detectChanges();
      const fakeAlert = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

      await component.confirmDelete(MOCK_TREE);

      const alertConfig = alertCtrlSpy.create.calls.mostRecent().args[0]!;
      expect(alertConfig['message']).toContain('White Oak');
    });

    it('should call deleteTree when destructive button handler is invoked', async () => {
      fixture.detectChanges();
      let capturedButtons: any[] = [];
      const fakeAlert = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });

      await component.confirmDelete(MOCK_TREE);

      // Find the destructive button and invoke its handler
      const deleteBtn = capturedButtons.find((b: any) => b.role === 'destructive');
      expect(deleteBtn).toBeTruthy();
      deleteBtn.handler();

      expect(treeServiceSpy.deleteTree).toHaveBeenCalledWith(MOCK_TREE.treeId);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset confirmation
  // ---------------------------------------------------------------------------
  describe('confirmReset()', () => {
    it('should present an alert', async () => {
      fixture.detectChanges();
      const fakeAlert = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      alertCtrlSpy.create.and.returnValue(Promise.resolve(fakeAlert as any));

      await component.confirmReset();

      expect(alertCtrlSpy.create).toHaveBeenCalled();
      expect(fakeAlert.present).toHaveBeenCalled();
    });

    it('should call resetToOriginal when destructive button handler is invoked', async () => {
      fixture.detectChanges();
      let capturedButtons: any[] = [];
      const fakeAlert = {
        present: jasmine.createSpy('present').and.returnValue(Promise.resolve()),
      };
      alertCtrlSpy.create.and.callFake((opts: any) => {
        capturedButtons = opts.buttons;
        return Promise.resolve(fakeAlert as any);
      });

      await component.confirmReset();

      const resetBtn = capturedButtons.find((b: any) => b.role === 'destructive');
      expect(resetBtn).toBeTruthy();
      resetBtn.handler();

      expect(treeServiceSpy.resetToOriginal).toHaveBeenCalled();
    });
  });
});
