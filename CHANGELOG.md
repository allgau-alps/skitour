# Skitour Manual Intervention Changelog

This file records all manual changes, fixes, and decisions made by the Skitour Steward (outside of automated GitHub Actions updates). It provides narrative context beyond terse git commit messages.

## 2026-03-21: Fix Tyrol PDF Endpoint for AT-07-01 (Official Endpoint + Local Fallback)

**Issue**: The Tyrol (AT-07) avalanche bulletin PDF endpoint (`https://api.avalanche.report/albina/api/bulletins/.../pdf`) was returning HTML ("albina-server") or 401/404 errors, causing daily fetch failures for Allgäu Alps East. The region stopped updating in March.

**Root Cause**: The original code used an incomplete URL pattern. The correct endpoint requires both `date` (ISO timestamp) and `microRegionId` parameters.

**Fix (v1)**: Updated `tools/pdf_fetcher.js` to use the correct endpoint pattern for Tyrol:
```
https://api.avalanche.report/albina/api/bulletins/pdf?date=<dateStr>T16:00:00.000Z>&region=EUREGIO&microRegionId=<regionId>&lang=en&grayscale=false
```
- For new PDF files, the code now checks the return value of `downloadImageWithRetry` (which returns `null` on failure instead of throwing). On failure, it falls back to local PDF generation via `pdf_generator.js`.
- For existing files, download failures are logged and skipped (existing file remains).
- This ensures that when the official endpoint returns errors (e.g., 400 for future dates not yet published), the fetch still produces a PDF via local generation and keeps the archive complete.

**Files Changed**:
- `tools/pdf_fetcher.js` — revised `processBulletinForPdfs` for `sourceType='avalanche-report'`
- `tools/pdf_generator.js` — new module (Puppeteer-based local generation) used as fallback.
- `CHANGELOG.md` / `MEMORY.md` — documentation updates.

**Impact**:
- AT-07-01 PDFs now retrieve correctly from the official endpoint when available.
- Fallback ensures resilience against endpoint outages or premature fetches (future dates).
- Site resumes daily updates for the region.
- No new runtime dependencies (puppeteer already in package.json).

**Verification**:
- Tested the endpoint URLs; they return valid PDFs for dates that exist.
- For 2026-03-22 (not yet available), the fetch falls back to local generation successfully (64 KB PDF produced).
- After deploying, routine GitHub Actions runs will fetch the official PDF when it becomes available; otherwise local generation fills the gap.

**Notes**:
- The fallback generator is now robustly invoked for missing new files.
- No Cloudflare Worker changes needed.

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
