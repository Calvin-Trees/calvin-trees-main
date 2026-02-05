import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

import { AdminPageRoutingModule } from './admin-routing.module';
import { AdminPage } from './admin.page';
import { TreeListComponent } from './components/tree-list/tree-list.component';
import { TreeFormComponent } from './components/tree-form/tree-form.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    IonicModule,
    AdminPageRoutingModule,
    TreeListComponent,
    TreeFormComponent
  ],
  declarations: [AdminPage]
})
export class AdminPageModule {}
