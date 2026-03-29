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

// POI Search Setup
let pois = []; // Will hold GeoJSON features with tokenized names

// Utility: debounce
function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

// Search handler
async function initPOISearch() {
    const input = document.getElementById('poi-search-input');
    const resultsBox = document.getElementById('poi-search-results');
    if (!input || !resultsBox) return;

    try {
        const response = await fetch('data/pois.json');
        if (response.ok) {
            const geojson = await response.json();
            pois = (geojson.features || []).map(f => {
                const tokens = f.properties.name.toLowerCase().split(/[\s-]+/).filter(Boolean);
                return { ...f, __tokens: tokens };
            });
        } else {
            console.warn('POIS data not available');
            pois = [];
        }
    } catch (e) {
        console.error('Failed to load POI data:', e);
        pois = [];
    }

    if (pois.length === 0) {
        input.placeholder = 'No POI data available';
        input.disabled = true;
        return;
    }

    const query = debounce((q) => {
        if (!q) {
            resultsBox.innerHTML = '';
            resultsBox.style.display = 'none';
            return;
        }
        const lower = q.toLowerCase();
        const matches = pois.filter(p => p.__tokens.some(t => t.startsWith(lower))).slice(0, 10);
        renderResults(matches);
    }, 200);

    input.addEventListener('input', (e) => query(e.target.value));

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !resultsBox.contains(e.target)) {
            resultsBox.style.display = 'none';
        }
    });
}

function renderResults(matches) {
    const resultsBox = document.getElementById('poi-search-results');
    if (matches.length === 0) {
        resultsBox.innerHTML = '<div style="padding:0.5rem;color:#888;">No matches</div>';
    } else {
        resultsBox.innerHTML = matches.map(f => {
            const props = f.properties;
            const name = props.name;
            const type = props.type || '';
            const ele = props.ele ? `, ${props.ele}m` : '';
            return `<div class="poi-result-item" data-lng="${f.geometry.coordinates[0]}" data-lat="${f.geometry.coordinates[1]}" style="padding:0.5rem; cursor:pointer; border-bottom:1px solid #eee;">
                <div style="font-weight:bold;">${name}</div>
                <div style="font-size:0.8rem;color:#666;">${type}${ele}</div>
            </div>`;
        }).join('');
        // Attach click listeners
        resultsBox.querySelectorAll('.poi-result-item').forEach(el => {
            el.addEventListener('click', () => {
                const lng = parseFloat(el.dataset.lng);
                const lat = parseFloat(el.dataset.lat);
                flyToPOI(lat, lng);
                resultsBox.style.display = 'none';
                document.getElementById('poi-search-input').value = '';
            });
        });
    }
    resultsBox.style.display = 'block';
}

function flyToPOI(lat, lng) {
    // Simply fly to the location; no marker
    map.flyTo({
        center: [lng, lat],
        zoom: 13,
        pitch: 0,
        bearing: 0,
        essential: true
    });
}

// Initialize overlay layers when map loads
map.on('load', () => {
    // Initialize POI search
    initPOISearch();

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
let shadeMapToggle;
try {
    shadeMap = new ShadeMap(map);
} catch (e) {
    console.error('Failed to initialize ShadeMap:', e);
}

// UI References
if (document.getElementById('shademap-toggle')) {
    shadeMapToggle = document.getElementById('shademap-toggle');
}

// Initialize Time Display
const now = new Date();
const initialMinutes = now.getHours() * 60 + now.getMinutes();
if (document.getElementById('shademap-time')) {
    document.getElementById('shademap-time').value = initialMinutes;
}
if (document.getElementById('shademap-time-value')) {
    document.getElementById('shademap-time-value').textContent = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
}
if (shadeMap) {
    shadeMap.setMinutes(initialMinutes);
}

function updateShademapLink() {
    const link = document.getElementById('shademap-link');
    if (!link) return;
    const center = map.getCenter();
    const zoom = map.getZoom();
    // ShadeMap format: @lat,lng,zoomz,timestampt
    const date = (shadeMap && shadeMap.currentTime) ? shadeMap.currentTime : new Date();
    const timestamp = date.getTime();

    const url = `https://shademap.app/@${center.lat.toFixed(5)},${center.lng.toFixed(5)},${zoom.toFixed(2)}z,${timestamp}t`;
    link.href = url;
}

function updateSatelliteLink() {
    const link = document.getElementById('satellite-link');
    if (!link) return;
    const center = map.getCenter();
    const zoom = Math.round(map.getZoom());
    link.href = `https://eos.com/landviewer/?lat=${center.lat.toFixed(5)}&lng=${center.lng.toFixed(5)}&z=${zoom}&b=Red,Green,Blue&anti=true&processing=L2A`;
}

if (shadeMapToggle) {
    shadeMapToggle.addEventListener('change', (e) => {
        if (e.target.checked) {
            // Show bottom slider
            if (document.getElementById('bottom-slider-container')) {
                document.getElementById('bottom-slider-container').style.display = 'flex';
            }
            // Show external link
            if (document.getElementById('shademap-link-container')) {
                document.getElementById('shademap-link-container').style.display = 'block';
                updateShademapLink();
                map.on('move', updateShademapLink);
            }

            if (shadeMap) shadeMap.toggle(true);

            // Mobile Workflow: Auto-close Control drawer and Open Time Slider
            if (window.innerWidth <= 768) {
                // Minimize Control Panel
                if (document.getElementById('control-panel')) {
                    document.getElementById('control-panel').classList.add('minimized');
                    document.getElementById('control-panel').style.transform = '';
                }

                // Ensure Time Slider is Open (not minimized)
                if (document.getElementById('bottom-slider-container')) {
                    document.getElementById('bottom-slider-container').classList.remove('minimized');
                }
            }
        } else {
            // Hide bottom slider
            if (document.getElementById('bottom-slider-container')) {
                document.getElementById('bottom-slider-container').style.display = 'none';
            }
            // Hide external link
            if (document.getElementById('shademap-link-container')) {
                document.getElementById('shademap-link-container').style.display = 'none';
                map.off('move', updateShademapLink);
            }

            if (shadeMap) shadeMap.toggle(false);
        }
    });
}

// Debounce slider input
let sliderTimeout;
if (document.getElementById('shademap-time')) {
    document.getElementById('shademap-time').addEventListener('input', (e) => {
        const minutes = parseInt(e.target.value);
        updateTimeDisplay(minutes);

        // Debounce the calculation
        clearTimeout(sliderTimeout);
        sliderTimeout = setTimeout(() => {
            if (shadeMap) shadeMap.setMinutes(minutes);
            updateShademapLink(); // Update link with new time
        }, 100); // 100ms debounce
    });
}

function updateTimeDisplay(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    if (document.getElementById('shademap-time-value')) {
        document.getElementById('shademap-time-value').textContent = timeStr;
    }
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

    if (toggle) {
        toggle.addEventListener('change', (e) => {
            // Special handling for Slope
            if (layer.id === 'slope') {
                if (window.slopeLayerInstance) {
                    window.slopeLayerInstance.visible = e.target.checked;
                    map.triggerRepaint();
                    // Show/Hide Legend
                    if (document.getElementById('slope-legend')) {
                        document.getElementById('slope-legend').style.display = e.target.checked ? 'block' : 'none';
                    }
                }
            } else if (layer.id === 'slope-aspect') {
                if (window.slopeAspectLayerInstance) {
                    window.slopeAspectLayerInstance.visible = e.target.checked;
                    map.triggerRepaint();
                    // Show/Hide Legend
                    if (document.getElementById('slope-aspect-legend')) {
                        document.getElementById('slope-aspect-legend').style.display = e.target.checked ? 'block' : 'none';
                    }
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
            if (opacityContainer) {
                opacityContainer.style.display = e.target.checked ? 'block' : 'none';
            }
        });

        if (opacitySlider) {
            opacitySlider.addEventListener('input', (e) => {
                const opacity = e.target.value / 100;
                if (layer.id === 'slope' && window.slopeLayerInstance) {
                    window.slopeLayerInstance.setOpacity(opacity);
                    if (opacityValue) {
                        opacityValue.textContent = e.target.value;
                    }
                } else if (layer.id === 'slope-aspect' && window.slopeAspectLayerInstance) {
                    window.slopeAspectLayerInstance.setOpacity(opacity);
                    if (opacityValue) {
                        opacityValue.textContent = e.target.value;
                    }
                } else {
                    map.setPaintProperty(`${layer.id}-layer`, 'raster-opacity', opacity);
                    if (opacityValue) {
                        opacityValue.textContent = e.target.value;
                    }
                }
            });
        }
    }
});

// 3D Terrain Controls
const terrainToggle = document.getElementById('terrain-toggle');

if (terrainToggle) {
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
            if (reality{