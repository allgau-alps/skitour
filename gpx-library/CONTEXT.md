# GPX Library Context
> **Path**: `gpx-library/`

The **GPX Library** is a dedicated module for archiving, visualizing, and analyzing ski touring routes. It operates as a Single Page Application (SPA) with cloud-based storage.

## Structure
*   **`index.html`**: The main entry point. Contains the UI structure, filter panels, and route table.
*   **`library.js`**: Core logic. Handles fetching data, client-side GPX analysis, filtering, sorting, and UI interactions (Upload/Delete).
*   **`library.css`**: Module-specific styling, including the custom toggle switches and dual-range sliders.

## Cloud Architecture
The library is fully cloud-based, powered by Cloudflare Workers.

### Backend
*   **Worker**: `workers/upload-worker.js` (Endpoints: `/gpx/list`, `/gpx/upload`, `/gpx/get`, `/gpx/delete`).
*   **Storage**: Cloudflare KV.
    *   `gpx:index`: Lightweight JSON array of route metadata.
    *   `gpx:file:<id>`: The actual GPX XML content.
*   **Worker URL** (frontend hardcoded in `library.js`):
    ```
    https://avalanche-archiver-uploads.bigdoggybollock.workers.dev
    ```
*   **KV Namespace Binding**: In `wrangler.toml`:
    ```
    [[kv_namespaces]]
    binding = "UPLOADS"
    id = "8ca71cb3a5f846939c753b995aba9245"
    ```
*   **Admin Authentication**: The `/gpx/upload` and `/gpx/delete` endpoints require an `X-Admin-Key` header matching the `ADMIN_KEY` secret set in the Cloudflare dashboard.
*   **Flow**: `library.js` fetches the index from the Worker. If the Worker is unreachable, the library displays an empty state.

### Manual Upload (for Steward)
If you need to add a GPX file without using the web UI:
1. Prepare the GPX file and metadata (see `gpx-files/` template).
2. Use `curl` or a Node script to POST to `/gpx/upload` with `X-Admin-Key`.
3. Example curl:
```bash
curl -X POST "$WORKER_URL/gpx/upload" \
  -H "X-Admin-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "gpxContent": "<gpx>...</gpx>",
    "metadata": {
      "id": "unique-id",
      "name": "Route Name",
      "region": "Allgäu Alps East",
      "source": "Community",
      "author": "Frank Faust",
      "uploadDate": "2026-03-21",
      "distance": 12.4,
      "ascent": 1800,
      "descent": 1800,
      "maxSlope": 38,
      "primaryAspect": "E",
      "aspectBreakdown": {"N":10,"NE":5,"E":30,"SE":15,"S":5,"SW":5,"W":15,"NW":15}
    }
  }'
```

## Key Features
*   **Client-Side Analysis**: The `analyzeGPXContent` function in `library.js` parses GPX files immediately upon selection, calculating distance, ascent, descent, max slope, and aspect breakdown directly in the browser.
*   **Smart Filtering**:
    *   **Dual Range Sliders**: For Distance, Ascent, Descent, and Max Slope (0-45°+).
    *   **Toggle Switches**: Filters are only applied when their specific toggle is enabled.
    *   **Aspect Filtering**: Filter by primary aspect (N, NE, E, etc.).
*   **Deep Linking**: Routes can be loaded directly into the **Planning Tool** (`planning/index.html`) via query parameters.

## Interactions
*   **Upload**: User selects file → Browser evaluates stats → User confirms → POST to Worker.
*   **Delete**: User clicks delete → POST to Worker (removes from Index and KV).
*   **Download**: Downloads the GPX file from the Worker.
*   **Load in Planner**: Redirects to the Planning tool with the route pre-loaded.
