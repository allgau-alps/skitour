# Troubleshooting Scrapers

If the daily fetch job fails, follow these steps to debug.

## 1. Check the Smoke Test
Run the smoke test to see if the issue is a simple corruption or config error.
```bash
npm run test:smoke
```

## 2. Debug `fetch_daily.js`
Run the script manually to see verbose output.
```bash
node tools/fetch_daily.js
```
*Note: This script skips downloading if files already exist for today. To force a retry, you may need to delete today's file in `data/pdfs/`.*

## 3. Common Issues
*   **Structure Change**: The source API (Lawis/Bayern) might have changed their JSON structure.
    *   Inspect `tools/pdf_fetcher.js` - this is where the logic resides for extracting the PDF URL from the JSON response.
*   **Network Timeout**: If fetching fails intermittently, check user's internet connection or increase timeouts in `puppeteer` config (if used).

## 4. Debug Weather Fetching
For weather station errors:
```bash
node tools/fetch_weather.js
```
Check `data/weather_stations.json` is valid JSON afterwards.
