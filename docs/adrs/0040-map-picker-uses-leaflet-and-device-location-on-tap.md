# 0040 The map picker uses Leaflet on the existing tiles and asks for the device position only on tap

Status: accepted (issue #58)

## Decision
- The full-screen "Pick on map" page uses Leaflet 1.9 on the tile server the small map already uses (`MAP_TILE_URL`). Leaflet is imported only when the map shows, so it is not in the first load. The pin is an overlay in the middle; the map moves under it.
- The address of the pin comes from the same place search as the suggestions (Photon, `/reverse` next to `PLACE_SEARCH_URL`), asked once the map rests (500 ms), straight from the device.
- "Use my location" uses `@capacitor/geolocation` in the Android app and `navigator.geolocation` in a browser. The permission is requested on the first tap only; a refusal shows a short note and the picker keeps working. The web `Permissions-Policy` allows `geolocation=(self)`.

## Alternatives
- MapLibre GL: vector tiles need a style and a tile source that is not the existing raster one, and a bigger bundle.
- Own pan/zoom on the existing tile maths: gestures, inertia and pinch are exactly what a maintained library does.
- Asking for the location when the picker opens: a permission dialog without a reason; the owner approved asking on the first tap.

## Why
Leaflet is small, maintained, needs no key and works on the raster tiles the CSP already allows. Reusing Photon keeps one place-search provider and one set of hosts.
