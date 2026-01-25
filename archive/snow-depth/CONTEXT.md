# Snow Depth Map Context

## Overview
An interactive 3D/2D map visualization showing current snow depth across the region.

## Data Source
- **Primary App**: The code for the map visualization itself resides in `snow-depth/` (root directory).
- **Data**: Likely fetches tile data or JSON overlays for snow depth (Source: Schneeressourcen / SLF / Local Models).

## Integration
- **Builder**: `tools/lib/builders/buildSnowDepth.js`
- **Process**:
    1. The core application runs as a standalone page in `snow-depth/index.html`.
    2. The builder script *copies* or *links* this application into the `archive/snow-depth/` directory during the build process.
    3. It adjusts relative paths (CSS, JS links) to ensure it works within the deeper `archive/` structure.
