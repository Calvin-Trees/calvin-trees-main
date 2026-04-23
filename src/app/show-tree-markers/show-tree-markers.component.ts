import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { TreeInfo } from '../shared/interfaces/tree-info.interface';

import { NgxMapLibreGLModule } from '@maplibre/ngx-maplibre-gl';

/**
 * Shared MapLibre marker layer for rendering a collection of tree points.
 *
 * Each instance must use a unique id because it creates source/layer ids in the
 * underlying map. Styling inputs intentionally stay simple so HomePage can
 * reuse this component for all, nearby, searched, and tour target markers.
 */
@Component({
    selector: 'app-show-tree-markers',
    templateUrl: './show-tree-markers.component.html',
    styleUrls: ['./show-tree-markers.component.scss'],
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        IonicModule,
        NgxMapLibreGLModule,
    ]
})
export class ShowTreeMarkersComponent {

  @Input() id: string = '';
  @Input() treesList: TreeInfo[] = [];
  @Input() color: string = '';
  @Input() markerRadius: number = 5;
  @Input() strokeColor: string = 'transparent';
  @Input() strokeWidth: number = 0;
  @Input() circleOpacity: number = 0.95;
}
