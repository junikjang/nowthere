import type { BBox, LatLng } from "./types.js";

const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
const EARTH_RADIUS_M = 6_371_000;

export function encodeGeohash(lat: number, lng: number, precision: number): string {
  let latMin = -90;
  let latMax = 90;
  let lngMin = -180;
  let lngMax = 180;
  let hash = "";
  let bit = 0;
  let ch = 0;
  let evenBit = true;

  while (hash.length < precision) {
    if (evenBit) {
      const mid = (lngMin + lngMax) / 2;
      if (lng >= mid) {
        ch = (ch << 1) | 1;
        lngMin = mid;
      } else {
        ch = ch << 1;
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat >= mid) {
        ch = (ch << 1) | 1;
        latMin = mid;
      } else {
        ch = ch << 1;
        latMax = mid;
      }
    }
    evenBit = !evenBit;
    if (++bit === 5) {
      hash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return hash;
}

/** Size of one geohash cell in degrees for a given precision */
export function geohashCellSize(precision: number): { latDeg: number; lngDeg: number } {
  const totalBits = precision * 5;
  const lngBits = Math.ceil(totalBits / 2);
  const latBits = Math.floor(totalBits / 2);
  return { latDeg: 180 / 2 ** latBits, lngDeg: 360 / 2 ** lngBits };
}

/**
 * All geohash cells of the given precision that intersect the bbox.
 * Returns null when more than `maxCells` would be needed (caller should use a coarser strategy).
 */
export function geohashesCoveringBBox(bbox: BBox, precision: number, maxCells: number): string[] | null {
  const { latDeg, lngDeg } = geohashCellSize(precision);
  const latSteps = Math.floor(bbox.maxLat / latDeg) - Math.floor(bbox.minLat / latDeg) + 1;
  const lngSteps = Math.floor(bbox.maxLng / lngDeg) - Math.floor(bbox.minLng / lngDeg) + 1;
  if (latSteps * lngSteps > maxCells) return null;

  const cells = new Set<string>();
  const latStart = Math.floor(bbox.minLat / latDeg) * latDeg + latDeg / 2;
  const lngStart = Math.floor(bbox.minLng / lngDeg) * lngDeg + lngDeg / 2;
  for (let i = 0; i < latSteps; i++) {
    const lat = Math.min(89.999999, latStart + i * latDeg);
    for (let j = 0; j < lngSteps; j++) {
      const lng = Math.min(179.999999, lngStart + j * lngDeg);
      cells.add(encodeGeohash(lat, lng, precision));
    }
  }
  return [...cells];
}

export function bboxAround(center: LatLng, radiusM: number): BBox {
  const latDelta = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const lngDelta = latDelta / Math.max(0.01, Math.cos((center.lat * Math.PI) / 180));
  return {
    minLat: Math.max(-90, center.lat - latDelta),
    maxLat: Math.min(90, center.lat + latDelta),
    minLng: Math.max(-180, center.lng - lngDelta),
    maxLng: Math.min(180, center.lng + lngDelta)
  };
}

export function haversineM(a: LatLng, b: LatLng): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function inBBox(p: LatLng, bbox: BBox): boolean {
  return p.lat >= bbox.minLat && p.lat <= bbox.maxLat && p.lng >= bbox.minLng && p.lng <= bbox.maxLng;
}

export function parseBBox(raw: string | undefined): BBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [minLng, minLat, maxLng, maxLat] = parts as [number, number, number, number];
  if (minLat < -90 || maxLat > 90 || minLng < -180 || maxLng > 180) return null;
  if (minLat >= maxLat || minLng >= maxLng) return null; // antimeridian-crossing boxes are not supported in MVP
  return { minLng, minLat, maxLng, maxLat };
}

/** Round coordinates for public display (~110m at 3 decimals) so we don't leak exact positions */
export function coarsen(p: LatLng, decimals = 3): LatLng {
  const f = 10 ** decimals;
  return { lat: Math.round(p.lat * f) / f, lng: Math.round(p.lng * f) / f };
}
