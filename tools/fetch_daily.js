const fs = require('fs');
const path = require('path');
const { fetchJsonWithRetry } = require('./lib/fetcher');
const { processBulletinForPdfs } = require('./pdf_fetcher');
const { formatDate, log } = require('./lib/utils');
const { SOURCES, PATHS } = require('./lib/config');

// Determine target date
// Default: Today
// Override: CLI argument (YYYY-MM-DD)
let targetDate = new Date();
if (process.argv[2]) {
    targetDate = new Date(process.argv[2]);
}

// Helper for Cache Directory
const CACHE_DIR = PATHS.bulletinCache;
if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });

// Stats tracking
const stats = { fetched: 0, cached: 0, pdfsNew: 0, pdfsUpdated: 0, errors: 0 };

// Helper to fetch and process a single source
/**
 * Fetches JSON metadata for a source and triggers PDF processing.
 * 
 * @param {object} source - Source configuration object from config.js
 * @param {string} source.name - Unique identifier (e.g. 'DE-BY')
 * @param {function} source.url - Function returning API URL: (date) => string
 * @param {string} source.type - 'lawinen-warnung' or 'avalanche-report'
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
async function fetchAndProcess(source, dateStr) {
    const url = source.url(dateStr);
    const cacheFile = path.join(CACHE_DIR, `${source.name}_${dateStr}.json`);

    log.info(`Fetching ${source.name}...`);

    try {
        const data = await fetchJsonWithRetry(url);
        // Normalize for comparison (and saving)
        // Using stringify ensures consistent formatting in cache
        const contentStr = JSON.stringify(data);

        let isNew = true;
        if (fs.existsSync(cacheFile)) {
            const cacheStr = fs.readFileSync(cacheFile, 'utf-8');
            // Compare strings. This might trigger one update if cache was raw formatted, 
            // but effectively self-heals the cache format.
            if (contentStr === cacheStr) {
                log.info(`${source.name}: No changes (cached)`);
                stats.cached++;
                isNew = false;
            }
        }

        if (isNew) {
            stats.fetched++;

            // Process Pdfs
            const bulletins = Array.isArray(data) ? data : data.bulletins;
            if (bulletins) {
                for (const bulletin of bulletins) {
                    const result = await processBulletinForPdfs(bulletin, dateStr, source.type);
                    if (result === 'new') stats.pdfsNew++;
                    if (result === 'updated') stats.pdfsUpdated++;
                }
            }

            // Update Cache
            fs.writeFileSync(cacheFile, contentStr); // Save the normalized string
            log.info(`${source.name}: Updated cache`);
        }
        return true;

    } catch (e) {
        log.error(`${source.name} processing failed`, e);
        stats.errors++;
        return false;
    }
}


(async () => {
    const dates = [targetDate];

    // If running automatically (no CLI arg) and it is evening (UTC Hour >= 15)
    // Include tomorrow's bulletin
    if (!process.argv[2]) {
        const utcHour = new Date().getUTCHours();
        if (utcHour >= 15) {
            const tomorrow = new Date(targetDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            dates.push(tomorrow);
            log.info(`Evening run (UTC ${utcHour}:00). Including tomorrow.`);
        }
    }

    for (const date of dates) {
        const dStr = formatDate(date);
        log.info(`=== Processing: ${dStr} ===`);

        // Parallel fetch all sources for this date
        await Promise.all(SOURCES.map(source => fetchAndProcess(source, dStr)));
    }

    // Summary
    log.info(`--- Summary ---`);
    log.info(`Sources fetched: ${stats.fetched}, cached: ${stats.cached}`);
    log.info(`PDFs new: ${stats.pdfsNew}, updated: ${stats.pdfsUpdated}`);
    if (stats.errors > 0) log.warn(`Errors: ${stats.errors}`);

    process.exit(stats.errors > 0 ? 1 : 0);
})();
