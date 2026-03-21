# Skitour Manual Intervention Changelog

This file records all manual changes, fixes, and decisions made by the Skitour Steward (outside of automated GitHub Actions updates). It provides narrative context beyond terse git commit messages.

## 2026-03-21: Fix Tyrol PDF Endpoint for AT-07-01 (Official Endpoint + Local Fallback)

**Issue**: The Tyrol (AT-07) avalanche bulletin PDF endpoint (`https://api.avalanche.report/albina/api/bulletins/.../pdf`) was returning HTML ("albina-server") or 401/404 errors, causing daily fetch failures for Allgäu Alps East. The region stopped updating in March.

**Root Cause**: The original code used an incomplete URL pattern. The correct endpoint requires both `date` (ISO timestamp) and `microRegionId` parameters.

**Fix**: Updated `tools/pdf_fetcher.js` to use the correct endpoint pattern for Tyrol:
```
https://api.avalanche.report/albina/api/bulletins/pdf?date=<ISO>&region=EUREGIO&microRegionId=<regionId>&lang=en&grayscale=false
```
The code now:
- Attempts the official endpoint first with the bulletin's `publicationTime`.
- If the download fails (network error, non-PDF, 404, etc.), falls back to local PDF generation from JSON (via `tools/pdf_generator.js` using Puppeteer).

**Files Changed**:
- `tools/pdf_fetcher.js` — revised `processBulletinForPdfs` for `sourceType='avalanche-report'`
- `tools/pdf_generator.js` — new module (Puppeteer-based local generation) created as fallback.
- `CHANGELOG.md` / `MEMORY.md` — documentation updates.

**Impact**:
- AT-07-01 PDFs now retrieve correctly from the official endpoint when available.
- Fallback ensures resilience against future endpoint issues.
- Site resumes daily updates for the region.
- No new runtime dependencies (puppeteer already in package.json).

**Verification**:
- Tested the endpoint URLs you provided; they return valid PDFs.
- After deploying, fetch logs should show "Downloaded PDF for allgau-alps-east/YYYY-MM-DD.pdf" rather than "Generated PDF".
- If any download fails, the fallback logs "Generated PDF...".

**Notes**:
- The fallback generator remains in place for robustness; it only activates if the official endpoint is unreachable or returns an error.
- No wrangler or worker changes needed.

**Related**: Resolves failure noted in commit `dc8f166` (backfilled PDFs manually).

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
