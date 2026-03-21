# Skitour Manual Intervention Changelog

This file records all manual changes, fixes, and decisions made by the Skitour Steward (outside of automated GitHub Actions updates). It provides narrative context beyond terse git commit messages.

## 2026-03-21: Fix Tyrol PDF Endpoint for AT-07-01

**Issue**: The Tyrol (AT-07) avalanche bulletin PDF endpoint (`https://api.avalanche.report/albina/api/bulletins/.../pdf`) was returning HTML ("albina-server") or 401/404 errors, causing daily fetch failures for Allgäu Alps East. The region stopped updating in March.

**Root Cause**: The code used an incomplete URL pattern. The correct endpoint requires both `date` (ISO timestamp at 16:00:00.000Z for the bulletin date) and `microRegionId` parameters.

**Fix**: Updated `tools/pdf_fetcher.js` to use the correct endpoint pattern:
```
https://api.avalanche.report/albina/api/bulletins/pdf?date=<dateStr>T16:00:00.000Z&region=EUREGIO&microRegionId=<regionId>&lang=en&grayscale=false
```
- For new PDFs: attempts download; on failure, logs error (no local fallback).
- For existing PDFs: checks for updates; archives versions if changed.
- The official endpoint works for dates that have been published. Future dates may return 400 until the bulletin is released; in that case the fetch logs an error and proceeds without PDF.

**Files Changed**:
- `tools/pdf_fetcher.js` — revised `processBulletinForPdfs` for `sourceType='avalanche-report'`
- Removed `tools/pdf_generator.js` (no longer used)
- `CHANGELOG.md` / `MEMORY.md` — documentation updates.

**Impact**:
- AT-07-01 PDFs are now fetched from the official source when available.
- Site resumes daily updates for the region via GitHub Actions.
- No local PDF generation; archival completeness depends on endpoint availability.

**Verification**:
- Tested endpoint URLs; they return valid PDFs for existing dates (e.g., 2026-02-17 through 2026-03-21).
- For 2026-03-22 (not yet published), endpoint returns 400 and fetch logs an error (no PDF created).
- Next scheduled GitHub Actions run will fetch March 22 once the PDF is published.

**Notes**:
- If the endpoint becomes unreliable again, consider reintroducing a fallback or alerting.
- No Cloudflare Worker changes needed.

## 2026-03-21: Add POI Search to Planning Tool

**Feature**: Added a search bar in the planning tool's control panel to quickly locate peaks and towns on the map.

**Implementation**:
- Created `planning/data/pois.json` with initial set of Allgäu peaks and nearby towns (GeoJSON).
- Modified `planning/index.html`: added search input and results dropdown container.
- Modified `planning/js/main.js`:
  - Added `initPOISearch()` to fetch POI data and set up debounced input.
  - Added `renderResults()` to build a dropdown of matching names with elevation info.
  - Added `flyToPOI()` to center the map on the selected location and show a red marker.
- Modified `planning/planning.css`: styled the search container and dropdown.

**Usage**:
- In the planning tool sidebar, type in the "Search peaks or towns..." box.
- Matching names appear; click one to fly the map to that location.
- The search is case-insensitive and matches substrings (e.g., "unsp" finds "Unspitze").

**Non-breaking**: The feature is additive; existing layers and controls remain unaffected.

**Future**: Expand `pois.json` with more Alpine features (passes, huts, etc.) as needed.

**Related**: Documentation updated in `MEMORY.md` (Planning Tool section).

## 2026-03-21: Enhance POI Search in Planning Tool

**Improvements**:
- Expanded `planning/data/pois.json` to ~50 features (peaks, huts, towns, passes) with accurate coordinates across Allgäu.
- Changed search to tokenized prefix matching: query must match the start of any word in the name (case-insensitive). This avoids overly broad matches (e.g., "e" does not match "Mädelegabel").
- Removed the map marker; selecting a result now only recenters the map.
- Maintains additive, non-breaking design.

**Files changed**:
- `planning/data/pois.json` — comprehensive replacement.
- `planning/js/main.js` — tokenization, prefix filter, simplified `flyToPOI`.

## 2026-03-21: Fix East/West Slope Aspect Mix-up

**Issue**: The slope aspect visualization in the planning/route tool incorrectly swapped east and west. North and south appeared correct, but east-facing slopes were colored as west and vice versa.

**Root Cause**: The downhill aspect calculation in `shared/js/SlopeUtils.js` used an incorrect formula:
```js
let aspectRad = Math.atan2(dzdy, dzdx);
let aspectDeg = aspectRad * 180 / Math.PI;
aspectDeg = 90 - aspectDeg;
```
This produces a bearing that maps E↔W.

**Fix**: Replaced with the correct downhill-bearing formula:
```js
let aspectRad = Math.atan2(-dzdx, dzdy);
let aspectDeg = aspectRad * 180 / Math.PI;
if (aspectDeg < 0) aspectDeg += 360;
```
This yields 0°=North, 90°=East, 180°=South, 270°=West.

**Files Changed**:
- `shared/js/SlopeUtils.js` — corrected `calculateSlopeAspect` function.

**Impact**:
- The Slope Aspect layer (`planning/js/overlays/SlopeAspectLayer.js`) now displays correct east/west colors.
- Any other code using `calculateSlopeAspect` (e.g., `shared/js/SlopeLayer.js` for slope steepness mapping) inherits the corrected aspect values.

**Verification**:
- N and S remain unchanged and correct.
- E and W are now swapped to their proper orientations.
- No other logic altered.

**Commit**: `0fbcc93` (push after rebase)

**Notes**:
- This was a mathematical error in the original implementation.
- The color palette in `SlopeAspectLayer.js` remains the same: N (blue), NE (cyan), E (green), SE (yellow-green), S (red), SW (orange), W (yellow), NW (purple). Only the mapping from aspect degrees to these directions is now correct.
