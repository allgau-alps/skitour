const path = require('path');
const { log: logger } = require('./utils');

/**
 * Validate required and optional environment variables
 * @param {Object} options - Validation options
 * @param {string[]} options.required - Required environment variables
 * @param {string[]} options.optional - Optional environment variables (will log warnings if missing)
 */
function validateEnv(options = {}) {
    const { required = [], optional = [] } = options;
    const missing = [];
    const missingOptional = [];

    // Check required variables
    for (const varName of required) {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    }

    // Check optional variables
    for (const varName of optional) {
        if (!process.env[varName]) {
            missingOptional.push(varName);
        }
    }

    // Report results
    if (missing.length > 0) {
        logger.error(`Missing required environment variables: ${missing.join(', ')}`);
        logger.error('Please set these variables in your .env file or environment');
        throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }

    if (missingOptional.length > 0) {
        logger.warn(`Missing optional environment variables: ${missingOptional.join(', ')}`);
        logger.warn('Some features may be disabled or limited');
    }

    if (missing.length === 0 && missingOptional.length === 0) {
        logger.info('✓ All environment variables validated');
    }
}

/**
 * Load .env file if it exists
 */
function loadEnvFile() {
    const fs = require('fs');
    try {
        const envPath = path.join(__dirname, '../../.env');
        if (fs.existsSync(envPath)) {
            const lines = fs.readFileSync(envPath, 'utf8').split('\n');
            for (const line of lines) {
                const parts = line.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const val = parts.slice(1).join('=').trim();
                    if (key && val && !process.env[key]) {
                        process.env[key] = val;
                    }
                }
            }
            logger.info('✓ Loaded .env file');
        }
    } catch (e) {
        logger.warn('Could not load .env file:', e.message);
    }
}

module.exports = {
    validateEnv,
    loadEnvFile
};
