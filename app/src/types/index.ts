export type VerificationStatus = "지금 검증됨" | "근처 검증됨" | "미검증";

export type PlacePost = {
  id: string;
  placeName: string;
  country: string;
  caption: string;
  imageLabel: string;
  verification: VerificationStatus;
  distanceLabel?: string;
  minutesAgo: number;
  weather: string;
  liveCount: string;
};

export type MapPinTone = "coral" | "teal" | "ocean";

export type ZoomLevel = "global" | "regional" | "local";

export type MapPinCandidate = {
  id: string;
  title: string;
  subtitle: string;
  topLabel: string;
  leftPct: number;
  topPct: number;
  tone: MapPinTone;
  score: number;
  category: "global" | "regional" | "local";
};

export type MapPin = {
  id: string;
  title: string;
  subtitle: string;
  topLabel: string;
  left: string;
  top: string;
  tone: MapPinTone;
};
