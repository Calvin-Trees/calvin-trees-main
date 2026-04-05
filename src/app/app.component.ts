import { Component, OnInit, OnDestroy } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
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

  constructor(private swUpdate: SwUpdate) {}

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;

    // When a new version is ready, activate it immediately and reload.
    // Prompting with "Later" trapped users on stale cached versions.
    this.updateSub = this.swUpdate.versionUpdates
      .pipe(filter((evt): evt is VersionReadyEvent => evt.type === 'VERSION_READY'))
      .subscribe(() => {
        this.swUpdate.activateUpdate().then(() => document.location.reload());
      });

    // iOS aggressively caches standalone PWAs — poll every 30 seconds
    this.checkInterval = setInterval(() => {
      this.swUpdate.checkForUpdate();
    }, 30 * 1000);
  }

  ngOnDestroy(): void {
    this.updateSub?.unsubscribe();
    if (this.checkInterval) clearInterval(this.checkInterval);
  }

}
