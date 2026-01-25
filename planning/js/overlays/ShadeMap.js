/**
 * ShadeMap integration for Avalanche Archiver Planning Tool
 * Approaches accurate terrain shadowing using Ray-Casting on Mapbox Terrain RGB tiles.
 * 
 * Optimized for performance: Pre-loads tiles and runs synchronous ray-casting.
 */

// ===== DEM TILE MANAGER =====
class DEMTileManager {
    constructor() {
        this.tileCache = new Map();
        this.tileSize = 256;
        this.maxZoom = 15;
    }

    getTileURL(x, y, z) {
        return `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
    }

    getTileCoords(lat, lng, zoom) {
        const z = Math.min(zoom, this.maxZoom);
        const scale = Math.pow(2, z);
        const x = Math.floor((lng + 180) / 360 * scale);
        const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale);
        return { x, y, z, scale };
    }

    async loadTile(x, y, z) {
        const key = `${z}/${x}/${y}`;
        if (this.tileCache.has(key)) {
            return this.tileCache.get(key);
        }

        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = this.tileSize;
                canvas.height = this.tileSize;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const imageData = ctx.getImageData(0, 0, this.tileSize, this.tileSize);
                this.tileCache.set(key, imageData);
                resolve(imageData);
            };
            img.onerror = () => {
                // Determine if we should reject or just resolve null to keep going
                console.warn(`Failed to load tile ${key}`);
                this.tileCache.set(key, null); // Cache null to avoid retrying
                resolve(null);
            };
            img.src = this.getTileURL(x, y, z);
        });
    }

    getElevation(r, g, b) {
        // Terrarium format: elevation = (R * 256 + G + B / 256) - 32768
        return (r * 256 + g + b / 256) - 32768;
    }

    /**
     * Preloads all tiles needed for a given bounding box.
     */
    async preloadArea(bounds, zoom) {
        const nw = this.getTileCoords(bounds.north, bounds.west, zoom);
        const se = this.getTileCoords(bounds.south, bounds.east, zoom);

        const promises = [];
        // Add 1 tile buffer
        for (let x = nw.x - 1; x <= se.x + 1; x++) {
            for (let y = nw.y - 1; y <= se.y + 1; y++) {
                if (x >= 0 && y >= 0) { // Basic validity check
                    promises.push(this.loadTile(x, y, nw.z));
                }
            }
        }
        await Promise.all(promises);
    }

    /**
     * Synchronous elevation lookup. Returns -9999 if tile not loaded.
     */
    getElevationSync(lat, lng, zoom) {
        const { x, y, z, scale } = this.getTileCoords(lat, lng, zoom);
        const key = `${z}/${x}/${y}`;
        const imageData = this.tileCache.get(key);

        if (!imageData) return -9999;

        // Convert lat/lng to pixel within tile
        const tileX = (lng + 180) / 360 * scale - x;
        const tileY = (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * scale - y;

        let px = Math.floor(tileX * this.tileSize);
        let py = Math.floor(tileY * this.tileSize);

        // Clamping just in case
        px = Math.max(0, Math.min(this.tileSize - 1, px));
        py = Math.max(0, Math.min(this.tileSize - 1, py));

        const idx = (py * this.tileSize + px) * 4;
        const r = imageData.data[idx];
        const g = imageData.data[idx + 1];
        const b = imageData.data[idx + 2];

        return this.getElevation(r, g, b);
    }

    // Keep async for backward compatibility if needed, but we won't use it in loop
    async getElevationAt(lat, lng, zoom) {
        const { x, y, z } = this.getTileCoords(lat, lng, zoom);
        await this.loadTile(x, y, z);
        return this.getElevationSync(lat, lng, zoom);
    }
}

// ===== SHADOW CALCULATOR =====
class ShadowCalculator {
    constructor(demManager) {
        this.demManager = demManager;
    }

    getSunPosition(date, lat, lng) {
        if (typeof SunCalc === 'undefined') {
            console.error('SunCalc library not loaded');
            return { azimuth: 0, altitude: 0 };
        }
        const pos = SunCalc.getPosition(date, lat, lng);
        return {
            azimuth: pos.azimuth,
            altitude: pos.altitude,
            zenith: Math.PI / 2 - pos.altitude
        };
    }

    // Synchronous check
    isInShadowSync(lat, lng, sun, zoom) {
        // If sun is below horizon, everything is in shadow
        if (sun.altitude <= 0) return true;

        const elevation = this.demManager.getElevationSync(lat, lng, zoom);
        if (elevation === -9999) return false; // Data missing

        const stepDistance = 0.0005; // ~50m
        const maxSteps = 100; // ~5km

        for (let step = 1; step < maxSteps; step++) {
            // Calculate position along ray toward sun
            const distance = step * stepDistance;
            const newLat = lat - distance * Math.cos(sun.azimuth);
            const newLng = lng - distance * Math.sin(sun.azimuth) / Math.cos(lat * Math.PI / 180);

            // Get elevation at this point
            const checkElevation = this.demManager.getElevationSync(newLat, newLng, zoom);

            if (checkElevation === -9999) continue; // Skip missing data points

            // Calculate required height to block sun
            const horizontalDistance = distance * 111000; // ~meters
            const requiredHeight = elevation + horizontalDistance * Math.tan(sun.altitude);

            // If terrain is higher than sun ray, we're in shadow
            if (checkElevation > requiredHeight) {
                return true;
            }
        }
        return false;
    }

    async generateShadowLayer(bounds, zoom, date, resolution = 64) {
        const { north, south, east, west } = bounds;

        // 1. Calculate extended bounds to prefetch
        // We look ahead up to ~0.05 degrees.
        const pBounds = {
            north: north + 0.05,
            south: south - 0.05,
            east: east + 0.05,
            west: west - 0.05
        };

        // 2. Preload all necessary tiles
        await this.demManager.preloadArea(pBounds, zoom);

        // 3. Process synchronously
        const latStep = (north - south) / resolution;
        const lngStep = (east - west) / resolution;

        const canvas = document.createElement('canvas');
        canvas.width = resolution;
        canvas.height = resolution;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(resolution, resolution);

        // Get single sun position approx (center of map) to avoid recalculating per pixel
        const centerLat = (north + south) / 2;
        const centerLng = (east + west) / 2;
        const sun = this.getSunPosition(date, centerLat, centerLng);

        for (let y = 0; y < resolution; y++) {
            for (let x = 0; x < resolution; x++) {
                const lat = north - y * latStep;
                const lng = west + x * lngStep;

                const inShadow = this.isInShadowSync(lat, lng, sun, zoom);

                const pIndex = (y * resolution + x) * 4;
                if (inShadow) {
                    imageData.data[pIndex] = 0;     // R
                    imageData.data[pIndex + 1] = 0; // G
                    imageData.data[pIndex + 2] = 40; // B
                    imageData.data[pIndex + 3] = 160; // Alpha
                } else {
                    imageData.data[pIndex + 3] = 0;
                }
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas.toDataURL();
    }
}

// ===== MAIN CLASS =====
class ShadeMap {
    constructor(map) {
        this.map = map;
        this.active = false;
        this.layerId = 'shademap-layer';
        this.demManager = new DEMTileManager();
        this.shadowCalc = new ShadowCalculator(this.demManager);
        this.isLoading = false;

        // Default time: Current time
        this.currentTime = new Date();
    }

    setTime(date) {
        this.currentTime = date;
        if (this.active) {
            this.update();
        }
    }

    setMinutes(minutes) {
        const date = new Date(this.currentTime);
        date.setHours(Math.floor(minutes / 60));
        date.setMinutes(minutes % 60);
        this.setTime(date);
    }

    toggle(isActive) {
        this.active = isActive;
        if (!isActive) {
            this.removeLayer();
            this.map.off('moveend', this._boundUpdate);
        } else {
            this.update();
            // Debounce update on moveend
            if (!this._boundUpdate) {
                this._boundUpdate = this._debounce(() => this.update(), 500);
            }
            this.map.on('moveend', this._boundUpdate);
        }
    }

    _debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    removeLayer() {
        if (this.map.getLayer(this.layerId)) {
            this.map.removeLayer(this.layerId);
        }
        if (this.map.getSource(this.layerId)) {
            this.map.removeSource(this.layerId);
        }
    }

    async update() {
        if (this.isLoading) return; // Prevent overlapping updates

        const statusEl = document.getElementById('shademap-status');
        if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.textContent = 'Calculating shadows...';
        }

        this.isLoading = true;

        try {
            const bounds = this.map.getBounds();
            // Ensure minimum zoom of 11 for terrain detail, but cap at current + 2 to avoid massive downloads
            let zoom = Math.floor(this.map.getZoom());
            zoom = Math.max(zoom, 11);

            // High resolution for crisp shadows
            const resolution = 300;

            const shadowImage = await this.shadowCalc.generateShadowLayer({
                north: bounds.getNorth(),
                south: bounds.getSouth(),
                east: bounds.getEast(),
                west: bounds.getWest()
            }, zoom, this.currentTime, resolution);

            // Update Map
            this.removeLayer();

            this.map.addSource(this.layerId, {
                type: 'image',
                url: shadowImage,
                coordinates: [
                    [bounds.getWest(), bounds.getNorth()],
                    [bounds.getEast(), bounds.getNorth()],
                    [bounds.getEast(), bounds.getSouth()],
                    [bounds.getWest(), bounds.getSouth()]
                ]
            });

            this.map.addLayer({
                id: this.layerId,
                type: 'raster',
                source: this.layerId,
                paint: {
                    'raster-opacity': 1,
                    'raster-fade-duration': 200
                }
            });

        } catch (e) {
            console.error('ShadeMap update failed', e);
        } finally {
            this.isLoading = false;
            if (statusEl) statusEl.style.display = 'none';
        }
    }
}

