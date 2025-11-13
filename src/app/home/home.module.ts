import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HomePage } from './home.page';

import { HomePageRoutingModule } from './home-routing.module';
import { NgxMapLibreGLModule } from '@maplibre/ngx-maplibre-gl';
import { ShowTreeMarkersComponent } from '../show-tree-markers/show-tree-markers.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    NgxMapLibreGLModule,
    ShowTreeMarkersComponent,
  ],
  declarations: [HomePage]
})
export class HomePageModule { }
