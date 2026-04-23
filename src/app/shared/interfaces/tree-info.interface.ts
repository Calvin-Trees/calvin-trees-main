/** Normalized tree record used by the map, search UI, tours, and admin tools. */
export interface TreeInfo {
  treeId: number;
  lng: number;
  lat: number;
  commonName: string;
  scientificName: string;
  commemoration: string;
  localImgFile?: string; // Populated at display time by getTreeImagePath(); absent in stored records.
}

/** Raw GeoJSON feature shape from assets/trees.json. */
export interface GeoJsonFeature {
  type: string;
  id: number;
  geometry: {
    type: string;
    coordinates: number[];
  };
  properties: {
    OBJECTID: number;
    globalid: string;
    common_nam: string;
    scientific: string;
    commemorat: string;
    [key: string]: any;
  };
}

/** Raw GeoJSON feature collection shape from assets/trees.json. */
export interface GeoJsonFeatureCollection {
  type: string;
  features: GeoJsonFeature[];
}
