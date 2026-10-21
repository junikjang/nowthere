import { MapPin, MapPinCandidate, PlacePost, ZoomLevel } from "../types";

export const popularPosts: PlacePost[] = [
  {
    id: "popular-1",
    placeName: "\uc2dc\ubd80\uc57c",
    country: "\uc77c\ubcf8",
    caption: "\uc2a4\ud06c\ub7a8\ube14 \uad50\ucc28\ub85c\uc5d0 \uc0ac\ub78c\uc774 \ub9ce\uace0 \ube44\uac00 \ub9c9 \ub0b4\ub9ac\uae30 \uc2dc\uc791\ud588\uc5b4\uc694.",
    imageLabel: "\ube44 \uc624\ub294 \uad50\ucc28\ub85c",
    verification: "\uc9c0\uae08 \uac80\uc99d\ub428",
    minutesAgo: 3,
    weather: "13\ub3c4 \ud750\ub9bc",
    liveCount: "\uc2e4\uc2dc\uac04 \uac8c\uc2dc\ubb3c 1.2\ucc9c\uac1c"
  },
  {
    id: "popular-2",
    placeName: "\uac15\ub0a8",
    country: "\ub300\ud55c\ubbfc\uad6d",
    caption: "\uc5ed \uadfc\ucc98 \ucd9c\uadfc\uae38 \ucc28\ub7c9 \ud750\ub984\uc774 \uc870\uae08\uc529 \ud480\ub9ac\uace0 \uc788\uc5b4\uc694.",
    imageLabel: "\ub3c4\uc2ec \uad50\ud1b5",
    verification: "\uadfc\ucc98 \uac80\uc99d\ub428",
    minutesAgo: 9,
    weather: "15\ub3c4 \ub9d1\uc74c",
    liveCount: "\uc2e4\uc2dc\uac04 \uac8c\uc2dc\ubb3c 860\uac1c"
  },
  {
    id: "popular-3",
    placeName: "\ud0c0\uc784\uc2a4\uc2a4\ud018\uc5b4",
    country: "\ubbf8\uad6d",
    caption: "\uc624\ub298 \ubc24 \ud589\uc0ac \uc804\uc774\ub77c \uad00\uad11\uac1d \uc778\ud30c\uac00 \ube60\ub974\uac8c \ub298\uace0 \uc788\uc5b4\uc694.",
    imageLabel: "\uc804\uad11\ud310 \uac70\ub9ac",
    verification: "\uc9c0\uae08 \uac80\uc99d\ub428",
    minutesAgo: 11,
    weather: "9\ub3c4 \uac15\ud55c \ubc14\ub78c",
    liveCount: "\uc2e4\uc2dc\uac04 \uac8c\uc2dc\ubb3c 640\uac1c"
  }
];

export const nearbyPosts: PlacePost[] = [
  {
    id: "nearby-1",
    placeName: "\uc11c\uc6b8\uc5ed",
    country: "\ub300\ud55c\ubbfc\uad6d",
    caption: "\ubc84\uc2a4 \uc904\uc774 \uae38\uace0 \uc2b9\uac15\uc7a5\ub3c4 \uc9c0\uae08 \uaf64 \ud63c\uc7a1\ud574\uc694.",
    imageLabel: "\ud658\uc2b9 \uc778\ud30c",
    verification: "\uc9c0\uae08 \uac80\uc99d\ub428",
    distanceLabel: "120m \uac70\ub9ac",
    minutesAgo: 2,
    weather: "14\ub3c4 \ud750\ub9bc",
    liveCount: "\uadfc\ucc98 \uac8c\uc2dc\ubb3c 312\uac1c"
  },
  {
    id: "nearby-2",
    placeName: "\ub0a8\ub300\ubb38",
    country: "\ub300\ud55c\ubbfc\uad6d",
    caption: "\ube44\uac00 \uc2dc\uc791\ub3fc\uc11c \ub178\uc810\ub4e4\uc774 \ucc9c\ub9c9\uc744 \uce58\uace0 \uc788\uc5b4\uc694.",
    imageLabel: "\uc2dc\uc7a5 \uace8\ubaa9",
    verification: "\uadfc\ucc98 \uac80\uc99d\ub428",
    distanceLabel: "450m \uac70\ub9ac",
    minutesAgo: 7,
    weather: "14\ub3c4 \uc774\uc2ac\ube44",
    liveCount: "\uadfc\ucc98 \uac8c\uc2dc\ubb3c 148\uac1c"
  },
  {
    id: "nearby-3",
    placeName: "\uc2dc\uccad",
    country: "\ub300\ud55c\ubbfc\uad6d",
    caption: "\uba54\uc778 \ub3c4\ub85c \uc815\uccb4\uac00 \uc870\uae08\uc529 \ud574\uc18c\ub418\uace0 \uc788\uc5b4\uc694.",
    imageLabel: "\ub3c4\uc2ec \ub300\ub85c",
    verification: "\ubbf8\uac80\uc99d",
    distanceLabel: "1.1km \uac70\ub9ac",
    minutesAgo: 15,
    weather: "14\ub3c4 \ud750\ub9bc",
    liveCount: "\uadfc\ucc98 \uac8c\uc2dc\ubb3c 91\uac1c"
  }
];

const mapPinCandidates: MapPinCandidate[] = [
  {
    id: "pin-1",
    title: "\uc2dc\ubd80\uc57c",
    subtitle: "\uad50\ucc28\ub85c \ud63c\uc7a1",
    topLabel: "1.2k",
    leftPct: 22,
    topPct: 28,
    tone: "coral",
    score: 98,
    category: "global"
  },
  {
    id: "pin-2",
    title: "\uac15\ub0a8\uc5ed",
    subtitle: "\ud1f4\uadfc \uad50\ud1b5",
    topLabel: "860",
    leftPct: 61,
    topPct: 44,
    tone: "teal",
    score: 92,
    category: "regional"
  },
  {
    id: "pin-3",
    title: "\uc11c\uc6b8\uc5ed",
    subtitle: "\ud658\uc2b9 \ud63c\uc7a1",
    topLabel: "312",
    leftPct: 43,
    topPct: 66,
    tone: "ocean",
    score: 81,
    category: "local"
  },
  {
    id: "pin-4",
    title: "\ud64d\ub300\uc785\uad6c",
    subtitle: "\uacf5\uc5f0 \ub300\uae30\uc5f4",
    topLabel: "205",
    leftPct: 55,
    topPct: 70,
    tone: "coral",
    score: 78,
    category: "local"
  },
  {
    id: "pin-5",
    title: "\uba85\ub3d9",
    subtitle: "\uad00\uad11\uac1d \uc99d\uac00",
    topLabel: "188",
    leftPct: 47,
    topPct: 52,
    tone: "teal",
    score: 74,
    category: "regional"
  },
  {
    id: "pin-6",
    title: "\ub3c4\ucfc4\uc5ed",
    subtitle: "\uc5f4\ucc28 \uc9c0\uc5f0",
    topLabel: "420",
    leftPct: 30,
    topPct: 46,
    tone: "ocean",
    score: 85,
    category: "regional"
  },
  {
    id: "pin-7",
    title: "\uc13c\ud2b8\ub7f4\ud30c\ud06c",
    subtitle: "\uc8fc\ub9d0 \uc778\ud30c",
    topLabel: "260",
    leftPct: 72,
    topPct: 26,
    tone: "coral",
    score: 76,
    category: "global"
  }
];

export const featuredPlace = popularPosts[0];

export const placeSearchSuggestions = [
  "\uc11c\uc6b8\uc5ed",
  "\uac15\ub0a8\uc5ed",
  "\ud64d\ub300\uc785\uad6c",
  "\uc2dc\ubd80\uc57c",
  "\ud0c0\uc784\uc2a4\uc2a4\ud018\uc5b4",
  "\uba85\ub3d9"
];

export function getMapPins(zoomLevel: ZoomLevel, searchQuery: string): MapPin[] {
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleCategories =
    zoomLevel === "global"
      ? ["global"]
      : zoomLevel === "regional"
        ? ["global", "regional"]
        : ["global", "regional", "local"];

  const filteredCandidates = mapPinCandidates
    .filter((candidate) => visibleCategories.includes(candidate.category))
    .filter((candidate) =>
      normalizedQuery.length === 0
        ? true
        : candidate.title.toLowerCase().includes(normalizedQuery) ||
          candidate.subtitle.toLowerCase().includes(normalizedQuery)
    );

  const buckets = new Map<string, MapPinCandidate[]>();

  filteredCandidates.forEach((candidate) => {
    const row = Math.min(3, Math.max(0, Math.floor(candidate.topPct / 25)));
    const col = Math.min(3, Math.max(0, Math.floor(candidate.leftPct / 25)));
    const key = `${row}-${col}`;

    if (!buckets.has(key)) {
      buckets.set(key, []);
    }

    buckets.get(key)?.push(candidate);
  });

  return Array.from(buckets.values())
    .flatMap((bucket) => bucket.sort((a, b) => b.score - a.score).slice(0, 3))
    .map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      subtitle: candidate.subtitle,
      topLabel: candidate.topLabel,
      left: `${candidate.leftPct}%`,
      top: `${candidate.topPct}%`,
      tone: candidate.tone
    }));
}
