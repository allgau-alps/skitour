# Snow Profile Archive Context

## Overview
This section archives snow profiles (Schneeprofile) which are technical analyses of the snowpack layers.

## Data Acquisition
- **Script**: `tools/process_profiles.js` (Scraped) & `tools/fetch_uploads.js` (User submitted).
- **Source**: Lawis.at / Regios API & Cloudflare Worker.
- **Retention**: **Ephemeral Feed (21 Days)**. The main feed only shows profiles from the last 21 days. Older profiles are deleted **unless they are linked to an Incident Report**, in which case they are preserved indefinitely to prevent broken links.

## Page Generation
- **Builder**: `tools/lib/builders/buildProfilePages.js`
- **Output**:
    - `index.html`: List of profiles from the last **21 days**.
    - `map.html`: Interactive map (Leaflet) showing recent profile locations.
    - Individual profile pages (`[id].html`) - deleted if > 21 days old *AND* not linked to an incident.
- **Visualization**:
    - Uses Highcharts (via `profile-viewer` library) to render interactive snow profiles.
