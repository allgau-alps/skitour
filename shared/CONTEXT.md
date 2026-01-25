# Shared Directory Context

## Overview
The `shared/` directory contains reusable client-side JavaScript modules that are used across multiple pages and modules in the project.

## Structure
- **`js/`**: Shared JavaScript modules
  - `SlopeLayer.js`: Slope angle visualization layer for MapLibre GL maps

## Purpose
This directory eliminates code duplication by providing a single source of truth for shared functionality. Instead of maintaining identical copies of code in multiple locations, modules import from this shared location.

## Usage
Modules reference shared code using relative paths:
```html
<!-- From planning/index.html -->
<script src="../shared/js/SlopeLayer.js"></script>
```

## Maintenance
When updating shared modules:
1. Edit the file in `shared/`
2. Test in all locations that use it
3. No need to update multiple copies - there's only one source

## Current Shared Modules

### SlopeUtils.js
- **Used by**: SlopeLayer.js, SlopeAspectLayer.js
- **Purpose**: Low-level math utilities for decoding Mapzen Terrarium data and calculating slope/aspect.
- **Features**: Finite difference gradient calculation, elevation decoding.

### SlopeLayer.js
- **Used by**: Planning Tool (`planning/index.html`)
- **Purpose**: Raster-based slope visualization using custom MapLibre protocol
- **Dependencies**: `SlopeUtils.js`

### SlopeAspectLayer.js
- **Used by**: Planning Tool (`planning/index.html`)
- **Purpose**: Highlights terrain with slope ≥20° colored by aspect.
- **Dependencies**: `SlopeUtils.js`
