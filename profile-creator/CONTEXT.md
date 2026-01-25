# Profile Creator Context

## Overview
The **Profile Creator** is an interactive tool for creating and submitting custom snow profiles. It allows users to visually build snowpack layer diagrams, add stability test results, and upload observations to the site's database.

## Structure
- **`index.html`**: Main interface with metadata form, layer builder, and canvas preview.
- **`styles.css`**: Module-specific styling for the creator interface.
- **`js/renderer.js`**: Canvas rendering logic for snow profile visualization.
- **`js/main.js`**: Application logic, form handling, and upload functionality.

## Key Features

### Metadata Input
- **Observer Information**: Name, location, coordinates
- **Location Selection**: 
  - Interactive map picker (MapLibre GL JS)
  - Geolocation support ("Use Current Location")
- **Environmental Data**: Date, elevation, aspect, air temperature

### Layer Builder
- **Dynamic Layer Management**: Add/remove snow layers
- **Layer Properties**:
  - Thickness (cm)
  - Hardness (F, 4F, 1F, P, K, I)
  - Grain form (PP, DF, RG, FC, DH, SH, MF, IF)
  - Temperature (°C)
- **Visual Preview**: Real-time canvas rendering of snowpack

### Stability Tests
- **Test Types**: ECT, CT, Rutschblock, etc.
- **Test Properties**:
  - Result (e.g., "ECTP12", "CTM15")
  - Depth (cm)
  - Description

### Export & Upload
- **Download Image**: Export profile as PNG
- **Upload to Site**: Submit to Cloudflare Worker for storage and display
  - Stored in `data/uploads.json`
  - Displayed in Ground Conditions section

## Technical Stack
- **Canvas API**: Profile rendering
- **MapLibre GL JS**: Interactive map for location selection
- **Cloudflare Workers**: Backend storage via `workers/upload-worker.js`

## Data Flow
1. User creates profile with layers and tests
2. Canvas renders visual representation
3. User clicks "Upload to Site"
4. Data is POSTed to Worker API (`/upload`)
5. Worker stores in Cloudflare KV
6. `fetch_uploads.js` syncs to `data/uploads.json`
7. `buildGroundConditions.js` generates HTML pages

## Integration Points
- **Worker API**: `/upload` endpoint in `workers/upload-worker.js`
- **Data Sync**: `tools/fetch_uploads.js` retrieves submissions
- **Display**: `archive/ground-conditions/` pages show uploaded profiles
