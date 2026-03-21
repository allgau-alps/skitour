# Skitour Manual Intervention Changelog

This file records all manual changes, fixes, and decisions made by the Skitour Steward (outside of automated GitHub Actions updates). It provides narrative context beyond terse git commit messages.

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
