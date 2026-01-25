const https = require('https');
const fs = require('fs');
const path = require('path');

// --- Simple Logging Wrapper ---
const log = {
    info: (msg) => console.log(`[INFO] ${new Date().toISOString().slice(11, 19)} ${msg}`),
    warn: (msg) => console.warn(`[WARN] ${new Date().toISOString().slice(11, 19)} ${msg}`),
    error: (msg, err) => console.error(`[ERROR] ${new Date().toISOString().slice(11, 19)} ${msg}`, err?.message || err || ''),
    debug: (msg) => process.env.DEBUG && console.log(`[DEBUG] ${new Date().toISOString().slice(11, 19)} ${msg}`)
};

/**
 * Fetch JSON data from a URL
 * @param {string} url - The URL to fetch from
 * @param {number} [timeout=15000] - Request timeout in milliseconds
 * @returns {Promise<any>} Parsed JSON data
 */
function fetchJson(url, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AvalancheArchiver/1.0'
            },
            timeout
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}: ${url}`));
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });
    });
}

/**
 * Download an image from a URL to a local path
 * @param {string} url - The URL of the image
 * @param {string} destPath - Destination file path
 * @returns {Promise<string|null>} Relative path to downloaded image, or null on error
 */
function downloadImage(url, destPath) {
    return new Promise((resolve) => {
        if (!url) return resolve(null);

        // Skip if exists
        if (fs.existsSync(destPath)) {
            resolve(destPath);
            return;
        }

        const req = https.get(url, {
            headers: { 'User-Agent': 'AvalancheArchiver/1.0' },
            timeout: 15000
        }, (res) => {
            if (res.statusCode === 200) {
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const file = fs.createWriteStream(destPath);
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(destPath);
                });
            } else {
                res.resume();
                resolve(null);
            }
        });

        req.on('error', () => resolve(null));
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
    });
}

/**
 * Calculate Haversine distance between two coordinates
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in kilometers
 */
function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

/**
 * Format a Date object as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Get human-readable month name from YYYY-MM format
 * @param {string} monthStr - Month in YYYY-MM format
 * @returns {string} Month name and year (e.g., "January 2026")
 */
function getMonthName(monthStr) {
    const [year, month] = monthStr.split('-');
    const date = new Date(year, parseInt(month) - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Translate aspect ID to human-readable direction
 * @param {number|string} id - Aspect ID (1-8) or string
 * @returns {string} Direction (N, NE, E, SE, S, SW, W, NW)
 */
function translateAspect(id) {
    if (!id) return '-';
    const map = {
        '1': 'N', '2': 'NE', '3': 'E', '4': 'SE',
        '5': 'S', '6': 'SW', '7': 'W', '8': 'NW'
    };
    return map[String(id)] || id;
}

module.exports = {
    log,
    fetchJson,
    downloadImage,
    getDistance,
    deg2rad,
    formatDate,
    getMonthName,
    translateAspect
};
