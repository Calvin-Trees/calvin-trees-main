import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TreeInfo, GeoJsonFeature } from '../shared/interfaces/tree-info.interface';
import treeJson from '../../assets/trees.json';

const STORAGE_KEY = 'calvin-trees-admin-data';

@Injectable({
  providedIn: 'root'
})
export class TreeService {
  private treesSubject = new BehaviorSubject<TreeInfo[]>([]);
  public trees$ = this.treesSubject.asObservable();

  constructor() {
    this.loadTrees();
  }

  private loadTrees(): void {
    const storedData = localStorage.getItem(STORAGE_KEY);

    if (storedData) {
      try {
        const trees = JSON.parse(storedData) as TreeInfo[];
        this.treesSubject.next(trees);
      } catch {
        this.loadFromJson();
      }
    } else {
      this.loadFromJson();
    }
  }

  private loadFromJson(): void {
    const trees = this.parseGeoJsonToTrees(treeJson.features as GeoJsonFeature[]);
    this.treesSubject.next(trees);
  }

  private parseGeoJsonToTrees(features: GeoJsonFeature[]): TreeInfo[] {
    return features.map((feature) => ({
      treeId: feature.properties.OBJECTID,
      lng: feature.geometry.coordinates[0],
      lat: feature.geometry.coordinates[1],
      commonName: feature.properties.common_nam,
      scientificName: feature.properties.scientific,
      commemoration: feature.properties.commemorat || ''
    }));
  }

  private saveTrees(trees: TreeInfo[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trees));
    this.treesSubject.next(trees);
  }

  getTrees(): TreeInfo[] {
    return this.treesSubject.getValue();
  }

  getTreeById(treeId: number): TreeInfo | undefined {
    return this.getTrees().find(tree => tree.treeId === treeId);
  }

  createTree(tree: Omit<TreeInfo, 'treeId'>): TreeInfo {
    const trees = this.getTrees();
    const maxId = trees.reduce((max, t) => Math.max(max, t.treeId), 0);
    const newTree: TreeInfo = {
      ...tree,
      treeId: maxId + 1
    };
    this.saveTrees([...trees, newTree]);
    return newTree;
  }

  updateTree(treeId: number, updates: Partial<Omit<TreeInfo, 'treeId'>>): TreeInfo | undefined {
    const trees = this.getTrees();
    const index = trees.findIndex(t => t.treeId === treeId);

    if (index === -1) {
      return undefined;
    }

    const updatedTree = { ...trees[index], ...updates };
    const updatedTrees = [...trees];
    updatedTrees[index] = updatedTree;
    this.saveTrees(updatedTrees);
    return updatedTree;
  }

  deleteTree(treeId: number): boolean {
    const trees = this.getTrees();
    const filteredTrees = trees.filter(t => t.treeId !== treeId);

    if (filteredTrees.length === trees.length) {
      return false;
    }

    this.saveTrees(filteredTrees);
    return true;
  }

  searchTrees(query: string): TreeInfo[] {
    if (!query.trim()) {
      return this.getTrees();
    }

    const lowerQuery = query.toLowerCase();
    return this.getTrees().filter(tree =>
      tree.commonName.toLowerCase().includes(lowerQuery) ||
      tree.scientificName.toLowerCase().includes(lowerQuery) ||
      tree.commemoration.toLowerCase().includes(lowerQuery)
    );
  }

  resetToOriginal(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.loadFromJson();
  }
}
