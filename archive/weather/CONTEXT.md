# Weather Archive Context

## Overview
This section provides access to historic mountain weather reports and station data.

## Data Acquisition
- **Script**: `tools/fetch_weather_report.js`
- **Source**: Mountain weather stations (config in `tools/lib/config.js` -> `WEATHER_STATIONS`, `TAWES_STATIONS`).
- **Process**:
    1. Fetches data from configured stations (API or HTML scraping).
    2. Aggregates data into `data/weather_archive.json`.
    3. Can also parse the textual "Alpine Weather Report" (Alpenwetterbericht).

## Page Generation
- **Builder**: `tools/lib/builders/buildWeatherPages.js`
- **Output**: 
    - `index.html`: Calendar/List of weather reports.
    - `[date].html`: Daily detail view showing conditions from all tracked stations for that specific date.
- **Purpose**: Correlate avalanche danger with actual weather conditions (wind, temp, new snow) recorded at high altitude.
