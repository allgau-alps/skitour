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
async function translateText(text, options = {}, retries = 3) {
    const format = options.format || 'text';
    const apiKey = process.env.GCP_TRANSLATE_KEY || process.env.GOOGLE_TRANSLATE_KEY;
    if (!apiKey) return null;
    if (!text || text.length < 2) return null;

    const key = hashText(text + '|' + format);
    if (translationCache[key]) return translationCache[key];

    const doRequest = () => new Promise((resolve, reject) => {
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
                        resolve(json.data.translations[0].translatedText);
                    } else if (json.error) {
                        reject(new Error(json.error.message));
                    } else {
                        resolve(null);
                    }
                } catch (e) { reject(e); }
            });
        });
        req.on('error', (e) => reject(e));
        req.write(JSON.stringify({
            q: text,
            source: 'de',
            target: 'en',
            format: format
        }));
        req.end();
    });

    for (let i = 0; i < retries; i++) {
        try {
            const result = await doRequest();
            if (result) {
                translationCache[key] = result;
                saveTranslationCache();
                return result;
            }
        } catch (e) {
            log.warn(`Translation attempt ${i + 1}/${retries} failed: ${e.message}`);
            if (i === retries - 1) {
                log.error(`All translation retries failed for text length ${text.length}`);
                return null;
            }
            // Wait before retry (exponential backoff: 1s, 2s, 4s...)
            await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        }
    }
    return null;
}

module.exports = { translateText };
