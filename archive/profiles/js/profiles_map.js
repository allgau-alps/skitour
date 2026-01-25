document.addEventListener('DOMContentLoaded', () => {

    // 1. Initialize Map
    const map = new maplibregl.Map({
        container: 'map',
        style: {
            version: 8,
            sources: {
                'opentopo': {
                    type: 'raster',
                    tiles: [
                        'https://a.tile.opentopomap.org/{z}/{x}/{y}.png',
                        'https://b.tile.opentopomap.org/{z}/{x}/{y}.png',
                        'https://c.tile.opentopomap.org/{z}/{x}/{y}.png'
                    ],
                    tileSize: 256,
                    attribution: 'Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap (CC-BY-SA)'
                }
            },
            layers: [
                {
                    id: 'opentopo',
                    type: 'raster',
                    source: 'opentopo',
                    minzoom: 0,
                    maxzoom: 22
                }
            ]
        },
        center: [10.2, 47.4], // Default Allgäu Alps
        zoom: 10,
        pitch: 0,
        bearing: 0,
        maxPitch: 85,
        dragRotate: false, // Disable rotation by default for 2D feel
        touchPitch: false // Disable pitch by default
    });

    map.addControl(new maplibregl.ScaleControl(), 'bottom-right');

    const slopeLayerInstance = new SlopeLayer(); // Assumes SlopeLayer.js is loaded

    map.on('load', () => {
        // 2. Add Satellite Source
        map.addSource('satellite', {
            type: 'raster',
            tiles: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
            ],
            tileSize: 256,
            attribution: 'Tiles © Esri'
        });
        map.addLayer({
            id: 'satellite-layer',
            type: 'raster',
            source: 'satellite',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 1.0 }
        });

        // 3. Init Slope Layer
        slopeLayerInstance.onAdd(map);

        // 4. Add Markers
        addProfileMarkers(map);

        // 5. Handle URL Params (Deep Linking)
        handleUrlParams(map);
    });

    // --- Controls ---

    // Toggles
    const satToggle = document.getElementById('satellite-toggle');
    if (satToggle) {
        satToggle.addEventListener('change', (e) => {
            map.setLayoutProperty('satellite-layer', 'visibility', e.target.checked ? 'visible' : 'none');
        });
    }

    const slopeToggle = document.getElementById('slope-toggle');
    if (slopeToggle) {
        slopeToggle.addEventListener('change', (e) => {
            slopeLayerInstance.visible = e.target.checked;
            map.triggerRepaint();
            const legend = document.getElementById('slope-legend');
            if (legend) legend.style.display = e.target.checked ? 'block' : 'none';
        });
    }

    // Nav Buttons
    const btnZoomIn = document.getElementById('btn-zoom-in');
    if (btnZoomIn) btnZoomIn.addEventListener('click', () => map.zoomIn());

    const btnZoomOut = document.getElementById('btn-zoom-out');
    if (btnZoomOut) btnZoomOut.addEventListener('click', () => map.zoomOut());

});

function addProfileMarkers(map) {
    if (typeof RECENT_PROFILES === 'undefined' || !RECENT_PROFILES) {
        console.warn('No RECENT_PROFILES data found.');
        return;
    }

    const bounds = new maplibregl.LngLatBounds();

    RECENT_PROFILES.forEach(p => {
        if (!p.latitude || !p.longitude) return;

        // Color based on recency (Blue < 24h, Grey > 24h)
        let isRecent = false;
        try {
            const date = new Date(p.datum);
            const now = new Date();
            const hours = (now - date) / (1000 * 60 * 60);
            isRecent = hours < 24;
        } catch (e) { }

        const color = isRecent ? '#0284c7' : '#64748b'; // blue-600 vs slate-500

        // Popup Content
        const backParam = window.location.search;
        const html = `
            <div class="popup-title">${p.ort}</div>
            <div class="popup-meta">${p.datum} | ${p.seehoehe ? p.seehoehe + 'm' : ''}</div>
            <a href="${p.profil_id || p.id}.html${backParam}" target="_top" class="popup-link">View Profile &rarr;</a>
        `;

        const el = document.createElement('div');
        el.style.width = '16px';
        el.style.height = '16px';
        el.style.backgroundColor = color;
        el.style.borderRadius = '50%';
        el.style.border = '2px solid white';
        el.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
        el.style.cursor = 'pointer';

        // Store ID on element for finding later
        el.dataset.id = p.profil_id || p.id;

        const marker = new maplibregl.Marker({ element: el })
            .setLngLat([p.longitude, p.latitude])
            .setPopup(new maplibregl.Popup().setHTML(html))
            .addTo(map);

        bounds.extend([p.longitude, p.latitude]);

        // Keep reference to marker
        p._marker = marker;
    });

    // Auto fit ONLY if no specific lat/lon provided in URL
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('lat') && !bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
}

function handleUrlParams(map) {
    const urlParams = new URLSearchParams(window.location.search);
    const lat = parseFloat(urlParams.get('lat'));
    const lon = parseFloat(urlParams.get('lon'));
    const pId = urlParams.get('profileId');
    const incLat = parseFloat(urlParams.get('incLat'));
    const incLon = parseFloat(urlParams.get('incLon'));
    const incFilename = urlParams.get('incFilename');

    const context = urlParams.get('context'); // 'coords' = Incident Focus

    let profileMarker = null;
    let incidentMarker = null;
    let profileNode = null;

    // 1. Identify Profile Marker & Object
    if (pId && typeof RECENT_PROFILES !== 'undefined') {
        profileNode = RECENT_PROFILES.find(p => String(p.profil_id || p.id) === String(pId));
        if (profileNode) {
            profileMarker = profileNode._marker;
        } else if (!isNaN(lat) && !isNaN(lon)) {
            // Fallback temporary marker logic if needed, but usually we just skip
        }
    }

    // 2. Add Incident Marker
    if (!isNaN(incLat) && !isNaN(incLon)) {
        const html = `
            <div class="popup-title" style="color:#ef4444;">Incident Location</div>
            <div class="popup-meta">Associated Incident</div>
            <a href="../incidents/${incFilename || 'index.html'}" target="_top" class="popup-link" style="background:#ef4444;">View Incident &rarr;</a>
        `;

        incidentMarker = new maplibregl.Marker({ color: '#ef4444' }) // Red
            .setLngLat([incLon, incLat])
            .setPopup(new maplibregl.Popup().setHTML(html))
            .addTo(map);
    }

    // 3. Handle View & Popup Logic
    if (context === 'coords') {
        // --- INCIDENT FOCUS ---
        if (incidentMarker) {
            incidentMarker.togglePopup(); // Open Incident Popup
            map.jumpTo({ center: [incLon, incLat], zoom: 15 });
        }

        // Update Profile Marker Popup to be "Associated Profile"
        if (profileMarker && profileNode) {
            const backParam = window.location.search;
            const linkUrl = `${profileNode.profil_id || profileNode.id}.html${backParam}`;

            const specialHtml = `
                <div class="popup-title">Associated Profile</div>
                <div class="popup-meta">${profileNode.datum}</div>
                <a href="${linkUrl}" target="_top" class="popup-link">View Profile &rarr;</a>
            `;
            profileMarker.setPopup(new maplibregl.Popup().setHTML(specialHtml));
        }

        // Fit bounds if both exist to show context
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(incLat) && !isNaN(incLon)) {
            const bounds = new maplibregl.LngLatBounds();
            bounds.extend([lon, lat]);
            bounds.extend([incLon, incLat]);
            map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
        }

    } else {
        // --- STANDARD PROFILE FOCUS ---
        // Prioritize Profile View
        if (!isNaN(lat) && !isNaN(lon)) {
            map.jumpTo({ center: [lon, lat], zoom: 15 });
        }

        if (profileMarker) {
            profileMarker.togglePopup();
        } else if (!isNaN(lat) && !isNaN(lon)) {
            // Fallback Marker
            new maplibregl.Marker({ color: '#ef4444' })
                .setLngLat([lon, lat])
                .setPopup(new maplibregl.Popup().setHTML('<b>Selected Profile</b>'))
                .addTo(map)
                .togglePopup();
        }

        // If incident exists too, fit bounds?
        // Usually if NOT context=coords, we assume the user clicked the map link on the profile card, 
        // which might just want to see the profile. But let's fit bounds if incident info is provided.
        if (!isNaN(lat) && !isNaN(lon) && !isNaN(incLat) && !isNaN(incLon)) {
            const bounds = new maplibregl.LngLatBounds();
            bounds.extend([lon, lat]);
            bounds.extend([incLon, incLat]);
            map.fitBounds(bounds, { padding: 100, maxZoom: 15 });
        }
    }

    // Handle Back Link Logic
    const backLink = document.getElementById('back-link');
    if (backLink) {
        if (incFilename) { // If incident filename is present in URL
            backLink.href = `../incidents/${incFilename}`;
            backLink.innerHTML = '&larr; Back to Incident';
        } else {
            // Default to Profile List
            // "index.html" in "archive/profiles/" is the profile list
            backLink.href = 'index.html';
            backLink.innerHTML = '&larr; Back to List';
        }
    }
}
