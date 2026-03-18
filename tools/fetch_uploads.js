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

function processImageBase64(upload, imgField, filenameSuffix = '') {
    if (!upload[imgField] || !upload[imgField].startsWith('data:image')) return upload[imgField];

    const ext = upload[imgField].substring(upload[imgField].indexOf('/') + 1, upload[imgField].indexOf(';'));
    const id = upload.id || new Date(upload.date).getTime();
    const filename = `${id}${filenameSuffix}.${ext}`;
    const filePath = path.join(IMAGES_DIR, filename);

    try {
        const base64Data = upload[imgField].split(',')[1];
        fs.writeFileSync(filePath, base64Data, 'base64');
        return `../data/upload_images/${filename}`;
    } catch (e) {
        log.error(`Failed to save image ${filename}:`, e.message);
        return upload[imgField]; // Keep original if save fails
    }
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

        // Helper to add/merge items with proper conflict resolution
        const addItems = (items) => {
            items.forEach(u => {
                const id = String(u.id || new Date(u.date).getTime());

                // Check if we already have this ID
                const existing = allUploadsMap.get(id);

                if (!existing) {
                    // New item, just add
                    allUploadsMap.set(id, { ...u });
                } else {
                    // Conflict resolution: Prefer local file paths over base64
                    // and newer timestamps over older ones
                    const incoming = u;
                    const keepIncoming = (() => {
                        // If existing has local file paths and incoming only has base64, keep existing
                        if (existing.image && existing.image.startsWith('../data/upload_images/') &&
                            incoming.image && incoming.image.startsWith('data:image')) {
                            return false;
                        }
                        // If existing has last_modified and incoming doesn't, keep existing
                        if (existing.last_modified && !incoming.last_modified) {
                            return false;
                        }
                        // If incoming has last_modified and it's newer, take incoming
                        if (incoming.last_modified && existing.last_modified &&
                            new Date(incoming.last_modified) > new Date(existing.last_modified)) {
                            return true;
                        }
                        // Otherwise, keep the one with more complete data (heuristic: longer JSON)
                        return JSON.stringify(incoming).length > JSON.stringify(existing).length;
                    })();

                    if (keepIncoming) {
                        allUploadsMap.set(id, { ...incoming });
                    }
                    // else keep existing as-is
                }
            });
        };

        // Add archive first (oldest), then active (may have edits), then new fetch (newest)
        addItems(archiveUploads);
        addItems(activeUploads);

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
        if (newUploads.length > 0) {
            newUploads.forEach(u => {
                const id = String(u.id || new Date(u.date).getTime());
                // For fresh fetches, always add (they may have base64 images to process)
                allUploadsMap.set(id, { ...u });
            });
        }

        log.info(`Total unique uploads tracked: ${allUploadsMap.size}`);

        // 3. Process Images (Extract Base64 -> File)
        const processedList = [];

        for (const [id, upload] of allUploadsMap.entries()) {
            const u = { ...upload };
            let changed = false;

            // Handle main image (legacy field)
            if (u.image && u.image.startsWith('data:image')) {
                u.image = processImageBase64(u, 'image');
                changed = true;
            }

            // Handle images array
            if (u.images && Array.isArray(u.images)) {
                u.images = u.images.map((img, index) => {
                    if (img && img.startsWith('data:image')) {
                        const ext = img.substring(img.indexOf('/') + 1, img.indexOf(';'));
                        const filename = `${id}_${index}.${ext}`;
                        const filePath = path.join(IMAGES_DIR, filename);

                        try {
                            const base64Data = img.split(',')[1];
                            fs.writeFileSync(filePath, base64Data, 'base64');
                            return `../data/upload_images/${filename}`;
                        } catch (e) {
                            log.error(`Failed to save image ${filename}:`, e.message);
                            return img;
                        }
                    }
                    return img;
                });
                changed = true;
            }

            // Ensure date is set
            if (!u.date && u.last_modified) {
                u.date = u.last_modified;
            }

            processedList.push(u);
        }

        // 4. Update Archive (Master Record)
        // Sort by date descending (use last_modified as tiebreaker)
        processedList.sort((a, b) => {
            const dateA = new Date(a.last_modified || a.date || 0);
            const dateB = new Date(b.last_modified || b.date || 0);
            return dateB - dateA;
        });

        fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(processedList, null, 2));
        log.info(`Updated Archive ${ARCHIVE_FILE} (${processedList.length} items)`);

        // 5. Update Active (Last 45 days)
        const Cutoff = Date.now() - (45 * 24 * 60 * 60 * 1000);

        const activeList = processedList.filter(u => {
            const date = new Date(u.last_modified || u.date || 0);
            return date.getTime() > Cutoff;
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
