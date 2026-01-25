# Webcam Archive Context

## Overview
Displays current snapshots from key mountain webcams to assess visibility and snow coverage.

## Data Acquisition
- **Config**: `data/webcams.json` defines the list of webcam URLs.
- **Process**:
    - The system creates a static gallery.
    - Images are hotlinked or fetched during build (depending on `fetch_webcams.js` logic).

## Page Generation
- **Builder**: `tools/lib/builders/buildGroundConditions.js` (Shared builder with Ground Conditions).
- **Output**: `index.html` containing the webcam gallery.
