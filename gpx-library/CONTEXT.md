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
*   **Flow**: `library.js` fetches the index from the Worker. If the Worker is unreachable, the library displays an empty state.

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
