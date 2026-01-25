# Planning Tool Context

## Overview
The **Planning Tool** is an interactive map-based application for ski tour route planning and terrain analysis. It provides real-time slope, aspect, and shade visualization to help users assess avalanche risk.

## Structure
- **`index.html`**: Main entry point with UI structure, control panels, and modals.
- **`planning.css`**: Module-specific styling for the planning interface.
- **`js/main.js`**: Core application logic, map initialization, and UI interactions.
- **`js/overlays/`**: Specialized overlay modules:
  - `SlopeAspectLayer.js`: Calculates and renders aspect (compass direction) visualization.
  - `ShadeMap.js`: Real-time sun position and shadow calculation using SunCalc.
  - Note: `SlopeLayer.js` is now in `shared/js/SlopeLayer.js` (shared across modules).

## Key Features

### Map Layers
- **Base Map**: OpenTopoMap with terrain relief.
- **Satellite Imagery**: Toggle overlay with opacity control.
- **Slope Angle**: Color-coded visualization (27°-45°+) for avalanche-prone terrain.
- **Slope-Aspect**: Directional slope visualization (N, NE, E, etc.) for aspect-dependent avalanche problems.
- **Simple Shade Map**: Real-time shadow calculation based on sun position and time of day.
- **3D Terrain**: MapLibre GL terrain with tilt/rotate controls.

### GPX Integration
- **Upload**: Load GPX files for route visualization.
- **Library Integration**: Direct link to GPX Library for loading saved routes.
- **Save to Library**: Upload routes directly to Cloudflare KV via the Worker API.

### External Links
- **EOS LandViewer**: Recent satellite imagery for snow cover assessment.
- **ShadeMap.app**: High-accuracy external shade map tool.
- **RealityMaps**: Premium 3D terrain visualization.

## Technical Stack
- **MapLibre GL JS**: Modern WebGL-based mapping library.
- **ToGeoJSON**: GPX parsing library.
- **SunCalc**: Solar position calculations for shade mapping.
- **Cloudflare Workers**: Backend for GPX storage (via `workers/upload-worker.js`).

## User Workflow
1. **Load Route**: Upload GPX or load from library.
2. **Enable Overlays**: Toggle slope/aspect/shade layers.
3. **Analyze Terrain**: Use visual overlays to identify hazardous slopes.
4. **Adjust Time**: Use time slider to see shade patterns throughout the day.
5. **Save Route**: Optionally save to cloud library for future reference.

## Integration Points
- **GPX Library**: Routes can be loaded via query parameters (`?filename=route.gpx&name=Route Name`).
- **Worker API**: Saves routes to `workers/upload-worker.js` endpoints.
