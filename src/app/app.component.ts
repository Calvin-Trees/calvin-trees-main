import { Component, OnInit, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { AlertController } from '@ionic/angular';
import { filter, Subscription } from 'rxjs';

@Component({
    selector: 'app-root',
    templateUrl: 'app.component.html',
    styleUrls: ['app.component.scss'],
    standalone: false
})
export class AppComponent implements OnInit, OnDestroy {
  private updateSub: Subscription | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;

  constructor(
    private swUpdate: SwUpdate,
    private alertController: AlertController
  ) {}

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;

    this.updateSub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => this.promptUpdate());

    // iOS aggressively caches standalone PWAs — poll every 5 minutes
    this.checkInterval = setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 5 * 60 * 1000);
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

  private async promptUpdate(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Update Available',
      message: 'A new version of Calvin Trees is available.',
      backdropDismiss: false,
      buttons: [
        { text: 'Later', role: 'cancel' },
        { text: 'Update', handler: () => document.location.reload() }
      ]
    });
    await alert.present();
  }
}
