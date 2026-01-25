const fs = require('fs');
const path = require('path');
const { PATHS } = require('./lib/config');
const { log: logger } = require('./lib/utils');
const { buildPdfArchive } = require('./lib/builders/buildPdfArchive');
const { buildWeatherPages } = require('./lib/builders/buildWeatherPages');
const { buildIncidentPages } = require('./lib/builders/buildIncidentPages');
const { buildProfilePages } = require('./lib/builders/buildProfilePages');
const { buildSnowDepth } = require('./lib/builders/buildSnowDepth');

async function main() {
    logger.info('Starting build process...');
    logger.info(`PATHS.archive: ${PATHS.archive}`);
    logger.info(`PATHS.root: ${PATHS.root}`);

    const start = Date.now();

    try {
        logger.info('Ensuring archive dir...');
        if (!fs.existsSync(PATHS.archive)) {
            fs.mkdirSync(PATHS.archive, { recursive: true });
        }
    } catch (e) {
        logger.error('Error creating archive dir:', e);
    }

    // Phase 1: Run independent builders in parallel
    logger.info('Running independent builders in parallel...');
    const phase1Start = Date.now();

    await Promise.allSettled([
        // Weather pages - independent
        (async () => {
            try {
                logger.info('Running buildWeatherPages...');
                buildWeatherPages();
            } catch (e) {
                logger.error('Error in buildWeatherPages:', e);
            }
        })(),

        // PDF archive - independent
        (async () => {
            try {
                logger.info('Running buildPdfArchive...');
                buildPdfArchive();
            } catch (e) {
                logger.error('Error in buildPdfArchive:', e);
            }
        })(),

        // Incident pages - independent
        (async () => {
            try {
                logger.info('Running buildIncidentPages...');
                buildIncidentPages();
            } catch (e) {
                logger.error('Error in buildIncidentPages:', e);
            }
        })(),

        // Snow depth - independent
        (async () => {
            try {
                logger.info('Running buildSnowDepth...');
                buildSnowDepth();
            } catch (e) {
                logger.error('Error in buildSnowDepth:', e);
            }
        })(),

        // Ground conditions - independent
        (async () => {
            try {
                const { buildGroundConditions } = require('./lib/builders/buildGroundConditions');
                logger.info('Running buildGroundConditions...');
                buildGroundConditions();
            } catch (e) {
                logger.error('Error in buildGroundConditions:', e);
            }
        })()
    ]);

    logger.info(`Phase 1 completed in ${(Date.now() - phase1Start) / 1000}s`);

    // Phase 2: Fetch uploads (required for profiles)
    try {
        logger.info('Fetching latest uploads...');
        const { fetchUploads } = require('./fetch_uploads');
        await fetchUploads();
    } catch (e) {
        logger.error('Error fetching uploads (continuing build):', e);
    }

    // Phase 3: Build profiles (depends on uploads)
    try {
        logger.info('Running buildProfilePages...');
        buildProfilePages();
    } catch (e) {
        logger.error('Error in buildProfilePages:', e);
    }

    // Phase 4: Generate root index
    try {
        logger.info('Generating Root Index...');
        const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avalanche Archive Root</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <div class="container">
        <header><div class="header-content"><span class="logo">Skitour Allgäu</span>
        <div class="date-nav">
            Updates daily @ 06:00, 14:00 & 18:00 CET.<br>
            Changes may take a few hours to appear.
        </div></div></header>
        <h1>Archive Root</h1>
        <div class="grid">
            <a href="incidents/index.html" class="card"><h2>Incidents</h2></a>
            <a href="profiles/index.html" class="card"><h2>Snow Profiles</h2></a>
            <a href="snow-depth/index.html" class="card"><h2>Snow Depth</h2></a>
             <a href="../index.html" class="card" style="background:#eee;"><h2>&larr; Main Site</h2></a>
        </div>
        
        <h2>Regions</h2>
        <div class="grid">
            ${getRegionLinks()}
        </div>
        <footer><p>Generated on ${new Date().toLocaleString()}</p></footer>
    </div>
</body>
</html>`;

        const indexDest = path.join(PATHS.archive, 'index.html');
        fs.writeFileSync(indexDest, indexHtml);
        logger.info('Root index generated.');

        // Generate Health Check File
        try {
            const healthData = {
                status: 'ok',
                lastBuild: new Date().toISOString(),
                builders: {
                    phase1: 'parallel',
                    phase2: 'uploads',
                    phase3: 'profiles',
                    phase4: 'index'
                },
                durationSeconds: (Date.now() - start) / 1000
            };
            fs.writeFileSync(path.join(PATHS.archive, 'health.json'), JSON.stringify(healthData, null, 2));
            logger.info('Health check file generated.');
        } catch (e) {
            logger.error('Error generating health.json:', e);
        }

    } catch (e) {
        logger.error('Error generating root index:', e);
    }

    logger.info(`Build completed in ${(Date.now() - start) / 1000}s`);
}

function getRegionLinks() {
    try {
        const { REGION_CONFIG } = require('./lib/config');
        return Object.values(REGION_CONFIG).map(r =>
            `<a href="${r.slug}/index.html" class="card"><h2>${r.label}</h2></a>`
        ).join('');
    } catch (e) {
        logger.error('Error in getRegionLinks:', e);
        return '';
    }
}

main();
