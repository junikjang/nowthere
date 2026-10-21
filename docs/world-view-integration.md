# NowThere World View Integration

## 1. Direction

NowThere should evolve beyond local user posts and become a live world surface.

The reference feeling is similar to a "world view" product:
- the map itself becomes the product
- users can zoom out to see global motion and zoom in to see local reality
- machine-fed global signals and human-fed local signals coexist

This fits NowThere especially well because:
- user posts explain what a place feels like
- world-scale feeds explain what is moving above and across that place

## 2. Product Layer Model

The map should support multiple live layers.

### Layer A. Human local layer
- verified text/image/video posts
- nearby activity
- popular regional posts

### Layer B. Public real-time infrastructure layer
- weather
- CCTV
- emergency/public feeds

### Layer C. World motion layer
- satellites
- civilian aircraft
- military aircraft where publicly available

## 3. Suggested Data Sources

### CelesTrak
- use for satellite orbit / TLE-based position data
- useful for showing active satellites above a region
- can support educational / observability style overlays

### OpenSky Network
- use for civilian aircraft location and movement
- useful for showing real-time aircraft density and notable flight paths

### Airplanes.live
- use for military aircraft or special flight tracking where publicly available
- should be treated as an optional advanced layer because availability and policy can vary

## 4. How This Fits the Existing UX

### On zoom out
- show world motion overlays such as major aircraft activity and satellite passes
- merge user posts more aggressively
- emphasize macro activity and moving signals

### On medium zoom
- show regional place pins + high-signal aircraft/satellite markers
- let the user toggle layers on/off

### On zoom in
- prioritize local verified posts
- show only the most relevant world objects near the current viewport

## 5. Recommended UI Pattern

Add a lightweight layer switcher on the map.

### Suggested layer toggles
- `현장`
- `날씨`
- `CCTV`
- `항공기`
- `위성`
- `군용기`

Default MVP visible layers:
- `현장`
- `날씨`

Phase 2:
- `항공기`
- `위성`

Phase 3:
- `군용기`

## 6. Ranking Philosophy

These world-view layers should not be ranked exactly like user posts.

### User posts
- ranked by verification, recency, engagement

### Aircraft
- ranked by viewport relevance, movement significance, altitude/type filters

### Satellites
- ranked by visibility window, orbit relevance, pass timing

### Military aircraft
- ranked by source confidence and viewport relevance

## 7. API Design Impact

The current map API should evolve from:

- `GET /v1/map/pins`

into a broader viewport feed concept:

- `GET /v1/map/layers`
- `GET /v1/map/pins`
- `GET /v1/map/traffic/aircraft`
- `GET /v1/map/traffic/satellites`

Example request shape:

`GET /v1/map/layers?bbox=...&zoom=...&layers=posts,weather,aircraft,satellites`

## 8. Data Modeling Suggestion

Do not force aircraft and satellites into the same table as user posts.

Recommended approach:
- keep `posts` separate
- add `tracked_objects`
- add `tracked_object_snapshots`

### tracked_objects
- id
- source_type (`opensky`, `celestrak`, `airplanes_live`)
- object_type (`aircraft`, `satellite`, `military_aircraft`)
- external_id
- display_name
- metadata_json

### tracked_object_snapshots
- id
- tracked_object_id
- latitude
- longitude
- altitude
- heading
- speed
- observed_at
- raw_payload_json

## 9. Map Rendering Rule with Existing Grid Logic

The current 4x4 grid rule still works, but by layer.

### Human posts
- max 3 representative pins per cell

### Aircraft/satellites
- separate cap or icon-density rule
- do not let moving objects visually bury local posts

Recommended:
- posts follow the existing 3-per-cell representative rule
- aircraft and satellites use lighter icon density and low-zoom filtering

## 10. Practical Rollout Order

### Step 1
- keep current local-post product loop
- stabilize posts, search, place detail, map density logic

### Step 2
- add weather layer toggle

### Step 3
- add OpenSky aircraft layer

### Step 4
- add CelesTrak satellite layer

### Step 5
- evaluate Airplanes.live integration as an optional advanced layer

## 11. Best Product Framing

This gives NowThere a stronger identity:

"A real-time world map that combines verified local posts with live public signals and moving global objects."
