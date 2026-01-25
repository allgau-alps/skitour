/**
 * Slope Calculation Utilities
 * 
 * Shared logic for decoding Mapzen Terrarium tiles and calculating slope/aspect.
 */

// Earth circumference in meters
const C = 40075016.686;

/**
 * Get meters per pixel for a given zoom level and latitude (approximate for tile center)
 */
function getMetersPerPixel(z, y) {
    const n = Math.pow(2, z);
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + 0.5) / n)));
    return (C * Math.cos(latRad)) / Math.pow(2, z) / 256.0;
}

/**
 * Decode elevation from Terrarium RGB
 * Formula: (R * 256 + G + B / 256) - 32768
 */
function getElevation(data, index) {
    return (data[index] * 256.0 + data[index + 1] + data[index + 2] / 256.0) - 32768.0;
}

/**
 * Calculate Slope and Aspect for a pixel
 * @param {Uint8ClampedArray} data - RGBA data of the tile (256x256)
 * @param {number} idx - Pixel index (r * 256 + c) * 4
 * @param {number} r - Row index
 * @param {number} c - Column index
 * @param {number} metersPerPixel - meters per pixel resolution
 * @returns {object} { slope: number (degrees), aspect: number (degrees 0-360) }
 */
function calculateSlopeAspect(data, idx, r, c, metersPerPixel) {
    const e0 = getElevation(data, idx);

    // Right neighbor
    let e_dx;
    if (c < 255) {
        e_dx = getElevation(data, idx + 4);
    } else {
        e_dx = e0; // Edge case: clamp
    }

    // Bottom neighbor
    let e_dy;
    if (r < 255) {
        e_dy = getElevation(data, idx + 256 * 4);
    } else {
        e_dy = e0; // Edge case: clamp
    }

    const dzdx = (e_dx - e0) / metersPerPixel;
    const dzdy = (e_dy - e0) / metersPerPixel;

    const slopeRad = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
    const slope = slopeRad * 180 / Math.PI;

    // Aspect Calculation
    let aspectRad = Math.atan2(dzdy, dzdx);
    let aspectDeg = aspectRad * 180 / Math.PI;

    // Convert to compass bearing (0° = North, 90° = East, etc.)
    aspectDeg = 90 - aspectDeg;
    if (aspectDeg < 0) aspectDeg += 360;
    if (aspectDeg >= 360) aspectDeg -= 360;

    return { slope, aspect: aspectDeg };
}

// Export for browser (ES Module or Global)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getMetersPerPixel, getElevation, calculateSlopeAspect };
} else {
    // Browser global
    window.SlopeUtils = { getMetersPerPixel, getElevation, calculateSlopeAspect };
}
