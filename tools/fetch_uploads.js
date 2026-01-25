const fs = require('fs');
const path = require('path');
const https = require('https');
const { log } = require('./lib/utils');
const { validateEnv } = require('./lib/validateEnv');

// Configure your Worker URL here or via environment variable
const WORKER_URL = process.env.UPLOAD_WORKER_URL || 'https://avalanche-archiver-uploads.bigdoggybollock.workers.dev';

// Files
const ACTIVE_FILE = path.join(__dirname, '../data/uploads.json');
const ARCHIVE_FILE = path.join(__dirname, '../data/uploads_archive.json');
const IMAGES_DIR = path.join(__dirname, '../data/upload_images');

async function fetchUploads() {
    validateEnv({ required: [], optional: ['UPLOAD_WORKER_URL'] });
    log.info(`Fetching uploads from ${WORKER_URL}...`);

    return new Promise((resolve, reject) => {
        https.get(WORKER_URL + '/list?limit=50', (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(new Error(`Failed to parse response: ${data.substring(0, 100)}`));
                    }
                } else {
                    reject(new Error(`Worker returned status ${res.statusCode}: ${data}`));
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function loadFile(filePath) {
    if (fs.existsSync(filePath)) {
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } catch (e) {
            log.error(`Failed to parse ${filePath}: ${e.message}`);
            return [];
        }
    }
    return [];
}

async function main() {
    try {
        // Ensure directories exist
        if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR, { recursive: true });

        // 1. Load existing data
        const activeUploads = loadFile(ACTIVE_FILE);
        const archiveUploads = loadFile(ARCHIVE_FILE);

        // Use a Map to deduplicate by ID key
        const allUploadsMap = new Map();

        // Helper to add/merge items
        const addItems = (items) => {
            items.forEach(u => {
                const id = u.id || new Date(u.date).getTime();
                // We overwrite existing with newer version (in case of edits), 
                // but usually older data is more complete if the new fetch is partial?
                // Actually, if we modify file paths locally, we want to PRESERVE the local version 
                // unless the remote version has changed?
                // Since user uploads are generally immutable or explicitly edited, 
                // and we strip base64, we should trust our local processed version 
                // UNLESS the incoming one is "raw" with base64 (which implies new data).

                // Strategy: Always add. If duplicate ID, last write wins.
                // We process "Archive" first, then "Active", then "New Fetch".
                // This ensures latest state is preserved.
                allUploadsMap.set(String(id), u);
            });
        };

        addItems(archiveUploads);
        addItems(activeUploads); // Active might have newer edits than archive

        // 2. Fetch new data
        let newUploads = [];
        try {
            newUploads = await fetchUploads();
            log.info(`Retrieved ${newUploads.length} uploads from worker.`);
        } catch (e) {
            log.warn('Failed to fetch new uploads, proceeding with local data maintenance.');
            log.error(e.message);
        }

        // Merge new uploads
        // Note: New uploads from worker might have Base64 images.
        // We add them to the map, potentially overwriting proper local paths with Base64.
        // That's fine, because step 3 cleaning will fix it.
        if (newUploads.length > 0) {
            newUploads.forEach(u => {
                const id = String(u.id || new Date(u.date).getTime());
                allUploadsMap.set(id, u);
            });
        }

        log.info(`Total unique uploads tracked: ${allUploadsMap.size}`);

        // 3. Process Images (Extract Base64 -> File)
        const processedList = [];

        for (const [id, upload] of allUploadsMap.entries()) {
            const u = { ...upload }; // Clone
            let changed = false;

            // Handle main image
            if (u.image && u.image.startsWith('data:image')) {
                const ext = u.image.substring(u.image.indexOf('/') + 1, u.image.indexOf(';'));
                const filename = `${id}.${ext}`;
                const filePath = path.join(IMAGES_DIR, filename);

                // Save file
                const base64Data = u.image.split(',')[1];
                fs.writeFileSync(filePath, base64Data, 'base64');

                // Update reference
                u.image = `../data/upload_images/${filename}`;
                changed = true;
            }

            // Handle images array
            if (u.images && Array.isArray(u.images)) {
                u.images = u.images.map((img, index) => {
                    if (img && img.startsWith('data:image')) {
                        const ext = img.substring(img.indexOf('/') + 1, img.indexOf(';'));
                        const filename = `${id}_${index}.${ext}`;
                        const filePath = path.join(IMAGES_DIR, filename);

                        const base64Data = img.split(',')[1];
                        fs.writeFileSync(filePath, base64Data, 'base64');
                        changed = true;

                        return `../data/upload_images/${filename}`;
                    }
                    return img;
                });
            }

            processedList.push(u);
        }

        // 4. Update Archive (Master Record)
        // Sort by date descending
        processedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(processedList, null, 2));
        log.info(`Updated Archive ${ARCHIVE_FILE} (${processedList.length} items)`);

        // 5. Update Active (Ephemera - e.g. last 45 days)
        // Broad enough to cover the 21-day build window with safety margin
        const Cutoff = Date.now() - (45 * 24 * 60 * 60 * 1000);

        const activeList = processedList.filter(u => {
            return new Date(u.date).getTime() > Cutoff;
        });

        fs.writeFileSync(ACTIVE_FILE, JSON.stringify(activeList, null, 2));
        log.info(`Updated Active ${ACTIVE_FILE} (${activeList.length} items)`);

    } catch (e) {
        log.error('Fatal error in fetch_uploads:', e);
        process.exit(1);
    }
}

// Allow running directly or importing
if (require.main === module) {
    main();
}

module.exports = { fetchUploads: main };
