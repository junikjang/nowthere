# NowThere MVP Blueprint

## 1. Product Structure

The MVP is organized around three primary actions:

- Explore a place in real time
- Share what is happening near me
- Verify and rank trusted local content

This means the initial app should have 4 core product surfaces:

- Home map
- Place detail
- Create post
- Profile / my activity

### Default product language
- Korean first (`ko-KR`)
- UI copy, system labels, and default content ordering should be designed for Korean users first
- multilingual expansion should be added later without changing core data structures

## 2. Information Architecture

### Main tab structure
- `Popular Now`
- `Map Home`
- `My Area`

This matches the product idea more closely:
- left tab shows the most popular places and posts globally or regionally
- center tab is the main screen with map + top search bar
- right tab shows popular posts near the user's current area

### Secondary actions
- search is embedded at the top of `Map Home`
- share is a floating action button on the main map
- profile and settings are opened from an avatar button or menu entry

### Navigation tree

```text
App
|- Auth
|  |- Welcome
|  |- Sign in
|  |- Sign up
|
|- Main
|  |- Popular Now
|  |  |- Popular Place List
|  |  |- Popular Post Feed
|  |  |- Place Detail
|  |
|  |- Map Home
|  |  |- Search Overlay
|  |  |- Place Preview Bottom Sheet
|  |  |- Place Detail
|  |
|  |- My Area
|  |  |- Nearby Popular Feed
|  |  |- Nearby Place List
|  |  |- Place Detail
|  |
|  |- Share Flow
|  |  |- Capture / Upload
|  |  |- Add Description
|  |  |- Verification Review
|  |  |- Upload Complete
|  |
|  |- Profile
|     |- My Posts
|     |- Verification History
|     |- Settings
```

## 3. MVP Screen List

### 1. Welcome / onboarding
- Short explanation of live local discovery
- Permission education for location and media

### 2. Popular now
- Ranked list of trending places
- Featured verified posts from the hottest regions
- Quick jump into a place detail screen

### 3. Map home
- Full-screen map
- Search bar at top
- Floating "share now" button
- Representative content pins with thumbnails
- Weather chip for visible area
- 4x4 viewport grid-based pin density control

### 4. My area
- Popular posts near the user's current area
- Sorted by freshness + verification + engagement
- Optional distance labels such as `120m away`, `1.2km away`

### 5. Place preview bottom sheet
- Place name
- Current weather snapshot
- Top verified thumbnail
- Recent post count
- Button to open full place page

### 6. Place detail
- Header image from top ranked verified post
- Place name and country
- Weather summary
- Live post feed
- Public signals module
- Filter chips: `verified`, `image`, `video`, `latest`

### 7. Search overlay
- Search input
- Suggested places
- Recent searches
- Results list with map mini-preview

### 8. Share capture/upload
- Camera or gallery picker
- Text-only post option
- Media type selection

### 9. Share compose
- Caption input
- Tag selection
- Chosen place preview
- Privacy note about coarse location display

### 10. Verification review
- Captured time detected
- Current location detected
- Distance from claimed place
- Expected verification badge shown before posting

### 11. Upload complete
- Verification result
- Button to view post on map

### 12. Profile
- User card
- Trust score summary
- My recent posts
- My verified ratio

## 4. Primary User Flows

### Flow A. Explore from map
1. User lands on the center `Map Home` tab
2. User sees pin clusters and thumbnail pins
3. User taps a pin
4. Place preview opens
5. User opens place detail
6. User browses live verified posts and weather

### Flow B. Search a location
1. User taps the top search bar on `Map Home`
2. User enters city, district, or landmark
3. User taps result
4. App centers map and opens place detail

### Flow C. Share current local status
1. User taps the floating `Share` button from the map
2. User records or uploads media
3. User adds caption and tags
4. App checks time/location metadata
5. User sees verification review
6. User publishes post

### Flow D. Browse hot regions
1. User opens the left `Popular Now` tab
2. User sees the most active or trending places
3. User taps a place or post
4. App opens that place detail screen

### Flow E. Browse nearby activity
1. User opens the right `My Area` tab
2. App uses current location permission to load nearby posts
3. User browses popular nearby content
4. User opens a nearby place or post

## 5. Low-Fidelity Wireframes

### A. Map home

```text
+--------------------------------------------------+
| Search places, landmarks, districts         [ ] |
|                                                  |
|     [pin]        [pin*thumb]        [cluster]    |
|                                                  |
|                MAP AREA                          |
|                                                  |
|        [pin*thumb]                [pin]          |
|                                                  |
|                            [Weather: 13C Cloudy] |
|                                        [Share+]  |
+--------------------------------------------------+
| Popular Now |  Map Home  | My Area               |
+--------------------------------------------------+
```

### B. Popular now

```text
+--------------------------------------------------+
| Popular Now                                      |
| Hottest places right now                         |
|--------------------------------------------------|
| 1. Shibuya         [thumb]  1.2k live posts      |
| 2. Gangnam         [thumb]    860 live posts     |
| 3. Times Square    [thumb]    640 live posts     |
|--------------------------------------------------|
| Featured posts                                   |
| [thumb] Heavy rain and traffic...                |
| [thumb] Festival crowd building up...            |
+--------------------------------------------------+
| Popular Now |  Map Home  | My Area               |
+--------------------------------------------------+
```

### C. My area

```text
+--------------------------------------------------+
| My Area                                          |
| Near Seoul Station                               |
|--------------------------------------------------|
| [thumb] Bus line very crowded      120m away     |
| [thumb] Rain starting now           450m away    |
| [thumb] Traffic clearing up         1.1km away   |
|--------------------------------------------------|
| Nearby hot places                                |
| Seoul Station | Namdaemun | City Hall            |
+--------------------------------------------------+
| Popular Now |  Map Home  | My Area               |
+--------------------------------------------------+
```

### D. Place detail

```text
+--------------------------------------------------+
| [Hero image from top verified post]              |
| Tokyo / Shibuya                                  |
| Cloudy 13C   Verified posts: 128                 |
| [verified] [latest] [image] [video]              |
|--------------------------------------------------|
| Live now                                         |
| [thumb] Caption snippet...     Verified Now      |
| [thumb] Caption snippet...     Verified Nearby   |
| [text ] Text-only post...      Unverified        |
|--------------------------------------------------|
| Public signals                                   |
| Weather | CCTV | Social                          |
+--------------------------------------------------+
```

### E. Share flow

```text
+--------------------------------------------------+
| Share what is happening now                      |
| [Open Camera]  [Upload Image]  [Upload Video]    |
| [Text only]                                      |
|--------------------------------------------------|
| Caption                                          |
| [............................................]   |
| Tags: [crowded] [rainy] [traffic] [event]        |
| Claimed place: Gangnam Station                   |
|--------------------------------------------------|
| Capture time: 09:14                              |
| Current location: Verified                       |
| Distance to place: 120m                          |
| Expected badge: Verified Now                     |
|                                      [Post]      |
+--------------------------------------------------+
```

## 6. Representative Pin Design

Each map pin should include:
- rounded image thumbnail
- small location marker shape
- optional popularity count
- verification emphasis on trusted content

### Viewport density rule
- split the current visible map into a 4x4 grid
- show at most 3 representative pins per grid cell
- merge nearby candidates more aggressively at low zoom
- reveal more detailed pins as zoom increases

### Pin selection logic
- choose the highest-ranked verified post in the visible place bucket
- if no verified media exists, use latest available media
- if no media exists, use a standard text pin

## 7. Ranking Rules for MVP

Use a simple and explainable ranking formula first.

### Feed score

```text
feed_score =
  verification_score * 0.45 +
  recency_score * 0.35 +
  engagement_score * 0.20
```

### Representative pin score

```text
pin_score =
  has_media * 0.20 +
  verification_score * 0.40 +
  recency_score * 0.25 +
  engagement_score * 0.15
```

## 8. Verification Rules for MVP

### Inputs
- device GPS on upload
- EXIF capture time
- EXIF GPS if available
- claimed place coordinates
- server receive timestamp

### Output badges
- `Verified Now`
- `Verified Nearby`
- `Unverified`

### Suggested server logic
- `Verified Now`
  - media captured within 10 minutes
  - upload device within 300m of claimed place
- `Verified Nearby`
  - media captured within 60 minutes
  - upload device within 2km of claimed place
- `Unverified`
  - missing metadata
  - timestamp mismatch too large
  - location mismatch beyond threshold

## 9. Backend Schema Draft

### tables

#### `users`
- `id` uuid pk
- `email` varchar unique
- `nickname` varchar
- `profile_image_url` varchar null
- `trust_score` numeric default 0
- `created_at` timestamptz

#### `places`
- `id` uuid pk
- `name` varchar
- `country_code` varchar(2)
- `region_name` varchar
- `latitude` numeric
- `longitude` numeric
- `geom` geography(point, 4326)
- `created_at` timestamptz

#### `posts`
- `id` uuid pk
- `user_id` uuid fk users(id)
- `place_id` uuid fk places(id)
- `post_type` varchar
- `caption` text null
- `media_url` varchar null
- `thumbnail_url` varchar null
- `status` varchar default 'published'
- `created_at` timestamptz
- `captured_at` timestamptz null
- `device_latitude` numeric null
- `device_longitude` numeric null
- `claimed_latitude` numeric null
- `claimed_longitude` numeric null
- `verification_status` varchar
- `verification_score` numeric default 0
- `engagement_score` numeric default 0

#### `post_tags`
- `id` uuid pk
- `post_id` uuid fk posts(id)
- `tag` varchar

#### `external_signals`
- `id` uuid pk
- `place_id` uuid fk places(id)
- `source_type` varchar
- `title` varchar
- `body` text null
- `source_url` varchar null
- `thumbnail_url` varchar null
- `published_at` timestamptz null
- `fetched_at` timestamptz

#### `post_metrics`
- `post_id` uuid pk fk posts(id)
- `view_count` int default 0
- `like_count` int default 0
- `comment_count` int default 0
- `share_count` int default 0

## 10. PostgreSQL Starter DDL

```sql
create extension if not exists postgis;

create table users (
  id uuid primary key,
  email varchar(255) unique not null,
  nickname varchar(50) not null,
  profile_image_url varchar(500),
  trust_score numeric(5,2) not null default 0,
  created_at timestamptz not null default now()
);

create table places (
  id uuid primary key,
  name varchar(120) not null,
  country_code varchar(2) not null,
  region_name varchar(120),
  latitude numeric(9,6) not null,
  longitude numeric(9,6) not null,
  geom geography(point, 4326) not null,
  created_at timestamptz not null default now()
);

create table posts (
  id uuid primary key,
  user_id uuid not null references users(id),
  place_id uuid not null references places(id),
  post_type varchar(20) not null,
  caption text,
  media_url varchar(500),
  thumbnail_url varchar(500),
  status varchar(20) not null default 'published',
  created_at timestamptz not null default now(),
  captured_at timestamptz,
  device_latitude numeric(9,6),
  device_longitude numeric(9,6),
  claimed_latitude numeric(9,6),
  claimed_longitude numeric(9,6),
  verification_status varchar(20) not null default 'unverified',
  verification_score numeric(5,2) not null default 0,
  engagement_score numeric(8,2) not null default 0
);

create table post_tags (
  id uuid primary key,
  post_id uuid not null references posts(id) on delete cascade,
  tag varchar(30) not null
);

create table external_signals (
  id uuid primary key,
  place_id uuid not null references places(id),
  source_type varchar(30) not null,
  title varchar(255) not null,
  body text,
  source_url varchar(500),
  thumbnail_url varchar(500),
  published_at timestamptz,
  fetched_at timestamptz not null default now()
);

create table post_metrics (
  post_id uuid primary key references posts(id) on delete cascade,
  view_count int not null default 0,
  like_count int not null default 0,
  comment_count int not null default 0,
  share_count int not null default 0
);

create index idx_places_geom on places using gist (geom);
create index idx_posts_place_created_at on posts (place_id, created_at desc);
create index idx_posts_verification_status on posts (verification_status);
create index idx_external_signals_place_id on external_signals (place_id);
```

## 11. Recommended API Set for the First Build

### Read APIs
- `GET /v1/places/search?q=...`
- `GET /v1/places/:placeId`
- `GET /v1/places/:placeId/posts`
- `GET /v1/places/:placeId/signals`
- `GET /v1/map/pins?bbox=...`

### Write APIs
- `POST /v1/posts/upload-url`
- `POST /v1/posts`
- `POST /v1/posts/:postId/reactions`

## 12. Recommended Sprint 1 Build Scope

If we start implementation now, Sprint 1 should be:

- Expo app bootstrap
- bottom tab navigation
- popular now screen
- map home screen with top search bar
- my area screen
- place detail screen shell
- floating share action
- mock data for posts and pins
- backend schema file

That is enough to make the product visible and test the core interaction loop before connecting real APIs.

## 13. Best Next Action

The next practical build step is one of these:

1. create the actual React Native app skeleton and screen files
2. create the backend project with schema and API route stubs
3. define the design system and visual style for the mobile UI

For momentum, option 1 is the strongest default.
