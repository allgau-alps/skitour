# Allgäu Alps East - Regional Archive

## Region Overview
- **Name**: Allgäu Alps East (Tannheimer Tal / Außerfern)
- **ID**: `AT-07-01`
- **Slug**: `allgau-alps-east`
- **Source**: Avalanche Report (Lawinenwarndienst Tirol)

## Data Acquisition
- **Script**: `tools/fetch_daily.js`
- **Source Config**: Mapped in `tools/lib/config.js` via `REGION_CONFIG['allgau-alps-east']`.
- **Process**:
    1. `fetch_daily.js` queries the Avalanche.report API (Tirol).
    2. Downloads the official PDF bulletin.
    3. Saves PDF to `data/pdfs/allgau-alps-east/`.

## Page Generation
- **Builder**: `tools/lib/builders/buildPdfArchive.js`
- **Output**: Generates `index.html` in this folder.
- **Logic**: 
    - Scans `data/pdfs/allgau-alps-east/`.
    - Creates a calendar-based interface or list to view historic PDFs.
