const fs = require('fs');
const path = require('path');
const { PATHS } = require('../config');
const { log: logger } = require('../utils');

/**
 * Build Snow Depth Page
 */
function buildSnowDepth() {
    const src = path.join(PATHS.root, 'snow-depth', 'index.html');
    const destDir = path.join(PATHS.archive, 'snow-depth');

    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    let content = fs.readFileSync(src, 'utf8');

    // Fix relative links for archive structure (deep by 1 level)
    // The source has `../index.html`. Archive needs `../../index.html`.
    content = content.replace(/href="\.\.\/index\.html"/g, 'href="../../index.html"');

    // Fix map link
    // Source might have `../archive/profiles/map.html` or `../profiles/map.html`
    // In archive structure: `../../profiles/map.html`.
    content = content.replace(/href="\.\.\/archive\/profiles\/map\.html/g, 'href="../../profiles/map.html');
    content = content.replace(/href="\.\.\/profiles\/map\.html/g, 'href="../../profiles/map.html');

    // Fix other assets if necessary (styles.css is usually ../styles.css, needs ../../styles.css)
    content = content.replace(/href="\.\.\/styles\.css"/g, 'href="../../styles.css"');

    fs.writeFileSync(path.join(destDir, 'index.html'), content);
    logger.info('Generated Snow Depth page.');
}

module.exports = { buildSnowDepth };
