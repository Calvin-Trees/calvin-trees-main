import { Component, inject, Input, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { TreeInfo } from '../../../shared/interfaces/tree-info.interface';

/**
 * Modal form used by the admin page to create or edit one tree record.
 *
 * The form returns normalized numeric coordinates to the caller and does not
 * write directly to persistence.
 */
@Component({
  selector: 'app-tree-form',
  templateUrl: './tree-form.component.html',
  styleUrls: ['./tree-form.component.scss'],
  standalone: true,
  imports: [ReactiveFormsModule, IonicModule]
})
export class TreeFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly modalController = inject(ModalController);

  @Input() mode: 'create' | 'edit' = 'create';
  @Input() tree?: TreeInfo;

  form!: FormGroup;

  private defaultLat = 42.9308076;
  private defaultLng = -85.5871801;

  ngOnInit(): void {
    this.form = this.fb.group({
      commonName: [this.tree?.commonName || '', Validators.required],
      scientificName: [this.tree?.scientificName || '', Validators.required],
      commemoration: [this.tree?.commemoration || ''],
      lat: [this.tree?.lat || this.defaultLat, Validators.required],
      lng: [this.tree?.lng || this.defaultLng, Validators.required]
    });
  }

  get title(): string {
    return this.mode === 'create' ? 'Add Tree' : 'Edit Tree';
  }

  cancel(): void {
    this.modalController.dismiss({ saved: false });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const formValue = this.form.value;
    // parseFloat: reactive form returns all values as strings, including number inputs.
    const treeData: Omit<TreeInfo, 'treeId'> = {
      commonName: formValue.commonName,
      scientificName: formValue.scientificName,
      commemoration: formValue.commemoration || '',
      lat: parseFloat(formValue.lat),
      lng: parseFloat(formValue.lng)
    };

    this.modalController.dismiss({
      saved: true,
      tree: treeData
    });
  }
}
