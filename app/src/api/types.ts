// Mirrors backend/src/core/types.ts (public shapes only)

export type LatLng = { lat: number; lng: number };

export type VerificationStatus = "verified_now" | "verified_nearby" | "unverified";

export type Verification = {
  status: VerificationStatus;
  score: number;
  capturedAt: string | null;
  captureTimeSource: "file_exif" | "client_exif" | "server_receive" | "none";
  receivedAt: string;
  captureAgeMinutes: number | null;
  deviceDistanceM: number | null;
  exifGpsDistanceM: number | null;
  reasons: string[];
};

export type Post = {
  id: string;
  userId: string;
  nickname: string;
  mediaType: "text" | "image";
  caption: string;
  tags: string[];
  placeName: string;
  location: LatLng;
  geohash: string;
  mediaUrl: string | null;
  status: "pending_media" | "published" | "rejected";
  verification: Verification | null;
  likeCount: number;
  createdAt: string;
  publishedAt: string | null;
  feedScore?: number;
  distanceM?: number;
};

export type MapPin = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  caption: string;
  mediaUrl: string | null;
  verification: VerificationStatus;
  count: number;
  postIds: string[];
  score: number;
  createdAt: string;
};

export type HotArea = {
  geohash: string;
  placeName: string;
  location: LatLng;
  postCount: number;
  verifiedCount: number;
  heat: number;
  topPost: Post;
};

export type UploadTarget = { url: string; fields: Record<string, string>; maxBytes: number };

export type CreatePostInput = {
  mediaType: "text" | "image";
  caption: string;
  tags: string[];
  placeName: string;
  location: LatLng;
  device: (LatLng & { accuracyM?: number | null }) | null;
  clientCapturedAt?: string | null;
  clientUtcOffsetMinutes?: number | null;
};
