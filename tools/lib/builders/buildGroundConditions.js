const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');
const { log } = require('../utils');
const { generateGroundConditionsPage, generateUploadPage, generateWebcamPage, generateUserUploadDetailPage } = require('../templates');

function buildGroundConditions() {
    log.info('Building Ground Conditions...');

    const groundDir = path.join(PATHS.archive, 'ground-conditions');
    const webcamDir = path.join(PATHS.archive, 'webcams');

    fs.mkdirSync(groundDir, { recursive: true });
    fs.mkdirSync(webcamDir, { recursive: true });

    // 1. Load Data
    // Webcams
    let webcams = [];
    try {
        const webcamFile = path.join(PATHS.data, 'webcams.json');
        if (fs.existsSync(webcamFile)) {
            webcams = JSON.parse(fs.readFileSync(webcamFile, 'utf8'));
        }
    } catch (e) { log.error('Error loading webcams.json', e); }

    // Uploads
    let uploads = [];
    try {
        const uploadFile = path.join(PATHS.data, 'uploads.json');
        if (fs.existsSync(uploadFile)) {
            uploads = JSON.parse(fs.readFileSync(uploadFile, 'utf8'));
        }
    } catch (e) { log.error('Error loading uploads.json', e); }

    // Filter uploads (last 21 days)
    const now = new Date();
    const recentUploads = uploads.filter(u => {
        // Exclude generated snow profiles (they have their own section)
        if (u.type === 'profile') return false;

        const d = new Date(u.date);
        const diff = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24);
        return diff <= 21;
    });

    // Sort by date desc
    recentUploads.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 1.5 Copy Images to Archive
    const imagesDestDir = path.join(groundDir, 'images');
    if (!fs.existsSync(imagesDestDir)) fs.mkdirSync(imagesDestDir, { recursive: true });

    recentUploads.forEach(u => {
        // Helper to process a single image path
        const processImage = (imgStr) => {
            if (imgStr && imgStr.startsWith('../data')) {
                // Resolve source path (relative to tools dir, as saved by fetch_uploads)
                const srcPath = path.resolve(PATHS.tools, imgStr);

                if (fs.existsSync(srcPath)) {
                    const filename = path.basename(srcPath);
                    const destPath = path.join(imagesDestDir, filename);

                    // Copy file
                    try {
                        fs.copyFileSync(srcPath, destPath);
                        // Return relative path for HTML (uploads/ID.html -> ../images/FILE)
                        return `../images/${filename}`;
                    } catch (e) {
                        log.error(`Failed to copy image ${srcPath}`, e);
                        return imgStr;
                    }
                }
            }
            return imgStr;
        };

        if (u.image) u.image = processImage(u.image);
        if (u.images && Array.isArray(u.images)) {
            u.images = u.images.map(img => processImage(img));
        }
    });

    // 2. Generate Index Page (Ground Conditions Hub)
    const indexHtml = generateGroundConditionsPage({
        uploads: recentUploads,
        webcamCount: webcams.length
    });
    fs.writeFileSync(path.join(groundDir, 'index.html'), indexHtml);

    // 3. Generate Upload Form Page
    const uploadHtml = generateUploadPage();
    fs.writeFileSync(path.join(groundDir, 'upload.html'), uploadHtml);

    // 4. Generate Webcam Page
    const webcamHtml = generateWebcamPage(webcams);
    fs.writeFileSync(path.join(webcamDir, 'index.html'), webcamHtml);

    // 5. Generate Individual User Upload Pages
    // Create a 'uploads' subdir
    const userUploadsDir = path.join(groundDir, 'uploads');

    // Clean old pages first to ensure expired reports are removed
    if (fs.existsSync(userUploadsDir)) {
        fs.rmSync(userUploadsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(userUploadsDir, { recursive: true });

    recentUploads.forEach(u => {
        const safeId = u.id || new Date(u.date).getTime();
        const detailHtml = generateUserUploadDetailPage(u);
        fs.writeFileSync(path.join(userUploadsDir, `${safeId}.html`), detailHtml);
    });

    log.info('Ground Conditions build complete.');
}

module.exports = { buildGroundConditions };
