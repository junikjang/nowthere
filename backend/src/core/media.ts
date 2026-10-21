import exifr from "exifr";

import type { LatLng } from "./types.js";

export type ExtractedExif = {
  capturedAt: Date | null;
  gps: LatLng | null;
  orientation: number;
  hasExif: boolean;
};

export function isJpeg(buf: Uint8Array): boolean {
  return buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
}

/**
 * Parse "YYYY:MM:DD HH:MM:SS" EXIF time. EXIF has no timezone unless OffsetTimeOriginal is present,
 * so we fall back to the client's reported UTC offset (minutes, e.g. 540 for KST), then to UTC.
 */
export function parseExifDate(raw: unknown, offset: unknown, fallbackOffsetMinutes: number | null): Date | null {
  if (raw instanceof Date) return Number.isNaN(raw.getTime()) ? null : raw;
  if (typeof raw !== "string") return null;
  const m = raw.trim().match(/^(\d{4})[:-](\d{2})[:-](\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  let offsetStr: string;
  if (typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset.trim())) {
    offsetStr = offset.trim();
  } else if (fallbackOffsetMinutes != null) {
    const sign = fallbackOffsetMinutes >= 0 ? "+" : "-";
    const abs = Math.abs(fallbackOffsetMinutes);
    offsetStr = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  } else {
    offsetStr = "Z";
  }
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}${offsetStr}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function extractExif(buf: Uint8Array, clientUtcOffsetMinutes: number | null): Promise<ExtractedExif> {
  let tags: Record<string, unknown> | undefined;
  try {
    tags = await exifr.parse(buf, {
      tiff: true,
      exif: true,
      gps: true,
      reviveValues: false,
      translateValues: false,
      pick: [
        "DateTimeOriginal",
        "OffsetTimeOriginal",
        "CreateDate",
        "Orientation",
        "GPSLatitude",
        "GPSLatitudeRef",
        "GPSLongitude",
        "GPSLongitudeRef"
      ]
    });
  } catch {
    tags = undefined;
  }
  if (!tags) return { capturedAt: null, gps: null, orientation: 1, hasExif: false };

  const capturedAt =
    parseExifDate(tags.DateTimeOriginal, tags.OffsetTimeOriginal, clientUtcOffsetMinutes) ??
    parseExifDate(tags.CreateDate, tags.OffsetTimeOriginal, clientUtcOffsetMinutes);

  const gps = toLatLng(tags);
  const orientation = typeof tags.Orientation === "number" ? tags.Orientation : 1;
  return { capturedAt, gps, orientation, hasExif: true };
}

function dmsToDeg(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number")) {
    return v[0] + v[1] / 60 + v[2] / 3600;
  }
  return null;
}

function toLatLng(tags: Record<string, unknown>): LatLng | null {
  let lat = dmsToDeg(tags.GPSLatitude);
  let lng = dmsToDeg(tags.GPSLongitude);
  if (lat == null || lng == null) return null;
  if (tags.GPSLatitudeRef === "S") lat = -lat;
  if (tags.GPSLongitudeRef === "W") lng = -lng;
  if (lat === 0 && lng === 0) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** APP1 segment containing a minimal EXIF block with only the Orientation tag */
function orientationApp1(orientation: number): Uint8Array {
  const tiff = [
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, // "MM", 42, IFD0 at offset 8
    0x00, 0x01, // 1 entry
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, // tag 0x0112 Orientation, SHORT, count 1
    0x00, orientation & 0xff, 0x00, 0x00, // value
    0x00, 0x00, 0x00, 0x00 // no next IFD
  ];
  const payload = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...tiff]; // "Exif\0\0"
  const len = payload.length + 2;
  return Uint8Array.from([0xff, 0xe1, (len >> 8) & 0xff, len & 0xff, ...payload]);
}

/**
 * Remove EXIF/XMP/comments (including GPS) from a JPEG without re-encoding.
 * Keeps JFIF and ICC profile; re-inserts only the Orientation tag so photos are not shown rotated.
 */
export function stripJpegMetadata(buf: Uint8Array, orientation = 1): Uint8Array {
  if (!isJpeg(buf)) throw new Error("not a JPEG");
  const out: Uint8Array[] = [buf.subarray(0, 2)];
  if (orientation > 1 && orientation <= 8) out.push(orientationApp1(orientation));

  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) throw new Error(`bad JPEG marker at ${i}`);
    const marker = buf[i + 1]!;
    if (marker === 0xff) {
      i += 1; // fill byte
      continue;
    }
    if (marker === 0xda) {
      out.push(buf.subarray(i)); // start of scan: copy the rest verbatim
      break;
    }
    if (marker === 0xd9) {
      out.push(buf.subarray(i, i + 2));
      break;
    }
    const segLen = (buf[i + 2]! << 8) | buf[i + 3]!;
    const segEnd = i + 2 + segLen;
    const isAppN = marker >= 0xe1 && marker <= 0xef;
    const isComment = marker === 0xfe;
    const isIcc =
      marker === 0xe2 && Buffer.from(buf.subarray(i + 4, i + 4 + 11)).toString("latin1") === "ICC_PROFILE";
    if (!(isAppN || isComment) || isIcc) out.push(buf.subarray(i, segEnd));
    i = segEnd;
  }

  const total = out.reduce((n, p) => n + p.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const p of out) {
    result.set(p, off);
    off += p.length;
  }
  return result;
}
