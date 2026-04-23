import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { TreeInfo, GeoJsonFeature } from '../shared/interfaces/tree-info.interface';
import treeJson from '../../assets/trees.json';

const STORAGE_KEY = 'calvin-trees-admin-data';

/**
 * In-browser tree repository.
 *
 * Initial data comes from assets/trees.json. Admin edits are stored in
 * localStorage so non-developers can experiment without changing the checked-in
 * GeoJSON dataset.
 */
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
        // Stored data is unparseable (corrupted write or schema change) — fall back to defaults.
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

  /** Return a snapshot of the current tree records. */
  getTrees(): TreeInfo[] {
    return this.treesSubject.getValue();
  }

  /** Find one tree by its numeric asset/database id. */
  getTreeById(treeId: number): TreeInfo | undefined {
    return this.getTrees().find(tree => tree.treeId === treeId);
  }

  /** Create a local tree record with the next available id. */
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

  /** Update one local tree record, returning undefined when the id is missing. */
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

  /** Delete one local tree record, returning false when the id is missing. */
  deleteTree(treeId: number): boolean {
    const trees = this.getTrees();
    const filteredTrees = trees.filter(t => t.treeId !== treeId);

    if (filteredTrees.length === trees.length) {
      return false;
    }

    this.saveTrees(filteredTrees);
    return true;
  }

  /** Search by common name, scientific name, or commemoration text. */
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

  /** Discard local admin edits and reload the checked-in GeoJSON data. */
  resetToOriginal(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.loadFromJson();
  }
}
