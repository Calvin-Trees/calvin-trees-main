import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { TreeService } from '../../../services/tree.service';
import { TreeInfo } from '../../../shared/interfaces/tree-info.interface';

@Component({
  selector: 'app-tree-list',
  templateUrl: './tree-list.component.html',
  styleUrls: ['./tree-list.component.scss'],
  standalone: true,
  imports: [FormsModule, IonicModule]
})
export class TreeListComponent implements OnInit, OnDestroy {
  @Output() editTree = new EventEmitter<TreeInfo>();
  @Output() deleteTree = new EventEmitter<TreeInfo>();

  trees: TreeInfo[] = [];
  filteredTrees: TreeInfo[] = [];
  searchQuery = '';

  private subscription: Subscription | null = null;

  constructor(private treeService: TreeService) {}

  ngOnInit(): void {
    this.subscription = this.treeService.trees$.subscribe(trees => {
      this.trees = trees;
      this.filterTrees();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  onSearchChange(): void {
    this.filterTrees();
  }

  private filterTrees(): void {
    if (!this.searchQuery.trim()) {
      this.filteredTrees = [...this.trees];
    } else {
      this.filteredTrees = this.treeService.searchTrees(this.searchQuery);
    }
  }

  onEdit(tree: TreeInfo): void {
    this.editTree.emit(tree);
  }

  onDelete(tree: TreeInfo): void {
    this.deleteTree.emit(tree);
  }
}
