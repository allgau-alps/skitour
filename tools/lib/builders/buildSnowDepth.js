const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');
const { log: logger } = require('../utils');

/**
 * Build Snow Depth Page
 */
function buildSnowDepth() {
    const src = path.join(PATHS.snowDepthSource, 'index.html');
    const destDir = PATHS.snowDepthDir;

    if (!fs.existsSync(src)) {
        logger.warn('Snow depth source not found:', src);
        return;
    }
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    let content = fs.readFileSync(src, 'utf8');

    // Fix Map Links (JS Strings & HTML)
    // Source: '../archive/profiles/map.html' -> Dest: '../profiles/map.html'
    content = content.replace(/archive\/profiles\/map\.html/g, 'profiles/map.html');

    // Fix Back Link param for Map (JS String)
    // Source: '../../snow-depth/index.html' -> Dest: '../snow-depth/index.html'
    content = content.split('../../snow-depth/index.html').join('../snow-depth/index.html');

    // Remove any legacy Archive prefixes defined in source
    content = content.replace(/\.\.\/archive\//g, '../');

    fs.writeFileSync(path.join(destDir, 'index.html'), content);
    logger.info('Generated Snow Depth page.');
}

module.exports = { buildSnowDepth };
