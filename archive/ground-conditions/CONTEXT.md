# Ground Conditions & User Uploads Context

## Overview
A community-driven section where users can upload observations (ground conditions, photos) and view recent submissions.

## Data Acquisition
- **Upload API**: Observations are submitted via `upload.html` using a Cloudflare Worker (`https://avalanche-archiver-uploads.bigdoggybollock.workers.dev`). Supports POST (`/upload`, `/delete`) and GET (`/get` for editing).
- **Storage**: `data/uploads.json` stores the metadata for approved/recent uploads.
- **Retention**: **Ephemeral Feed (21 Days)**. Observations are only displayed for 21 days. The build script (`buildGroundConditions.js`) deletes older uploads to keep the feed fresh.

## Page Generation
- **Builder**: `tools/lib/builders/buildGroundConditions.js`
- **Output**:
    - `index.html`: The "Ground Conditions Hub" listing recent uploads and webcams.
    - `upload.html`: Form for new submissions.
    - `uploads/[id].html`: Detail page for specific user observations.
