import { Component, Input, OnInit } from '@angular/core';
import { IonicModule } from '@ionic/angular';

import { TreeInfo } from '../home/home.page';

import { NgxMapLibreGLModule } from '@maplibre/ngx-maplibre-gl';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-show-tree-markers',
    templateUrl: './show-tree-markers.component.html',
    styleUrls: ['./show-tree-markers.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        IonicModule,
        NgxMapLibreGLModule,
    ]
})
export class ShowTreeMarkersComponent {

  @Input() id: string = '';
  @Input() treesList: TreeInfo[] = [];
  @Input() color: string = '';
  @Input() markerRadius: number = 5;

  constructor() { }

}
