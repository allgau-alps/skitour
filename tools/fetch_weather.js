const fs = require('fs');
const { log: logger } = require('./lib/utils');
const { fetchJsonWithRetry } = require('./lib/fetcher');
const { WEATHER_STATIONS, PATHS } = require('./lib/config');

const OUTPUT_FILE = PATHS.weatherStations;

const main = async () => {
    logger.info('Fetching weather station data...');
    try {
        let existingData = [];
        if (fs.existsSync(OUTPUT_FILE)) {
            try {
                existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            } catch (e) {
                logger.warn('Could not read existing data, starting fresh.');
            }
        }

        const results = await Promise.all(WEATHER_STATIONS.map(async (station) => {
            logger.info(`Fetching ${station.name}...`);
            try {
                // Use shared fetchJson with 10s timeout
                const newData = await fetchJsonWithRetry(station.apiUrl, { timeout: 10000 });

                // Find existing station data to merge with
                const existingStation = existingData.find(s => s.id === station.id) || { data: [] };

                // Merge arrays: create a map of TS -> entry to deduplicate
                const mergedMap = new Map();

                // Add existing data
                existingStation.data.forEach(item => mergedMap.set(item.TS, item));

                // Add/Overwrite with new data
                newData.forEach(item => mergedMap.set(item.TS, item));

                // Convert back to array and sort
                const allData = Array.from(mergedMap.values()).sort((a, b) => new Date(a.TS) - new Date(b.TS));

                // The API returns data in 10-minute intervals. 
                // 6 points/hour * 24 hours * 7 days = 1008 points.
                // Keeping 1100 to ensure we cover full 7 days.
                const recentData = allData.slice(-1100);

                return {
                    ...station,
                    lastUpdated: new Date().toISOString(),
                    data: recentData
                };
            } catch (error) {
                logger.error(`Failed to fetch ${station.name}:`, error.message);
                // Return existing data if fetch fails
                const existingStation = existingData.find(s => s.id === station.id);
                return existingStation || {
                    ...station,
                    error: error.message,
                    data: []
                };
            }
        }));

        // Merge results into existingData preserving other stations
        const finalStationsMap = new Map();

        // 1. Add all existing stations to map
        existingData.forEach(s => {
            if (s.name) finalStationsMap.set(s.name, s);
        });

        // 2. Overwrite/Add updated Bavarian stations
        results.forEach(r => {
            finalStationsMap.set(r.name, r);
        });

        const outputList = Array.from(finalStationsMap.values());
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(outputList, null, 2));
        logger.info(`Successfully wrote data to ${OUTPUT_FILE}`);

    } catch (error) {
        logger.error('Fatal error:', error);
        process.exit(1);
    }
};

main();
