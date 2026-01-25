# Allgäu Prealps - Regional Archive

## Region Overview
- **Name**: Allgäu Prealps (Sonthofen)
- **ID**: `DE-BY-11`
- **Slug**: `allgau-prealps`
- **Source**: Bavarian Avalanche Warning Service

## Data Acquisition
- **Script**: `tools/fetch_daily.js`
- **Source Config**: Mapped in `tools/lib/config.js` via `REGION_CONFIG['allgau-prealps']`.
- **Process**:
    1. `fetch_daily.js` queries the Lawinenwarndienst Bayern API.
    2. Downloads the official PDF bulletin.
    3. Saves PDF to `data/pdfs/allgau-prealps/`.

## Page Generation
- **Builder**: `tools/lib/builders/buildPdfArchive.js`
- **Output**: Generates `index.html` in this folder.
- **Logic**: 
    - Scans `data/pdfs/allgau-prealps/`.
    - Creates a calendar-based interface.
