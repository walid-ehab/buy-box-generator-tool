export type LatLng = [number, number];

export interface Listing {
  id: string;
  title: string;
  url: string;
  beds: number;
  sleeps: number;
  baths: number;
  rev: number;
  adr: number | null;
  occ: number | null;
  lat: number | null;
  lng: number | null;
  zip: string;
  /** 0/1 per dataset.amenities index */
  am: number[];
  /** % of reviews per dataset.traveler category (0–100) */
  tp?: number[];
  /** number of reviews, used to weight the traveler mix */
  rw?: number;
}

export interface Dataset {
  source: string;
  amenities: { key: string; label: string }[];
  /** review-share categories found in the data (pct_* columns) */
  traveler?: { key: string; label: string }[];
  listings: Listing[];
}

export type RangeOp = 'eq' | 'range' | 'gte' | 'lte';
export interface Range { op: RangeOp; a: number; b: number }

export interface Img { src: string; caption: string }

export interface UWExample { title: string; link: string; note: string; revenue: string; price: string }

export interface BuyBox {
  id: string;
  name: string;
  tagline: string;
  regions: LatLng[][];
  beds: Range;
  baths: Range;
  sleeps: Range;
  /** which of the ranges also restrict the listings used in the analytics below */
  filterBy: { beds: boolean; baths: boolean; sleeps: boolean };
  must: {
    /** which listings the penetration is measured over: those at/above the market threshold (default) or all */
    scope?: 'threshold' | 'all';
    penetration: number;             // % cutoff
    selected: string[];              // amenity keys
    touched: boolean;                // user has manually changed the selection
    notes: Record<string, string>;
    images: Record<string, Img[]>;
  };
  nice: {
    topPct: number;
    minCount: number;
    vifLimit: number;
    selected: string[];
    touched: boolean;
    notes: Record<string, string>;
    images: Record<string, Img[]>;
  };
  /** which listings the traveler mix is measured over: those at/above the market threshold (default) or all */
  travelerScope?: 'threshold' | 'all';
  text: Record<string, string>;
  images: Record<string, Img[]>;
  uw: UWExample[];
}

export interface Market {
  name: string;
  region: string;
  tagline: string;
  heroImage: Img | null;
  about: string;
  visitors: string;
  whyStr: string;
  places: string;          // one per line
  gallery: Img[];
}

export interface Spec {
  version: 1;
  market: Market;
  threshold: number;
  boxes: BuyBox[];
}

export interface Bundle { spec: Spec; data: Dataset }
