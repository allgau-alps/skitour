const fs = require('fs');
const path = require('path');
const { generateIndexPage } = require('../templates');
const { formatDate, getMonthName, log } = require('../utils');
const { REGION_CONFIG, PATHS } = require('../config');

/**
 * Build PDF Archive Hierarchy
 * @returns {void}
 */
function buildPdfArchive() {
    // 1. Scan PDFs to build hierarchy
    const pdfsBaseDir = PATHS.pdfs;
    const allData = {}; // { regionId: { yyyy-mm: { yyyy-mm-dd: { file, updated } } } }

    if (!fs.existsSync(pdfsBaseDir)) return;

    for (const regionSlug of fs.readdirSync(pdfsBaseDir)) {
        const regionPath = path.join(pdfsBaseDir, regionSlug);
        if (!fs.statSync(regionPath).isDirectory()) continue;

        // Find config ID by slug (reverse lookup)
        const regionId = Object.keys(REGION_CONFIG).find(k => REGION_CONFIG[k].slug === regionSlug);
        if (!regionId) continue; // Skip unknown folders

        if (!allData[regionId]) allData[regionId] = {};

        for (const file of fs.readdirSync(regionPath)) {
            if (!file.endsWith('.pdf')) continue;

            const dateMatch = file.match(/^(\d{4}-\d{2}-\d{2})/);
            if (!dateMatch) continue;
            const dateStr = dateMatch[1];
            const monthStr = dateStr.substring(0, 7); // YYYY-MM

            if (!allData[regionId][monthStr]) allData[regionId][monthStr] = {};

            // Determine if update or version
            let label = "Download PDF";
            let displayClass = "pdf-link";

            // Check for v2/v3 suffix (Old style)
            if (file.includes('_v')) {
                const parts = file.split('_v');
                const v = parts[1].replace('.pdf', '');
                label = `Version ${v}`;
                displayClass += " updated";
            }
            // Check for timestamp suffix (New style: _YYYYMMDD-HHMM)
            else {
                // Regex for _20260112-1600
                const tsMatch = file.match(/_(\d{8})-(\d{4})\.pdf$/);
                if (tsMatch) {
                    const dPart = tsMatch[1]; // 20260112
                    const tPart = tsMatch[2]; // 1600

                    // Format readable
                    const y = dPart.substring(0, 4);
                    const m = dPart.substring(4, 6);
                    const d = dPart.substring(6, 8);
                    const H = tPart.substring(0, 2);
                    const M = tPart.substring(2, 4);

                    // Construct Date object to be locale aware if needed, or just string
                    // 12 Jan 2026, 16:00:00
                    const dateObj = new Date(`${y}-${m}-${d}T${H}:${M}:00Z`); // Treat as UTC for display consistency or simplistic
                    // Actually usually local time. 
                    const readable = `${d} ${getMonthName(`${y}-${m}`).split(' ')[0]} ${y}, ${H}:${M}:00`;

                    label = `Updated ${readable}`;
                    displayClass += " updated";
                }
            }

            allData[regionId][monthStr][dateStr] = {
                file: file,
                label: label,
                class: displayClass
            };
        }
    }

    // 2. Generate Index Pages
    for (const [regionId, monthsData] of Object.entries(allData)) {
        const config = REGION_CONFIG[regionId];
        const regionDir = path.join(PATHS.archive, config.slug);
        if (!fs.existsSync(regionDir)) fs.mkdirSync(regionDir, { recursive: true });

        // Generate Region Index (List of Months)
        const sortedMonths = Object.keys(monthsData).sort().reverse();
        const monthsHtml = generateIndexPage(
            config.label,
            `../../`,
            sortedMonths.map(m => ({ text: getMonthName(m), href: `${m}/index.html` })),
            false,
            `../../forecast-archive/index.html`
        );
        fs.writeFileSync(path.join(regionDir, 'index.html'), monthsHtml);

        for (const [month, datesData] of Object.entries(monthsData)) {
            const monthDir = path.join(regionDir, month);
            if (!fs.existsSync(monthDir)) fs.mkdirSync(monthDir, { recursive: true });

            // Generate Month Index (List of Days)
            const sortedDates = Object.keys(datesData).sort().reverse();
            let daysHtml = generateIndexPage(
                `${config.label} - ${getMonthName(month)}`,
                `../../../`,
                sortedDates.map(d => {
                    const item = datesData[d];
                    // Also check if we have a detailed weather report for this day
                    const weatherPath = path.join(PATHS.archive, 'weather', `${d}.html`);
                    // We can't easily check file existence from here relative to output without absolute path
                    // But we know where we put them.
                    const hasWeather = fs.existsSync(weatherPath);
                    const weatherLink = hasWeather ? ` <a href="../../../weather/${d}.html" class="weather-icon" title="View Weather Report">🌤️</a>` : '';

                    return {
                        text: `${d} ${weatherLink}`,
                        href: item.file // Opens PDF directly
                    };
                }),
                false,
                `../index.html`
            );

            // Actually, the card href IS the PDF.
            // But we want to show the "Updated" label if present.
            // For weather links, we need to generate them as separate elements.

            // Generate custom HTML for this month page with weather links
            let cardsHtml = '';
            const now = new Date();

            sortedDates.forEach(d => {
                const item = datesData[d];
                const weatherFile = path.join(PATHS.archive, 'weather', `${d}.html`);
                const hasWeather = fs.existsSync(weatherFile);

                let labelHtml = '';
                if (item.class.includes('updated')) {
                    // Check if 24+ hours have passed since the ORIGINAL was published
                    // Original bulletins publish at ~17:00 the day BEFORE the bulletin date
                    // e.g., 2026-01-12 bulletin was originally published 2026-01-11 at 17:00
                    const bulletinDate = new Date(d + 'T00:00:00');
                    const originalPublishTime = new Date(bulletinDate);
                    originalPublishTime.setDate(originalPublishTime.getDate() - 1);
                    originalPublishTime.setHours(17, 0, 0, 0); // 17:00 previous day

                    const hoursSinceOriginal = (now - originalPublishTime) / (1000 * 60 * 60);

                    // Check if original version exists (format: {date}.pdf without timestamp)
                    const originalFilename = `${d}.pdf`;
                    const originalExists = fs.existsSync(path.join(monthDir, originalFilename)) ||
                        fs.existsSync(path.join(PATHS.pdfs, config.slug, originalFilename));

                    if (hoursSinceOriginal >= 24 && originalExists) {
                        labelHtml = `<span class="badge-update">${item.label} <a href="${originalFilename}" class="obsolete-link">view obsolete version</a></span>`;
                    } else {
                        labelHtml = `<span class="badge-update">${item.label}</span>`;
                    }
                }

                // Card with whole-area PDF link (overlay), but weather/update links on top
                cardsHtml += `
                <div class="archive-item">
                    <a href="${item.file}" class="pdf-full-link" aria-label="Download PDF"></a>
                    <h2>${d}</h2>
                    ${hasWeather ? `<div class="link-container"><a href="../../weather/${d}.html" class="weather-link">Mountain Weather</a></div>` : ''}
                    <div class="link-container">${labelHtml}</div>
                </div>`;
            });

            const customHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.label} - ${getMonthName(month)}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../../../styles.css">
    <style>
        .archive-list { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); 
            gap: 1.5rem; 
            margin: 0; 
            padding: 0; 
        }
        .archive-item { 
            position: relative;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #ffffff;
            padding: 1.5rem;
            text-align: center;
            color: #1e293b;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .archive-item:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: #3b82f6;
        }
        .pdf-full-link {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 1;
        }
        .archive-item h2 { 
            margin: 0; 
            font-size: 1rem; 
            font-weight: 600; 
            /* Text should be visible but clicks pass through to overlay or are covered */
            pointer-events: none; 
        }
        /* Links that must separate from the main card link */
        .link-container {
            position: relative;
            z-index: 2;
        }
        
        .badge-update { 
            display: inline-block; 
            font-size: 0.7rem; 
            background: #fef3c7; 
            color: #92400e; 
            padding: 0.2rem 0.5rem; 
            border-radius: 4px; 
            margin-top: 0.5rem;
            font-weight: 500;
        }
        /* Ensure links inside badge are clickable */
        .badge-update a {
            position: relative;
            z-index: 2;
        }

        .obsolete-link {
            color: #92400e;
            text-decoration: underline;
            margin-left: 0.25rem;
        }
        .obsolete-link:hover { color: #78350f; }
        .weather-link { 
            font-size: 0.85rem;
            color: #3b82f6;
            text-decoration: none;
            margin-top: 0.5rem;
            display: inline-block;
        }
        .weather-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="header-content">
                <a href="../../../index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>${config.label}</span></div>
            </div>
        </header>

        <h1>${config.label} - ${getMonthName(month)}</h1>

        <div class="archive-list">
            ${cardsHtml}
        </div>

        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                <a href="../index.html">&larr; Back to ${config.label}</a>
            </p>
        </footer>
    </div>
</body>
</html>`;

            daysHtml = customHtml;

            // Copy PDFs
            sortedDates.forEach(d => {
                const item = datesData[d];
                const src = path.join(PATHS.pdfs, config.slug, item.file);
                const dest = path.join(monthDir, item.file);
                fs.copyFileSync(src, dest);
            });

            fs.writeFileSync(path.join(monthDir, 'index.html'), daysHtml);
        }
    }

    // 3. Generate Forecast Archive Navigation Hub
    const forecastArchiveDir = path.join(PATHS.root, 'forecast-archive');
    if (!fs.existsSync(forecastArchiveDir)) fs.mkdirSync(forecastArchiveDir, { recursive: true });

    const regionLinks = Object.values(REGION_CONFIG)
        .map(region => `
            <a href="../archive/${region.slug}/index.html" class="archive-item"
                style="display:flex; flex-direction:column; align-items:flex-start;">
                <span>${region.label}</span>
            </a>`)
        .join('\n');

    const forecastArchiveHtml = `<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Avalanche Forecast - Avalanche Archive</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
</head>

<body>
    <div class="container">
        <header>
            <div class="header-content">
                <a href="../index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>Avalanche Forecasts</span></div>
            </div>
        </header>

        <h1>Avalanche Forecast</h1>

        <div class="archive-list">
            ${regionLinks}
        </div>

        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                <a href="../index.html">&larr; Back to Home</a>
            </p>
        </footer>
    </div>
</body>

</html>`;

    fs.writeFileSync(path.join(forecastArchiveDir, 'index.html'), forecastArchiveHtml);
    log.info('Generated forecast-archive navigation page.');

    log.info(`Generated PDF archive pages for ${Object.keys(allData).length} regions.`);
}

module.exports = { buildPdfArchive };
