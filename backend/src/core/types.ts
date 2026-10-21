export type LatLng = { lat: number; lng: number };

/** minLng, minLat, maxLng, maxLat */
export type BBox = { minLng: number; minLat: number; maxLng: number; maxLat: number };

export type VerificationStatus = "verified_now" | "verified_nearby" | "unverified";

/** Where the capture time came from. File EXIF is read by the server; client EXIF is only what the app claims. */
export type CaptureTimeSource = "file_exif" | "client_exif" | "server_receive" | "none";

export type PostStatus = "pending_media" | "published" | "rejected";

export type MediaType = "text" | "image";

export type Verification = {
  status: VerificationStatus;
  score: number;
  capturedAt: string | null;
  captureTimeSource: CaptureTimeSource;
  /** server time the content was received (S3 event time for media, API time for text) */
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
  mediaType: MediaType;
  caption: string;
  tags: string[];
  placeName: string;
  /** public, coarse location of the post (the place the user claims) */
  location: LatLng;
  geohash: string;
  /** private: exact location the user claimed (verification compares against this) */
  claimedLocation: LatLng;
  /** private: device GPS at upload time. Never returned by public APIs. */
  deviceLocation: LatLng | null;
  deviceAccuracyM: number | null;
  clientCapturedAt: string | null;
  /** device UTC offset in minutes, used to interpret EXIF times without a timezone */
  clientUtcOffsetMinutes: number | null;
  mediaKey: string | null;
  mediaUrl: string | null;
  status: PostStatus;
  verification: Verification | null;
  likeCount: number;
  createdAt: string;
  publishedAt: string | null;
};

/** What public APIs return */
export type PublicPost = Omit<
  Post,
  "claimedLocation" | "deviceLocation" | "deviceAccuracyM" | "clientCapturedAt" | "clientUtcOffsetMinutes" | "mediaKey"
> & {
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
  /** number of posts merged into this pin */
  count: number;
  postIds: string[];
  score: number;
  createdAt: string;
};

export function toPublicPost(post: Post): PublicPost {
  const {
    claimedLocation: _cl,
    deviceLocation: _d,
    deviceAccuracyM: _a,
    clientCapturedAt: _c,
    clientUtcOffsetMinutes: _o,
    mediaKey: _m,
    ...rest
  } = post;
  return rest;
}
