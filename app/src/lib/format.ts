import type { VerificationStatus } from "../api/types";
import { colors } from "../theme/colors";

export const verificationLabel: Record<VerificationStatus, string> = {
  verified_now: "지금 검증됨",
  verified_nearby: "근처 검증됨",
  unverified: "미검증"
};

export const verificationTone: Record<VerificationStatus, { fg: string; bg: string }> = {
  verified_now: { fg: colors.teal, bg: "#D8F3EE" },
  verified_nearby: { fg: colors.ocean, bg: "#DBEAFE" },
  unverified: { fg: colors.slate, bg: colors.cloud }
};

export function timeAgo(iso: string, now = Date.now()): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

export function distanceLabel(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10}m` : `${(m / 1000).toFixed(1)}km`;
}
