const fs = require('fs');
const path = require('path');
const { log } = require('./lib/utils');

const ROOT_DIR = path.resolve(__dirname, '..');
const DIST_DIR = path.join(ROOT_DIR, 'dist');

// Cleanup
if (fs.existsSync(DIST_DIR)) {
    fs.rmSync(DIST_DIR, { recursive: true, force: true });
}
fs.mkdirSync(DIST_DIR);

const FILES_TO_COPY = [
    'index.html',
    'styles.css',
    'stations_metadata.json'
];

const DIRS_TO_COPY = [
    'archive',
    'data',
    'forecast-archive',
    'gpx-library',
    'planning',
    'profile-creator',
    'snow-depth'
];

// Copy Files
FILES_TO_COPY.forEach(file => {
    const src = path.join(ROOT_DIR, file);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(DIST_DIR, file));
        log.info(`Copied ${file}`);
    }
});

// Copy Directories
DIRS_TO_COPY.forEach(dir => {
    const src = path.join(ROOT_DIR, dir);
    if (fs.existsSync(src)) {
        fs.cpSync(src, path.join(DIST_DIR, dir), { recursive: true });
        log.info(`Copied ${dir}/`);
    }
});

// Create .nojekyll in dist to ensure underscores are ignored by GH Pages
fs.writeFileSync(path.join(DIST_DIR, '.nojekyll'), '');
log.info('Created .nojekyll');

log.info('Dist folder prepared.');
