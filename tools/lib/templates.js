const { translateAspect } = require('./utils');

// --- HTML TEMPLATES ---

/**
 * Generate Main or Month Index Page
 * @param {string} title - Page title
 * @param {string} relativePath - Path to root (e.g., "../../")
 * @param {Array} links - Array of { text, href }
 * @param {boolean} isIncident - Is this an incident page?
 * @param {string} backLink - Optional back link URL
 * @returns {string} HTML Content
 */
function generateIndexPage(title, relativePath, links, isIncident = false, backLink = '') {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="${relativePath}styles.css">
    <style>
        .archive-list { 
            display: grid; 
            grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); 
            gap: 1.5rem; 
            margin: 0; 
            padding: 0; 
        }
        .archive-item { 
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: #ffffff;
            padding: 1.5rem;
            text-align: center;
            text-decoration: none;
            color: #1e293b;
            border-radius: 12px;
            border: 1px solid #e2e8f0;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
        }
        .archive-item:hover { 
            transform: translateY(-2px); 
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            border-color: #3b82f6;
            color: #3b82f6;
        }
        .archive-item h2 { margin: 0; font-size: 1rem; font-weight: 600; }
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
        .weather-icon { font-size: 1.2rem; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="header-content">
                <a href="${relativePath}index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>${title}</span></div>
            </div>
        </header>

        <h1>${title}</h1>

        <div class="archive-list">
            ${links.length > 0 ? links.map(link => {
        let inner;
        if (link.date && link.title) {
            const profileIcon = link.hasProfiles ? `<span style="background:#0284c7; width:12px; height:12px; border-radius:50%; border:2px solid white; box-shadow:0 1px 2px rgba(0,0,0,0.3); display:inline-block; flex-shrink:0;" title="Has Snow Profile"></span>` : '';
            const imagesIcon = link.hasImages ? `<span style="font-size:1.1rem; flex-shrink:0;" title="Has Images">📷</span>` : '';

            // Only render icon row if needed
            const iconsRow = (profileIcon || imagesIcon) ?
                `<div style="display:flex; align-items:center; justify-content:center; gap:8px; margin-top:2px;">
                    ${profileIcon}
                    ${imagesIcon}
                </div>` : '';

            inner = `<div style="display:flex; flex-direction:column; gap:0.25rem;">
                               <span style="font-size:0.85rem; color:#64748b; font-weight:500;">${link.date}</span>
                               <span style="font-size:1.1rem; color:#1e293b;">${link.title}</span>
                               ${iconsRow}
                             </div>`;
        } else {
            inner = `<h2>${link.text}</h2>`;
        }
        return `<a href="${link.href}" class="archive-item ${isIncident ? 'incident-item' : ''}">${inner}</a>`;
    }).join('') : '<p style="grid-column: 1/-1; text-align:center; color:#64748b; padding:2rem; font-style:italic;">No items found.</p>'}
        </div>

        ${backLink ? `
        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                <a href="${backLink}">&larr; Back</a>
            </p>
        </footer>` : ''}
    </div>
</body>
</html>`;
}

/**
 * Generate Profile Detail Page HTML
 */
function generateProfileDetailPage(p, profileImageBaseName, relativePath, backLink = null) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Profile: ${p.ort}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="${relativePath}styles.css">
    <style>
        .profile-image-container { margin-top: 2rem; text-align: center; }
        .profile-image img { max-width: 100%; height: auto; border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .back-link { margin-bottom: 1rem; display: block; color: var(--primary-blue); text-decoration: none; }
        .back-link:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <header><div class="header-content"><a href="${relativePath}index.html" class="logo">Skitour Allgäu</a><div class="date-nav"><span>Snow Profiles</span></div></div></header>
        
        ${backLink ? `<a href="${backLink}" id="dynamic-back-link" class="back-link">&larr; Back</a>` : ''}

        <h1>Snow Profile: ${p.ort}</h1>
        <div class="profile-image-container">
            <div class="profile-image">
                <a href="${profileImageBaseName}" target="_blank">
                    <img src="${profileImageBaseName}" alt="Snow Profile Image" loading="lazy">
                </a>
            </div>
            <a href="https://lawis.at" target="_blank" class="lawis-link">View on LAWIS.at</a>
        </div>
    </div>
    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const backUrl = urlParams.get('back');
        if (backUrl) {
            const link = document.getElementById('dynamic-back-link');
            if (link) {
                link.href = backUrl;
                if (backUrl.includes('map.html')) {
                    link.innerHTML = '&larr; Back to Map';
                    
                    // Check for incident context in the map URL
                    try {
                        const mapQuery = backUrl.split('?')[1];
                        if (mapQuery) {
                            const mapParams = new URLSearchParams(mapQuery);
                            const incFilename = mapParams.get('incFilename');
                            if (incFilename) {
                                // Create secondary link back to incident
                                const incUrl = '../incidents/' + incFilename;
                                const incLink = document.createElement('a');
                                incLink.href = incUrl;
                                incLink.className = 'back-link';
                                incLink.innerHTML = '&larr; Back to Incident';
                                incLink.style.marginTop = '0'; // Reduce gap slightly if needed, but default margin is fine
                                
                                // Insert after the Map link
                                link.parentNode.insertBefore(incLink, link.nextSibling);
                            }
                        }
                    } catch (e) {
                        console.error('Error parsing back URL params', e);
                    }

                } else if (backUrl.includes('incidents')) {
                    link.innerHTML = '&larr; Back to Incident';
                } else {
                    link.innerHTML = '&larr; Back';
                }
            }
        }
    </script>
</body>
</html>`;
}

/**
 * Generate Weather Report HTML
 */
function generateWeatherPage(w, content) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mountain Weather - ${w.date}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
    <style>
        .weather-content { background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .original-text { margin-top: 2rem; border-top: 1px solid #eee; padding-top: 1rem; color: #555; }
        .original-text summary { cursor: pointer; color: var(--primary-blue); font-weight: 500; }
    </style>
</head>
<body>
    <div class="container">
        <header><div class="header-content"><a href="../index.html" class="logo">Skitour Allgäu</a><div class="date-nav"><span>Mountain Weather</span></div></div></header>
        <div style="margin-bottom:1rem;"><a href="#" onclick="history.back(); return false;">&larr; Back</a></div>
        <h1>Mountain Weather Report</h1>
        <h2 style="color: #666; font-weight: 400;">${w.date} (Issued: ${w.issued})</h2>
        <div class="weather-content">
            ${content}
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate Incident Weather Context Page (Chart + Text)
 */
function generateIncidentWeatherPage(inc, weatherHtml, historicText, dailyWeatherLink) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Context: ${inc.location}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        .chart-container { position: relative; height: 400px; width: 100%; margin-bottom: 2rem; }
        .weather-text { background: #f9f9f9; padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; }
        .meta-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem; }
        .meta-item { background: white; padding: 1rem; border-radius: 4px; border: 1px solid #eee; }
        .meta-label { font-size: 0.85rem; color: #666; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-value { font-size: 1.1rem; font-weight: 600; color: #333; margin-top: 0.25rem; }
    </style>
</head>
<body>
    <div class="container">
        <header><div class="header-content"><a href="../index.html" class="logo">Skitour Allgäu</a><div class="date-nav"><span>Weather Context</span></div></div></header>
        <div style="margin-bottom:1rem;"><a href="index.html">&larr; Back to Incidents</a></div>
        
        <h1>Weather Context</h1>
        <h2 style="color: #666;">${inc.location} - ${inc.date}</h2>

        <div class="weather-text">
            <h3>Weather Report (${inc.date})</h3>
            ${historicText ? `<p style="white-space: pre-line;">${historicText}</p>` : '<p>No text report available for this specific location/date in historic records.</p>'}
            ${dailyWeatherLink ? `<div style="margin-top:1rem; padding-top:1rem; border-top:1px solid #e5e7eb;">
                <a href="${dailyWeatherLink}" style="color:#0284c7; font-weight:bold; text-decoration:none;">&rarr; View Full Mountain Weather Forecast</a>
            </div>` : ''}
        </div>

        <h3>Station Data: ${inc.closestStation.name} (${inc.closestStation.dist}km away)</h3>
        <p style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">Data from previous 48hrs leading up to incident.</p>
        
        <div class="chart-container">
            <canvas id="weatherChart"></canvas>
        </div>

        <script>
            const ctx = document.getElementById('weatherChart').getContext('2d');
            const data = ${JSON.stringify(inc.weatherData)};
            
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(d => new Date(d.TS).toLocaleString('de-DE', { day: '2-digit', hour: '2-digit', minute: '2-digit' })),
                    datasets: [
                        {
                            label: 'Snow Height (cm)',
                            data: data.map(d => d.HS),
                            borderColor: '#3498db',
                            yAxisID: 'y',
                        },
                        {
                            label: 'Air Temp (°C)',
                            data: data.map(d => d.TL),
                            borderColor: '#e74c3c',
                            yAxisID: 'y1',
                        },
                        {
                            label: 'Wind Speed (km/h)',
                            data: data.map(d => d.ff ? d.ff * 3.6 : null), // m/s to km/h
                            borderColor: '#2ecc71',
                            yAxisID: 'y',
                            hidden: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    interaction: { mode: 'index', intersect: false },
                    scales: {
                        y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Snow (cm) / Wind (km/h)' } },
                        y1: { type: 'linear', display: true, position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: 'Temperature (°C)' } }
                    }
                }
            });
        </script>
    </div>
</body>
</html>`;
}

/**
 * Generate Incident Detail Page HTML (matches original format)
 */
function generateIncidentPage(inc, imagesHtml, weatherLink, profilesHtml, relativePath) {
    // Handle missing fields gracefully
    const elevation = inc.elevation || inc.details?.location?.elevation?.value || 'N/A';
    const incline = inc.incline || inc.details?.location?.incline?.value || 'N/A';
    const aspect = inc.aspect || inc.details?.location?.aspect?.text || 'N/A';
    const lat = inc.lat || inc.details?.location?.latitude;
    const lon = inc.lon || inc.details?.location?.longitude;
    const dateTime = inc.datetime || inc.date || '';
    const location = inc.location || inc.details?.location?.text || 'Unknown Location';
    const description_en = inc.comments_en || inc.details?.comments_en || '';
    const description_de = inc.comments || inc.details?.comments || '';

    // Build coordinates link if available (includes incId for map back-link)
    // If we have a closest profile, include it so we show BOTH pins.
    // context=coords parameter tells map to use specific popup text.
    let coordsUrl = `../profiles/map.html?incLat=${lat}&incLon=${lon}&incId=${inc.id}&incFilename=${inc.filename || ''}&context=coords`;

    if (inc.closestProfile) {
        coordsUrl += `&lat=${inc.closestProfile.latitude}&lon=${inc.closestProfile.longitude}&profileId=${inc.closestProfile.id}`;
    }

    const coordsHtml = (lat && lon) ? `
        <div class="meta-item"><strong>Coordinates:</strong> 
            <a href="${coordsUrl}" style="color:#0284c7; text-decoration:none;">
                ${lat}, ${lon}
            </a>
        </div>` : '';

    // Build forecast link if available (path is relative to incidents folder)
    const forecastHtml = inc.pdf_path ? `
        <div class="meta-item"><strong>Forecast:</strong> <a href="${inc.pdf_path}" target="_blank" style="color:#0284c7; text-decoration:none;">Archived Bulletin</a></div>` : '';

    // Build weather link if available
    const weatherHtml = weatherLink ? `
        <div class="meta-item"><strong>Weather:</strong> ${weatherLink}</div>` : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Incident: ${location}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <div class="container">
        <header>
             <div class="header-content">
                <a href="../index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>Avalanche Incidents</span></div>
             </div>
        </header>

        <h1>Incident Report</h1>
        <div style="margin-bottom:1rem;"><a href="index.html">&larr; Back to Incidents</a></div>
        <h2 style="color: #d32f2f;">${location}</h2>
        <h4 style="color: #666;">${dateTime}</h4>

        <div class="incident-detail-container">
            
        <div class="incident-meta-grid">
            <div class="meta-item"><strong>Date:</strong> ${dateTime}</div>
            <div class="meta-item"><strong>Location:</strong> ${location}</div>
            <div class="meta-item"><strong>Elevation:</strong> ${elevation}${elevation !== 'N/A' ? 'm' : ''}</div>
            <div class="meta-item"><strong>Incline:</strong> ${incline}${incline !== 'N/A' ? '°' : ''}</div>
            <div class="meta-item"><strong>Aspect:</strong> ${aspect}</div>
            ${coordsHtml}
            ${forecastHtml}
            ${weatherHtml}
        </div>
    
            ${profilesHtml ? `
        <div class="incident-profiles" style="margin-top:2rem; padding-top:1rem; border-top:1px solid #eee;">
            <h3>Nearby Snow Profiles</h3>
            <p style="color:#666; font-size:0.9rem;">Snow pits within 1km & 48hrs.</p>
            <div style="display:grid; gap:1rem; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-top:1rem;">
                ${profilesHtml}
            </div>
        </div>
` : ''}
            
            ${description_en ? `
            <div class="incident-description">
                <h3>Description</h3>
                <p>${description_en}</p>
                ${description_de ? `
                <details style="margin-top:1rem; color:#666;">
                    <summary style="cursor:pointer; font-size:0.9rem;">Show Original (German)</summary>
                    <p style="margin-top:0.5rem; font-style:italic;">${description_de}</p>
                </details>` : ''}
            </div>
` : ''}

            ${imagesHtml ? `
        <div class="incident-gallery">
            <h3>Images</h3>
            <div class="gallery-grid">
                ${imagesHtml}
            </div>
        </div>
` : ''}
            
            <div class="incident-links" style="text-align:center;">
                <a href="https://lawis.at" target="_blank" class="lawis-link">View on LAWIS.at</a>
            </div>
        </div>


    </div>
</body>
</html>`;
}

/**
 * Generate Ground Conditions Index Page
 */
function generateGroundConditionsPage(data) {
    const { uploads, webcamCount } = data;
    const uploadCards = uploads.map(u => {
        const dateStr = new Date(u.date).toLocaleDateString();
        return `
        <div class="archive-item" style="display:flex; flex-direction:column; justify-content:space-between; text-align:left; align-items:stretch; cursor:default;">
            <a href="uploads/${u.id || new Date(u.date).getTime()}.html" style="text-decoration:none; color:inherit; display:flex; flex-direction:column; gap:0.25rem; flex-grow: 1;">
                 ${u.image ? '<span style="font-size:1.1rem; flex-shrink:0; float:right;" title="Has Image">📷</span>' : ''}
                <span style="font-size:1.1rem; color:#0f172a; font-weight:700;">${u.location || 'Unknown Location'}</span>
                <span style="font-size:0.85rem; color:#64748b; font-style:italic;">Uploaded by ${u.user}</span>
                <span style="font-size:0.85rem; color:#64748b; font-weight:500;">${dateStr}</span>
                <span style="font-size:0.9rem; color:#334155; margin-top:0.5rem; line-height:1.5;">"${u.comment.substring(0, 50)}${u.comment.length > 50 ? '...' : ''}"</span>
            </a>
             <div style="margin-top:1rem; text-align:right; border-top:1px solid #f1f5f9; padding-top:0.5rem; display:flex; justify-content:flex-end; gap:1rem;">
                <a href="upload.html?edit=${u.id}" style="color:#0284c7; font-size:0.8rem; text-decoration:none; font-weight:600;">Edit Report</a>
                <button onclick="openDeleteModal('${u.id}', this)" style="color:#ef4444; background:none; border:none; padding:0; font-size:0.8rem; cursor:pointer; text-decoration:none;">Remove Report</button>
            </div>
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ground Conditions</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <style>
        /* Updated Tagline Style: White background, standard font, no border */
        .tagline-container { text-align: center; margin-bottom: 3rem; padding: 2rem 1rem; background: white; }
        .tagline-main { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 1.75rem; color: #0f172a; margin-bottom: 0.5rem; letter-spacing: -0.02em; }
        .tagline-sub { font-size: 1rem; color: #64748b; font-weight: 400; max-width: 600px; margin: 0 auto; line-height: 1.5; }
        
        .action-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 3rem; }
        .action-card { padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; text-decoration: none; color: inherit; transition: transform 0.2s; border: 2px solid transparent; }
        .action-card:hover { transform: translateY(-4px); border-color: #0284c7; }
        .action-icon { font-size: 3rem; margin-bottom: 1rem; display: block; }
        .action-title { font-size: 1.25rem; font-weight: 700; color: #0f172a; display: block; }
        .map-container { height: 400px; width: 100%; border-radius: 12px; overflow: hidden; margin-bottom: 2rem; border: 1px solid #e2e8f0; }
        
        /* Modal Styles */
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000; }
        .modal { background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
        .modal h3 { margin-top: 0; color: #ef4444; }
        .modal-actions { margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem; }
        .btn-cancel { background: #f1f5f9; color: #64748b; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; }
        .btn-confirm { background: #ef4444; color: white; border: none; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; opacity: 0.5; pointer-events: none; }
        .maplibregl-marker, .maplibregl-marker svg { cursor: pointer !important; }
        
        /* Global Popup Link Styles */
        .maplibregl-popup-content a {
            color: #0284c7 !important;
            text-decoration: none;
            font-weight: bold;
            outline: none;
            border: none;
            box-shadow: none;
        }
        .maplibregl-popup-content a:hover {
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
             <div class="header-content">
                <a href="../index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>Ground Conditions</span></div>
             </div>
        </header>

        <div class="tagline-container">
            <h1>Ground Conditions</h1>
            <h2 class="tagline-main">If you find good snow let your fellow skiers know! ❄️</h2>
            <div class="tagline-sub">...and if it's not good, definitely share it so we can mark and avoid! 🏔️</div>
        </div>

        <div class="action-grid">
            <a href="../webcams/index.html" class="action-card">
                <span class="action-icon">📹</span>
                <span class="action-title">Allgäu Webcams</span>
                <span style="display:block; margin-top:0.5rem; color:#64748b;">${webcamCount} Live Views & Cams</span>
            </a>
            <a href="upload.html" class="action-card" style="background:#fefce8; border-color:#fef08a;">
                <span class="action-icon">⛷️</span>
                <span class="action-title">Skier Upload</span>
                <span style="display:block; margin-top:0.5rem; color:#854d0e;">Submit Report</span>
            </a>
        </div>

        <h2>Report Map</h2>
        <div id="map" class="map-container"></div>

        <h2>Recent Reports</h2>
        ${uploads.length > 0 ? `<div class="archive-list">${uploadCards}</div>` : '<p style="text-align:center; color:#64748b; padding:2rem;">No reports in the last 21 days. Be the first!</p>'}

        <!-- Delete Modal -->
        <div id="deleteModal" class="modal-overlay">
            <div class="modal">
                <h3>Remove Report?</h3>
                <p>Are you sure you want to remove this report?</p>
                <div style="margin: 1rem 0;">
                    <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                        <input type="checkbox" id="confirmAuth">
                        <span style="font-size:0.9rem;">I confirm I am the author of this report or have authority to remove it.</span>
                    </label>
                </div>
                <div class="modal-actions">
                    <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                    <button id="btnDelete" class="btn-confirm" onclick="confirmDelete()">Remove</button>
                </div>
            </div>
        </div>

        <!-- Generic Message Modal -->
        <div id="messageModal" class="modal-overlay">
            <div class="modal">
                <h3 id="msgTitle">Title</h3>
                <p id="msgText">Text</p>
                <div class="modal-actions">
                    <button class="btn-cancel" style="background:var(--primary-blue); color:white;" onclick="closeMessageModal()">OK</button>
                </div>
            </div>
        </div>

        <script>
            const uploads = ${JSON.stringify(uploads)};

            function formatMapDate(isoStr) {
                const date = new Date(isoStr);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                
                const inputDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                const timeStr = hours + ':' + minutes;
                
                if (inputDate.getTime() === today.getTime()) {
                    return 'Today @' + timeStr;
                } else if (inputDate.getTime() === yesterday.getTime()) {
                    return 'Yesterday @' + timeStr;
                } else {
                    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                    return days[date.getDay()] + ' ' + date.getDate() + ' @' + timeStr;
                }
            }

            const map = new maplibregl.Map({
                container: 'map',
                style: {
                    version: 8,
                    sources: {
                        'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors' },
                        'topo': { type: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' }
                    },
                    layers: [
                        { id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
                        { id: 'topo-layer', type: 'raster', source: 'topo', minzoom: 0, maxzoom: 17, layout: { visibility: 'none' } }
                    ]
                },
                center: [10.3, 47.45], // Lon, Lat
                zoom: 9
            });
            map.addControl(new maplibregl.NavigationControl());

            function updateLayers() {
                const zoom = map.getZoom();
                if (zoom < 13) {
                    if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'none');
                    if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'visible');
                } else {
                    if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'none');
                    if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'visible');
                }
            }
            map.on('zoom', updateLayers);

            uploads.forEach(u => {
                if (u.lat && u.lon) {
                    const link = 'uploads/' + (u.id || new Date(u.date).getTime()) + '.html';
                    const popuphtml = \`<b>\${u.user}</b><br>\${formatMapDate(u.date)}<br><a href="\${link}">View Report</a>\`;
                    
                    new maplibregl.Marker()
                        .setLngLat([u.lon, u.lat])
                        .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popuphtml))
                        .addTo(map);
                }
            });

            // DELETE LOGIC
            let deleteTargetId = null;
            let deleteTargetBtn = null;
            const modal = document.getElementById('deleteModal');
            const check = document.getElementById('confirmAuth');
            const btnDelete = document.getElementById('btnDelete');

            function openDeleteModal(id, btnElement) {
                deleteTargetId = id;
                deleteTargetBtn = btnElement;
                modal.style.display = 'flex';
                check.checked = false;
                btnDelete.style.opacity = '0.5';
                btnDelete.style.pointerEvents = 'none';
            }

            function closeModal() {
                modal.style.display = 'none';
                deleteTargetId = null;
            }

            check.addEventListener('change', function() {
                if(this.checked) {
                    btnDelete.style.opacity = '1';
                    btnDelete.style.pointerEvents = 'auto';
                } else {
                    btnDelete.style.opacity = '0.5';
                    btnDelete.style.pointerEvents = 'none';
                }
            });

            // Message Modal Logic
            const msgModal = document.getElementById('messageModal');
            const msgTitle = document.getElementById('msgTitle');
            const msgText = document.getElementById('msgText');

            function showMessage(title, text, isError = false) {
                msgTitle.innerText = title;
                msgTitle.style.color = isError ? '#ef4444' : '#0f172a';
                msgText.innerText = text;
                msgModal.style.display = 'flex';
            }

            function closeMessageModal() {
                msgModal.style.display = 'none';
            }

            async function confirmDelete() {
                if(!deleteTargetId) return;
                
                btnDelete.innerText = 'Removing...';
                try {
                    const WORKER_URL = 'https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/delete';
                    const res = await fetch(WORKER_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: deleteTargetId })
                    });
                    
                    if(res.ok) {
                        closeModal(); // Close delete confirmation first
                        showMessage('Report Removed', 'It will disappear permanently on the next site update. (Updates daily @06:00, 14:00 & 18:00 CET)');
                        // Visually remove
                        const card = deleteTargetBtn.closest('.archive-item');
                        if(card) {
                            card.style.opacity = '0.5';
                            card.style.pointerEvents = 'none';
                            card.innerHTML += '<div style="color:red; font-weight:bold; text-align:center;">REMOVED</div>';
                        }
                    } else {
                        closeModal();
                        showMessage('Error', 'Error removing report.', true);
                    }
                } catch(e) {
                    closeModal();
                    showMessage('Error', 'Error: ' + e.message, true);
                } finally {
                    btnDelete.innerText = 'Remove';
                    // closeModal is handled in if/else blocks to allow smooth transition to message modal
                }
            }
        </script>

        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                <a href="../index.html">&larr; Back to Home</a>
            </p>
        </footer>
    </div>
</body>
</html>`;
}

/**
 * Generate Upload Form Page
 */
function generateUploadPage() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Skier Upload</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
    <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
    <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
    <style> 
        .upload-form { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); border: 1px solid #e2e8f0; }
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; font-weight: 600; margin-bottom: 0.5rem; color: #1e293b; }
        input[type="text"], textarea, select { width: 100%; padding: 0.75rem; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 1rem; }
        input[type="file"] { width: 100%; padding: 0.5rem; border: 1px dashed #cbd5e1; border-radius: 6px; }
        button { background: #0284c7; color: white; padding: 0.75rem 1.5rem; border: none; border-radius: 6px; font-size: 1rem; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
        button:hover { background: #0369a1; }
        .map-picker { height: 300px; width: 100%; border-radius: 6px; border: 1px solid #cbd5e1; margin-top: 0.5rem; position: relative; }
        .status-msg { margin-top: 1rem; padding: 1rem; border-radius: 6px; display: none; }
        .success { background: #dcfce7; color: #166534; }
        .error { background: #fee2e2; color: #991b1b; }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: none; align-items: center; justify-content: center; z-index: 1000; animation: fadeIn 0.3s; }
        .modal { background: white; padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%; box-shadow: 0 10px 25px rgba(0,0,0,0.1); text-align:center; }
        .modal h3 { margin-top: 0; color: #ef4444; }
        .modal-actions { margin-top: 1.5rem; display: flex; justify-content: center; gap: 1rem; }
        .btn-action-primary { background: #0ea5e9; color: white; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; font-weight:600; }
        .btn-action-secondary { background: #e2e8f0; color: #64748b; border: none; padding: 0.8rem 1.5rem; border-radius: 6px; cursor: pointer; }

        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }
        
        .shake { animation: shake 0.4s ease-in-out; }
        .map-error { border: 2px solid #ef4444 !important; box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.2); }

        .native-style-bubble {
            position: absolute;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            padding: 12px 16px;
            border-radius: 4px;
            display: flex;
            align-items: flex-start;
            gap: 10px;
            z-index: 1000;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            max-width: 250px;
        }
        .native-style-bubble.visible { opacity: 1; pointer-events: auto; }
        .native-style-bubble::after {
            content: '';
            position: absolute;
            border-width: 6px;
            border-style: solid;
            border-color: #ffffff transparent transparent transparent;
        }
        .native-style-bubble.top { bottom: 100%; left: 0; margin-bottom: 10px; }
        .native-style-bubble.top::after { top: 100%; left: 20px; }
        
        .native-style-icon {
            background: #f97316;
            color: white;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 3px;
            font-weight: bold;
            font-family: sans-serif;
            font-size: 14px;
            flex-shrink: 0;
            margin-top: 2px;
        }
        .native-style-text {
            color: #1e293b;
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 13px;
            line-height: 1.4;
        }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div class="header-content">
                <a href="../../index.html" class="logo">Skitour Allgäu</a>
                <div class="date-nav"><span>Submit Report</span></div>
            </div>
        </header>
        <div style="margin-bottom:1rem;"><a href="index.html">&larr; Back to Ground Conditions</a></div>

        <div class="upload-form">
            <h1>❄️ Skier Upload</h1>
            <p style="margin-bottom:2rem; color:#64748b;">Share your observations. Photos will be scanned for location data.</p>
            
            <form id="uploadForm">
                <div class="form-group">
                    <label>Location / Route</label>
                    <input type="text" id="location" required placeholder="e.g. Grosser Daumen Descent">
                </div>

                <div class="form-group">
                    <label>Your Name</label>
                    <input type="text" id="name" required placeholder="e.g. Barry Buddon">
                </div>

                <div class="form-group">
                    <label>Date</label>
                    <select id="dateSelect"></select>
                </div>

                <div class="form-group">
                    <label>Photos (Optional)</label>
                    <input type="file" id="photo" accept="image/*" multiple>
                    <div style="font-size:0.85rem; color:#64748b; margin-top:0.25rem;">You can select multiple images.</div>
                    <div id="locationStatus" style="font-size:0.85rem; color:#64748b; margin-top:0.5rem;"></div>
                </div>

                <div class="form-group" style="position:relative;">
                    <label>Location</label>
                    <div style="margin-bottom:0.5rem;">
                        <button type="button" id="useLocationBtn" style="background:#f1f5f9; color:#0f172a; border:1px solid #cbd5e1; width:auto; padding:0.5rem 1rem;">📍 Use Current Location</button>
                    </div>
                    <p style="font-size:0.85rem; color:#64748b; margin:0 0 0.5rem 0;">Tap the map or use the button above to drop a pin. <strong>You can drag the pin to adjust.</strong></p>
                    <div id="pickerMap" class="map-picker"></div>
                    <input type="hidden" id="lat">
                    <input type="hidden" id="lon">

                    <!-- Native Error Bubble -->
                    <div id="locationErrorBubble" class="native-style-bubble top">
                        <div class="native-style-icon">!</div>
                        <div class="native-style-text">
                            <strong>It's not alot of good if we don't know where it is!</strong><br>
                            Please select position on the map.
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Comments</label>
                    <textarea id="comment" rows="4" placeholder="How was the snow? Any hazards?"></textarea>
                </div>

                <button type="submit">Submit Report</button>
                <div id="status" class="status-msg"></div>
            </form>

            <!-- Sassy No-Image Modal -->
            <div id="noImageModal" class="modal-overlay">
                <div class="modal">
                    <h3 style="font-size:1.5rem; margin-bottom:1rem;">No image? Boooooo! 👎</h3>
                    <p style="font-size:1.1rem; color:#334155; margin-bottom:2rem;">Just words is soo boring 🥱</p>
                    <div class="modal-actions">
                        <button class="btn-action-secondary" onclick="confirmSubmitWithoutImage()">I'm Boring (Submit)</button>
                        <button class="btn-action-primary" onclick="closeNoImageModal()">Upload Image</button>
                    </div>
                </div>
            </div>
        </div>

        <!-- EXIF JS for reading geo tags -->
        <script src="https://cdn.jsdelivr.net/npm/exif-js"></script> 
        <script>
            // 0. State
            let editingId = null;
            let existingImages = [];

            // 1. Date Dropdown (Today + 4 days back)
            const dateSelect = document.getElementById('dateSelect');
            const today = new Date();
            for(let i=0; i<5; i++) {
                const d = new Date();
                d.setDate(today.getDate() - i);
                const opt = document.createElement('option');
                opt.value = d.toISOString();
                opt.text = i === 0 ? 'Today' : i === 1 ? 'Yesterday' : d.toLocaleDateString('en-US', { weekday: 'long' });
                dateSelect.add(opt);
            }

            // 2. Map Picker
            const map = new maplibregl.Map({
                container: 'pickerMap',
                style: {
                    version: 8,
                    sources: {
                        'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors' },
                        'topo': { type: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' }
                    },
                    layers: [
                        { id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
                        { id: 'topo-layer', type: 'raster', source: 'topo', minzoom: 0, maxzoom: 17, layout: { visibility: 'none' } }
                    ]
                },
                center: [10.3, 47.45], // Lon, Lat
                zoom: 9
            });
            map.addControl(new maplibregl.NavigationControl());

            function updateLayers() {
                const zoom = map.getZoom();
                if (zoom < 13) {
                    if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'none');
                    if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'visible');
                } else {
                    if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'none');
                    if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'visible');
                }
            }
            map.on('zoom', updateLayers);
            
            let marker;
            function setLocation(lat, lng) {
                if(marker) marker.remove();
                marker = new maplibregl.Marker({ draggable: true })
                    .setLngLat([lng, lat])
                    .addTo(map);
                
                document.getElementById('lat').value = lat;
                document.getElementById('lon').value = lng;
                
                // Clear errors
                clearLocationError();

                marker.on('dragend', function() {
                    const pos = marker.getLngLat();
                    document.getElementById('lat').value = pos.lat;
                    document.getElementById('lon').value = pos.lng;
                    clearLocationError(); 
                });
            }

            map.on('click', function(e) {
                setLocation(e.lngLat.lat, e.lngLat.lng);
            });
            
            document.getElementById('useLocationBtn').addEventListener('click', function() {
                if(navigator.geolocation) {
                     const btn = this;
                     btn.innerText = 'Locating...';
                     navigator.geolocation.getCurrentPosition(pos => {
                         setLocation(pos.coords.latitude, pos.coords.longitude);
                         map.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13 });
                         btn.innerText = '📍 Use Current Location';
                     }, err => {
                         alert('Could not get location. Please check browser permissions.');
                         btn.innerText = '📍 Use Current Location';
                     });
                 } else {
                     alert('Geolocation is not supported by your browser');
                 }
            });

            // Location Error Helpers
            const bubble = document.getElementById('locationErrorBubble');
            const mapContainer = document.getElementById('pickerMap');

            function showLocationError() {
                mapContainer.classList.add('map-error');
                mapContainer.classList.add('shake');
                bubble.classList.add('visible');
                mapContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => {
                    bubble.classList.remove('visible');
                    mapContainer.classList.remove('shake');
                }, 5000);
            }

            function clearLocationError() {
                mapContainer.classList.remove('map-error');
                bubble.classList.remove('visible');
            }

            // 3. EXIF Extraction
            document.getElementById('photo').addEventListener('change', function(e) {
                const file = e.target.files[0];
                if(file) {
                    EXIF.getData(file, function() {
                        const lat = EXIF.getTag(this, "GPSLatitude");
                        const lon = EXIF.getTag(this, "GPSLongitude");
                        
                        // Convert DMS to DD
                        if(lat && lon && lat.length === 3 && lon.length === 3) {
                             const toDecimal = (n) => n[0] + n[1]/60 + n[2]/3600;
                             const latDec = toDecimal(lat);
                             const lonDec = toDecimal(lon);
                             
                             setLocation(latDec, lonDec);
                             map.jumpTo({ center: [lonDec, latDec], zoom: 14 });
                             document.getElementById('locationStatus').innerText = "✅ Location found in photo!";
                        } else {
                            document.getElementById('locationStatus').innerText = "⚠️ No location in photo. Please tap the map.";
                             // Try Geolocation API
                             if(navigator.geolocation) {
                                 navigator.geolocation.getCurrentPosition(pos => {
                                     setLocation(pos.coords.latitude, pos.coords.longitude);
                                      map.jumpTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 12 });
                                 });
                             }
                        }
                    });
                }
            });

            // 4. Submit
            const form = document.getElementById('uploadForm');
            const noImageModal = document.getElementById('noImageModal');
            let bypassImageCheck = false;

            document.getElementById('uploadForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                // 1. Validate Location
                const lat = document.getElementById('lat').value;
                const lon = document.getElementById('lon').value;

                if (!lat || !lon) {
                    showLocationError();
                    return;
                }

                // 2. Validate Image (Sassy Check)
                const fileInput = document.getElementById('photo');
                // Allow bypass if editing and we have existing images
                if (fileInput.files.length === 0 && !bypassImageCheck && existingImages.length === 0) {
                    noImageModal.style.display = 'flex';
                    return;
                }
                
                await performUpload();
            });

            async function performUpload() {
                const btn = form.querySelector('button[type="submit"]');
                btn.disabled = true;
                btn.innerText = editingId ? 'Updating...' : 'Uploading...';
                
                const statusDiv = document.getElementById('status');
                statusDiv.style.display = 'block';
                statusDiv.className = 'status-msg';
                statusDiv.innerText = editingId ? 'Updating Report...' : 'Uploading...';

                try {
                    const data = {
                        id: editingId || undefined,
                        id: editingId || undefined,
                        user: document.getElementById('name').value,
                        location: document.getElementById('location').value,
                        date: dateSelect.value,
                        comment: document.getElementById('comment').value,
                        lat: document.getElementById('lat').value,
                        lon: document.getElementById('lon').value,
                        images: []
                    };

                    // Read Images as Base64
                    const fileInput = document.getElementById('photo');
                    if (fileInput.files.length > 0) {
                         const promises = Array.from(fileInput.files).map(file => {
                             return new Promise((resolve) => {
                                 const reader = new FileReader();
                                 reader.onload = (e) => resolve(e.target.result);
                                 reader.readAsDataURL(file);
                             });
                         });
                         
                         data.images = await Promise.all(promises);
                    } else if (editingId && existingImages.length > 0) {
                        data.images = existingImages;
                    }

                    // Support legacy
                    if(data.images.length > 0) data.image = data.images[0];

                    const WORKER_URL = 'https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/upload';
                    const res = await fetch(WORKER_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    });

                    if(res.ok) {
                        statusDiv.className = 'status-msg success';
                        statusDiv.innerText = editingId ? 'Update Successful! Rebuild needed to see changes.' : 'Report Submitted! Should be displayed on next site update. (Updates daily @06:00, 14:00 & 18:00 CET)';
                        if (!editingId) form.reset();
                        
                        // Clear map if new upload
                        if(!editingId && marker) map.removeLayer(marker);
                        if(!editingId) {
                            document.getElementById('lat').value = '';
                            document.getElementById('lon').value = '';
                        }
                        document.getElementById('locationStatus').innerText = '';
                        bypassImageCheck = false;
                        
                        // If editing, maybe disable form or show back button
                        if(editingId) {
                            btn.innerText = 'Update Report';
                            setTimeout(() => {
                                window.location.href = 'index.html'; // Redirect back to list
                            }, 2000);
                        }
                    } else {
                        const errorText = await res.text();
                        throw new Error('Upload failed (' + res.status + '): ' + errorText);
                    }

                } catch(err) {
                    console.error(err);
                    statusDiv.className = 'status-msg error';
                    statusDiv.innerText = 'Error: ' + err.message;
                } finally {
                    btn.disabled = false;
                    if(!editingId) btn.innerText = 'Submit Report';
                }
            }

            window.closeNoImageModal = function() {
                 noImageModal.style.display = 'none';
                 document.getElementById('photo').click(); 
            };

            window.confirmSubmitWithoutImage = function() {
                bypassImageCheck = true;
                noImageModal.style.display = 'none';
                performUpload(); 
            };
            
            // 5. Init Edit Mode
            (async function checkEditMode() {
                const urlParams = new URLSearchParams(window.location.search);
                const editId = urlParams.get('edit');
                if (editId) {
                    try {
                        const statusDiv = document.getElementById('status');
                        statusDiv.style.display = 'block';
                        statusDiv.innerText = 'Loading report for editing...';
                        
                        const res = await fetch(\`https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/get?id=\${editId}\`);
    if (!res.ok) throw new Error('Report not found');
    const data = await res.json();

    editingId = data.id;
    document.getElementById('name').value = data.user;
    document.getElementById('location').value = data.location || '';
    // Attempt to match date
    // The dropdown generated 5 days. If older, add option?
    const existingOpt = Array.from(dateSelect.options).find(o => o.value.startsWith(data.date.split('T')[0]));
    if (existingOpt) {
        dateSelect.value = existingOpt.value;
    } else {
        // Add custom option
        const opt = document.createElement('option');
        opt.value = data.date;
        opt.text = new Date(data.date).toLocaleDateString();
        opt.selected = true;
        dateSelect.add(opt);
    }

    document.getElementById('comment').value = data.comment;

    if (data.lat && data.lon) {
        setLocation(data.lat, data.lon);
        map.jumpTo({ center: [data.lon, data.lat], zoom: 13 });
    }

    if (data.images && data.images.length > 0) {
        existingImages = data.images;
        document.getElementById('locationStatus').innerHTML = \`✅ <strong>\${existingImages.length} Existing Image(s) Loaded.</strong><br>Upload new ones to replace them.\`;
    } else if (data.image) {
        existingImages = [data.image];
        document.getElementById('locationStatus').innerHTML = \`✅ <strong>1 Existing Image Loaded.</strong><br>Upload new ones to replace it.\`;
    }

    document.querySelector('button[type="submit"]').innerText = 'Update Report';
    document.querySelector('h1').innerText = '✏️ Edit Report';
    statusDiv.style.display = 'none';

} catch (e) {
    console.error(e);
    alert('Error loading edit: ' + e.message);
}
                }
            }) ();
        </script >
    </div >
</body >
</html > `;
}

/**
 * Generate Webcams Page (simplified - no thumbnails)
 */
function generateWebcamPage(webcams) {
    return `<!DOCTYPE html>
    <html lang="en">
        <head>
            <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Allgäu Webcams</title>
                    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
                    <link rel="stylesheet" href="../../styles.css">
                        <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
                        <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
                        <style>
                            .webcam-grid {
                                display: grid;
                            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
                            gap: 0.75rem;
                            margin-top: 1rem; 
        }
                            .webcam-card {
                                display: block;
                            background: white;
                            border-radius: 6px;
                            padding: 0.875rem 1rem;
                            text-decoration: none;
                            color: #1e293b;
                            transition: all 0.2s;
                            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                            border: 1px solid #e2e8f0;
        }
                            .webcam-card:hover {
                                transform: translateY(-1px);
                            box-shadow: 0 2px 8px rgba(2,132,199,0.15);
                            border-color: #0284c7;
                            color: #0284c7;
        }
                            .webcam-title {
                                font - size: 0.95rem;
                            font-weight: 500;
                            margin: 0;
        }

                            /* Custom Marker Styles */
                            .custom-marker {
                                width: 16px;
                            height: 16px;
                            border-radius: 50%;
                            border: 2px solid white;
                            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                            background: #3b82f6; 
                            cursor: pointer !important;
        }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <header>
                                <div class="header-content">
                                    <a href="../../index.html" class="logo">Skitour Allgäu</a>
                                    <div class="date-nav"><span>Webcams</span></div>
                                </div>
                            </header>
                            <div style="margin-bottom:1rem;"><a href="../ground-conditions/index.html">&larr; Back to Ground Conditions</a></div>

                            <h1>Allgäu Webcams</h1>

                            <div id="map" style="height: 400px; width: 100%; border-radius: 12px; margin-bottom: 2rem; border:1px solid #e2e8f0;"></div>

                            ${(() => {
            // Group Definitions
            const groups = {
                'Oberjoch & Tannheimer Tal': [
                    'Bad Hindelang/Oberjoch', 'Zöblen - Obere Halde', 'Neunerköpfle'
                ],
                'Allgäu Prealps': [
                    'Balderschwang Gelbhansekopf', 'Balderschwang', 'Grasgehren - Bolgengrat',
                    'Ofterschwang Bergbahnen', 'Weiherkopf Bolsterlang', 'Hochgrat', 'Grünten'
                ]
            };

            // Helper to find which group a cam belongs to
            const getGroup = (title) => {
                for (const [groupName, titles] of Object.entries(groups)) {
                    if (titles.includes(title)) return groupName;
                }
                return 'Oberstdorf & Kleinwalsertal';
            };

            // Bucketing (Defines Order)
            const buckets = {
                'Oberstdorf & Kleinwalsertal': [],
                'Allgäu Prealps': [],
                'Oberjoch & Tannheimer Tal': []
            };

            webcams.forEach(cam => {
                const group = getGroup(cam.title);
                if (buckets[group]) {
                    buckets[group].push(cam);
                }
            });

            // Render HTML
            return Object.entries(buckets).map(([groupName, cams]) => {
                if (cams.length === 0) return '';

                const gridHtml = cams.map(cam => {
                    return `
                        <a href="${cam.linkUrl}" target="_blank" class="webcam-card">
                            <h3 class="webcam-title">${cam.title}</h3>
                        </a>`;
                }).join('');

                return `
                    <h2 style="margin-top:2.5rem; margin-bottom:1rem; color:#1e293b; border-bottom:1px solid #e2e8f0; padding-bottom:0.5rem;">${groupName}</h2>
                    <div class="webcam-grid">
                        ${gridHtml}
                    </div>
                `;
            }).join('');
        })()}

                            <script>
                                const webcams = ${JSON.stringify(webcams)};
                                const map = new maplibregl.Map({
                                    container: 'map',
                                    style: {
                                        version: 8,
                                        sources: {
                                            'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors' },
                                            'topo': { type: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' }
                                        },
                                        layers: [
                                            { id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
                                            { id: 'topo-layer', type: 'raster', source: 'topo', minzoom: 0, maxzoom: 17, layout: { visibility: 'none' } }
                                        ]
                                    },
                                    center: [10.3, 47.45], // Lon, Lat
                                    zoom: 9
                                });
                                map.addControl(new maplibregl.NavigationControl());

                                function updateLayers() {
                                    const zoom = map.getZoom();
                                    if (zoom < 13) {
                                        if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'none');
                                        if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'visible');
                                    } else {
                                        if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'none');
                                        if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'visible');
                                    }
                                }
                                map.on('zoom', updateLayers);

                                webcams.forEach(cam => {
                                    if(cam.lat && cam.lon) {
                                        const el = document.createElement('div');
                                        el.className = 'custom-marker';

                                        const popupContent = \`
                                        <div style="text-align:center;">
                                            <b>\${cam.title}</b><br>
                                                <a href="\${cam.linkUrl}" target="_blank" style="color:#0284c7; font-weight:600; text-decoration:none; display:block; margin-top:4px;">View Feed &rarr;</a>
                                        </div>
                                        \`;

                                        new maplibregl.Marker({ element: el })
                                            .setLngLat([cam.lon, cam.lat])
                                            .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupContent))
                                            .addTo(map);
                                    }
                                });
                            </script>
                        </div>
                    </body>
                </html>`;
}

/**
 * Generate User Upload Detail Page
 */
function generateUserUploadDetailPage(upload) {
    const imageGallery = (upload.images && upload.images.length > 0)
        ? upload.images.map(img => `<img src="${img}" style="max-width:100%; border-radius:8px; display:block; margin:0 auto 1rem auto;">`).join('')
        : (upload.image ? `<img src="${upload.image}" style="max-width:100%; border-radius:8px; display:block; margin:0 auto;">` : '');

    return `<!DOCTYPE html>
                        <html lang="en">
                            <head>
                                <meta charset="UTF-8">
                                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                        <title>Report by ${upload.user}</title>
                                        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
                                        <link rel="stylesheet" href="../../../styles.css">
                                            <link href="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css" rel="stylesheet">
                                            <script src="https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js"></script>
                                        </head>
                                        <body>
                                            <div class="container">
                                                <header>
                                                    <div class="header-content">
                                                        <a href="../../../index.html" class="logo">Skitour Allgäu</a>
                                                        <div class="date-nav"><span>Report Detail</span></div>
                                                    </div>
                                                </header>
                                                <div style="margin-bottom:1rem;"><a href="../index.html">&larr; Back to Ground Conditions</a></div>

                                                <h1>Skier Report</h1>
                                                <div style="background:white; padding:2rem; border-radius:12px; box-shadow:0 2px 4px rgba(0,0,0,0.1); border:1px solid #e2e8f0;">
                                                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid #eee; padding-bottom:1rem;">
                                                        <div>
                                                            <h2 style="margin:0; color:#0f172a;">${upload.location || 'Report'}</h2>
                                                            <div style="font-size:0.95rem; font-style:italic; color:#475569; margin-top:0.25rem;">Uploaded by ${upload.user}</div>
                                                            <div style="color:#64748b; margin-top:0.25rem;">${new Date(upload.date).toLocaleDateString()} ${new Date(upload.date).toLocaleTimeString()}</div>
                                                        </div>
                                                    </div>

                                                    <div style="margin-bottom:2rem;">
                                                        ${imageGallery}
                                                    </div>

                                                    <p style="font-size:1.1rem; line-height:1.7; color:#334155;">${upload.comment}</p>

                                                    ${(upload.lat && upload.lon) ? `
            <div style="margin-top:2rem;">
                <h3>Location</h3>
                <div id="map" style="height:200px; width:100%; max-width:400px; border-radius:8px; border:1px solid #cbd5e1;"></div>
                <script>
                    const map = new maplibregl.Map({
                        container: 'map',
                        style: {
                            version: 8,
                            sources: {
                                'osm': { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '&copy; OpenStreetMap Contributors' },
                                'topo': { type: 'raster', tiles: ['https://a.tile.opentopomap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)' }
                            },
                            layers: [
                                { id: 'osm-layer', type: 'raster', source: 'osm', minzoom: 0, maxzoom: 19 },
                                { id: 'topo-layer', type: 'raster', source: 'topo', minzoom: 0, maxzoom: 17, layout: { visibility: 'none' } }
                            ]
                        },
                        center: [${upload.lon}, ${upload.lat}],
                        zoom: 13
                    });
                    map.addControl(new maplibregl.NavigationControl());

                    function updateLayers() {
                        const zoom = map.getZoom();
                        if (zoom < 13) {
                            if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'none');
                            if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'visible');
                        } else {
                            if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'none');
                            if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'visible');
                        }
                    }
                    map.on('zoom', updateLayers);

                    new maplibregl.Marker()
                        .setLngLat([${upload.lon}, ${upload.lat}])
                        .addTo(map);
                </script>
            </div>` : ''}
                                                </div>
                                            </div>
                                        </body>
                                    </html>`;
}

module.exports = {
    generateIndexPage,
    generateProfileDetailPage,
    generateWeatherPage,
    generateIncidentWeatherPage,
    generateIncidentPage,
    generateGroundConditionsPage,
    generateUploadPage,
    generateWebcamPage,
    generateUserUploadDetailPage
};
