# Weather Fetch Improvements - Feb 13, 2026

## Summary
Fixed the "Navigating frame was detached" error in the mountain weather fetch script and re-translated legacy German weather reports.

## Changes Made

### 1. Puppeteer Stability Improvements (`tools/fetch_weather_report.js`)
**Problem**: The weather fetch was failing in CI environments with "Navigating frame was detached" errors, particularly during afternoon runs.

**Solution**:
- ✅ Added retry logic with 3 attempts and exponential backoff (2s, 4s, 8s delays)
- ✅ Improved browser launch configuration for CI stability:
  - `--disable-dev-shm-usage` (prevents shared memory issues in containers)
  - `--single-process` (better for CI environments)
  - `--disable-gpu` and `--disable-software-rasterizer`
- ✅ Implemented frame detachment recovery (retries navigation once if frame detaches)
- ✅ Increased navigation timeout from 60s to 90s
- ✅ Enhanced error logging and browser cleanup

### 2. GitHub Secret Configuration
**Problem**: The `GCP_TRANSLATE_KEY` secret was incorrectly formatted with the variable name included.

**Solution**:
- ✅ Corrected secret value format (should be just the API key, not `GCP_TRANSLATE_KEY=xxx`)
- ✅ Updated documentation to clarify correct format

### 3. Legacy Weather Report Translation
**Problem**: Weather reports from Feb 11-13 were still in German after the translation service was fixed.

**Solution**:
- ✅ Created and ran a one-time script to re-translate the 3 German entries
- ✅ All weather reports now display in English with German original text in a collapsible section

### 4. Navigation Structure Standardization
**Problem**: Header logo links used relative paths, which could vary by page depth.

**Solution**:
- ✅ Changed all header logo links to use absolute path `/skitour/index.html`
- ✅ Updated 12 instances across:
  - `tools/lib/templates.js` (9 instances)
  - `tools/lib/builders/buildProfilePages.js` (1 instance)
  - `tools/lib/builders/buildPdfArchive.js` (2 instances)
- ✅ Ensures consistent navigation to site root from any page

### 5. Documentation Updates
- ✅ Updated `README.md`:
  - Corrected environment variable name to `GCP_TRANSLATE_KEY`
  - Added weather fetch reliability section
  - Clarified secret value format
- ✅ Updated `.ai/CONTEXT.md`:
  - Added navigation structure documentation

## Files Modified
1. `tools/fetch_weather_report.js` - Puppeteer stability improvements
2. `tools/lib/translator.js` - Warning message correction
3. `.github/workflows/daily-fetch.yml` - Environment variable name (already correct)
4. `data/weather_archive.json` - Re-translated entries for Feb 11-13
5. `tools/lib/templates.js` - Logo link absolute paths
6. `tools/lib/builders/buildProfilePages.js` - Logo link absolute path
7. `tools/lib/builders/buildPdfArchive.js` - Logo link absolute paths
8. `README.md` - Documentation updates
9. `.ai/CONTEXT.md` - Navigation structure documentation

## Verification Steps
1. ✅ Local test of weather fetch script
2. ✅ Verified re-translated weather reports display in English
3. ✅ Rebuilt site with updated navigation links
4. ✅ Confirmed logo links point to `/skitour/index.html`

## Next Steps
1. Commit and push changes to GitHub
2. Monitor next scheduled workflow runs (05:00, 13:00, 17:00 UTC)
3. Verify weather fetch succeeds in CI environment
4. Confirm translations are working for new reports

## Notes
- The forecast timing logic (afternoon reports assigned to next day) is working correctly and was not modified
- The Puppeteer fixes specifically target CI environment stability issues
- All changes are backward compatible
