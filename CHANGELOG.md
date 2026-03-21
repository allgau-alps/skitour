# Skitour Manual Intervention Changelog

This file records all manual changes, fixes, and decisions made by the Skitour Steward (outside of automated GitHub Actions updates). It provides narrative context beyond terse git commit messages.

## 2026-03-21: Fix Tyrol PDF Endpoint Failure for AT-07-01

**Issue**: The Tyrol (AT-07) avalanche bulletin PDF endpoint (`https://api.avalanche.report/albina/api/bulletins/.../pdf`) started returning HTML ("albina-server") or 401/404 errors instead of PDFs, causing daily fetch failures for Allgäu Alps East region. The region stopped updating in March 2026.

**Root Cause**: The Albina API for Tyrol appears to be deprecated or requires parameters/authorization that are not available. The existing code in `tools/pdf_fetcher.js` relied solely on that endpoint for `sourceType: 'avalanche-report'`.

**Fix**: Implemented local PDF generation from bulletin JSON data for Tyrol bulletins, bypassing the broken external endpoint entirely.

**Files Changed**:
- `tools/pdf_generator.js` — new module
  - Uses Puppeteer (already a dependency) to render an HTML template of the bulletin and print to PDF.
  - Template includes danger ratings, avalanche problems, snowpack comments, and source attribution.
- `tools/pdf_fetcher.js` — updated `processBulletinForPdfs`
  - For `sourceType === 'avalanche-report'` (Tyrol), calls `generatePdf` instead of attempting remote download.
  - For `lawinen-warnung` (DE-BY, AT-08), keeps existing remote PDF download flow.
- `package.json` — no changes; puppeteer already present.
- `CHANGELOG.md` — this entry.

**Impact**:
- AT-07-01 (Allgäu Alps East) PDFs will now generate reliably from the JSON bulletin data, regardless of external endpoint status.
- The site resumes daily updates for the region.
- PDFs are styled to match the original format (A4, print-friendly, color-coded danger levels).
- Backfill is not needed for past dates because the generator runs on fetch; future dates will be generated automatically.

**Verification**:
- Output PDF saved to `data/pdfs/allgau-alps-east/YYYY-MM-DD.pdf`.
- Build pipeline (`npm run fetch:all`) now completes without errors for AT-07.
- Puppeteer runs headless in CI; no additional system dependencies required beyond those already present.

**Notes**:
- If the original Tyrol PDF endpoint ever becomes stable again, this code can be extended to prefer remote first with local fallback, but local generation is currently the most robust approach.
- No changes to `wrangler.toml` or Cloudflare Workers required.

**Related**: This resolves the failure noted in commit `dc8f166` (backfilled PDFs manually) and ensures sustainable operation going forward.

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
