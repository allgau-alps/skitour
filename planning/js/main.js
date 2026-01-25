// Initialize map centered on Allgäu Alps
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
                attribution: 'Map data: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, SRTM | Map style: © <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
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
    center: [10.2, 47.4], // Allgäu Alps region
    zoom: 10,
    pitch: 0,
    bearing: 0,
    // Mobile Gestures
    dragPan: true,        // One finger to move
    touchZoomRotate: true, // Two fingers to zoom/rotate
    touchPitch: true,      // Two fingers to tilt
    maxPitch: 85           // Allow steeper angles
});

// Add standard scale control
map.addControl(new maplibregl.ScaleControl(), 'bottom-left');



// Initialize overlay layers when map loads
map.on('load', () => {
    // Add Satellite layer (Sentinel-2)
    map.addSource('satellite', {
        type: 'raster',
        tiles: [
            'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        ],
        tileSize: 256,
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
    });

    map.addLayer({
        id: 'satellite-layer',
        type: 'raster',
        source: 'satellite',
        layout: { visibility: 'none' },
        paint: { 'raster-opacity': 1.0 }
    });

    // Add Slope-Aspect Layer instance (added first to render underneath)
    const slopeAspectLayer = new SlopeAspectLayer();
    slopeAspectLayer.onAdd(map);

    window.slopeAspectLayerInstance = slopeAspectLayer; // Global access for controls

    // Add Slope Layer instance
    const slopeLayer = new SlopeLayer();
    slopeLayer.onAdd(map); // Manually trigger add - it manages its own source/layer now

    window.slopeLayerInstance = slopeLayer; // Global access for controls


    // Add terrain source for 3D
    map.addSource('terrarium', {
        type: 'raster-dem',
        tiles: [
            'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'
        ],
        encoding: 'terrarium',
        tileSize: 256,
        attribution: 'Terrain tiles by <a href="https://github.com/tilezen/joerd">Mapzen Joerd</a>'
    });

    // Add source for GPX routes
    map.addSource('gpx-route', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    });

    map.addLayer({
        id: 'gpx-route-layer',
        type: 'line',
        source: 'gpx-route',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#dc2626',
            'line-width': 4,
            'line-opacity': 0.8
        }
    });

    // Initialize File Input listeners
    initGPXUpload();

    // Check for GPX parameter in URL
    checkGPXParameter();
});

// Create ShadeMap instance
let shadeMap;
try {
    shadeMap = new ShadeMap(map);
} catch (e) {
    console.error('Failed to initialize ShadeMap:', e);
}

// UI References
const shademapToggle = document.getElementById('shademap-toggle');
const shademapBottomContainer = document.getElementById('bottom-slider-container');
const shademapTimeSlider = document.getElementById('shademap-time');
const shademapTimeValue = document.getElementById('shademap-time-value');
const shademapLinkContainer = document.getElementById('shademap-link-container');
const shademapLink = document.getElementById('shademap-link');

// Initialize Time Display
const now = new Date();
const initialMinutes = now.getHours() * 60 + now.getMinutes();
shademapTimeSlider.value = initialMinutes;
updateTimeDisplay(initialMinutes);
if (shadeMap) {
    shadeMap.setMinutes(initialMinutes);
}

function updateShademapLink() {
    const center = map.getCenter();
    const zoom = map.getZoom();
    // ShadeMap format: @lat,lng,zoomz,timestampt
    const date = (shadeMap && shadeMap.currentTime) ? shadeMap.currentTime : new Date();
    const timestamp = date.getTime();

    const url = `https://shademap.app/@${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom.toFixed(2)}z,${timestamp}t`;
    shademapLink.href = url;
}

function updateSatelliteLink() {
    const link = document.getElementById('satellite-link');
    if (!link) return;
    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());
    link.href = `https://eos.com/landviewer/?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&z=${zoom}&b=Red,Green,Blue&anti=true&processing=L2A`;
}

shademapToggle.addEventListener('change', (e) => {
    if (e.target.checked) {
        // Show bottom slider
        shademapBottomContainer.style.display = 'flex';
        // Show external link
        shademapLinkContainer.style.display = 'block';
        updateShademapLink();
        map.on('move', updateShademapLink);

        if (shadeMap) shadeMap.toggle(true);

        // Mobile Workflow: Auto-close Control drawer and Open Time Slider
        if (window.innerWidth <= 768) {
            // Minimize Control Panel
            controlPanel.classList.add('minimized');
            controlPanel.style.transform = '';

            // Ensure Time Slider is Open (not minimized)
            shademapBottomContainer.classList.remove('minimized');
        }
    } else {
        // Hide bottom slider
        shademapBottomContainer.style.display = 'none';
        // Hide external link
        shademapLinkContainer.style.display = 'none';
        map.off('move', updateShademapLink);

        if (shadeMap) shadeMap.toggle(false);
    }
});

// Debounce slider input
let sliderTimeout;
shademapTimeSlider.addEventListener('input', (e) => {
    const minutes = parseInt(e.target.value);
    updateTimeDisplay(minutes);

    // Debounce the calculation
    clearTimeout(sliderTimeout);
    sliderTimeout = setTimeout(() => {
        if (shadeMap) shadeMap.setMinutes(minutes);
        updateShademapLink(); // Update link with new time
    }, 100); // 100ms debounce
});

function updateTimeDisplay(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    shademapTimeValue.textContent = timeStr;
}

// Layer Controls
const layers = [
    { id: 'slope', toggle: 'slope-toggle', opacity: 'slope-opacity', opacityValue: 'slope-opacity-value', container: 'slope-opacity-container' },
    { id: 'slope-aspect', toggle: 'slope-aspect-toggle', opacity: 'slope-aspect-opacity', opacityValue: 'slope-aspect-opacity-value', container: 'slope-aspect-opacity-container' },
    { id: 'satellite', toggle: 'satellite-toggle', opacity: 'satellite-opacity', opacityValue: 'satellite-opacity-value', container: 'satellite-opacity-container' }
];

layers.forEach(layer => {
    const toggle = document.getElementById(layer.toggle);
    const opacitySlider = document.getElementById(layer.opacity);
    const opacityValue = document.getElementById(layer.opacityValue);
    const opacityContainer = document.getElementById(layer.container);

    toggle.addEventListener('change', (e) => {
        // Special handling for Slope
        if (layer.id === 'slope') {
            if (window.slopeLayerInstance) {
                window.slopeLayerInstance.visible = e.target.checked;
                map.triggerRepaint();
                // Show/Hide Legend
                document.getElementById('slope-legend').style.display = e.target.checked ? 'block' : 'none';
            }
        } else if (layer.id === 'slope-aspect') {
            if (window.slopeAspectLayerInstance) {
                window.slopeAspectLayerInstance.visible = e.target.checked;
                map.triggerRepaint();
                // Show/Hide Legend
                document.getElementById('slope-aspect-legend').style.display = e.target.checked ? 'block' : 'none';
            }
        } else if (layer.id === 'satellite') {
            const visibility = e.target.checked ? 'visible' : 'none';
            map.setLayoutProperty(`${layer.id}-layer`, 'visibility', visibility);

            // Handle EOS Link
            const linkContainer = document.getElementById('satellite-link-container');

            if (e.target.checked) {
                linkContainer.style.display = 'block';
                updateSatelliteLink();
                map.on('move', updateSatelliteLink);
            } else {
                linkContainer.style.display = 'none';
                map.off('move', updateSatelliteLink);
            }
        } else {
            const visibility = e.target.checked ? 'visible' : 'none';
            map.setLayoutProperty(`${layer.id}-layer`, 'visibility', visibility);
        }
        opacityContainer.style.display = e.target.checked ? 'block' : 'none';
    });

    opacitySlider.addEventListener('input', (e) => {
        const opacity = e.target.value / 100;
        if (layer.id === 'slope' && window.slopeLayerInstance) {
            window.slopeLayerInstance.setOpacity(opacity);
            opacityValue.textContent = e.target.value;
        } else if (layer.id === 'slope-aspect' && window.slopeAspectLayerInstance) {
            window.slopeAspectLayerInstance.setOpacity(opacity);
            opacityValue.textContent = e.target.value;
        } else {
            map.setPaintProperty(`${layer.id}-layer`, 'raster-opacity', opacity);
            opacityValue.textContent = e.target.value;
        }
    });
});

// 3D Terrain Controls
const terrainToggle = document.getElementById('terrain-toggle');

terrainToggle.addEventListener('change', (e) => {
    const realityLink = document.getElementById('realitymaps-link-container');
    if (e.target.checked) {
        map.setTerrain({ source: 'terrarium', exaggeration: 1.5 });
        if (realityLink) realityLink.style.display = 'block';

        // Prevent being buried in terrain: Zoom out if too close (Zoom > 12.5)
        const currentZoom = map.getZoom();
        const targetZoom = currentZoom > 12.5 ? 12.5 : currentZoom;

        map.easeTo({
            pitch: 60,
            zoom: targetZoom,
            duration: 1000
        });
    } else {
        map.setTerrain(null);
        if (realityLink) realityLink.style.display = 'none';
        map.easeTo({ pitch: 0, bearing: 0, duration: 1000 });
    }
});

// Custom Controls Logic
const controls3dGroup = document.getElementById('controls-3d-group');
const compassIcon = document.getElementById('compass-icon');

// Buttons
const btnZoomIn = document.getElementById('btn-zoom-in');
const btnZoomOut = document.getElementById('btn-zoom-out');
const btnResetNorth = document.getElementById('btn-reset-north');
const ctrlTiltUp = document.getElementById('ctrl-tilt-up');
const ctrlTiltDown = document.getElementById('ctrl-tilt-down');
const ctrlRotateLeft = document.getElementById('ctrl-rotate-left');
const ctrlRotateRight = document.getElementById('ctrl-rotate-right');

function update3DControlsVisibility() {
    if (terrainToggle.checked) {
        controls3dGroup.classList.add('visible');
    } else {
        controls3dGroup.classList.remove('visible');
    }
}

// Keep Compass pointer updated
map.on('rotate', () => {
    const bearing = map.getBearing();
    compassIcon.style.transform = `rotate(${-bearing}deg)`;
});

// Link visibility to terrain toggle
terrainToggle.addEventListener('change', update3DControlsVisibility);

// Control Actions
btnZoomIn.addEventListener('click', () => map.zoomIn());
btnZoomOut.addEventListener('click', () => map.zoomOut());

btnResetNorth.addEventListener('click', () => {
    map.easeTo({ bearing: 0, pitch: 0, duration: 1000 });
    // Also reset 3D active state visuals if needed, though we keep 3D terrain on
});

ctrlTiltUp.addEventListener('click', () => {
    map.easeTo({ pitch: Math.max(map.getPitch() - 5, 0), duration: 200 }); // Smaller step, faster duration
});
ctrlTiltDown.addEventListener('click', () => {
    map.easeTo({ pitch: Math.min(map.getPitch() + 5, 82), duration: 200 }); // Max 82 degrees
});
ctrlRotateLeft.addEventListener('click', () => {
    map.easeTo({ bearing: map.getBearing() - 22.5, duration: 300 });
});
ctrlRotateRight.addEventListener('click', () => {
    map.easeTo({ bearing: map.getBearing() + 22.5, duration: 300 });
});

// GPX Upload Logic
// Modal State
let pendingGPXFile = null;

function initGPXUpload() {
    const fileInput = document.getElementById('gpx-file-input');
    const clearBtn = document.getElementById('btn-clear-gpx');
    const statusDiv = document.getElementById('gpx-status');
    const uploadLabel = document.querySelector('.upload-btn');

    // Choice Modal
    const choiceModal = document.getElementById('uploadChoiceModal');
    const btnChoiceView = document.getElementById('btn-choice-view');
    const btnChoiceSave = document.getElementById('btn-choice-save');

    // Save Modal
    const saveModal = document.getElementById('saveRouteModal');
    const nameInput = document.getElementById('save-route-name');
    const btnConfirmSave = document.getElementById('btn-confirm-save');

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        pendingGPXFile = file;
        choiceModal.style.display = 'flex';
        fileInput.value = ''; // Reset
    });

    // View Only
    btnChoiceView.onclick = () => {
        if (pendingGPXFile) loadLocalGPX(pendingGPXFile);
        closeUploadModal();
    };

    // Save
    btnChoiceSave.onclick = () => {
        choiceModal.style.display = 'none';
        saveModal.style.display = 'flex';
        if (pendingGPXFile) {
            // Pre-analyze to get name or just use filename
            nameInput.value = pendingGPXFile.name.replace(/\.gpx$/i, '');
        }
    };

    // Confirm Save
    btnConfirmSave.onclick = async () => {
        if (!pendingGPXFile) return;
        const name = nameInput.value.trim() || pendingGPXFile.name;

        btnConfirmSave.disabled = true;
        btnConfirmSave.textContent = 'Saving...';

        try {
            await uploadAndLoadGPX(pendingGPXFile, name);
            closeSaveModal();
        } catch (err) {
            alert('Save failed: ' + err.message);
        } finally {
            btnConfirmSave.disabled = false;
            btnConfirmSave.textContent = 'Save & View';
        }
    };

    clearBtn.addEventListener('click', () => {
        map.getSource('gpx-route').setData({ type: 'FeatureCollection', features: [] });
        statusDiv.style.display = 'none';
        uploadLabel.style.display = 'flex';
    });
}

function closeUploadModal() {
    document.getElementById('uploadChoiceModal').style.display = 'none';
    pendingGPXFile = null;
}

function closeSaveModal() {
    document.getElementById('saveRouteModal').style.display = 'none';
    pendingGPXFile = null;
}

function loadLocalGPX(file) {
    const statusDiv = document.getElementById('gpx-status');
    const filenameSpan = document.getElementById('gpx-filename');
    const uploadLabel = document.querySelector('.upload-btn');

    filenameSpan.textContent = file.name;
    uploadLabel.style.display = 'none';
    statusDiv.style.display = 'flex';

    const reader = new FileReader();
    reader.onload = (event) => {
        processGPXTextToMap(event.target.result);
    };
    reader.readAsText(file);
}

async function uploadAndLoadGPX(file, name) {
    const text = await file.text();
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(text, 'text/xml');

    // Analyze using the helper we added
    const metadata = analyzeGPXContent(gpxDoc, file.name);

    if (!metadata) throw new Error('Invalid GPX content');

    metadata.name = name;
    // Enforce filename convention
    const safeId = metadata.id;
    metadata.filename = `${safeId}.gpx`;

    const response = await fetch(`${WORKER_URL}/gpx/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            gpxContent: text,
            metadata: metadata
        })
    });

    if (!response.ok) throw new Error('Upload failed');

    // Load into map
    loadLocalGPX(file);
    alert('Route saved to Library!');
}

function processGPXTextToMap(gpxText) {
    try {
        const parser = new DOMParser();
        const gpxDoc = parser.parseFromString(gpxText, 'text/xml');
        const geojson = toGeoJSON.gpx(gpxDoc);
        map.getSource('gpx-route').setData(geojson);
        fitMapToGeoJSON(geojson);
    } catch (err) {
        console.error('Error parsing GPX:', err);
        alert('Invalid GPX file.');
    }
}

function fitMapToGeoJSON(geojson) {
    const bounds = new maplibregl.LngLatBounds();
    let hasFeatures = false;

    geojson.features.forEach(feature => {
        if (feature.geometry && feature.geometry.coordinates) {
            if (feature.geometry.type === 'LineString') {
                hasFeatures = true;
                feature.geometry.coordinates.forEach(coord => bounds.extend(coord));
            } else if (feature.geometry.type === 'MultiLineString') {
                hasFeatures = true;
                feature.geometry.coordinates.forEach(line => {
                    line.forEach(coord => bounds.extend(coord));
                });
            }
        }
    });

    if (hasFeatures) {
        const is3D = document.getElementById('terrain-toggle').checked;
        const isMobile = window.innerWidth <= 768;
        let padding = 50;
        if (is3D) {
            const h = map.getCanvas().height;
            padding = {
                top: h * 0.65,
                bottom: 20,
                left: 50,
                right: isMobile ? 20 : 350
            };
        } else {
            padding = isMobile ? 20 : 50;
        }
        map.fitBounds(bounds, { padding: padding, maxZoom: 12.5 });
    }
}

// Check for GPX parameter in URL and load from library
function checkGPXParameter() {
    const urlParams = new URLSearchParams(window.location.search);
    const filename = urlParams.get('filename');
    const name = urlParams.get('name');
    const gpxId = urlParams.get('gpx');

    if (filename) {
        loadGPXFromFilename(filename, name);
    } else if (gpxId) {
        loadGPXFromLibrary(gpxId);
    }
}

const WORKER_URL = 'https://avalanche-archiver-uploads.bigdoggybollock.workers.dev';

async function loadGPXFromFilename(filename, name) {
    try {
        updateGPXUI(name || filename, true); // Show loading state?
        // Strategy 1: Cloud via /gpx/get?id=...
        const id = filename.replace(/\.gpx$/i, '');
        let gpxResponse = await fetch(`${WORKER_URL}/gpx/get?id=${encodeURIComponent(id)}`);

        // Strategy 4: Local Fallback (if user has files)
        if (!gpxResponse.ok) {
            console.warn('Cloud fetch failed, trying local fallback...');
            gpxResponse = await fetch(`../gpx/${filename}`);
        }

        if (!gpxResponse.ok) {
            throw new Error(`Failed to fetch GPX file: ${gpxResponse.status}`);
        }

        const gpxText = await gpxResponse.text();
        processGPXTextToMap(gpxText);
        updateGPXUI(name || filename);

    } catch (err) {
        console.error(err);
        alert('Failed to load GPX: ' + err.message);
    }
}

// Load GPX file from library (Legacy ID lookup)
async function loadGPXFromLibrary(routeId) {
    try {
        console.log('Loading GPX from library:', routeId);

        // Fetch metadata to get filename
        const metadataResponse = await fetch(`${WORKER_URL}/gpx/list`);
        if (!metadataResponse.ok) throw new Error('Failed to fetch route list');

        const metadata = await metadataResponse.json();
        const route = (metadata.routes || []).find(r => r.id === routeId);

        if (!route) {
            console.error(`Route ${routeId} not found in library`);
            alert('Route not found in Cloud Library.');
            return;
        }

        // Fetch the GPX file using the correct API
        let gpxResponse = await fetch(`${WORKER_URL}/gpx/get?id=${encodeURIComponent(routeId)}`);

        if (!gpxResponse.ok) {
            throw new Error(`Failed to fetch GPX file: ${gpxResponse.status} ${gpxResponse.statusText}`);
        }

        const gpxText = await gpxResponse.text();
        processGPXTextToMap(gpxText);
        updateGPXUI(route.name);

    } catch (error) {
        console.error('Failed to load GPX from library:', error);
        alert('Failed to load route from library.');
    }
}

function updateGPXUI(name, loading = false) {
    const filenameSpan = document.getElementById('gpx-filename');
    const statusDiv = document.getElementById('gpx-status');
    const uploadLabel = document.querySelector('.upload-btn');

    filenameSpan.textContent = loading ? 'Loading...' : name;
    uploadLabel.style.display = 'none';
    statusDiv.style.display = 'flex';
}

// Drawer Controls logic
const controlPanel = document.getElementById('control-panel');
const sidebarHandle = document.getElementById('sidebar-handle');
const bottomDrawerContainer = document.getElementById('bottom-slider-container');
const bottomDrawerToggle = document.getElementById('bottom-drawer-toggle');

// Helper to get current translateY
function getTranslateY(element) {
    const style = window.getComputedStyle(element);
    const matrix = new WebKitCSSMatrix(style.transform);
    return matrix.m42;
}

// Mobile Drawer Drag Logic
let startY = 0;
let startTransformY = 0;
let isDragging = false;
let hasMoved = false; // Track if a move occurred to distinguish drag from tap

// Touch Start
sidebarHandle.addEventListener('touchstart', (e) => {
    if (window.innerWidth > 768) return; // Desktop ignore

    isDragging = true;
    hasMoved = false;
    startY = e.touches[0].clientY;
    startTransformY = getTranslateY(controlPanel);

    controlPanel.style.transition = 'none'; // Disable transition for direct tracking
}, { passive: true });

// Touch Move
sidebarHandle.addEventListener('touchmove', (e) => {
    if (!isDragging || window.innerWidth > 768) return;

    const deltaY = e.touches[0].clientY - startY;

    // Ignore micro-movements to allow cleaner taps
    if (Math.abs(deltaY) > 5) hasMoved = true;

    if (!hasMoved) return;

    const newY = startTransformY + deltaY;

    // Limits: 0 (Top/Expanded) to Height (Bottom/Closed)
    const panelHeight = controlPanel.offsetHeight;

    if (newY < 0) {
        controlPanel.style.transform = `translateY(0px)`;
    } else if (newY > panelHeight) {
        controlPanel.style.transform = `translateY(${panelHeight}px)`;
    } else {
        controlPanel.style.transform = `translateY(${newY}px)`;
    }
}, { passive: true });

// Touch End
sidebarHandle.addEventListener('touchend', (e) => {
    if (!isDragging || window.innerWidth > 768) return;
    isDragging = false;

    controlPanel.style.transition = 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)';

    // If it was just a tap (no significant move), let the click handler handle it
    if (!hasMoved) return;

    const finalY = getTranslateY(controlPanel);
    const panelHeight = controlPanel.offsetHeight;
    const windowHeight = window.innerHeight;
    const defaultVisibleHeight = windowHeight * 0.30;
    const defaultY = panelHeight - defaultVisibleHeight;

    // Drag Logic:
    // If dragged DOWN beyond Default -> Snap Closed
    // Otherwise -> Stay put (Free positioning)

    const closeThreshold = defaultY + 50;

    if (finalY > closeThreshold) {
        // Snap Closed
        controlPanel.style.transform = '';
        controlPanel.classList.add('minimized');
    } else if (finalY > defaultY - 20 && finalY < defaultY + 20) {
        // Snap to Default (Magnet)
        controlPanel.style.transform = '';
        controlPanel.classList.remove('minimized');
    } else {
        // Stay Free
        controlPanel.style.transform = `translateY(${finalY}px)`;
        controlPanel.classList.remove('minimized');
    }
});

// Click Toggle (Desktop and Mobile fallback)
sidebarHandle.addEventListener('click', (e) => {
    if (window.innerWidth > 768) {
        controlPanel.classList.toggle('minimized');
    } else {
        // On mobile, check if we engaged in a drag just now
        if (hasMoved) {
            hasMoved = false;
            return; // Do nothing, drag logic already handled position
        }

        // Smart Toggle Logic
        // 1. If Expanded (> Default Height, i.e. Y < DefaultY) -> Snap to Default
        // 2. If at Default -> Snap to Closed
        // 3. If Closed -> Snap to Default

        const panelHeight = controlPanel.offsetHeight;
        const windowHeight = window.innerHeight;
        const defaultVisibleHeight = windowHeight * 0.30; // Matches CSS 30vh
        const defaultY = panelHeight - defaultVisibleHeight; // Y value at Default state

        const currentY = getTranslateY(controlPanel);
        const isClosed = controlPanel.classList.contains('minimized');

        // Threshold tolerance
        const isExpandedHigh = currentY < (defaultY - 50);

        if (isClosed) {
            // Open to Default
            controlPanel.style.transform = '';
            controlPanel.classList.remove('minimized');
        } else if (isExpandedHigh) {
            // Snap back to Default
            controlPanel.style.transform = '';
            controlPanel.classList.remove('minimized');
        } else {
            // We are at Default (or close enough), so Close it
            controlPanel.style.transform = '';
            controlPanel.classList.add('minimized');
        }
    }
});

// Bottom Slider Toggle
// Bottom Slider Toggle
if (bottomDrawerToggle && bottomDrawerContainer) {
    bottomDrawerToggle.addEventListener('click', () => {
        const isMinimizing = !bottomDrawerContainer.classList.contains('minimized');
        bottomDrawerContainer.classList.toggle('minimized');

        // On mobile, if we are opening/closing the bottom drawer, we want the Side Drawer (Control Panel)
        // to "lock" onto it or move out of the way.
        if (window.innerWidth <= 768) {
            // If Bottom Drawer is OPEN (not minimized) -> Close Control Panel (minimized)
            // If Bottom Drawer is CLOSED (minimized) -> Restore Control Panel (Default)
            // However, just adding/removing 'minimized' might put Control Panel BEHIND bottom drawer or overlaps weirdly.
            // The user asked for "closes to lock into... moves with it".

            // Simplest interpretation: 
            // Time Slider OPEN -> Control Panel CLOSED (so handle sits on top)
            // Time Slider CLOSED -> Control Panel DEFAULT

            if (isMinimizing) {
                // Bottom Drawer is CLOSING -> Minimize it
                // Control Panel should probably return to Default
                controlPanel.classList.remove('minimized');
                controlPanel.style.transform = '';
            } else {
                // Bottom Drawer is OPENING
                // Control Panel should Minimize (snap shut)
                controlPanel.classList.add('minimized');
                controlPanel.style.transform = '';
            }
        }
    });
}

// GPX Analysis Helpers
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function calculateSlopeAndAspect(p1, p2, distance) {
    const elevationChange = p2.ele - p1.ele;
    const slopeRad = Math.atan(elevationChange / distance);
    const slopeDeg = slopeRad * 180 / Math.PI;

    const lat1 = p1.lat * Math.PI / 180;
    const lat2 = p2.lat * Math.PI / 180;
    const Δλ = (p2.lon - p1.lon) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(Δλ);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    bearing = (bearing + 360) % 360;

    return { slope: Math.abs(slopeDeg), aspect: bearing };
}

function categorizeAspect(bearing) {
    if (bearing >= 337.5 || bearing < 22.5) return 'N';
    if (bearing >= 22.5 && bearing < 67.5) return 'NE';
    if (bearing >= 67.5 && bearing < 112.5) return 'E';
    if (bearing >= 112.5 && bearing < 157.5) return 'SE';
    if (bearing >= 157.5 && bearing < 202.5) return 'S';
    if (bearing >= 202.5 && bearing < 247.5) return 'SW';
    if (bearing >= 247.5 && bearing < 292.5) return 'W';
    return 'NW';
}

function analyzeGPXContent(gpxDoc, filename) {
    const trkpts = gpxDoc.getElementsByTagName('trkpt');
    const trackPoints = [];
    for (let i = 0; i < trkpts.length; i++) {
        const trkpt = trkpts[i];
        const lat = parseFloat(trkpt.getAttribute('lat'));
        const lon = parseFloat(trkpt.getAttribute('lon'));
        const eleNode = trkpt.getElementsByTagName('ele')[0];
        const ele = eleNode ? parseFloat(eleNode.textContent) : 0;
        trackPoints.push({ lat, lon, ele });
    }
    if (trackPoints.length < 2) return null;

    let totalDistance = 0;
    let totalAscent = 0;
    let totalDescent = 0;
    let elevationMin = Infinity;
    let elevationMax = -Infinity;
    let maxSlope = 0;
    let totalSlopeDistance = 0;
    const aspectDistances = { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 };
    let totalDistanceAboveThreshold = 0;
    const descentAspectDistances = { N: 0, NE: 0, E: 0, SE: 0, S: 0, SW: 0, W: 0, NW: 0 };
    let totalDescentDistanceAboveThreshold = 0;

    for (let i = 0; i < trackPoints.length - 1; i++) {
        const p1 = trackPoints[i];
        const p2 = trackPoints[i + 1];
        const distance = haversineDistance(p1.lat, p1.lon, p2.lat, p2.lon);
        totalDistance += distance;
        const elevChange = p2.ele - p1.ele;
        if (elevChange > 0) totalAscent += elevChange;
        if (elevChange < 0) totalDescent += Math.abs(elevChange);
        elevationMin = Math.min(elevationMin, p1.ele, p2.ele);
        elevationMax = Math.max(elevationMax, p1.ele, p2.ele);
        let { slope, aspect } = calculateSlopeAndAspect(p1, p2, distance);
        if (elevChange > 0) aspect = (aspect + 180) % 360;
        maxSlope = Math.max(maxSlope, slope);
        totalSlopeDistance += slope * distance;

        if (slope >= 15) {
            const aspectCategory = categorizeAspect(aspect);
            aspectDistances[aspectCategory] += distance;
            totalDistanceAboveThreshold += distance;
        }
        if (elevChange < 0 && slope >= 15) {
            const aspectCategory = categorizeAspect(aspect);
            descentAspectDistances[aspectCategory] += distance;
            totalDescentDistanceAboveThreshold += distance;
        }
    }

    const aspectBreakdown = {};
    for (const dir in aspectDistances) {
        aspectBreakdown[dir] = totalDistanceAboveThreshold > 0
            ? parseFloat((aspectDistances[dir] / totalDistanceAboveThreshold * 100).toFixed(1))
            : 0;
    }
    const avgSlope = totalDistance > 0 ? (totalSlopeDistance / totalDistance) : 0;
    let primaryAspect = 'N';
    let maxDescentDistance = 0;
    for (const dir in descentAspectDistances) {
        if (descentAspectDistances[dir] > maxDescentDistance) {
            maxDescentDistance = descentAspectDistances[dir];
            primaryAspect = dir;
        }
    }
    if (maxDescentDistance === 0) {
        let maxAspectDist = 0;
        for (const dir in aspectDistances) {
            if (aspectDistances[dir] > maxAspectDist) {
                maxAspectDist = aspectDistances[dir];
                primaryAspect = dir;
            }
        }
    }

    let displayName = filename.replace(/\.gpx$/i, '');
    let region = 'Allgäu Alps';
    const lowerName = displayName.toLowerCase();
    if (lowerName.includes('kleinwalsertal') || lowerName.includes('fellhorn')) {
        region = 'Allgäu Alps West';
    } else if (lowerName.includes('oberstdorf') || lowerName.includes('nebelhorn')) {
        region = 'Allgäu Alps Central';
    }

    return {
        id: filename.replace('.gpx', '').replace(/\s+/g, '-').toLowerCase() + '-' + Date.now().toString().slice(-4),
        name: displayName,
        filename: filename,
        region,
        distance: parseFloat((totalDistance / 1000).toFixed(2)),
        ascent: Math.round(totalAscent),
        descent: Math.round(totalDescent),
        elevationMin: Math.round(elevationMin),
        elevationMax: Math.round(elevationMax),
        maxSlope: Math.round(maxSlope),
        avgSlope: parseFloat(avgSlope.toFixed(1)),
        primaryAspect,
        aspectBreakdown
    };
}
