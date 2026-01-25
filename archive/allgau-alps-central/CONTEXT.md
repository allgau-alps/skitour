# Allgäu Alps Central - Regional Archive

## Region Overview
- **Name**: Allgäu Alps Central (Oberstdorf)
- **ID**: `DE-BY-12`
- **Slug**: `allgau-alps-central`
- **Source**: Bavarian Avalanche Warning Service (Lawinenwarndienst Bayern)

## Data Acquisition
- **Script**: `tools/fetch_daily.js`
- **Source Config**: Mapped in `tools/lib/config.js` via `REGION_CONFIG['allgau-alps-central']`.
- **Process**:
    1. `fetch_daily.js` queries the Lawinenwarndienst API/JSON.
    2. Downloads the official PDF bulletin.
    3. Saves PDF to `data/pdfs/allgau-alps-central/`.

## Page Generation
- **Builder**: `tools/lib/builders/buildPdfArchive.js`
- **Output**: Generates `index.html` in this folder.
- **Logic**: 
    - Scans `data/pdfs/allgau-alps-central/`.
    - Creates a calendar-based interface or list to view historic PDFs.
    - Each PDF acts as a snapshot of the avalanche danger for that day.
