# NowThere Map Clustering Spec

## 1. Goal

Keep the map readable while still showing real-time information density.

The default interaction should feel like this:
- zoomed out: only a few representative pins are shown
- medium zoom: important regions and districts become visible
- zoomed in: more specific places and posts appear

## 2. Default Language

All MVP map labels and system UI defaults use Korean first.

- `인기 지역`
- `내 주변`
- `지금 공유`
- `검증됨`

## 3. Viewport Aggregation Rule

For each map response:

1. take the current viewport `bbox`
2. split it into a `4 x 4` grid
3. evaluate posts/places inside each cell
4. return at most `3` representative pins per cell

### Maximum visible pins

- grid cells: `16`
- max pins per cell: `3`
- absolute max on screen: `48`

In practice, most cells will return fewer than 3 pins.

## 4. Zoom-Based Behavior

### Zoomed out
- prioritize countries, cities, or large districts
- merge nearby candidate places
- often return only 1 or 2 strong pins in a cell
- representative title can be region-level

### Mid zoom
- prioritize districts and landmarks
- return up to 2 or 3 pins when activity is high

### Zoomed in
- prioritize exact places and dense local hotspots
- show more precise pins inside the same area
- keep the `3 pins per cell` cap

## 5. Pin Candidate Selection

Within each grid cell:

1. gather candidate places/posts in the viewport
2. compute a representative score
3. sort descending
4. keep top 3
5. if two candidates are too close, merge them into one representative

### Suggested score

```text
representative_score =
  verification_score * 0.35 +
  recency_score * 0.30 +
  engagement_score * 0.20 +
  media_quality_score * 0.15
```

## 6. Merge Rule

When zoomed out, multiple nearby places should merge.

### Suggested merge thresholds

- zoom 3-5: merge within 20-40km
- zoom 6-8: merge within 5-10km
- zoom 9-11: merge within 1-3km
- zoom 12+: merge only very close pins

These values can be tuned later with real usage data.

## 7. API Contract Suggestion

### Request

`GET /v1/map/pins?bbox=minLng,minLat,maxLng,maxLat&zoom=9`

### Response shape

```json
{
  "locale": "ko-KR",
  "grid": {
    "rows": 4,
    "cols": 4,
    "maxPinsPerCell": 3
  },
  "pins": [
    {
      "id": "place_123",
      "type": "representative",
      "title": "강남역",
      "subtitle": "지금 가장 활발한 지역",
      "latitude": 37.4979,
      "longitude": 127.0276,
      "thumbnailUrl": "https://...",
      "postCount": 83,
      "verificationRatio": 0.74,
      "zoomTier": "district",
      "merged": false
    }
  ]
}
```

## 8. Server Algorithm Outline

### Step 1
- parse `bbox` and `zoom`

### Step 2
- build 16 viewport cells

### Step 3
- fetch candidate places/posts in bbox

### Step 4
- bucket candidates by cell

### Step 5
- apply zoom-based merge threshold

### Step 6
- rank candidates within each cell

### Step 7
- return top 3 representatives per cell

## 9. Why Server-Side Aggregation Is Better

- lower payload size
- consistent logic across iOS and Android
- easier ranking control
- easier abuse filtering
- easier caching by viewport + zoom

## 10. Future Improvements

- dynamic grid sizes based on device screen ratio
- heatmap layer under pins
- user-selected filters for `검증됨만`, `영상만`, `최근 10분`
- different ranking rules for `인기 지역` and `내 주변`
