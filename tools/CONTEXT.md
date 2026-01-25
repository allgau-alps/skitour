# Tools Directory Context

## Overview
This directory is the **Engine Room** of the project. It contains all the scripts used to fetch data and build the static website.

## Key Scripts

### Data Fetchers
- **`fetch_daily.js`**: The core cron-job. Iterates through configured regions (in `lib/config.js`) and fetches the daily avalanche bulletin (PDF) and JSON metadata.
- **`fetch_lawis_incidents.js`**: Scrapes lawis.at for avalanche incidents, details, and images.
- **`fetch_weather_report.js`**: Fetches weather data from mountain stations.
- **`fetch_geosphere.js`**: Fetches historical weather data from Geosphere Austria (TAWES stations).
- **`process_profiles.js`**: Fetches regional snow profiles and links them to incidents based on location and time.
- **`enrich_profiles.js`**: Fetches detailed metadata for profiles, parses stability tests (ECT), and translates comments.
- **`fetch_uploads.js`**: Fetches user-submitted observations from the Cloudflare Worker API.

### Helpers
- **`pdf_fetcher.js`**: Logic for determining correct PDF URLs (used by `fetch_daily.js`).

### Static Site Generator
- **`build.js`**: The main build orchestration script (`npm run build`).
    - It calls specific builders located in `lib/builders/`.
    - Generates the entire `archive/` directory structure.

## Libraries (`tools/lib/`)
- **`config.js`**: Central configuration for regions, IDs, URLs, and file paths.
- **`fetcher.js`**: Robust HTTP client with exponential backoff and retry logic.
- **`validateEnv.js`**: Validator for required/optional environment variables.
- **`translator.js`**: Centralized translation logic with disk-based caching.
- **`utils.js`**: Helper functions (date formatting, distance calculations, logging).
- **`templates.js`**: Shared HTML templates for generating pages (Incidents, Weather, Profiles, etc.). Contains embedded MapLibre GL JS logic for inline maps (Uploads, Webcams) ensuring consistent visual style.
- **`map.html`**: Standalone map template used for Profiles and Incidents detailed map view. Implements hybrid OpenStreetMap/OpenTopoMap switching logic.
- **`builders/`**: Contains the logic to generate HTML for each section (Weather, Incidents, Profiles, Ground Conditions, etc.).
