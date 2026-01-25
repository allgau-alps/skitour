# Avalanche Archiver - Architectural Digest

## 🗺️ High-Level Map

| Directory | Purpose | ⚠️ Rules for AI |
| :--- | :--- | :--- |
| **`tools/`** | **SOURCE CODE**. Contains all logic, scripts, and **templates**. | **EDIT HERE**. If you want to change the HTML structure, CSS classes, or logic, you MUST edit files in `tools/`. |
| **`shared/`** | **SHARED CLIENT CODE**. Reusable JavaScript modules used across multiple pages (e.g., SlopeLayer.js). | **EDIT HERE**. Single source of truth for shared client-side code. |
| **`workers/`** | **SERVERLESS**. Cloudflare Worker scripts. | **DEPLOY**. Changes here interact with `wrangler deploy`. |
| **`archive/`** | **BUILD OUTPUT**. Generated static HTML files for the website. | **READ-ONLY**. Do NOT edit these files directly. Your changes will be overwritten by the build script. |
| **`data/`** | **RAW DATA**. JSON files (including `webcams.json`), cache, and raw incident images. | **READ-ONLY**. Generally managed by fetch scripts. |
| **`snow-depth/`**| **Module**. Specific component for snow depth visualization. | Contains its own `index.html` source which is copied to `archive/` during build. |
| **`planning/`** | **Module**. Interactive Map & Route Planning tool. | Contains `index.html`, CSS, and JS. Served from root during dev. |
| **`gpx-library/`** | **Module**. GPX Route Archive & Analysis tool. | Hybrid SPA (Cloud + Static Fallback). |

## 🏗️ The Build Pipeline
The site is static, generated from raw data.
1.  **Fetch**: Scripts download data into `data/`.
    *   **`tools/fetch_lawis_incidents.js`**: Main incident data.
    *   **`tools/fetch_weather_report.js`**: Daily weather text.
    *   **`tools/process_profiles.js`**: Snow profile data.
    *   **`tools/fetch_uploads.js`**: User-submitted reports (from Cloudflare KV).
    *   **`tools/fetch_daily.js`**: Orchestrates daily updates.
2.  **Process**: Data is cleaned and structured.
3.  **Build**: `node tools/build.js` is the master conductor.
    *   It reads `data/`.
    *   It loads templates from **`tools/lib/templates.js`**.
    *   It **generates** HTML files (incidents, profiles, **ground conditions**, **webcams**) and writes them to `archive/`.

## ☁️ Cloud & Dynamic Features
*   **User Uploads**:
    *   **Frontend**: `archive/ground-conditions/upload.html` (generated via `templates.js`) submits to Cloudflare.
    *   **Backend**: `workers/upload-worker.js` handles POST requests and stores data in **Cloudflare KV**.
    *   **Sync**: `tools/fetch_uploads.js` retrieves data from KV to `data/uploads.json` so it can be baked into the static site.
*   **GPX Library**:
    *   **Frontend**: `gpx-library/index.html` (SPA).
    *   **Backend**: `workers/upload-worker.js` (managed via `/gpx/*` endpoints).
    *   **Data**: Stores metadata index (`gpx:index`) and files (`gpx:file:<id>`) in Cloudflare KV.

## 🔑 Key Files "Cheatsheet"

*   **`tools/lib/templates.js`**: **THE UI SOURCE**. All HTML for incidents, weather, profiles, **webcams**, and **ground conditions** is generated here. Uses **MapLibre GL JS** for maps. **If the user asks for a UI change, check this file first.**
*   **`tools/build.js`**: The main build orchestrator.
*   **`tools/lib/builders/buildGroundConditions.js`**: Builds the combined Ground Conditions & Webcam pages.
*   **`workers/upload-worker.js`**: API for User Uploads & **GPX Library**.
*   **`styles.css`**: Global styles.

## 📚 Detailed Documentation
We now have granular `CONTEXT.md` files for every section of the system.
See **[.ai/CONTEXT.md](.ai/CONTEXT.md)** for the master index.
*   **Archive Structure**: [archive/CONTEXT.md](archive/CONTEXT.md)
*   **Tools Engine**: [tools/CONTEXT.md](tools/CONTEXT.md)
*   **Shared Code**: [shared/CONTEXT.md](shared/CONTEXT.md)

## 🛑 Common Pitfalls (Don't do these!)
*   ❌ **Don't edit `archive/incidents/2026-01-15.html`**. It will be deleted/overwritten next time we build.
*   ❌ **Don't ask "Where is the HTML source?"** for an incident page. It doesn't exist. It's constructed dynamically in `templates.js`.
