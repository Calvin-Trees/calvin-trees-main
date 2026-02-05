export interface TreeInfo {
  treeId: number;
  lng: number;
  lat: number;
  commonName: string;
  scientificName: string;
  commemoration: string;
  localImgFile?: string;
}

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

export interface GeoJsonFeatureCollection {
  type: string;
  features: GeoJsonFeature[];
}
