# How to Add a New Region

This workflow describes the steps to track a new avalanche region in the archiver.

## 1. Identify Source Data
Find the **Region ID** used by the avalanche warning service (Lawis / Lawinenwarndienst Bayern).
- Look at the `JSON` response from their API.
- e.g. `DE-BY-12` or `AT-08-01`.

## 2. Update Configuration (`tools/lib/config.js`)
1.  Add the region to `REGION_CONFIG`:
    ```javascript
    'new-region-slug': {
        label: 'New Region Name',
        slug: 'new-region-slug',
        type: 'pdf'
    }
    ```
2.  Add the mapping to `REGION_PDF_MAP`:
    ```javascript
    'SOURCE-ID-XX': 'new-region-slug'
    ```

## 3. Create Archive Directory
Create the folder where files will be stored:
```bash
mkdir archive/new-region-slug
```
Create a `CONTEXT.md` in that folder following the pattern of existing regions.

## 4. Run Fetcher
Test the configuration by running the daily fetcher for a specific date (or just let the daily job run).
```bash
node tools/fetch_daily.js
```

## 5. Verify Output
1. Check `data/pdfs/new-region-slug/` contains PDFs.
2. Run `npm run build`.
3. Check `archive/new-region-slug/index.html` generates correctly.
