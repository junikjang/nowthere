import { haversineM } from "./geo.js";
import type { CaptureTimeSource, LatLng, Verification, VerificationStatus } from "./types.js";

export const VERIFICATION_RULES = {
  now: { maxAgeMinutes: 10, maxDistanceM: 300 },
  nearby: { maxAgeMinutes: 60, maxDistanceM: 2000 },
  /** capture times this far in the future (vs server clock) are treated as tampered */
  futureToleranceMinutes: 2,
  /** GPS fixes worse than this can never be "verified_now" */
  maxAccuracyForNowM: 150
} as const;

const SCORE: Record<VerificationStatus, number> = {
  verified_now: 1,
  verified_nearby: 0.6,
  unverified: 0.1
};

export type VerificationInput = {
  claimed: LatLng;
  device: LatLng | null;
  deviceAccuracyM: number | null;
  /** Trusted server-side time: S3 event time for media, API receive time for text */
  receivedAt: Date;
  capturedAt: Date | null;
  captureTimeSource: CaptureTimeSource;
  exifGps: LatLng | null;
};

const rank: VerificationStatus[] = ["unverified", "verified_nearby", "verified_now"];
const minStatus = (a: VerificationStatus, b: VerificationStatus) =>
  rank.indexOf(a) <= rank.indexOf(b) ? a : b;

/**
 * Decide how much we trust that a post is "here, right now".
 * Each signal (time, device location, EXIF location) yields a ceiling; the final status is the lowest ceiling.
 */
export function verify(input: VerificationInput): Verification {
  const reasons: string[] = [];
  const { now, nearby } = VERIFICATION_RULES;
  let ceiling: VerificationStatus = "verified_now";

  // --- time ---
  let captureAgeMinutes: number | null = null;
  if (!input.capturedAt || input.captureTimeSource === "none") {
    ceiling = "unverified";
    reasons.push("촬영 시각 정보 없음");
  } else {
    captureAgeMinutes = (input.receivedAt.getTime() - input.capturedAt.getTime()) / 60_000;
    if (captureAgeMinutes < -VERIFICATION_RULES.futureToleranceMinutes) {
      ceiling = "unverified";
      reasons.push("촬영 시각이 서버 시각보다 미래임 (시계 조작 의심)");
    } else if (captureAgeMinutes <= now.maxAgeMinutes) {
      // ok
    } else if (captureAgeMinutes <= nearby.maxAgeMinutes) {
      ceiling = minStatus(ceiling, "verified_nearby");
      reasons.push(`촬영 후 ${Math.round(captureAgeMinutes)}분 경과`);
    } else {
      ceiling = "unverified";
      reasons.push(`촬영 후 ${Math.round(captureAgeMinutes)}분 경과 (60분 초과)`);
    }
    if (input.captureTimeSource === "client_exif") {
      ceiling = minStatus(ceiling, "verified_nearby");
      reasons.push("파일에 EXIF가 없어 앱이 보고한 촬영 시각 사용");
    }
  }

  // --- device location vs claimed place ---
  let deviceDistanceM: number | null = null;
  if (!input.device) {
    ceiling = "unverified";
    reasons.push("기기 위치 정보 없음");
  } else {
    deviceDistanceM = haversineM(input.device, input.claimed);
    ceiling = minStatus(ceiling, distanceCeiling(deviceDistanceM));
    if (deviceDistanceM > now.maxDistanceM) reasons.push(`기기 위치가 장소에서 ${Math.round(deviceDistanceM)}m 떨어짐`);
    if (input.deviceAccuracyM != null && input.deviceAccuracyM > VERIFICATION_RULES.maxAccuracyForNowM) {
      ceiling = minStatus(ceiling, "verified_nearby");
      reasons.push(`GPS 정확도 낮음 (±${Math.round(input.deviceAccuracyM)}m)`);
    }
  }

  // --- EXIF GPS (optional, but if present it must agree) ---
  let exifGpsDistanceM: number | null = null;
  if (input.exifGps) {
    exifGpsDistanceM = haversineM(input.exifGps, input.claimed);
    ceiling = minStatus(ceiling, distanceCeiling(exifGpsDistanceM));
    if (exifGpsDistanceM > now.maxDistanceM) reasons.push(`사진 GPS가 장소에서 ${Math.round(exifGpsDistanceM)}m 떨어짐`);
  }

  return {
    status: ceiling,
    score: SCORE[ceiling],
    capturedAt: input.capturedAt ? input.capturedAt.toISOString() : null,
    captureTimeSource: input.captureTimeSource,
    receivedAt: input.receivedAt.toISOString(),
    captureAgeMinutes: captureAgeMinutes == null ? null : Math.round(captureAgeMinutes * 10) / 10,
    deviceDistanceM: deviceDistanceM == null ? null : Math.round(deviceDistanceM),
    exifGpsDistanceM: exifGpsDistanceM == null ? null : Math.round(exifGpsDistanceM),
    reasons
  };
}

function distanceCeiling(distanceM: number): VerificationStatus {
  if (distanceM <= VERIFICATION_RULES.now.maxDistanceM) return "verified_now";
  if (distanceM <= VERIFICATION_RULES.nearby.maxDistanceM) return "verified_nearby";
  return "unverified";
}
