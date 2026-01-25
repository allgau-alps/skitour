/**
 * SlopeAspectLayer - Aspect-based Slope Visualization
 * 
 * Highlights only terrain with slopes ≥20° and colors by aspect direction.
 * Uses a custom protocol 'slope-aspect://' to generate tiles on the CPU.
 * This allows MapLibre to natively drape the layer over 3D terrain.
 * 
 * Refactored to use shared/js/SlopeUtils.js
 */

// Register the custom protocol once
let aspectProtocolRegistered = false;

function registerSlopeAspectProtocol() {
    if (aspectProtocolRegistered) return;

    maplibregl.addProtocol('slope-aspect', async (params, abortController) => {
        const chunks = params.url.split('slope-aspect://')[1].split('/');
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

            // Aspect color palette (8 directions)
            const aspectColors = {
                N: { R: 59, G: 130, B: 246, A: 204 }, // Blue
                NE: { R: 34, G: 211, B: 238, A: 204 }, // Cyan
                E: { R: 34, G: 197, B: 94, A: 204 }, // Green
                SE: { R: 163, G: 230, B: 53, A: 204 }, // Yellow-green
                S: { R: 239, G: 68, B: 68, A: 204 }, // Red
                SW: { R: 251, G: 146, B: 60, A: 204 }, // Orange
                W: { R: 250, G: 204, B: 21, A: 204 }, // Yellow
                NW: { R: 168, G: 85, B: 247, A: 204 }  // Purple
            };

            for (let r = 0; r < 256; r++) {
                for (let c = 0; c < 256; c++) {
                    const i = (r * 256 + c) * 4;

                    const { slope, aspect: aspectDeg } = utils.calculateSlopeAspect(data, i, r, c, metersPerPixel);

                    if (slope >= 20.0) {
                        let color;
                        if (aspectDeg >= 337.5 || aspectDeg < 22.5) {
                            color = aspectColors.N;
                        } else if (aspectDeg >= 22.5 && aspectDeg < 67.5) {
                            color = aspectColors.NE;
                        } else if (aspectDeg >= 67.5 && aspectDeg < 112.5) {
                            color = aspectColors.E;
                        } else if (aspectDeg >= 112.5 && aspectDeg < 157.5) {
                            color = aspectColors.SE;
                        } else if (aspectDeg >= 157.5 && aspectDeg < 202.5) {
                            color = aspectColors.S;
                        } else if (aspectDeg >= 202.5 && aspectDeg < 247.5) {
                            color = aspectColors.SW;
                        } else if (aspectDeg >= 247.5 && aspectDeg < 292.5) {
                            color = aspectColors.W;
                        } else {
                            color = aspectColors.NW;
                        }

                        outputData[i] = color.R;
                        outputData[i + 1] = color.G;
                        outputData[i + 2] = color.B;
                        outputData[i + 3] = color.A;
                    } else {
                        outputData[i] = 0;
                        outputData[i + 1] = 0;
                        outputData[i + 2] = 0;
                        outputData[i + 3] = 0;
                    }
                }
            }

            const outImgData = new ImageData(outputData, 256, 256);
            ctx.putImageData(outImgData, 0, 0);

            const outBlob = await canvas.convertToBlob({ type: 'image/png' });
            return { data: await outBlob.arrayBuffer() };

        } catch (e) {
            console.error('Slope-aspect protocol error', e);
            throw e;
        }
    });

    aspectProtocolRegistered = true;
}

class SlopeAspectLayer {
    constructor() {
        this.id = 'slope-aspect-layer';
        this.sourceId = 'slope-aspect-source';
        this._visible = false;
        this.opacity = 0.7;

        registerSlopeAspectProtocol();
    }

    onAdd(map) {
        this.map = map;

        if (!map.getSource(this.sourceId)) {
            map.addSource(this.sourceId, {
                type: 'raster',
                tiles: ['slope-aspect://{z}/{x}/{y}'],
                tileSize: 256,
                minzoom: 0,
                maxzoom: 15, // Terrarium limit
                attribution: 'Slope-aspect calculated from Mapzen Terrarium'
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
