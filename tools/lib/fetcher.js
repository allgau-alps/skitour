const https = require('https');
const { log: logger } = require('./utils');

/**
 * Retry configuration
 */
const DEFAULT_RETRY_CONFIG = {
    maxRetries: 3,
    initialDelay: 1000, // 1 second
    maxDelay: 10000,    // 10 seconds
    backoffMultiplier: 2,
    timeout: 15000      // 15 seconds per attempt
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch JSON with automatic retry logic and exponential backoff
 * @param {string} url - The URL to fetch from
 * @param {Object} options - Fetch options
 * @param {number} options.maxRetries - Maximum number of retry attempts (default: 3)
 * @param {number} options.timeout - Request timeout in milliseconds (default: 15000)
 * @param {number} options.initialDelay - Initial retry delay in ms (default: 1000)
 * @param {number} options.backoffMultiplier - Backoff multiplier for retries (default: 2)
 * @returns {Promise<any>} Parsed JSON data
 */
async function fetchJsonWithRetry(url, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.min(
                    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
                    config.maxDelay
                );
                logger.info(`Retry attempt ${attempt}/${config.maxRetries} for ${url} after ${delay}ms`);
                await sleep(delay);
            }

            const data = await fetchJsonSingle(url, config.timeout);

            if (attempt > 0) {
                logger.info(`Successfully fetched ${url} on attempt ${attempt + 1}`);
            }

            return data;

        } catch (error) {
            lastError = error;

            // Don't retry on 4xx errors (client errors)
            if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
                logger.error(`Client error ${error.statusCode} for ${url}, not retrying`);
                throw error;
            }

            if (attempt < config.maxRetries) {
                logger.warn(`Fetch failed for ${url}: ${error.message}, will retry...`);
            } else {
                logger.error(`All ${config.maxRetries + 1} attempts failed for ${url}`);
            }
        }
    }

    throw lastError;
}

/**
 * Single fetch attempt (internal helper)
 */
function fetchJsonSingle(url, timeout) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'AvalancheArchiver/1.0'
            },
            timeout
        }, (res) => {
            if (res.statusCode !== 200) {
                res.resume();
                const error = new Error(`HTTP ${res.statusCode}: ${url}`);
                error.statusCode = res.statusCode;
                reject(error);
                return;
            }

            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`JSON parse error: ${e.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });
    });
}

/**
 * Download image with retry logic
 * @param {string} url - The URL of the image
 * @param {string} destPath - Destination file path
 * @param {Object} options - Retry options
 * @returns {Promise<string|null>} Path to downloaded image, or null on error
 */
async function downloadImageWithRetry(url, destPath, options = {}) {
    const config = { ...DEFAULT_RETRY_CONFIG, ...options };
    const fs = require('fs');
    const path = require('path');

    if (!url) return null;

    // Skip if exists
    if (fs.existsSync(destPath)) {
        return destPath;
    }

    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
        try {
            if (attempt > 0) {
                const delay = Math.min(
                    config.initialDelay * Math.pow(config.backoffMultiplier, attempt - 1),
                    config.maxDelay
                );
                await sleep(delay);
            }

            const result = await downloadImageSingle(url, destPath, config.timeout);

            if (result && attempt > 0) {
                logger.info(`Successfully downloaded image on attempt ${attempt + 1}`);
            }

            return result;

        } catch (error) {
            lastError = error;

            if (attempt < config.maxRetries) {
                logger.warn(`Image download failed for ${url}: ${error.message}, will retry...`);
            }
        }
    }

    logger.error(`Failed to download image after ${config.maxRetries + 1} attempts: ${url}`);
    return null;
}

/**
 * Single image download attempt (internal helper)
 */
function downloadImageSingle(url, destPath, timeout) {
    const fs = require('fs');
    const path = require('path');

    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: { 'User-Agent': 'AvalancheArchiver/1.0' },
            timeout
        }, (res) => {
            if (res.statusCode === 200) {
                const dir = path.dirname(destPath);
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

                const file = fs.createWriteStream(destPath);
                res.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(destPath);
                });
                file.on('error', (err) => {
                    fs.unlink(destPath, () => { }); // Clean up partial file
                    reject(err);
                });
            } else {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode}`));
            }
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Request Timeout'));
        });
    });
}

module.exports = {
    fetchJsonWithRetry,
    downloadImageWithRetry,
    DEFAULT_RETRY_CONFIG
};
