const fs = require('fs');
const path = require('path');
const { generateProfileDetailPage } = require('../templates');
const { PATHS } = require('../config');
const { log: logger, translateAspect } = require('../utils');

/**
 * Build Profile Pages
 */
function buildProfilePages() {
    // Determine source file. Use recent_profiles.json if available for "Latest" semantics, 
    // or profiles.json for a full archive. 
    // User context implies "Latest Snow Profiles (Last 48 Hours)".
    // Let's check recentProfiles first.
    const profilesPath = PATHS.recentProfiles || path.join(PATHS.data, 'recent_profiles.json');

    if (!fs.existsSync(profilesPath)) {
        logger.warn(`Profiles data not found at ${profilesPath}, skipping profile build.`);
        return 0;
    };

    // Load recent profiles
    let profiles = [];
    if (fs.existsSync(profilesPath)) {
        profiles = JSON.parse(fs.readFileSync(profilesPath, 'utf8')).map(p => ({
            ...p,
            neigung: p.neigung || p.hangneigung,
            exposition: p.exposition || p.exposition_id
        }));
    }

    // Also load profiles linked in incidents
    const incidentsPath = PATHS.incidents; // Ensure this is defined in config or construct it
    if (fs.existsSync(incidentsPath)) {
        const incidents = JSON.parse(fs.readFileSync(incidentsPath, 'utf8'));
        incidents.forEach(inc => {
            if (inc.linked_profiles) {
                inc.linked_profiles.forEach(lp => {
                    // Check if already in profiles to avoid duplicates
                    // Normalize to string to avoid type mismatch
                    if (!profiles.find(p => String(p.profil_id || p.id) === String(lp.id))) {
                        // console.log(`Adding linked profile: ${lp.id}`);
                        // Adapt linked_profile structure to profile structure if needed
                        // linked_profile has { id, date, elevation, aspect, latitude, longitude, ... }
                        // templates expect { ort, datum, seehoehe, ... }
                        // We map what we have. 
                        profiles.push({
                            profil_id: lp.id,
                            ort: lp.location || `Profile ${lp.id}`, // Incidents might not have location name for profile
                            datum: lp.date,
                            seehoehe: lp.elevation,
                            exposition: lp.aspect,
                            neigung: lp.slope || '?', // Incidents might not have slope
                            region: 'Archived',
                            latitude: lp.latitude,
                            longitude: lp.longitude
                        });
                    }
                });
            }
        });
    }

    // Load User Uploads
    const uploadsPath = path.join(PATHS.data, 'uploads.json');
    if (fs.existsSync(uploadsPath)) {
        try {
            const uploads = JSON.parse(fs.readFileSync(uploadsPath, 'utf8'));
            uploads.filter(u => u.type === 'profile').forEach((u, i) => {
                const id = `user-${new Date(u.date).getTime()}-${i}`;

                // Metadata: Prefer explicit fields, fallback to comment parsing
                let location = u.location && u.location !== 'Unknown' ? u.location : 'User Upload';
                let elevation = u.elevation || '';
                let aspect = u.aspect || '';

                if (u.comment) {
                    // Fallback/Legacy parsing if direct fields are missing
                    if (location === 'User Upload') {
                        const locMatch = u.comment.match(/Location: (.*?)(\n|$)/);
                        if (locMatch) location = locMatch[1].trim();
                    }
                    if (!elevation) {
                        const elevMatch = u.comment.match(/Elevation: (\d+)/);
                        if (elevMatch) elevation = elevMatch[1];
                    }
                    if (!aspect) {
                        const aspMatch = u.comment.match(/Aspect: ([A-Z]+)/);
                        if (aspMatch) aspect = aspMatch[1];
                    }
                }

                // Handle Image (Base64 -> File)
                // Handle Image (Base64 -> File)
                // Worker stores image in 'images' array or 'image', check both
                const base64Img = u.image || (u.images && u.images.length > 0 ? u.images[0] : null);

                if (base64Img && base64Img.startsWith('data:image')) {
                    const base64Data = base64Img.replace(/^data:image\/png;base64,/, "");
                    const imgName = `snowprofile_${id}.png`;

                    // Create source directory if not exists (it acts as a cache/source)
                    if (!fs.existsSync(PATHS.profileImages)) fs.mkdirSync(PATHS.profileImages, { recursive: true });

                    const destImgPath = path.join(PATHS.profileImages, imgName);
                    fs.writeFileSync(destImgPath, base64Data, 'base64');
                }

                profiles.push({
                    profil_id: id,
                    original_id: u.id, // KV Key for API operations
                    ort: `${location} (${u.user})`,
                    datum: u.date,
                    seehoehe: elevation,
                    exposition: aspect,
                    neigung: '?',
                    region: 'User Uploads',
                    latitude: parseFloat(u.lat),
                    longitude: parseFloat(u.lon),
                    comments: u.comment, // Pass full comment for detail page
                    isUserUpload: true
                });
            });
            logger.info(`Integrated ${profiles.filter(p => p.isUserUpload).length} user uploads.`);
        } catch (err) {
            logger.error('Error processing user uploads:', err);
        }
    }
    // --- FILTER: Ephemeral Feed (Last 21 days) ---
    // 21 days = 21 * 24 * 60 * 60 * 1000 = 1,814,400,000 ms
    const cutoffTime = Date.now() - 1814400000;

    // Collect IDs of profiles linked to incidents to PROTECT them from deletion
    const incidentLinkedIds = new Set();
    if (fs.existsSync(PATHS.incidents)) {
        try {
            const incs = JSON.parse(fs.readFileSync(PATHS.incidents, 'utf8'));
            incs.forEach(inc => {
                if (inc.linked_profiles) {
                    inc.linked_profiles.forEach(lp => incidentLinkedIds.add(String(lp.id)));
                }
            });
        } catch (e) { logger.error('Error reading incidents for profile protection:', e); }
    }

    // Filter the MAIN list to what we want to BUILD/KEEP on disk
    // Rule: Keep if Recent (<21 days) OR Incident-Linked
    profiles = profiles.filter(p => {
        const pId = String(p.profil_id || p.id);
        const isRecent = new Date(p.datum).getTime() >= cutoffTime;
        const isLinked = incidentLinkedIds.has(pId);

        return isRecent || isLinked;
    });

    logger.info(`Building ${profiles.length} profiles (Recent < 21d OR Incident-Linked).`);

    // Create the SUBSET for the Index Page (Feed) - STRICTLY RECENT ONLY
    const recentProfiles = profiles.filter(p => new Date(p.datum).getTime() >= cutoffTime);
    logger.info(`Index Feed will show ${recentProfiles.length} recent profiles.`);

    // -------------------------------------------

    const profilesDir = PATHS.profilesDir;
    if (!fs.existsSync(profilesDir)) fs.mkdirSync(profilesDir, { recursive: true });

    // --- CLEANUP: Remove stale profile pages ---
    // Only keep profiles that are in the 'profiles' list (Recent + Linked).
    try {
        const expectedFiles = new Set(profiles.map(p => `${p.profil_id || p.id}.html`));
        expectedFiles.add('index.html');
        expectedFiles.add('map.html');
        // keep images dir

        const existingFiles = fs.readdirSync(profilesDir);
        existingFiles.forEach(file => {
            if (file.endsWith('.html') && !expectedFiles.has(file)) {
                // console.log(`Cleaning up stale/expired profile: ${file}`);
                try {
                    fs.unlinkSync(path.join(profilesDir, file));
                } catch (err) {
                    logger.error(`Failed to delete stale profile ${file}:`, err);
                }
            }
        });
    } catch (e) {
        logger.error('Error during profile cleanup:', e);
    }
    // -------------------------------------------

    // Copy map if exists (legacy)
    const mapSrc = path.join(PATHS.profiles || path.join(PATHS.root, 'tools'), 'map.html');
    if (fs.existsSync(mapSrc)) {
        let mapContent = fs.readFileSync(mapSrc, 'utf8');
        // Update map back link
        mapContent = mapContent.replace('javascript:history.back()', 'index.html');
        fs.writeFileSync(path.join(profilesDir, 'map.html'), mapContent);
    }

    let count = 0;

    // Sort by date descending
    profiles.sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime());

    profiles.forEach((p, index) => {
        try {
            // Image handling - LAWIS uses "snowprofile_{id}.png" naming
            // Incident linked profiles might have local_path
            const pId = p.profil_id || p.id;
            // console.log(`Building page for profile: ${pId}`);
            const imgName = `snowprofile_${pId}.png`;
            const imgPath = path.join(PATHS.profileImages, imgName);

            // Copy image
            const destImgDir = path.join(profilesDir, 'images');
            if (!fs.existsSync(destImgDir)) fs.mkdirSync(destImgDir, { recursive: true });

            if (fs.existsSync(imgPath)) {
                fs.copyFileSync(imgPath, path.join(destImgDir, imgName));
            }

            const html = generateProfileDetailPage(p, `images/${imgName}`, '../', 'index.html');
            try {
                fs.writeFileSync(path.join(profilesDir, `${pId}.html`), html);
            } catch (err) {
                logger.error(`Failed to write profile page for ${pId}:`, err);
            }
        } catch (err) {
            logger.error(`Error generating page for profile ${p.profil_id || p.id}:`, err);
        }
        count++;
    });

    // 5. Inject Dynamic Markers into Map HTML
    // (Profiles array is already filtered to recent, so use it directly)
    if (fs.existsSync(path.join(profilesDir, 'map.html'))) {
        let mapContent = fs.readFileSync(path.join(profilesDir, 'map.html'), 'utf8');

        // Script to clear static markers and add recent ones
        // Script to clear static markers and add recent ones
        const mapScript = `
        <script>
            document.addEventListener("DOMContentLoaded", function() {
                setTimeout(() => {
                    const map = window.map;
                    if (!map) return;
                    
                    // Add Recent Profiles (Strictly Recent Only)
                    const profiles = ${JSON.stringify(recentProfiles)};
                    profiles.forEach(p => {
                        if (p.latitude && p.longitude) {
                            // Differentiate user uploads with Orange (#f97316), matching the UI button
                            const isUser = p.isUserUpload; 
                            const color = isUser ? "#f97316" : "#0284c7";
                            
                            const el = document.createElement('div');
                            el.className = 'marker-pin recent-pin';
                            el.style.backgroundColor = color;
                            if (isUser) {
                                el.style.width = '20px';
                                el.style.height = '20px';
                            }

                            const backParam = window.location.search; // Pass current context if any
                            const popupHTML = \`<b>\${p.ort}</b><br><span style="font-size:0.8rem">\${p.datum}</span><br><a href="\${p.profil_id || p.id}.html\${backParam}" target="_top" style="color:#0284c7; font-weight:bold;">View Profile →</a>\`;

                            new maplibregl.Marker({ element: el })
                                .setLngLat([p.longitude, p.latitude])
                                .setPopup(new maplibregl.Popup({ offset: 10 }).setHTML(popupHTML))
                                .addTo(map);
                        }
                    });
                }, 100); 
            });
        </script>`;

        // Append before body end
        mapContent = mapContent.replace('</body>', mapScript + '</body>');
        fs.writeFileSync(path.join(profilesDir, 'map.html'), mapContent);
    }


    // Custom Index Page Generation (matching User Request)
    const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Latest Snow Profiles</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⛷️</text></svg>">
    <link rel="stylesheet" href="../styles.css">
    <style>
        .profile-list { display: grid; gap: 2rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); margin-top:2rem; }
        .station-card { background: white; padding: 1.5rem; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e5e7eb; }
        .station-header { border-bottom: 2px solid #3b82f6; margin-bottom: 1rem; padding-bottom: 0.5rem; display:flex; justify-content:space-between; align-items:center; }
        .station-name { font-size: 1.1rem; margin:0; color: #1e40af; font-weight:700; }
        .latest-update { font-size: 0.85rem; color: #6b7280; }
        .data-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin-bottom: 1rem; }
        .data-item { display:flex; flex-direction:column; }
        .data-label { font-size: 0.75rem; text-transform:uppercase; color: #6b7280; font-weight:600; }
        .data-value { font-weight: 600; font-size: 0.95rem; }
        .source-link { color: #ef4444; font-weight: bold; text-decoration: none; font-size:0.9rem;}
        .source-link:hover { text-decoration: underline; }
        .map-container { width: 100%; height: 500px; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; }
        .stability-tag { display: inline-block; background: #fee2e2; color: #991b1b; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; margin-right: 4px; margin-bottom: 4px; border:1px solid #fca5a5; }
    </style>
</head>
<body>
    <div class="container">
        <header><div class="header-content"><a href="../index.html" class="logo">Skitour Allgäu</a><div class="date-nav"><span>Snow Profiles</span></div></div></header>
        
        <h1>Latest Snow Profiles (Last 21 Days)</h1>

        <div class="map-container">
             <iframe src="map.html" width="100%" height="100%" style="border:none;"></iframe>
        </div>

        <div class="profile-list">
            ${(() => {
            logger.info('Building profile list HTML...');
            return recentProfiles.map(p => {
                try {
                    const hs = getHS(p.profile);
                    const tests = formatTests(p.stability_tests);
                    const comments = p.comments_en || translateComments(p.comments);

                    return `
            <div class="station-card">
                <div class="station-header">
                    <h2 class="station-name"><a href="${p.profil_id || p.id}.html" style="color:inherit; text-decoration:none;">${p.ort}</a></h2>
                    <span class="latest-update">${p.datum}</span>
                </div>
                <div class="data-grid">
                   <div class="data-item"><span class="data-label">Elev</span><span class="data-value">${p.seehoehe ? p.seehoehe + ' m' : '-'}</span></div>
                   <div class="data-item"><span class="data-label">Aspect</span><span class="data-value">${translateAspect(p.exposition) || '-'}</span></div>
                   <div class="data-item"><span class="data-label">Slope</span><span class="data-value">${p.neigung ? p.neigung + '°' : '-'}</span></div>
                   <div class="data-item"><span class="data-label">HS</span><span class="data-value">${hs ? hs + ' cm' : '-'}</span></div>
                </div>
                ${tests.length > 0 ? `<div style="margin-bottom:0.75rem;">
                    ${tests.map(t => {
                        const style = t.isSafe
                            ? 'background:#dcfce7; color:#166534; border:1px solid #bbf7d0;'
                            : 'background:#fee2e2; color:#991b1b; border:1px solid #fca5a5;';
                        return `<span class="stability-tag" style="${style}">${t.text}</span>`;
                    }).join('')}
                </div>` : ''}
                ${comments ? `<div style="font-size:0.85rem; color:#4b5563; background:#f9fafb; padding:8px; border-radius:6px; margin-bottom:1rem; border:1px solid #f3f4f6;">
                    <strong>Comments:</strong><br>${comments.replace(/\n/g, '<br>')}
                </div>` : ''}
                <a href="${p.profil_id || p.id}.html" class="source-link">View Detail &rarr;</a>
                
                ${p.isUserUpload ? `
                <div style="margin-top:0.5rem; display:flex; gap:0.5rem; border-top:1px solid #f3f4f6; padding-top:0.5rem;">
                    <a href="../profile-creator/index.html?edit=${p.original_id || p.profil_id}" class="action-btn" style="text-decoration:none; color:#0284c7; font-size:0.85rem; font-weight:600;">Edit</a>
                    <button onclick="requestDelete('${p.original_id || p.profil_id}')" class="action-btn" style="background:none; border:none; color:#ef4444; font-size:0.85rem; font-weight:600; cursor:pointer; margin-left:auto;">Remove</button>
                </div>
                ` : ''}

            </div>`;
                } catch (err) {
                    logger.error('Error in profile list map:', err);
                    return '';
                }
            }).join('');
        })()}
            
            <div class="station-card" style="border: 2px dashed #bae6fd; background: #f0f9ff; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center;">
                 <a href="../profile-creator/index.html" class="source-link" style="color:#1e40af; font-size:1.1rem; margin-bottom:1rem;">Upload your own profile &rarr;</a>
                 <div style="height: 1px; width: 100%; background: #e5e7eb; margin-bottom: 1rem;"></div>
                 <p style="color:#666; margin-bottom:1rem;">View full database on Lawis.at</p>
                 <a href="https://lawis.at/profile/" target="_blank" class="source-link" style="font-size:1.1rem;">Go to Lawis &rarr;</a>
            </div>
        </div>

        <footer style="margin-top: 4rem; padding-top: 2rem; border-top: 1px solid var(--border-color);">
            <p style="text-align: center; color: var(--text-secondary); font-size: 0.875rem;">
                <a href="../index.html">&larr; Back to Home</a>
            </p>
        </footer>
    </div>

    <!-- Delete Modal -->
    <div id="deleteModal" class="modal-overlay" style="display: none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); align-items:center; justify-content:center;">
        <div class="modal" style="background:white; padding:2rem; border-radius:12px; max-width:400px; width:90%; text-align:center;">
            <h3 style="margin-top:0; color:#ef4444;">Remove Report?</h3>
            <p>Are you sure you want to remove this report?</p>
            <div style="margin: 1rem 0; text-align:left;">
                <label style="display:flex; align-items:center; gap:0.5rem; cursor:pointer;">
                    <input type="checkbox" id="confirmAuth" onchange="toggleDeleteBtn()">
                    <span style="font-size:0.9rem;">I confirm I am the author of this report or have authority to remove it.</span>
                </label>
            </div>
            <div class="modal-actions" style="display:flex; gap:1rem; justify-content:center; margin-top:1.5rem;">
                <button onclick="closeModal()" style="background:#e5e7eb; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer;">Cancel</button>
                <button id="btnDelete" onclick="confirmDelete()" style="background:#ef4444; color:white; border:none; padding:0.5rem 1rem; border-radius:6px; cursor:pointer; opacity: 0.5; pointer-events: none;">Remove</button>
            </div>
        </div>
    </div>

    <script>
        let deleteId = null;
        
        function requestDelete(id) {
            deleteId = id;
            document.getElementById('deleteModal').style.display = 'flex';
            document.getElementById('confirmAuth').checked = false;
            toggleDeleteBtn();
        }

        function closeModal() {
            document.getElementById('deleteModal').style.display = 'none';
            deleteId = null;
        }

        function toggleDeleteBtn() {
            const btn = document.getElementById('btnDelete');
            if(document.getElementById('confirmAuth').checked) {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            } else {
                btn.style.opacity = '0.5';
                btn.style.pointerEvents = 'none';
            }
        }

        async function confirmDelete() {
            if(!deleteId) return;
            const btn = document.getElementById('btnDelete');
            btn.innerText = 'Deleting...';
            
            try {
                // Determine ID (strip user- prefix if purely a backend ID, but we used full ID in KV)
                // Actually our KV keys are likely just the timestamp or the ID we generated. 
                // Wait, in buildProfilePages.js we force an ID: "user-\${new Date(u.date).getTime()}-\${i}"
                // But the backend ID is "id" field in u.id. THIS IS IMPORTANT.
                // We need to use values.u.id NOT the generated p.profil_id if they differ.
                // In buildProfilePages we set profil_id = "user-..." BUT u has u.id from worker.
                // We need to pass the REAL backend ID to the delete function.
                
                // Let's assume for now we need to fix the ID passing in the loop above first?
                // Actually, let's fix the loop to use p.original_id if available or we might have an issue.
                // See below note.
                
                await fetch('https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/delete', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ id: deleteId })
                });
                
                // Reload to reflect changes (removed locally by rebuild script usually, but for now just reload)
                alert('Item removed. It will disappear from the site on the next build (approx 4 hours) or sooner.');
                closeModal();
                btn.innerText = 'Remove';
            } catch(e) {
                alert('Error deleting: ' + e.message);
                btn.innerText = 'Remove';
            }
        }
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(profilesDir, 'index.html'), indexHtml);
    logger.info(`Generated ${count} profile pages and index.`);
    return count;
}



function getHS(layers) {
    if (!layers || !layers.length) return null;
    let max = 0;
    layers.forEach(l => {
        if (l.height && l.height.max > max) max = l.height.max;
    });
    return max;
}

function formatTests(tests) {
    if (!tests || !tests.length) return [];
    return tests.map(t => {
        const type = t.type ? t.type.text : '?';
        const res = t.result ? t.result.text : '';

        // Safety Detection
        const isSafe = /no\s*break|kein\s*bruch|KB|ECTN|ECTX|no\s*prop/i.test(res);

        // Formatting
        const resCodeMatch = res.match(/\(([^)]+)\)/);
        const code = resCodeMatch ? resCodeMatch[1] : '';

        let label = type;
        if (code) label += code;

        let detail = ` ${t.step}`;
        if (t.height) detail += `@${t.height}cm`;

        // Append text if not clear from code
        if (!code && isSafe) detail += ' (No Break)';

        return { text: label + detail, isSafe };
    });
}

function translateComments(text) {
    if (!text) return '';
    let t = text;
    const map = [
        [/plötzlicher Bruch/gi, 'sudden fracture'],
        [/Teilbruch/gi, 'partial fracture'],
        [/ganzer Block/gi, 'whole block'],
        [/kein Bruch/gi, 'no fracture'],
        [/No break/gi, 'no fracture'], // Normalize
        [/KB/g, 'KB (no fracture)'],
        [/bis/gi, 'to'],
        [/Profil im Bereich der Anrisskante einer mittelgroßen Lawine vom Vortag – ausgelöst durch einzelnen Skifahrer/gi, 'Profile taken in the area of the crown of a medium‑sized avalanche from the previous day – triggered by a single skier']
    ];
    map.forEach(([re, rep]) => t = t.replace(re, rep));
    return t;
}

module.exports = { buildProfilePages };
