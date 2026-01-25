const https = require('https');
const fs = require('fs');
const path = require('path');
const { fetchJsonWithRetry, downloadImageWithRetry } = require('./lib/fetcher');
const { translateText } = require('./lib/translator');
const { log } = require('./lib/utils');
const { validateEnv } = require('./lib/validateEnv');

const OUTPUT_FILE = path.join(__dirname, '../data/incidents.json');
const IMAGES_DIR = path.join(__dirname, '../data/incident_images');
const LOCATIONS_URL = 'https://lawis.at/lawis_api/v2_3/location/';
const INCIDENTS_URL = 'https://lawis.at/lawis_api/v2_3/incident/';

if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

async function downloadImage(url, incidentId) {
    if (!url) return null;
    const filename = path.basename(url).split('?')[0];
    const destDir = path.join(IMAGES_DIR, incidentId.toString());
    const destPath = path.join(destDir, filename);

    const absPath = await downloadImageWithRetry(url, destPath);
    if (!absPath) return null;

    return path.relative(path.join(__dirname, '../data'), absPath);
}

// Date Utils
function getSeasonDates() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // 1-12

    // Avalanche season usually starts around Sept/Oct.
    // If we are in Jan 2026, season started late 2025.
    // If we are in Oct 2025, season started late 2025.
    let startYear = currentYear;
    if (currentMonth < 9) {
        startYear = currentYear - 1;
    }

    return {
        startDate: `${startYear}-09-01`,
        endDate: `${startYear + 1}-09-01`
    };
}

(async () => {
    try {
        validateEnv({ required: [], optional: ['GCP_TRANSLATE_KEY', 'GOOGLE_TRANSLATE_KEY'] });

        log.info('Fetching locations...');
        const locations = await fetchJsonWithRetry(LOCATIONS_URL);

        // Recursive search for IDs
        const relevantSubregionIds = new Set();

        function findSubregions(obj, parentName = '') {
            if (!obj || typeof obj !== 'object') return;

            // If this object represents a region/subregion with a name
            if (obj.name && (obj.name.toLowerCase().includes('allgäu') || obj.name.toLowerCase().includes('kleinwalsertal'))) {
                // Try to determine the ID. In the Lawis structure, the ID is often the key in the parent object used to access this object.
                // However, we are iterating. If we are currently AT the object, we might not have the ID if it's the key.
                // But wait, usually `subregions` is a map of ID -> Object.
                // So when we iterate `Object.entries(parent.subregions)`, the key is the ID.
            }

            // Iterate children
            for (const key in obj) {
                const child = obj[key];
                if (key === 'subregions' && typeof child === 'object') {
                    // Iterate subregions map specifically to capture IDs
                    for (const subId in child) {
                        const subData = child[subId];
                        if (subData.name && (subData.name.toLowerCase().includes('allgäu') || subData.name.toLowerCase().includes('kleinwalsertal'))) {
                            log.info(`Found relevant subregion: ${subData.name} (ID: ${subId})`);
                            relevantSubregionIds.add(parseInt(subId));
                        }
                        // Recurse in case there are sub-subregions
                        findSubregions(subData, subData.name);
                    }
                } else {
                    findSubregions(child);
                }
            }
        }

        findSubregions(locations);

        if (relevantSubregionIds.size === 0) {
            log.warn('No relevant subregions found. Defaulting to known ID 82 (Allgäuer Alpen/Vorarlberg) as fallback.');
            relevantSubregionIds.add(82);
        }

        log.info('Fetching incidents...');
        // Fetch broad range to capture historical archive
        // User example was from 2021. Let's fetch from 2018.
        const incidentApiUrl = `${INCIDENTS_URL}?startDate=2018-09-01&endDate=${getSeasonDates().endDate}`;
        log.info(`Querying: ${incidentApiUrl}`);

        const allIncidents = await fetchJsonWithRetry(incidentApiUrl);

        if (!Array.isArray(allIncidents)) {
            throw new Error('Incidents API response is not an array');
        }

        const relevantIncidents = allIncidents.filter(inc =>
            relevantSubregionIds.has(inc.subregion_id)
        ).map(inc => ({
            id: inc.incident_id,
            date: inc.datum,
            location: inc.ort,
            regionId: inc.region_id,
            subregionId: inc.subregion_id,
            lat: inc.latitude,
            lon: inc.longitude,
            url: `https://lawis.at/incident/${inc.incident_id}`
        }));

        log.info(`Found ${relevantIncidents.length} relevant incidents.`);

        // 1. Load existing data to avoid re-fetching/re-translating
        let existingIncidentsMap = new Map();
        if (fs.existsSync(OUTPUT_FILE)) {
            try {
                const existingData = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
                for (const inc of existingData) {
                    existingIncidentsMap.set(inc.id, inc);
                }
                log.info(`Loaded ${existingIncidentsMap.size} existing incidents from local cache.`);
            } catch (e) {
                log.warn('Could not read existing data file, starting fresh.');
            }
        }

        const detailedIncidents = [];
        let newOrUpdatedCount = 0;

        for (const simpleInc of relevantIncidents) {
            try {
                // Check if we already have this incident with full details and translation
                const existing = existingIncidentsMap.get(simpleInc.id);

                let needsUpdate = false;
                if (!existing) {
                    needsUpdate = true; // New incident
                } else if (!existing.details) {
                    needsUpdate = true; // No details
                } else if (existing.details.comments && !existing.details.comments_en) {
                    needsUpdate = true; // Available German comments but no translation -> Retry translation
                }

                let finalInc = simpleInc;
                let details = null;
                let parsedImages = [];
                let commentsEn = null;

                if (!needsUpdate) {
                    finalInc = existing;
                } else {
                    newOrUpdatedCount++;
                    // Throttle slightly only if we are actually fetching
                    await new Promise(r => setTimeout(r, 200));

                    const detailUrl = `https://lawis.at/lawis_api/public/incident/${simpleInc.id}`;
                    log.info(`Fetching details for ${simpleInc.id}...`);
                    try {
                        details = await fetchJsonWithRetry(detailUrl);
                    } catch (e) {
                        log.error(`Failed to fetch details for ${simpleInc.id}`, e);
                        detailedIncidents.push(simpleInc);
                        continue;
                    }

                    // Merge details
                    // 1. Try images from API response first
                    if (details.images && Array.isArray(details.images)) {
                        parsedImages = details.images
                            .filter(img => img && img.url)
                            .map(img => ({
                                url: `https://lawis.at/lawis_api/v2_3/${img.url}`,
                                caption: img.caption,
                                comment: img.comment
                            }));
                    }

                    // 2. If no images found, try probing
                    if (parsedImages.length === 0) {
                        // console.log(`  Probing images for ${simpleInc.id}...`);
                        parsedImages = await probeImages(simpleInc.id);
                    } else {
                        // console.log(`  Found ${parsedImages.length} images from API for ${simpleInc.id}.`);
                    }

                    // DOWNLOAD IMAGES
                    for (const img of parsedImages) {
                        try {
                            const localRelPath = await downloadImage(img.url, simpleInc.id);
                            if (localRelPath) {
                                img.local_path = localRelPath.replace(/\\/g, '/'); // Normalize for JSON
                            }
                        } catch (e) {
                            log.error(`Failed to download image ${img.url}`, e);
                        }
                    }

                    if (details.comments) {
                        log.info(`  Translating text for ${simpleInc.id}...`);
                        commentsEn = await translateText(details.comments);
                        if (commentsEn) log.info(`  -> Success!`);
                        else log.info(`  -> Failed.`);
                    }

                    finalInc = {
                        ...simpleInc,
                        details: {
                            ...details,
                            images: parsedImages,
                            comments_en: commentsEn
                        }
                    };
                }

                // ALWAYS Re-Run PDF Logic
                await ensurePdfLink(finalInc);

                detailedIncidents.push(finalInc);

            } catch (err) {
                log.error(`Failed to fetch details for ${simpleInc.id}`, err);
                detailedIncidents.push(simpleInc);
            }
        }

        log.info(`Processed all incidents. ${newOrUpdatedCount} fetched/updated.`);

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(detailedIncidents, null, 2));
        log.info(`Saved ${detailedIncidents.length} incidents to ${OUTPUT_FILE}`);

    } catch (error) {
        log.error('Error in fetch_lawis_incidents:', error);
        process.exit(1);
    }
})();

async function probeImages(incidentId) {
    const base = "https://lawis.at/lawis_api/v2_3/files/incidents";
    const found = [];
    // Verify up to 5 images to keep it fast, user script said 20 but that's a lot of requests per incident
    for (let i = 0; i < 20; i++) {
        const index = String(i).padStart(3, '0');
        const url = `${base}/incident_${incidentId}_${index}.jpg`;
        // Check if exists using HEAD or GET
        try {
            const exists = await checkUrlExists(url);
            if (exists) {
                found.push({ url: url });
            } else if (i === 0) {
                // If the first one (000) fails, we assume no images and stop probing
                break;
            } else {
                // If a subsequent one fails, maybe gap? or end.
                // Usually sequential. Let's stop to save time.
                break;
            }
        } catch (e) {
            break;
        }
    }
    return found;
}

function checkUrlExists(url) {
    return new Promise((resolve) => {
        const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
            res.resume();
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
        req.end();
    });
}

// Translation logic moved to lib/translator.js

async function ensurePdfLink(inc) {
    const { PATHS } = require('./lib/config');
    const DAILY_PDF_DIR = PATHS.pdfs;
    const INCIDENT_PDF_DIR = PATHS.incidentBulletins;

    const dateStr = inc.date || (inc.details && inc.details.date);
    if (!dateStr) return;
    const iDate = dateStr.split(' ')[0].split('T')[0];

    // Priority slugs based on heuristics, but we will check all
    // Determine a "primary" slug based on region
    let primarySlug = 'allgau-alps-central';
    if (inc.regionId === 2) primarySlug = 'allgau-alps-west';
    else if (inc.regionId === 1) primarySlug = 'allgau-alps-east';
    // Note: subregionId 158 is Kleinwalsertal/Ifen area (uses AT-08 Vorarlberg bulletin = allgau-alps-west)
    if (inc.subregionId === 158) primarySlug = 'allgau-alps-west';

    // Create ordered slugs array with primarySlug first to prioritize correct region
    const allSlugs = ['allgau-alps-central', 'allgau-alps-west', 'allgau-alps-east', 'allgau-prealps'];
    const slugs = [primarySlug, ...allSlugs.filter(s => s !== primarySlug)];

    const dateObj = new Date(iDate);
    if (isNaN(dateObj.getTime())) return;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const ym = `${year}-${month}`;

    let foundPath = null;

    // 1. Check if it already exists in Incident Archive (prioritize correct region first)
    for (const slug of slugs) {
        const checkPath = path.join(INCIDENT_PDF_DIR, slug, ym, `${iDate}.pdf`);
        if (fs.existsSync(checkPath)) {
            foundPath = `incident_bulletins/${slug}/${ym}/${iDate}.pdf`;
            break;
        }
    }

    // 2. If not in Incident Archive, try to find in Daily Archive (any slug) and COPY
    if (!foundPath) {
        for (const slug of slugs) {
            const checkPath = path.join(DAILY_PDF_DIR, slug, `${iDate}.pdf`);
            if (fs.existsSync(checkPath)) {
                // Found in Daily! Copy to Incident Archive (using the SAME slug to preserve structure)
                const targetAbsPath = path.join(INCIDENT_PDF_DIR, slug, ym, `${iDate}.pdf`);
                try {
                    fs.mkdirSync(path.dirname(targetAbsPath), { recursive: true });
                    fs.copyFileSync(checkPath, targetAbsPath);
                    foundPath = `incident_bulletins/${slug}/${ym}/${iDate}.pdf`;
                } catch (e) {
                    // ignore
                }
                break;
            }
        }
    }

    if (foundPath) {
        inc.pdf_path = foundPath;
    }
}
