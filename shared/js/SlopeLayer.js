/**
 * SlopeLayer - Raster-based Slope Visualization
 * 
 * Uses a custom protocol 'slope://' to generate slope tiles on the CPU.
 * This allows MapLibre to natively drape the slope layer over the 3D terrain,
 * eliminating z-fighting and floating mesh issues.
 * 
 * Refactored to use shared/js/SlopeUtils.js
 */

// Register the custom protocol once
let protocolRegistered = false;

function registerSlopeProtocol() {
    if (protocolRegistered) return;

    maplibregl.addProtocol('slope', async (params, abortController) => {
        const chunks = params.url.split('slope://')[1].split('/');
        const z = parseInt(chunks[0]);
        const x = parseInt(chunks[1]);
        const y = parseInt(chunks[2]);

        const terrariumUrl = `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

        try {
            const response = await fetch(terrariumUrl, { signal: abortController.signal });
            if (!response.ok) throw new Error('Tile load failed');

            const blob = await response.blob();
            const imageBitmap = await createImageBitmap(blob);

            const canvas = new OffscreenCanvas(256, 256);
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(imageBitmap, 0, 0);

            const imgData = ctx.getImageData(0, 0, 256, 256);
            const data = imgData.data;
            const outputData = new Uint8ClampedArray(data.length);

            // Use Shared Utils
            const utils = window.SlopeUtils;
            if (!utils) {
                console.error('SlopeUtils not loaded');
                throw new Error('SlopeUtils not loaded');
            }

            const metersPerPixel = utils.getMetersPerPixel(z, y);

            for (let r = 0; r < 256; r++) {
                for (let c = 0; c < 256; c++) {
                    const i = (r * 256 + c) * 4;

                    const { slope } = utils.calculateSlopeAspect(data, i, r, c, metersPerPixel);

                    let R = 0, G = 0, B = 0, A = 0;

                    if (slope >= 45.0) { R = 26; G = 0; B = 51; A = 204; } // #1a0033cc
                    else if (slope >= 40.0) { R = 153; G = 0; B = 0; A = 204; } // #990000cc
                    else if (slope >= 35.0) { R = 255; G = 0; B = 0; A = 204; } // #ff0000cc
                    else if (slope >= 30.0) { R = 255; G = 128; B = 0; A = 204; } // #ff8000cc
                    else if (slope >= 27.0) { R = 255; G = 255; B = 0; A = 204; } // #ffff00cc 
                    else { R = 0; G = 0; B = 0; A = 0; }

                    outputData[i] = R;
                    outputData[i + 1] = G;
                    outputData[i + 2] = B;
                    outputData[i + 3] = A;
                }
            }

            const outImgData = new ImageData(outputData, 256, 256);
            ctx.putImageData(outImgData, 0, 0);

            const outBlob = await canvas.convertToBlob({ type: 'image/png' });
            return { data: await outBlob.arrayBuffer() };

        } catch (e) {
            console.error('Slope protocol error', e);
            throw e;
        }
    });

    protocolRegistered = true;
}

class SlopeLayer {
    constructor() {
        this.id = 'slope-layer';
        this.sourceId = 'slope-source';
        this._visible = false;
        this.opacity = 0.5;

        registerSlopeProtocol();
    }

    onAdd(map) {
        this.map = map;

        if (!map.getSource(this.sourceId)) {
            map.addSource(this.sourceId, {
                type: 'raster',
                tiles: ['slope://{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 0,
                maxzoom: 15, // Terrarium limit
                attribution: 'Slope calculated from Mapzen Terrarium'
            });
        }

        if (!map.getLayer(this.id)) {
            map.addLayer({
                id: this.id,
                type: 'raster',
                source: this.sourceId,
                paint: {
                    'raster-opacity': this.opacity,
                    'raster-fade-duration': 0
                },
                layout: {
                    visibility: 'none'
                }
            });
        }
    }

    setOpacity(val) {
        this.opacity = val;
        if (this.map && this.map.getLayer(this.id)) {
            this.map.setPaintProperty(this.id, 'raster-opacity', val);
        }
    }

    get visible() {
        return this._visible;
    }

    set visible(val) {
        this._visible = val;
        if (this.map && this.map.getLayer(this.id)) {
            this.map.setLayoutProperty(this.id, 'visibility', val ? 'visible' : 'none');
        }
    }
}
