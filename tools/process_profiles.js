const https = require('https');
const fs = require('fs');
const path = require('path');
const { log: logger, getDistance } = require('./lib/utils');
const { fetchJsonWithRetry, downloadImageWithRetry } = require('./lib/fetcher');

const INCIDENTS_FILE = path.join(__dirname, '../data/incidents.json');
const RECENT_PROFILES_FILE = path.join(__dirname, '../data/recent_profiles.json');
const PROFILE_API_URL = 'https://lawis.at/lawis_api/v2_3/profile/';
const IMAGES_DIR = path.join(__dirname, '../data/profile_images');

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

// Helper to get relative path for data (used for local_path logic)
function getRelativeDataPath(absPath) {
    return path.relative(path.join(__dirname, '..', 'data'), absPath);
}


// Configuration
const MATCH_DIST_KM = 1.0; // 1km
const MATCH_TIME_DAYS = 2; // 48hrs
const RECENT_WINDOW_DAYS = 21;

// Helper to fetch JSON
// Helper to fetch JSON
// Use fetchJsonWithRetry imported from fetcher.js

(async () => {
    logger.info('--- Processing Snow Profiles ---');

    // 1. Load Incidents
    let incidents = [];
    if (fs.existsSync(INCIDENTS_FILE)) {
        incidents = JSON.parse(fs.readFileSync(INCIDENTS_FILE, 'utf8'));
    }
    logger.info(`Loaded ${incidents.length} incidents.`);

    // 2. Fetch Profiles (Historical Pass logic: fetch from 2018?)
    // In production, we might want to be smarter, but for now, let's fetch broad.
    // However, fetching 6 years of profiles might be heavy. 
    // Optimization: If we have many incidents, we definitely want matching.
    // Let's simpler: Fetch ALL from 2018-01-01. Lawis API is usually fast enough for a few thousand items.

    // Calculate start date: Earliest incident date - 7 days, OR default to 2018.
    // For now, let's hardcode a reasonable historical start for the "one-time" pass.
    // User requested "one-time historical pass".
    const startDate = '2018-09-01';
    logger.info(`Fetching profiles since ${startDate}...`);

    const profiles = await fetchJsonWithRetry(`${PROFILE_API_URL}?startDate=${startDate}`);
    logger.info(`Fetched ${profiles.length} profiles.`);

    // 3. Match Profiles to Incidents
    let mtachedCount = 0;

    // We should enable "Germany" and "Allgau" filtering for recent profiles.
    // Simple Bounding Box/Region Check for "Recent" list (Allgau + Bayern)
    // Approximate box for Bavarian Alps + Allgau:
    // Lat: 47.2 - 47.8, Lon: 9.9 - 13.5
    // Center: Oberstdorf (47.4099, 10.2797) - Radius: 25km
    function isRelevantRegion(p) {
        const lat = p.latitude;
        const lon = p.longitude;
        if (!lat || !lon) return false;

        const dist = getDistance(47.4099, 10.2797, lat, lon);
        return dist <= 25;
    }

    const now = new Date();
    const recentProfiles = [];

    // Helper to parse date "YYYY-MM-DD HH:mm:ss"
    function parseDate(dStr) {
        return new Date(dStr.replace(' ', 'T'));
    }

    profiles.forEach(p => {
        const pDate = parseDate(p.datum); // Assuming "datum" field

        // A. Recent Profiles Logic
        const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24);
        if (diffDays <= RECENT_WINDOW_DAYS && diffDays >= 0) {
            // Check region
            if (isRelevantRegion(p)) {
                recentProfiles.push(p);
            }
        }
    });

    // B. Incident Matching Logic
    // B. Incident Matching Logic
    for (const inc of incidents) {
        const iDate = parseDate(inc.date);

        // Initialize or clear matches
        inc.linked_profiles = [];

        for (const p of profiles) {
            if (!p.latitude || !p.longitude) continue;

            // 1. Time Check
            const pDate = parseDate(p.datum);
            const timeDiff = Math.abs((iDate.getTime() - pDate.getTime()) / (1000 * 60 * 60 * 24));

            if (timeDiff <= MATCH_TIME_DAYS) {
                // 2. Distance Check
                const dist = getDistance(inc.lat, inc.lon, p.latitude, p.longitude);
                if (dist <= MATCH_DIST_KM) {
                    // Match!
                    const imgUrl = `https://lawis.at/lawis_api/v2_3/files/profiles/snowprofile_${p.profil_id}.png?v=${p.revision || 1}`;
                    let localPath = null;
                    try {
                        // We can await here now
                        const filename = path.basename(imgUrl).split('?')[0];
                        const destPath = path.join(IMAGES_DIR, filename);

                        const absPath = await downloadImageWithRetry(imgUrl, destPath);
                        if (absPath) localPath = getRelativeDataPath(absPath).replace(/\\/g, '/');
                    } catch (e) { logger.error('Error downloading profile image', e); }

                    inc.linked_profiles.push({
                        id: p.profil_id,
                        date: p.datum,
                        dist_km: dist.toFixed(3),
                        elevation: p.seehoehe,
                        aspect: p.exposition, // or expo? need to verify field
                        latitude: p.latitude,
                        longitude: p.longitude,
                        url: imgUrl,
                        local_path: localPath
                    });
                }
            }
        }

        if (inc.linked_profiles.length > 0) {
            mtachedCount++;
            // Sort by distance
            inc.linked_profiles.sort((a, b) => parseFloat(a.dist_km) - parseFloat(b.dist_km));
        }
    }

    logger.info(`Matched profiles to ${mtachedCount} incidents.`);
    logger.info(`Found ${recentProfiles.length} recent profiles in region.`);

    // 4. Download images for recent profiles
    logger.info('Downloading images for recent profiles...');
    for (const p of recentProfiles) {
        const imgUrl = `https://lawis.at/lawis_api/v2_3/files/profiles/snowprofile_${p.profil_id}.png?v=${p.revision || 1}`;
        const destPath = path.join(IMAGES_DIR, `snowprofile_${p.profil_id}.png`);
        try {
            await downloadImageWithRetry(imgUrl, destPath);
        } catch (e) {
            logger.error(`Error downloading profile image ${p.profil_id}:`, e.message);
        }
    }

    // 5. Save
    fs.writeFileSync(INCIDENTS_FILE, JSON.stringify(incidents, null, 2));

    // Sort recent by date desc
    recentProfiles.sort((a, b) => parseDate(b.datum).getTime() - parseDate(a.datum).getTime());
    fs.writeFileSync(RECENT_PROFILES_FILE, JSON.stringify(recentProfiles, null, 2));

    logger.info('Saved updates.');

})();
