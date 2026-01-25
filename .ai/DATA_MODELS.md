# Data Models & Schemas

This document defines the core data structures used in the Avalanche Archiver.

## 1. Weather Stations (`data/weather_stations.json`)
A list of mountain weather stations and their timeseries data.

```typescript
type WeatherStationDB = WeatherStation[];

interface WeatherStation {
  name: string;        // e.g. "Hochgrat (1715m) / Hörmoos (1300m)"
  id: string;          // Unique ID, e.g. "7"
  apiUrl: string;      // The JSON source URL
  originalUrl: string; // The public facing URL
  lat: number;         // Latitude
  lon: number;         // Longitude
  elevation: number;   // Meters above sea level
  lastUpdated: string; // ISO Date String
  data: WeatherMeasurement[];
}

interface WeatherMeasurement {
  _id: string;
  ID: string;          // Station ID
  TS: string;          // Timestamp "YYYY-MM-DD HH:mm:ss"
  HS?: number;         // Height of Snow (cm)
  RR?: number;         // Rain (mm)
  TL?: number;         // Temperature Air (°C)
  TO?: number;         // Temperature Surface? (°C)
  dd?: number;         // Wind Direction (degrees)
  ff?: number;         // Wind Speed (m/s) or km/h?
  ffBoe?: number;      // Wind Gusts
  // ... other sensor fields
}
```

## 2. Weather Reports (`data/weather_archive.json`)
Daily textual weather reports scraped from the Avalanche Warning Service.

```typescript
type WeatherReportDB = WeatherReport[];

interface WeatherReport {
  date: string;              // "YYYY-MM-DD"
  title: string;             // e.g. "Mountain Weather Report (2026-01-19)"
  issued: string;            // Text description of issue time
  html_content: string;      // Raw HTML from source (German)
  translated_content?: string; // English translation (HTML)
  fetched_at?: string;       // ISO timestamp
}
```

## 3. Incidents (`data/incidents.json`)
Avalanche accidents scraped from lawis.at.

```typescript
type IncidentDB = Incident[];

interface Incident {
  id: number;                // Lawis ID
  date: string;              // "YYYY-MM-DD HH:mm:ss"
  location: string;          // Description
  regionId: number;
  subregionId: number;
  lat: number;
  lon: number;
  url: string;               // Lawis detail URL
  details: IncidentDetails;
  linked_profiles: LinkedProfile[];
  pdf_path?: string;         // Path to archived PDF bulletin for that day
}

interface IncidentDetails {
  comments?: string;         // Description German
  comments_en?: string;      // Description English
  danger?: {
    rating?: {
      level: number;         // 1-5
      text: string;
    };
    problem?: {
      text: string;          // e.g. "fresh snow"
    };
  };
  avalanche?: {
    type: { text: string }; // e.g. "slab"
    size: { text: string }; // e.g. "2: medium avalanche"
    release: { text: string }; // e.g. "artificial"
  };
  involved?: {
    dead: number;
    injured: number;
    buried_total: number;
    // ...
  };
  images: Array<{ url: string }>;
}

interface LinkedProfile {
  id: number;
  date: string;
  dist_km: string;
  elevation: number;
  aspect: number;
  latitude: number;
  longitude: number;
  url: string;
  local_path: string | null;
}
```

## 4. Region Config (`tools/lib/config.js`)
Configuration for the daily bulletin fetchers.

```typescript
interface RegionConfig {
  [slug: string]: {
    label: string;    // Human readable name
    slug: string;     // URL friendly ID
    type: 'pdf';      // Only PDF supported currently
  }
}
```

## 5. Webcams (`data/webcams.json`)
List of mountain webcams for the dashboard.

```typescript
type WebcamDB = Webcam[];

interface Webcam {
  title: string;       // Human readable title
  location: string;    // Region name (e.g. "Allgäu")
  type: string;        // e.g. "live"
  linkUrl: string;     // URL to the provider's page
  lat: number;         // Latitude
  lon: number;         // Longitude
  provider?: string;   // e.g. "Feratel", "Roundshot"
}
```

## 6. User Uploads (`data/uploads.json` & Cloudflare KV)
User-submitted snow profiles and ground condition reports.

```typescript
type UploadsDB = UploadRecord[];

interface UploadRecord {
  id: string;               // Unique ID (timestamp based)
  date: string;             // ISO Date "2026-01-21T..."
  user: string;             // Observer Name
  location: string;         // Location Name e.g. "Fellhorn"
  comment: string;          // User description
  lat: number;              // Latitude
  lon: number;              // Longitude
  elevation?: number;       // Elevation in meters
  aspect?: string;          // Aspect (N, NE, etc)
  type: 'profile' | 'generic';
  images: string[];         // Array of Base64 strings or URLs
  layers?: Layer[];         // Raw snow profile layers
  tests?: Test[];           // Stability tests
  approved: boolean;
}

interface Layer {
    id: number;
    thickness: number;
    hardness: string;
    grainForm: string;
    temp: number;
}

interface Test {
    id: number;
    result: string;
    depth: number;
    desc: string;
}
```

## 7. GPX Library (`data/gpx/routes-metadata.json`)
Metadata for the local GPX route collection.

```typescript
interface GPXArchive {
    routes: GPXRoute[];
}

interface GPXRoute {
    id: string;             // e.g. "Skitour_Hoehv_2024"
    name: string;           // Display Name
    filename: string;       // Original filename
    region: string;         // e.g. "Allgäu Alps Central"
    distance: number;       // km
    ascent: number;         // meters
    descent: number;        // meters
    elevationMin: number;
    elevationMax: number;
    maxSlope: number;       // degrees
    avgSlope: number;       // degrees
    primaryAspect: string;  // e.g. "N", "NW"
    aspectBreakdown: {      // Percentage of route on each aspect (>15°)
        N: number;
        NE: number;
        E: number;
        SE: number;
        S: number;
        SW: number;
        W: number;
        NW: number;
    };
}
```
