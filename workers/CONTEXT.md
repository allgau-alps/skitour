# Workers Context

## Overview
This directory contains **Cloudflare Workers** that provide serverless backend functionality for the application. Currently, there is a single unified worker handling all API endpoints.

## Structure
- **`upload-worker.js`**: Unified API worker for user uploads and GPX library management.

## Worker: `upload-worker.js`

### Purpose
Provides serverless API endpoints for:
1. **User Observations**: Ground condition reports and snow profiles
2. **GPX Library**: Route storage and management

### KV Namespace
- **Binding**: `UPLOADS`
- **Storage Strategy**:
  - User uploads: Direct KV storage with unique IDs
  - GPX files: Metadata index pattern (`gpx:index` + `gpx:file:<id>`)

### API Endpoints

#### User Uploads
- **`POST /upload`**: Submit observation (images, comments, snow profiles)
  - Accepts: JSON with user, location, comment, lat/lon, images (base64), layers, tests
  - Returns: `{ success: true, id: "..." }`
  
- **`GET /list`**: Retrieve all user uploads
  - Returns: Array of upload objects
  
- **`GET /get?id=<id>`**: Get single upload by ID
  - Returns: Upload object
  
- **`POST /delete`**: Delete upload by ID
  - Accepts: `{ id: "..." }`
  - Returns: `{ success: true }`

#### GPX Library
- **`GET /gpx/list`**: Get route metadata index
  - Returns: `{ routes: [...] }` (lightweight metadata only)
  
- **`GET /gpx/get?id=<id>`**: Download GPX file
  - Returns: GPX XML content
  
- **`POST /gpx/upload`**: Upload new route
  - Accepts: `{ gpxContent: "...", metadata: {...} }`
  - Updates both file storage and metadata index
  
- **`POST /gpx/delete`**: Delete route
  - Accepts: `{ id: "..." }`
  - Removes file and updates index

### CORS Configuration
All endpoints support CORS with:
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET, HEAD, POST, OPTIONS`
- `Access-Control-Allow-Headers: Content-Type`

### Data Retention
- **User Uploads**: Permanent storage (no TTL) - some uploads are linked to incidents
- **GPX Files**: Permanent storage (no TTL) - user's personal route library

## Integration Points
- **Frontend**: `profile-creator/`, `gpx-library/`, `archive/ground-conditions/`
- **Data Sync**: `tools/fetch_uploads.js` syncs uploads to `data/uploads.json`
- **Build**: `tools/lib/builders/buildGroundConditions.js` generates HTML from synced data

## Deployment
Deploy using Wrangler CLI:
```bash
wrangler deploy workers/upload-worker.js
```

Ensure KV namespace `UPLOADS` is bound in `wrangler.toml`.
