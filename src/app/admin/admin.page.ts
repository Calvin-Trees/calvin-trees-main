import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AlertController, IonicModule, ModalController } from '@ionic/angular';
import { TreeService } from '../services/tree.service';
import { TreeInfo } from '../shared/interfaces/tree-info.interface';
import { TreeFormComponent } from './components/tree-form/tree-form.component';
import { TreeListComponent } from './components/tree-list/tree-list.component';

const AUTH_SESSION_KEY = 'calvin-trees-admin-auth';
const PASSPHRASE = 'calvin';

/**
 * Admin maintenance page for the local tree database.
 *
 * Changes are persisted by TreeService in browser localStorage. The passphrase
 * gate is intentionally lightweight and should not be treated as server-side
 * authentication.
 */
@Component({
  selector: 'app-admin',
  templateUrl: './admin.page.html',
  styleUrls: ['./admin.page.scss'],
  standalone: true,
  imports: [FormsModule, IonicModule, TreeListComponent]
})
export class AdminPage implements OnInit {
  private readonly treeService = inject(TreeService);
  private readonly modalController = inject(ModalController);
  private readonly alertController = inject(AlertController);

  isAuthenticated = false;
  passphraseInput = '';
  passphraseError = '';

  ngOnInit() {
    this.checkAuth();
  }

  private checkAuth(): void {
    // sessionStorage (not localStorage) — auth clears when the tab closes,
    // so each new session requires re-entry of the passphrase.
    const auth = sessionStorage.getItem(AUTH_SESSION_KEY);
    this.isAuthenticated = auth === 'true';
  }

  submitPassphrase(): void {
    if (this.passphraseInput === PASSPHRASE) {
      sessionStorage.setItem(AUTH_SESSION_KEY, 'true');
      this.isAuthenticated = true;
      this.passphraseError = '';
    } else {
      this.passphraseError = 'Incorrect passphrase';
    }
  }

  async openCreateModal(): Promise<void> {
    const modal = await this.modalController.create({
      component: TreeFormComponent,
      componentProps: {
        mode: 'create'
      }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.saved) {
      this.treeService.createTree(data.tree);
    }
  }

  async openEditModal(tree: TreeInfo): Promise<void> {
    const modal = await this.modalController.create({
      component: TreeFormComponent,
      componentProps: {
        mode: 'edit',
        tree: tree
      }
    });

    await modal.present();

    const { data } = await modal.onDidDismiss();
    if (data?.saved) {
      this.treeService.updateTree(tree.treeId, data.tree);
    }
  }

  async confirmDelete(tree: TreeInfo): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Delete Tree',
      message: `Are you sure you want to delete "${tree.commonName}"?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: () => {
            this.treeService.deleteTree(tree.treeId);
          }
        }
      ]
    });

    await alert.present();
  }

  async confirmReset(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Reset Data',
      message: 'This will restore all trees to their original state. Any changes you made will be lost. Continue?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reset',
          role: 'destructive',
          handler: () => {
            this.treeService.resetToOriginal();
          }
        }
      ]
    });

    await alert.present();
  }

  logout(): void {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    this.isAuthenticated = false;
    this.passphraseInput = '';
  }
}
