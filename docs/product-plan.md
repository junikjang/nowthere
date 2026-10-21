# NowThere Product Plan

## 1. Product Concept

NowThere is a location-based real-time information sharing app that helps users explore what is happening "right now" anywhere in the world.

Users can:
- view public real-time signals for a place
- search or select a region on a map
- share what is happening around them in real time
- verify freshness and credibility of shared content using capture time and location metadata

The core product promise is:

"See what is happening there, right now."

Default launch language:
- Korean first (`ko-KR`)

## 2. Core User Value

### Viewer value
- Check live conditions in a region before traveling or commuting
- Discover current weather, local atmosphere, crowds, incidents, and public activity
- Compare multiple real-time sources in one place

### Contributor value
- Share what is happening around them immediately
- Build trust through verified location/time proof
- Gain visibility when posts become representative content on the map

## 3. Key Features

### A. Real-time place lookup
- Search by city, district, landmark, or coordinates
- Select a place directly on the map
- Load public real-time information related to that place

### B. External real-time signal aggregation
- CCTV or public live camera feeds where legally available
- Weather conditions and short-term forecast
- Related X/Twitter posts
- Related Instagram posts or public social posts where API/policy allows
- Satellite orbit and visibility layers
- Civilian aircraft movement layers
- Military aircraft tracking layers where publicly available

Note:
- Instagram and X integration depend heavily on official API access and policy limits.
- In practice, the product should be designed so unsupported sources can be disabled by region/platform policy.
- World motion data should be treated as optional map layers rather than mixed directly into the user post feed.

### C. User-generated live sharing
- Text posts
- Image uploads
- Video uploads
- Optional short status tags such as `crowded`, `rainy`, `traffic`, `quiet`, `event`

### D. Verification layer
- Request device permissions for location
- Request media metadata for capture time
- Validate upload freshness against server receive time
- Validate claimed location against device geolocation
- Mark posts with verification badges

### E. Search and map exploration
- Search results list + map view
- Pins shown with representative thumbnail
- Most popular verified post in an area becomes the default preview pin
- Tap pin to open place feed

### F. Main home navigation
- Center tab is the main home with map + top search bar
- Left tab shows the most popular regions and current popular posts
- Right tab shows popular posts around the user's current area
- The share action is accessible directly from the main map

### G. Map pin density control
- The visible map viewport is divided into a 4x4 grid
- Each grid cell shows at most 3 representative pins
- Zoom out merges nearby pins into fewer representatives
- Zoom in reveals more local and detailed pins

### H. World view expansion
- The product should support a future "world view" mode
- Local verified posts remain the primary human layer
- Additional machine-fed layers can include satellites, civilian aircraft, and military aircraft
- These layers should be toggleable and should not overpower the local post layer

## 4. Recommended MVP Scope

To ship faster, the MVP should focus on the smallest usable loop:

### MVP included
- User auth
- Map-based region browsing
- Place search
- Feed by location
- User posts with text/image/video
- Verified capture time + current location checks
- Weather integration
- Popular representative pin on map

### MVP excluded or phase 2
- CCTV aggregation in all countries
- Full Instagram integration
- Full X/Twitter ingestion at scale
- Advanced moderation automation
- Live streaming
- Ranking personalization

## 5. User Flows

### Flow 1. Explore a place
1. User opens app
2. User searches "Shibuya" or taps map
3. App loads place summary
4. App shows:
   - weather
   - verified recent posts
   - available public live feeds
   - trending representative post

### Flow 2. Share current local info
1. User taps "Share now"
2. App requests location permission
3. User records text, image, or video
4. App reads capture metadata
5. Server verifies freshness and location consistency
6. Post is published with badges such as:
   - Verified time
   - Verified location
   - Unverified

### Flow 3. Browse the map
1. User zooms to a region
2. App clusters posts by area
3. Each cluster or pin shows representative thumbnail
4. Most popular recent verified post is used as the lead visual

### Flow 4. Browse popular and nearby tabs
1. User switches between left, center, and right tabs
2. Left tab shows globally or regionally trending areas
3. Center tab shows the interactive map and search
4. Right tab shows nearby popular posts using current location

## 6. Trust and Verification Design

This is one of the most important parts of the product.

### Verification signals
- Device location at upload time
- EXIF capture timestamp from image/video
- EXIF GPS if available
- Difference between media capture time and upload time
- Distance between capture location and current device location

### Suggested rules
- `Verified Now`: capture time within 10 minutes and device location within 300m of claimed place
- `Verified Nearby`: location matches area but capture time is older
- `Unverified`: metadata missing or mismatched

### Abuse prevention
- Strip precise personal location from public output and expose only coarse area
- Prevent uploads with manual timestamp tampering by comparing server receive time and client telemetry
- Rate limit spam by account/device/IP
- Require moderation review for flagged uploads

## 7. Map UX

### Map pin behavior
- Show thumbnail + small popularity indicator
- Use clustering when zoomed out
- Use dominant/most popular verified content as representative image

### Place detail screen
- Hero card with current weather and trust summary
- Tabs or sections:
  - Live posts
  - Public feeds
  - Weather
  - Social mentions

### Ranking for representative pin
- Recent verified posts weighted highest
- Engagement score
- Media quality score
- Recency decay

Example:

`pin_score = verification_weight * 0.5 + recency * 0.3 + engagement * 0.2`

## 8. Suggested System Architecture

### Frontend
- Mobile app: React Native with Expo
- Map: Mapbox or Google Maps
- Media upload: direct upload to object storage

### Backend
- API: Node.js with NestJS or Next.js API routes
- Database: PostgreSQL + PostGIS
- Cache: Redis
- Storage: S3-compatible object storage
- Jobs: background workers for metadata extraction, moderation, and ranking

### External integrations
- Weather API
- Public CCTV/open camera sources by country or municipality
- Social platform APIs where official access exists
- CelesTrak for satellite orbit data
- OpenSky Network for civilian aircraft
- Airplanes.live for military aircraft where appropriate

## 9. Suggested Data Model

### Users
- id
- nickname
- profile_image
- trust_score
- created_at

### Places
- id
- name
- country
- region
- latitude
- longitude
- geom

### Posts
- id
- user_id
- place_id
- type (`text`, `image`, `video`)
- text_content
- media_url
- thumbnail_url
- created_at
- captured_at
- verification_status
- verification_score
- visibility_radius
- latitude
- longitude

### ExternalSignals
- id
- place_id
- source_type (`weather`, `cctv`, `x`, `instagram`)
- title
- body
- url
- thumbnail_url
- fetched_at

## 10. API Example Surface

### Public read APIs
- `GET /places/search?q=seoul`
- `GET /places/:id/feed`
- `GET /places/:id/signals`
- `GET /map/tiles/posts`

### Authenticated APIs
- `POST /posts`
- `POST /media/upload-url`
- `POST /posts/:id/verify`

## 11. Main Product Risks

### 1. Social platform restrictions
- X and Instagram data access can change and may be limited or expensive

### 2. Privacy risk
- Exact location and time metadata can expose users

### 3. False real-time claims
- Users may upload old or stolen media

### 4. Content moderation
- Real-time local media can include violence, faces, license plates, or illegal content

## 12. Best Launch Strategy

Instead of launching globally on day 1, start with:
- one country
- one city group
- weather + user live posts first
- selective CCTV integrations

Recommended launch wedge:
- tourist-heavy districts
- events/festivals
- commute-heavy downtown zones

## 13. Recommended Build Order

### Phase 1
- Auth
- Place search
- Map browsing
- Location-based feed

### Phase 2
- Upload text/image/video
- Metadata extraction
- Verification badges

### Phase 3
- Weather integration
- Representative map pins
- Ranking

### Phase 4
- External public feeds
- moderation tooling
- trust scoring

## 14. Product Positioning

Possible positioning line:

"A live map of what is happening right now, powered by public signals and verified local posts."

## 15. Immediate Next Step

The most practical next step is to convert this concept into:
- app information architecture
- screen list
- MVP wireframe
- backend schema

That will make implementation much more concrete.
