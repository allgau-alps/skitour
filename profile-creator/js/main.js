
document.addEventListener('DOMContentLoaded', () => {
    const renderer = new ProfileRenderer('profile-canvas');

    // State
    const state = {
        meta: {
            location: '',
            lat: '',
            lon: '',
            date: new Date().toISOString().split('T')[0],
            elevation: '',
            aspect: '',
            observer: '',
            airTemp: ''
        },
        layers: [
            { id: 1, thickness: 20, hardness: 'F', grainForm: '+', temp: -5.0 },
            { id: 2, thickness: 35, hardness: '1F', grainForm: 'o', temp: -3.5 },
            { id: 3, thickness: 40, hardness: 'P', grainForm: '•', temp: -1.5 }
        ],
        tests: []
    };

    // DOM Elements
    const layersList = document.getElementById('layers-list');
    const testsList = document.getElementById('tests-list');
    const addLayerBtn = document.getElementById('add-layer-btn');
    const addLayerBtnBottom = document.getElementById('add-layer-btn-bottom');
    const addTestBtn = document.getElementById('add-test-btn');
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-site-btn');

    // Map Modal Elements
    const mapModal = document.getElementById('map-modal');
    const openMapBtn = document.getElementById('open-map-btn');
    const closeMapBtn = document.getElementById('close-map-btn');
    const confirmLocBtn = document.getElementById('confirm-loc-btn');
    const useLocBtn = document.getElementById('use-loc-btn');

    // Inputs
    const locationInput = document.getElementById('meta-location');
    const latInput = document.getElementById('meta-lat');
    const lonInput = document.getElementById('meta-lon');
    const dateInput = document.getElementById('meta-date');
    const elevInput = document.getElementById('meta-elevation');
    const aspInput = document.getElementById('meta-aspect');
    const observerInput = document.getElementById('meta-observer');
    const airTempInput = document.getElementById('meta-air-temp');

    // Init Inputs
    dateInput.value = state.meta.date;

    // Listeners
    locationInput.addEventListener('input', (e) => { state.meta.location = e.target.value; update(); });
    latInput.addEventListener('input', (e) => { state.meta.lat = e.target.value; update(); });
    lonInput.addEventListener('input', (e) => { state.meta.lon = e.target.value; update(); });
    dateInput.addEventListener('input', (e) => { state.meta.date = e.target.value; update(); });
    elevInput.addEventListener('input', (e) => { state.meta.elevation = e.target.value; update(); });
    aspInput.addEventListener('input', (e) => { state.meta.aspect = e.target.value; update(); });
    observerInput.addEventListener('input', (e) => { state.meta.observer = e.target.value; update(); });
    airTempInput.addEventListener('input', (e) => { state.meta.airTemp = e.target.value; update(); });

    if (addLayerBtn) addLayerBtn.addEventListener('click', addLayer);
    if (addLayerBtnBottom) addLayerBtnBottom.addEventListener('click', addLayer);

    if (addTestBtn) addTestBtn.addEventListener('click', addTest);

    if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
            const link = document.createElement('a');
            link.download = `snow-profile-${state.meta.date || 'draft'}.png`;
            link.href = document.getElementById('profile-canvas').toDataURL();
            link.click();
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', uploadToSite);
    }

    // --- Map Logic ---
    let map;
    let marker;

    if (openMapBtn) {
        openMapBtn.addEventListener('click', () => {
            mapModal.style.display = 'flex';
            setTimeout(() => {
                initMap();
                map.invalidateSize();
            }, 100);
        });
    }

    if (closeMapBtn) {
        closeMapBtn.addEventListener('click', () => {
            mapModal.style.display = 'none';
        });
    }

    if (confirmLocBtn) {
        confirmLocBtn.addEventListener('click', () => {
            if (marker) {
                const pos = marker.getLngLat();
                latInput.value = pos.lat.toFixed(5);
                lonInput.value = pos.lng.toFixed(5);
                state.meta.lat = pos.lat.toFixed(5);
                state.meta.lon = pos.lng.toFixed(5);
                update();
            }
            mapModal.style.display = 'none';
        });
    }

    if (useLocBtn) {
        useLocBtn.addEventListener('click', () => {
            const originalText = useLocBtn.innerText;
            useLocBtn.innerText = 'Locating...';
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((pos) => {
                    latInput.value = pos.coords.latitude.toFixed(5);
                    lonInput.value = pos.coords.longitude.toFixed(5);
                    state.meta.lat = pos.coords.latitude.toFixed(5);
                    state.meta.lon = pos.coords.longitude.toFixed(5);
                    update();
                    useLocBtn.innerText = originalText;
                }, () => {
                    alert('Could not get location.');
                    useLocBtn.innerText = originalText;
                });
            } else {
                alert('Geolocation not supported.');
                useLocBtn.innerText = originalText;
            }
        });
    }

    function initMap() {
        if (map) {
            map.resize(); // maplibre specific to handle modal resize
            return;
        }

        // Default to Alps center or existing coords
        let startLat = 47.4;
        let startLon = 10.3;
        let zoom = 9;

        if (state.meta.lat && state.meta.lon) {
            startLat = parseFloat(state.meta.lat);
            startLon = parseFloat(state.meta.lon);
            zoom = 13;
        }

        map = new maplibregl.Map({
            container: 'picker-map',
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
            center: [startLon, startLat], // Lon, Lat
            zoom: zoom
        });
        map.addControl(new maplibregl.NavigationControl());

        function updateLayers() {
            const z = map.getZoom();
            if (z < 13) {
                if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'none');
                if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'visible');
            } else {
                if (map.getLayer('osm-layer')) map.setLayoutProperty('osm-layer', 'visibility', 'none');
                if (map.getLayer('topo-layer')) map.setLayoutProperty('topo-layer', 'visibility', 'visible');
            }
        }
        map.on('zoom', updateLayers);

        function setMarker(lat, lng) {
            if (marker) marker.remove();
            marker = new maplibregl.Marker({ draggable: true })
                .setLngLat([lng, lat])
                .addTo(map);
        }

        if (state.meta.lat && state.meta.lon) {
            setMarker(startLat, startLon);
        }

        map.on('click', (e) => {
            setMarker(e.lngLat.lat, e.lngLat.lng);
        });
    }

    // Check for Edit Mode
    let editingId = null;
    checkEditMode();

    async function checkEditMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const editId = urlParams.get('edit');
        if (editId) {
            try {
                // Fetch data
                const res = await fetch(`https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/get?id=${editId}`);
                if (!res.ok) throw new Error('Profile not found');
                const data = await res.json();

                // Populate State
                editingId = data.id;
                state.meta.location = data.location || '';
                state.meta.date = data.date ? data.date.split('T')[0] : ''; // handled by worker ISO string usually
                state.meta.elevation = data.elevation || '';
                state.meta.aspect = data.aspect || '';
                state.meta.lat = data.lat || '';
                state.meta.lon = data.lon || '';
                state.meta.observer = data.user !== 'Anonymous' ? data.user : '';

                // Parse Air Temp from comment if not explicit (legacy) or use stored field if we add it
                // We didn't store airTemp explicitly in payload before, so regex check:
                const tempMatch = data.comment ? data.comment.match(/Air Temp: ([\d.-]+)C/) : null;
                if (tempMatch) state.meta.airTemp = tempMatch[1];

                // Layers & Tests (New uploads will have this, legacy won't)
                if (data.layers) {
                    state.layers = data.layers;
                } else {
                    console.warn('Legacy profile: No raw layer data available.');
                    alert('This is an older profile without raw layer data. You can edit the metadata, but the snow layers cannot be restored automatically.');
                }

                if (data.tests) {
                    state.tests = data.tests;
                }

                // Update UI Inputs
                locationInput.value = state.meta.location;
                if (state.meta.lat) latInput.value = state.meta.lat;
                if (state.meta.lon) lonInput.value = state.meta.lon;
                dateInput.value = state.meta.date;
                elevInput.value = state.meta.elevation;
                aspInput.value = state.meta.aspect;
                observerInput.value = state.meta.observer;
                if (state.meta.airTemp) airTempInput.value = state.meta.airTemp;

                // Update Upload Button Text
                if (uploadBtn) uploadBtn.innerText = 'Update Profile';

                // Re-render
                renderLayersList();
                renderTestsList();
                update();

                // Init map params if needed
                if (state.meta.lat && state.meta.lon) {
                    // pre-set map center? handled in initMap but we might want to trigger it? nah
                }

            } catch (e) {
                console.error('Error loading edit data', e);
                alert('Error loading profile for editing: ' + e.message);
            }
        }
    }

    // Use current location logic
    // --- Upload Logic ---
    async function uploadToSite() {
        if (!state.meta.lat || !state.meta.lon) {
            alert('Please provide coordinates (Latitude and Longitude) before uploading.');
            return;
        }

        const uploadBtn = document.getElementById('upload-site-btn');
        const statusDiv = document.getElementById('upload-status');

        uploadBtn.disabled = true;
        uploadBtn.innerText = editingId ? 'Updating...' : 'Uploading...';
        statusDiv.innerText = 'Converting image...';
        statusDiv.className = '';

        try {
            // Get Image
            const canvas = document.getElementById('profile-canvas');
            const dataUrl = canvas.toDataURL('image/png');

            // Payload
            const payload = {
                id: editingId || undefined, // Send ID if editing to overwrite
                user: state.meta.observer || 'Anonymous',
                date: state.meta.date,
                location: state.meta.location,
                elevation: state.meta.elevation,
                aspect: state.meta.aspect,
                comment: `Snow Profile generated via Profile Creator.\nLocation: ${state.meta.location}\nElevation: ${state.meta.elevation}m, Aspect: ${state.meta.aspect}\nAir Temp: ${state.meta.airTemp}C`,
                lat: state.meta.lat,
                lon: state.meta.lon,
                image: dataUrl,
                type: 'profile',
                layers: state.layers, // Store raw data for future edits
                tests: state.tests
            };

            statusDiv.innerText = 'Sending to server...';

            const WORKER_URL = 'https://avalanche-archiver-uploads.bigdoggybollock.workers.dev/upload';
            const res = await fetch(WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                statusDiv.innerText = editingId ? '✅ Update Successful! Rebuild needed.' : '✅ Upload Successful! It will appear on the site after the next build.';
                statusDiv.style.color = '#059669';
                setTimeout(() => {
                    uploadBtn.innerText = editingId ? 'Update Profile' : 'Upload to Site';
                    uploadBtn.disabled = false;
                }, 3000);
            } else {
                throw new Error(await res.text());
            }

        } catch (err) {
            console.error(err);
            statusDiv.innerText = '❌ Error: ' + err.message;
            statusDiv.style.color = '#dc2626';
            uploadBtn.innerText = editingId ? 'Update Profile' : 'Upload to Site';
            uploadBtn.disabled = false;
        }
    }


    // Helper functions
    function update() {
        renderer.render(state);
    }

    function renderLayersList() {
        layersList.innerHTML = '';
        state.layers.forEach((layer, index) => {
            const el = document.createElement('div');
            el.className = 'layer-item';

            // Buttons disabled logic
            const isFirst = index === 0;
            const isLast = index === state.layers.length - 1;

            el.innerHTML = `
                <div class="layer-header">
                    <span>Layer ${index + 1}</span>
                    <div class="move-buttons">
                        <button class="btn-move move-up" data-index="${index}" ${isFirst ? 'disabled' : ''}>▲</button>
                        <button class="btn-move move-down" data-index="${index}" ${isLast ? 'disabled' : ''}>▼</button>
                    </div>
                    <span class="remove-layer" data-index="${index}">&times;</span>
                </div>
                <div class="layer-controls">
                    <div>
                        <label style="font-size:0.7rem; display:block;">Thickness (cm)</label>
                        <input type="number" class="layer-thickness" data-index="${index}" value="${layer.thickness}">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; display:block;">Hardness</label>
                        <select class="layer-hardness" data-index="${index}">
                            ${['F', '4F', '1F', 'P', 'K', 'I'].map(h => `<option value="${h}" ${h === layer.hardness ? 'selected' : ''}>${h}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:0.7rem; display:block;">Temp (°C)</label>
                        <input type="number" step="0.1" class="layer-temp" data-index="${index}" value="${layer.temp !== undefined ? layer.temp : ''}">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; display:block;">Grain Form</label>
                        <select class="layer-grain" data-index="${index}">
                            <option value="" ${layer.grainForm === '' ? 'selected' : ''}>-</option>
                            <option value="+" ${layer.grainForm === '+' ? 'selected' : ''}>+ (New Snow)</option>
                            <option value="/" ${layer.grainForm === '/' ? 'selected' : ''}>/ (Decomposed)</option>
                            <option value="•" ${layer.grainForm === '•' ? 'selected' : ''}>• (Rounded)</option>
                            <option value="□" ${layer.grainForm === '□' ? 'selected' : ''}>□ (Faceted)</option>
                            <option value="^" ${layer.grainForm === '^' ? 'selected' : ''}>^ (Depth Hoar)</option>
                            <option value="V" ${layer.grainForm === 'V' ? 'selected' : ''}>V (Surface Hoar)</option>
                            <option value="⬤" ${layer.grainForm === '⬤' ? 'selected' : ''}>⬤ (Melt-Freeze)</option>
                            <option value="🗙" ${layer.grainForm === '🗙' ? 'selected' : ''}>🗙 (Ice)</option>
                            <option value="●" ${layer.grainForm === '●' ? 'selected' : ''}>● (Graupel)</option>
                        </select>
                    </div>
                </div>
            `;
            layersList.appendChild(el);
        });

        // Add listeners to new elements
        document.querySelectorAll('.layer-thickness').forEach(i => i.addEventListener('input', updateLayer));
        document.querySelectorAll('.layer-hardness').forEach(i => i.addEventListener('change', updateLayer));
        document.querySelectorAll('.layer-temp').forEach(i => i.addEventListener('input', updateLayer));
        document.querySelectorAll('.layer-grain').forEach(i => i.addEventListener('change', updateLayer));
        document.querySelectorAll('.remove-layer').forEach(i => i.addEventListener('click', removeLayer));

        document.querySelectorAll('.move-up').forEach(i => i.addEventListener('click', moveLayerUp));
        document.querySelectorAll('.move-down').forEach(i => i.addEventListener('click', moveLayerDown));
    }

    function renderTestsList() {
        if (!testsList) return;
        testsList.innerHTML = '';
        state.tests.forEach((test, index) => {
            const el = document.createElement('div');
            el.className = 'test-item';

            el.innerHTML = `
                 <div class="layer-header">
                    <span>Test ${index + 1}</span>
                    <span class="remove-test" data-index="${index}">&times;</span>
                </div>
                <div class="test-controls">
                    <div>
                        <label style="font-size:0.7rem; display:block;">Result</label>
                        <input type="text" class="test-result" data-index="${index}" value="${test.result}" placeholder="CT 12">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; display:block;">Height (cm)</label>
                        <input type="number" class="test-depth" data-index="${index}" value="${test.depth}" placeholder="0">
                    </div>
                    <div>
                        <label style="font-size:0.7rem; display:block;">Description</label>
                        <input type="text" class="test-desc" data-index="${index}" value="${test.desc}" placeholder="RP">
                    </div>
                </div>
            `;
            testsList.appendChild(el);
        });

        document.querySelectorAll('.test-result').forEach(i => i.addEventListener('input', updateTest));
        document.querySelectorAll('.test-depth').forEach(i => i.addEventListener('input', updateTest));
        document.querySelectorAll('.test-desc').forEach(i => i.addEventListener('input', updateTest));
        document.querySelectorAll('.remove-test').forEach(i => i.addEventListener('click', removeTest));
    }

    function moveLayerUp(e) {
        const idx = parseInt(e.target.dataset.index);
        if (idx > 0) {
            const temp = state.layers[idx];
            state.layers[idx] = state.layers[idx - 1];
            state.layers[idx - 1] = temp;
            renderLayersList();
            update();
        }
    }

    function moveLayerDown(e) {
        const idx = parseInt(e.target.dataset.index);
        if (idx < state.layers.length - 1) {
            const temp = state.layers[idx];
            state.layers[idx] = state.layers[idx + 1];
            state.layers[idx + 1] = temp;
            renderLayersList();
            update();
        }
    }

    function updateLayer(e) {
        const idx = parseInt(e.target.dataset.index);
        let field = '';
        if (e.target.classList.contains('layer-thickness')) field = 'thickness';
        else if (e.target.classList.contains('layer-hardness')) field = 'hardness';
        else if (e.target.classList.contains('layer-temp')) field = 'temp';
        else field = 'grainForm';

        state.layers[idx][field] = e.target.value;
        update();
    }

    function removeLayer(e) {
        const idx = parseInt(e.target.dataset.index);
        state.layers.splice(idx, 1);
        renderLayersList();
        update();
    }

    function addLayer() {
        state.layers.push({ id: Date.now(), thickness: 20, hardness: 'F', grainForm: '', temp: -1.0 });
        renderLayersList();
        update();
    }

    function addTest() {
        state.tests.push({ id: Date.now(), result: '', depth: 0, desc: '' });
        renderTestsList();
        update();
    }

    function updateTest(e) {
        const idx = parseInt(e.target.dataset.index);
        let field = '';
        if (e.target.classList.contains('test-result')) field = 'result';
        else if (e.target.classList.contains('test-depth')) field = 'depth';
        else if (e.target.classList.contains('test-desc')) field = 'desc';

        state.tests[idx][field] = e.target.value;
        update();
    }

    function removeTest(e) {
        const idx = parseInt(e.target.dataset.index);
        state.tests.splice(idx, 1);
        renderTestsList();
        update();
    }

    // Initialize
    renderLayersList();
    renderTestsList();
    update();
});
