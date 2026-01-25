# Allgäu Alps West - Regional Archive

## Region Overview
- **Name**: Allgäu Alps West (Kleinwalsertal)
- **ID**: `AT-08-01`
- **Slug**: `allgau-alps-west`
- **Source**: Avalanche Report (Lawinenwarndienst Vorarlberg)

## Data Acquisition
- **Script**: `tools/fetch_daily.js`
- **Source Config**: Mapped in `tools/lib/config.js` via `REGION_CONFIG['allgau-alps-west']`.
- **Process**:
    1. `fetch_daily.js` queries the Avalanche.report API (Vorarlberg).
    2. Downloads the official PDF bulletin.
    3. Saves PDF to `data/pdfs/allgau-alps-west/`.

## Page Generation
- **Builder**: `tools/lib/builders/buildPdfArchive.js`
- **Output**: Generates `index.html` in this folder.
- **Logic**: 
    - Scans `data/pdfs/allgau-alps-west/`.
    - Creates a calendar-based interface.
