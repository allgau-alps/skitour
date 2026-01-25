const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');
require('dotenv').config();
const { log } = require('./utils');

const TRANSLATION_CACHE_FILE = path.join(__dirname, '../../data/translation_cache.json');
let translationCache = {};

// Load cache on init
if (fs.existsSync(TRANSLATION_CACHE_FILE)) {
    try {
        translationCache = JSON.parse(fs.readFileSync(TRANSLATION_CACHE_FILE, 'utf8'));
    } catch (e) {
        log.warn('Failed to load translation cache');
    }
}

function saveTranslationCache() {
    try {
        const dir = path.dirname(TRANSLATION_CACHE_FILE);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(TRANSLATION_CACHE_FILE, JSON.stringify(translationCache, null, 2));
    } catch (e) {
        log.error('Failed to save translation cache', e);
    }
}

function hashText(text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

/**
 * Translate German text to English using Google Cloud Translate API
 * Uses local file cache to minimize API calls.
 * Requires GCP_TRANSLATE_KEY in environment variables.
 * @param {string} text - Text to translate
 * @param {Object} [options] - Options
 * @param {string} [options.format='text'] - 'text' or 'html'
 * @returns {Promise<string|null>} Translated text or null
 */
async function translateText(text, options = {}) {
    const format = options.format || 'text';
    const apiKey = process.env.GCP_TRANSLATE_KEY || process.env.GOOGLE_TRANSLATE_KEY;
    if (!apiKey) return null;
    if (!text || text.length < 2) return null;

    const key = hashText(text + '|' + format);
    if (translationCache[key]) return translationCache[key];

    return new Promise((resolve) => {
        const url = `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`;
        const req = https.request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.data && json.data.translations && json.data.translations.length > 0) {
                        const translated = json.data.translations[0].translatedText;
                        translationCache[key] = translated;
                        saveTranslationCache();
                        resolve(translated);
                    } else {
                        resolve(null);
                    }
                } catch (e) { resolve(null); }
            });
        });
        req.on('error', (e) => {
            log.error(`Translation request failed: ${e.message}`);
            resolve(null);
        });
        req.write(JSON.stringify({
            q: text,
            source: 'de',
            target: 'en',
            format: format
        }));
        req.end();
    });
}

module.exports = { translateText };
