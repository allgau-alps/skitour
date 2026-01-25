const fs = require('fs');
const { log: logger } = require('./lib/utils');
const { fetchJsonWithRetry } = require('./lib/fetcher');
const { TAWES_STATIONS, PATHS } = require('./lib/config');

const OUTPUT_FILE = PATHS.weatherStations;
const DATASET = 'tawes-1h-station-messwerte';

const fetchGeosphere = async () => {
    // 1. Load Existing Data
    let existingStations = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            const raw = fs.readFileSync(OUTPUT_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                existingStations = parsed;
            } else if (typeof parsed === 'object') {
                existingStations = Object.values(parsed);
            }
        } catch (e) {
            logger.warn('Could not read existing weather_stations.json');
        }
    }

    // 2. Build TAWES Request
    const now = new Date();
    // Fetch last 7 days to match previous logic
    const START_DATE = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString();

    const PARAMS = 'TL,RR,HS,DD,FF,FFX';
    // TL = Temp, RR = Rain, HS = Snow Height, DD = Wind Dir, FF = Wind Speed, FFX = Gust

    const urlParams = new URLSearchParams();
    urlParams.append('subsequence_start', START_DATE);
    // Add multiple station IDs
    TAWES_STATIONS.forEach(s => urlParams.append('station_ids', s.id));
    PARAMS.split(',').forEach(p => urlParams.append('parameters', p));

    const URL = `https://dataset.api.hub.geosphere.at/v1/station/historical/${DATASET}?${urlParams.toString()}`;
    logger.info(`Fetching Austrian Weather Data from ${URL}...`);

    try {
        const response = await fetchJsonWithRetry(URL, { timeout: 20000 });

        // 3. Process Response
        if (!response.features || !response.timestamps) {
            logger.error('Invalid Geosphere response format');
            return;
        }

        const timestamps = response.timestamps.map(ts => new Date(ts).toISOString());

        for (const feature of response.features) {
            const stationId = feature.properties.station;
            // Config IDs match response IDs? Config has simple string '11012', response likely same
            const meta = TAWES_STATIONS.find(s => String(s.id) === String(stationId));
            if (!meta) continue;

            const params = feature.properties.parameters;

            // Transform to our format: { TS, HS, TL, ff, ... }
            const dataPoints = [];
            for (let i = 0; i < timestamps.length; i++) {
                const tl = params.TL && params.TL.data[i] !== null ? params.TL.data[i] : null;
                const hs = params.HS && params.HS.data[i] !== null ? params.HS.data[i] : null;
                const rr = params.RR ? params.RR.data[i] : null;
                const ff = params.FF ? params.FF.data[i] : null;
                const dd = params.DD ? params.DD.data[i] : null;

                if (tl !== null || hs !== null || rr !== null || ff !== null) {
                    dataPoints.push({
                        TS: timestamps[i],
                        TL: tl,
                        HS: hs,
                        RR: rr,
                        ff: ff,
                        dd: dd
                    });
                }
            }

            // Merge with existing
            const existingStation = existingStations.find(s => String(s.id) === `AT-${stationId}`);
            const mergedData = new Map();

            if (existingStation && existingStation.data) {
                existingStation.data.forEach(d => mergedData.set(d.TS, d));
            }

            dataPoints.forEach(d => mergedData.set(d.TS, d));

            // Sort and Limit
            const allData = Array.from(mergedData.values()).sort((a, b) => new Date(a.TS) - new Date(b.TS));
            const recentData = allData.slice(-1100);

            // Update/Create Station Entry
            const index = existingStations.findIndex(s => String(s.id) === `AT-${stationId}`);
            const newEntry = {
                name: `${meta.name} (TAWES)`,
                id: `AT-${stationId}`,
                source: 'Geosphere Austria',
                lat: meta.lat,
                lon: meta.lon,
                elevation: meta.elevation,
                lastUpdated: new Date().toISOString(),
                data: recentData
            };

            if (index >= 0) {
                existingStations[index] = newEntry;
            } else {
                existingStations.push(newEntry);
            }
        }

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existingStations, null, 2));
        logger.info(`Updated ${TAWES_STATIONS.length} Austrian stations.`);

    } catch (e) {
        logger.error('Failed to fetch Geosphere data:', e.message);
    }
};

fetchGeosphere();
