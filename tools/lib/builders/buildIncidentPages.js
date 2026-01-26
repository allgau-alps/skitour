const fs = require('fs');
const path = require('path');
const { generateIncidentPage, generateIncidentWeatherPage, generateIndexPage } = require('../templates');
const { getDistance, deg2rad, formatDate, log } = require('../utils');
const { PATHS, WEATHER_STATIONS } = require('../config');

// Helper to compute correct bulletin path based on incident region
function computeBulletinPath(inc) {
    // Determine correct bulletin region based on incident's region/subregion
    let slug = 'allgau-alps-central'; // default

    // regionId 2 = Vorarlberg = allgau-alps-west
    // regionId 1 = Tirol = usually allgau-alps-east, but subregionId 158 (Allgäuer Alpen) can be west
    if (inc.regionId === 2) slug = 'allgau-alps-west';
    else if (inc.regionId === 1) {
        if (inc.subregionId === 158) slug = 'allgau-alps-west';
        else slug = 'allgau-alps-east';
    }
    // subregionId 82 = Allgäuer Alpen (Vorarlberg) = allgau-alps-west
    if (inc.subregionId === 82) slug = 'allgau-alps-west';

    // Parse date to get year-month folder
    const dateStr = inc.date ? inc.date.split(' ')[0] : '';
    if (!dateStr) return null;

    const dateParts = dateStr.split('-');
    if (dateParts.length < 3) return null;
    const ym = `${dateParts[0]}-${dateParts[1]}`;

    // Check if bulletin exists in main archive
    const bulletinPath = path.join(PATHS.archive, slug, ym, `${dateStr}.pdf`);
    if (fs.existsSync(bulletinPath)) {
        // Return path relative to incidents folder (../slug/ym/date.pdf)
        return `../archive/${slug}/${ym}/${dateStr}.pdf`;
    }

    // Fallback: Check data/incident_bulletins (Older bulletins)
    // Try primary slug first, then others (legacy data might be misfiled)
    const slugs = [slug, 'allgau-alps-east', 'allgau-alps-west', 'allgau-alps-central', 'allgau-prealps'];
    // Remove duplicates
    const uniqueSlugs = [...new Set(slugs)];

    for (const checkSlug of uniqueSlugs) {
        const fallbackSource = path.join(PATHS.incidentBulletins, checkSlug, ym, `${dateStr}.pdf`);
        if (fs.existsSync(fallbackSource)) {
            // Copy to specific incidents/incident_bulletins folder (using the FOUND slug to match structure)
            // Actually, we should probably keep it consistent or use the found slug for the link
            const targetDir = path.join(PATHS.incidentsDir, 'incident_bulletins', checkSlug, ym);
            if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

            // Only copy if not exists to avoid redundant writes (though overwrite is fine)
            fs.copyFileSync(fallbackSource, path.join(targetDir, `${dateStr}.pdf`));

            return `incident_bulletins/${checkSlug}/${ym}/${dateStr}.pdf`;
        }
    }

    return null;
}

// Helper to load historic weather
function loadHistoricWeather() {
    const map = new Map();
    if (fs.existsSync(PATHS.historicWeather)) {
        const text = fs.readFileSync(PATHS.historicWeather, 'utf8');

        // Split by lines starting with digit + ) e.g. "1) "
        // Use a regex with capturing group to keep the delimiter or just manual parsing
        const entryRegex = /^(\d+\)\s+.*(?:\r?\n(?!\d+\)).*)*)/gm;
        // Actually simpler: split by valid entry headers
        // But headers are like "1) 2026-01-11 ..."
        // Use regex split for cross-platform newline handling
        const lines = text.split(/\r?\n/);
        let currentEntry = null;

        lines.forEach(line => {
            // Permissive match: 1) DateString {Separator} LocationString
            // Captures "2026-01-11" (or with unicode dashes) as group 1
            // Captures "Location..." as group 2
            const headerMatch = line.match(/^\d+\)\s+(\S+)\s+.\s+(.*)$/);
            if (headerMatch) {
                // Save previous if exists
                if (currentEntry) {
                    processEntry(map, currentEntry);
                }
                // Start new
                currentEntry = {
                    dateRaw: headerMatch[1],
                    locationRaw: headerMatch[2],
                    text: []
                };
            } else if (currentEntry) {
                if (line.trim()) {
                    currentEntry.text.push(line.trim());
                }
            }
        });
        // Process last
        if (currentEntry) processEntry(map, currentEntry);
    }
    return map;
}

function processEntry(map, entry) {
    // Normalize date and location (replace weird hyphens)
    const date = entry.dateRaw.replace(/[\u2011\u2013\u2014]/g, '-');
    const location = entry.locationRaw.replace(/[\u2011\u2013\u2014]/g, '-').trim();
    const content = entry.text.join('\n');

    // Key: "YYYY-MM-DD|Location"
    map.set(`${date}|${location}`, content);
    // Also key: "YYYY-MM-DD" (fallback)
    if (!map.has(date)) map.set(date, content);
}

/**
 * Build Incident Pages and Weather Context
 */
function buildIncidentPages() {
    const rawDataPath = PATHS.incidents; // Already includes 'incidents.json'
    if (!fs.existsSync(rawDataPath)) return 0;

    let incidents = JSON.parse(fs.readFileSync(rawDataPath, 'utf8'));
    const historicWeatherMap = loadHistoricWeather();

    // Filter Incidents (Robust Removal: Excluded IDs & Empty Content)
    const excludedIds = ['10872', '10796', '10791', '10354'];
    incidents = incidents.filter(inc => {
        const hasDesc = !!(inc.comments_en || inc.details?.comments_en || inc.comments || inc.details?.comments);
        // Check source images existence
        const sourceImagesDir = path.join(PATHS.incidentImages, String(inc.id));
        const hasImages = fs.existsSync(sourceImagesDir) && fs.readdirSync(sourceImagesDir).length > 0;

        return (hasDesc || hasImages) && !excludedIds.includes(String(inc.id));
    });

    // Ensure output dirs
    const incidentsDir = PATHS.incidentsDir;
    if (fs.existsSync(incidentsDir)) {
        fs.rmSync(incidentsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(incidentsDir, { recursive: true });

    let count = 0;

    // Sort by date desc
    incidents.sort((a, b) => {
        const dateA = new Date(a.date.split('.').reverse().join('-')).getTime();
        const dateB = new Date(b.date.split('.').reverse().join('-')).getTime();
        return dateB - dateA;
    });

    incidents.forEach(inc => {
        // 1. Find Closest Weather Station
        let closestStation = null;
        let minDist = Infinity;

        // Parse incident coords (approximate from map link or specific fields if available)
        const incLat = inc.lat || 47.5;
        const incLon = inc.lon || 11.0;

        // Find closest station
        WEATHER_STATIONS.forEach(st => {
            const d = getDistance(incLat, incLon, st.lat, st.lon);
            if (d < minDist) {
                minDist = d;
                closestStation = { ...st, dist: d.toFixed(1) };
            }
        });

        // 2. Build Weather Context Page
        let weatherLink = '';
        if (closestStation) {
            // Find weather data from weather_stations.json (data is embedded per station)
            // First, load the full weather stations data
            let weatherData = [];
            if (fs.existsSync(PATHS.weatherStations)) {
                const allStations = JSON.parse(fs.readFileSync(PATHS.weatherStations, 'utf8'));
                const stationEntry = allStations.find(s => s.id === closestStation.id || s.id === String(closestStation.id));

                if (stationEntry && stationEntry.data && stationEntry.data.length > 0) {
                    // Parse incident date - format is "2026-01-11 11:38:00"
                    const incDate = new Date(inc.date.replace(' ', 'T'));
                    const cutoff = new Date(incDate);
                    cutoff.setHours(cutoff.getHours() - 48);
                    const end = new Date(incDate);
                    end.setHours(23, 59, 59);

                    weatherData = stationEntry.data.filter(d => {
                        const ts = new Date(d.TS.replace(' ', 'T'));
                        return ts >= cutoff && ts <= end;
                    });
                }
            }

            // Get historic text
            const dateKey = inc.date ? inc.date.split(' ')[0] : '';
            let historicText = historicWeatherMap.get(`${dateKey}|${inc.location}`);

            if (!historicText) {
                let normLoc = inc.location.split('" - ')[0].replace(/"/g, '').trim();
                normLoc = normLoc.replace(/\u2011/g, '-').replace(/\s*\(.*?\)/g, '').trim();
                historicText = historicWeatherMap.get(`${dateKey}|${normLoc}`);
            }
            if (!historicText) {
                const parts = inc.location.split(' ');
                if (parts.length > 0) {
                    historicText = historicWeatherMap.get(`${dateKey}|${parts[0]}`);
                }
            }
            if (!historicText) {
                historicText = historicWeatherMap.get(dateKey);
            }

            // Check for Daily Weather Report file in MAIN ARCHIVE
            let dailyWeatherLink = null;
            if (dateKey) {
                // Weather archive is also moving to root/weather?
                // Yes, logic: PATHS.weatherDir
                const dailyWeatherFile = path.join(PATHS.weatherDir, `${dateKey}.html`);
                if (fs.existsSync(dailyWeatherFile)) {
                    dailyWeatherLink = `../archive/weather/${dateKey}.html`;
                }
            }

            const weatherHtml = generateIncidentWeatherPage(
                { ...inc, closestStation, weatherData },
                '',
                historicText,
                dailyWeatherLink
            );

            const weatherFileName = `weather_${inc.id}.html`;
            fs.writeFileSync(path.join(incidentsDir, weatherFileName), weatherHtml);
            weatherLink = `<a href="${weatherFileName}" style="color:#0284c7; text-decoration:none;">Weather Context</a>`;
        }

        // Calculate filename early
        const dateStr = inc.date ? inc.date.split(' ')[0] : inc.date;
        const filename = `${dateStr}_${inc.id}.html`;

        // Find closest profile
        if (inc.linked_profiles && inc.linked_profiles.length > 0) {
            const closest = [...inc.linked_profiles].sort((a, b) => parseFloat(a.dist_km) - parseFloat(b.dist_km))[0];
            inc.closestProfile = closest;
        }

        // 3. Profiles Link Logic
        let profilesHtml = '';
        if (inc.linked_profiles && inc.linked_profiles.length > 0) {
            const incLat = inc.lat || inc.details?.location?.latitude;
            const incLon = inc.lon || inc.details?.location?.longitude;

            profilesHtml = inc.linked_profiles.map(p => {
                const profileDate = p.date ? p.date.split(' ')[0] : 'Unknown';
                const profileAspect = p.aspect || '-';
                const locationParam = p.location ? `&location=${encodeURIComponent(p.location)}` : '';
                const mapLink = `../profiles/map.html?lat=${p.latitude}&lon=${p.longitude}&profileId=${p.id}${locationParam}${incLat && incLon ? `&incLat=${incLat}&incLon=${incLon}&incId=${inc.id}&incFilename=${filename}` : ''}`;
                return `
                    <div style="background:#f0f9ff; padding:1rem; border-radius:8px; border:1px solid #bae6fd;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
                            <strong>${profileDate}</strong>
                            <a href="${mapLink}" style="color:#0284c7; text-decoration:none;" title="View on Interactive Map">📍 ${Number(p.dist_km).toFixed(1)} km away</a>
                        </div>
                        <div style="font-size:0.9rem; margin-bottom:0.5rem;">
                            Elev: ${p.elevation}m | Aspect: ${profileAspect}
                        </div>
                        <a href="../profiles/${p.id}.html?back=${encodeURIComponent('../incidents/' + filename)}" style="color:#0284c7; text-decoration:none;">View Profile →</a>
                    </div>`;
            }).join('');
        }

        // 4. Generate Main Incident Page
        const sourceImagesDir = path.join(PATHS.incidentImages, String(inc.id));
        const archiveImagesDir = path.join(incidentsDir, 'images', String(inc.id));

        if (fs.existsSync(sourceImagesDir)) {
            if (!fs.existsSync(archiveImagesDir)) fs.mkdirSync(archiveImagesDir, { recursive: true });
            const files = fs.readdirSync(sourceImagesDir);
            files.forEach(f => {
                const srcFile = path.join(sourceImagesDir, f);
                const destFile = path.join(archiveImagesDir, f);
                if (fs.statSync(srcFile).isFile()) {
                    fs.copyFileSync(srcFile, destFile);
                }
            });
        }

        let imagesHtml = '';
        if (fs.existsSync(archiveImagesDir)) {
            const imageFiles = fs.readdirSync(archiveImagesDir)
                .filter(f => /\.(jpg|jpeg|png|gif|webp)$/i.test(f))
                .sort();

            imagesHtml = imageFiles.map(file => `
                    <div class="gallery-item">
                        <a href="images/${inc.id}/${file}" target="_blank">
                            <img src="images/${inc.id}/${file}" alt="Incident Image" loading="lazy">
                        </a>
                    </div>`
            ).join('');
        }

        // 5. Compute correct bulletin path based on region
        const bulletinPath = computeBulletinPath(inc);
        if (bulletinPath) {
            inc.pdf_path = bulletinPath;
        }

        inc.filename = filename;
        inc.hasImages = (imagesHtml.length > 0);
        inc.hasDescription = !!(inc.comments_en || inc.details?.comments_en || inc.comments || inc.details?.comments);
        inc.hasProfiles = (inc.linked_profiles && inc.linked_profiles.length > 0);

        const html = generateIncidentPage(inc, imagesHtml, weatherLink, profilesHtml, '../');

        // Filename already calculated above
        try {
            fs.writeFileSync(path.join(incidentsDir, filename), html);
            count++;
        } catch (err) {
            log.error(`Failed to write incident page for ${inc.id}:`, err);
        }
    });

    // 5. Generate Index
    // Incidents array is ALREADY filtered upstream (excluded IDs & empty content)
    // and objects have metadata attached from the loop above.
    const links = incidents.map(inc => {
        const dateStr = inc.date ? inc.date.split(' ')[0] : inc.date;
        return {
            date: dateStr,
            title: inc.location,
            text: `${dateStr} - ${inc.location}`, // Fallback
            href: `${dateStr}_${inc.id}.html`,
            hasProfiles: inc.hasProfiles,
            hasImages: inc.hasImages
        };
    });

    const indexHtml = generateIndexPage('Avalanche Incidents', '../', links, true, '../index.html');
    fs.writeFileSync(path.join(incidentsDir, 'index.html'), indexHtml);

    log.info(`Generated ${count} incident pages.`);
    return count;
}

module.exports = { buildIncidentPages };
