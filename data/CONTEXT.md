# Data Directory Context

## Overview
This directory (`data/`) contains all **raw data** fetched from external sources. It serves as the source of truth for the static site generation process.

## Structure

### JSON Files
- **`incidents.json`**: Avalanche accident reports from Lawis.at (includes details, images, translations).
- **`weather_stations.json`**: Timeseries data from mountain weather stations (Bayern + TAWES Austria).
- **`weather_archive.json`**: Daily textual weather reports (German + English).
- **`recent_profiles.json`**: Snow profiles from the last 21 days (ephemeral feed).
- **`uploads.json`**: Active user-submitted observations (Last 45 days).
- **`uploads_archive.json`**: Master archive of all user uploads.
- **`webcams.json`**: List of mountain webcams with coordinates.
- **`translation_cache.json`**: MD5-keyed cache of Google Translate API responses (cost optimization).

### Text Files
- **`historic_weather.txt`**: Historical weather narratives (legacy format, parsed by builders).

### Directories
- **`pdfs/`**: Daily avalanche bulletins organized by region slug (flat structure: `slug/YYYY-MM-DD.pdf`).
- **`incident_bulletins/`**: Historical bulletins organized by year-month for incident correlation (`slug/YYYY-MM/YYYY-MM-DD.pdf`).
- **`bulletin_cache/`**: Temporary cache of raw JSON bulletins from EAWS API.
- **`incident_images/`**: Photos from accident reports, organized by incident ID (`ID/image_000.jpg`).
- **`profile_images/`**: Snow profile diagrams from Lawis.at (`snowprofile_[ID].png`).

## Data Flow
1. **Fetch Scripts** (`tools/fetch_*.js`) download data from external APIs.
2. **Raw Data** is saved to this directory.
3. **Build Scripts** (`tools/build.js` + builders) read from here to generate `archive/`.

## Retention Policies
- **Profiles**: 21-day rolling window (unless linked to an incident).
- **Incidents**: Permanent archive.
- **Weather Stations**: Last ~1100 measurements per station.
- **Bulletins**: Permanent archive (PDFs are never deleted).

## Important Notes
- **DO NOT** manually edit JSON files. They are managed by fetch scripts.
- **Cache files** (translation, bulletin) can be safely deleted if needed; they will regenerate.
- **Images** are permanent once downloaded (no cleanup logic exists).
