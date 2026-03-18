const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

const { log } = require('./lib/utils');
const { validateEnv } = require('./lib/validateEnv');
const { translateText } = require('./lib/translator');

const rootDir = path.resolve(__dirname, '..');
const incidentsPath = path.join(rootDir, 'data', 'incidents.json');
const recentPath = path.join(rootDir, 'data', 'recent_profiles.json');

async function fetchProfile(id) {
    return new Promise((resolve) => {
        const url = `https://lawis.at/lawis_api/v2_3/profile/${id}`;
        https.get(url, (res) => {
            if (res.statusCode !== 200) {
                log.warn(`Failed to fetch ${id}: ${res.statusCode}`);
                resolve(null);
                return;
            }
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    log.error(`Failed to parse ${id}`);
                    resolve(null);
                }
            });
        }).on('error', (e) => {
            log.error(`Invalid URL ${url}: ${e.message}`);
            resolve(null);
        });
    });
}

function parseTests(comment) {
    if (!comment) return [];
    // Match "ECTP 13 @ 16.0cm" or "ECTP 13@16.0cm" or "ECTP 13"
    // Regex: /(ECT[A-Z]*\s*\d+)(?:\s*@\s*([\d.]+)\s*cm)?/
    const tests = [];
    const regex = /(ECT[A-Z]*\s*\d+)(?:\s*@\s*([\d.]+)\s*cm)?/g;
    let match;

    // Normalize newlines
    comment = comment.replace(/\r\n/g, '\n');

    while ((match = regex.exec(comment)) !== null) {
        const rawText = match[1]; // "ECTP 13"
        const height = match[2];  // "16.0" (optional)

        // Parse "ECTP 13"
        const parts = rawText.match(/([A-Z]+)\s*(\d+)/);
        if (!parts) continue;

        const typeStr = parts[1]; // "ECTP"
        const step = parts[2];     // "13"

        // Determine P (Propagation) or N (No Prop)
        let code = '';
        let baseType = typeStr;
        if (typeStr.endsWith('P')) {
            code = 'P';
            baseType = typeStr.slice(0, -1);
        } else if (typeStr.endsWith('N')) {
            code = 'N';
            baseType = typeStr.slice(0, -1);
        }

        // Create structure to match buildProfilePages expectations
        const resultText = code === 'P' ? 'propagation (P)' : (code === 'N' ? 'no propagation (N)' : '');

        tests.push({
            type: { text: baseType },
            step: parseInt(step),
            height: height ? parseFloat(height) : null,
            result: { text: resultText }
        });
    }
    return tests;
}

async function run() {
    validateEnv({ required: [], optional: ['GCP_TRANSLATE_KEY', 'GOOGLE_TRANSLATE_KEY'] });
    log.info('Enriching profiles with detailed metadata...');

    let incidents = [];
    let recent = [];

    if (fs.existsSync(incidentsPath)) incidents = JSON.parse(fs.readFileSync(incidentsPath, 'utf8'));
    if (fs.existsSync(recentPath)) recent = JSON.parse(fs.readFileSync(recentPath, 'utf8'));

    // Collect unique IDs to fetch
    const profilesToFetch = new Map();

    // From Recent
    recent.forEach(p => {
        const id = p.profil_id || p.id;
        if (id) profilesToFetch.set(String(id), p);
    });

    // From Incidents
    incidents.forEach(inc => {
        if (inc.linked_profiles) {
            inc.linked_profiles.forEach(p => {
                const id = p.id || p.profil_id;
                if (id) profilesToFetch.set(String(id), p);
            });
        }
    });

    log.info(`Found ${profilesToFetch.size} unique profiles.`);
    let enrichedCount = 0;

    for (const [id, localObj] of profilesToFetch) {
        // Always fetch to get detailed metadata (bemerkungen, etc.)
        const data = await fetchProfile(id);
        if (data) {
            // Map API fields to our Schema
            if (data.ort) localObj.location = data.ort;
            if (data.ort) localObj.ort = data.ort; // For recent

            if (data.seehoehe) localObj.elevation = data.seehoehe;
            if (data.seehoehe) localObj.seehoehe = data.seehoehe;

            if (data.hangneigung) localObj.slope = data.hangneigung;
            if (data.hangneigung) localObj.neigung = data.hangneigung;
            if (data.hangneigung) localObj.hangneigung = data.hangneigung;

            if (data.exposition_id) localObj.aspect = data.exposition_id;
            if (data.exposition_id) localObj.exposition = data.exposition_id;
            if (data.exposition_id) localObj.exposition_id = data.exposition_id;

            if (data.bemerkungen) {
                localObj.comments = data.bemerkungen;

                // Translate with fallback to original German if translation fails
                if (process.env.GCP_TRANSLATE_KEY || process.env.GOOGLE_TRANSLATE_KEY) {
                    try {
                        const translated = await translateText(data.bemerkungen);
                        if (translated) {
                            localObj.comments_en = translated;
                        } else {
                            // Translation failed or returned null, keep original
                            localObj.comments_en = data.bemerkungen;
                            log.debug(`Translation skipped for profile ${id}, using original German`);
                        }
                    } catch (transError) {
                        log.warn(`Translation error for profile ${id}: ${transError.message}. Using original.`);
                        localObj.comments_en = data.bemerkungen;
                    }
                } else {
                    // No API key, keep original
                    localObj.comments_en = data.bemerkungen;
                }

                const tests = parseTests(data.bemerkungen);
                if (tests.length > 0) {
                    localObj.stability_tests = tests;
                }
            }
            enrichedCount++;
            process.stdout.write('.');
        }
    }
    log.info(`\nEnriched ${enrichedCount} profiles.`);

    // Save
    fs.writeFileSync(incidentsPath, JSON.stringify(incidents, null, 2));
    fs.writeFileSync(recentPath, JSON.stringify(recent, null, 2));
    log.info('Saved enrichment updates.');
}

run();
