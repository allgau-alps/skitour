# Snow Depth Context

## Overview
The **Snow Depth** module is a data visualization dashboard displaying real-time weather station data from the Bavarian Alps. It provides interactive charts for snow depth, temperature, wind, and precipitation.

## Structure
- **`index.html`**: Self-contained single-page application with embedded CSS and JavaScript.

## Key Features

### Data Display
- **Station Cards**: Grid layout showing current conditions for each weather station
- **Real-time Metrics**:
  - Snow Depth (cm) - Bavarian stations only
  - Air Temperature (°C)
  - Wind Speed (km/h)
  - Wind Direction (compass + arrows)
  - Precipitation (mm) - Austrian stations only

### Interactive Charts
- **Embedded Charts**: Small preview charts in each station card
- **Expandable Modal**: Full-screen detailed charts with all data series
- **Toggle Datasets**: Click legend items to show/hide specific metrics
- **Wind Direction Arrows**: Visual representation of wind direction overlaid on charts
- **24h Snow Difference**: Automatic calculation in tooltips

### Map Integration
- **Station Locations**: Each station name links to its location on the profiles map
- **Clickable Markers**: Map shows station position with link back to snow depth page

## Data Source
- **File**: `data/weather_stations.json`
- **Bavarian Stations**: Lawinenwarndienst Bayern
- **Austrian Stations**: Geosphere Austria (TAWES network)
- **Update Frequency**: Fetched during `npm run fetch:all`

## Technical Stack
- **Chart.js**: Interactive time-series charts
- **Custom Plugins**: Wind arrow visualization
- **Responsive Design**: Mobile-optimized with fullscreen modal support

## Data Flow
1. `fetch_weather.js` (Bayern) and `fetch_geosphere.js` (Austria) collect station data
2. Data is stored in `data/weather_stations.json`
3. This page loads and visualizes the data
4. Charts update automatically when data is refreshed

## Integration Points
- **Profiles Map**: Links to `archive/profiles/map.html` with station coordinates
- **Main Dashboard**: Accessible from root `index.html`
