const fs = require('fs');
const path = require('path');
const { log } = require('./lib/utils');
const { downloadImageWithRetry } = require('./lib/fetcher'); // Generic file downloader
const { REGION_PDF_MAP, PATHS } = require('./lib/config');
const { generatePdf } = require('./pdf_generator');

// Using downloadImageWithRetry as generic file downloader
const downloadPdf = downloadImageWithRetry;

// sourceType: 'lawinen-warnung' (Bavaria/Vorarlberg) or 'avalanche-report' (Tyrol/Euregio)
/**
 * Extracts and downloads the official PDF URL from a bulletin JSON object.
 * For Tyrol (AT-07), generates PDF locally from JSON data since the endpoint is defunct.
 * Checks for version conflicts and archives updates with timestamp suffixes.
 * 
 * @param {object} bulletin - The raw JSON bulletin object
 * @param {string[]|object[]} bulletin.regions - List of region IDs covered
 * @param {string} [bulletin.id] - Bulletin UUID (varies by API)
 * @param {string} [bulletin.bulletinID] - Alternative UUID field
 * @param {string} [bulletin.publicationTime] - Timestamp of publication
 * @param {string} dateStr - Date string YYYY-MM-DD
 * @param {string} [sourceType='lawinen-warnung'] - API Type to determine PDF URL format
 * @returns {Promise<string>} 'new', 'updated', or undefined
 */
async function processBulletinForPdfs(bulletin, dateStr, sourceType = 'lawinen-warnung') {
    if (!bulletin.regions) return;

    // Check if this bulletin contains any of our target regions
    const regions = bulletin.regions.map(r => (typeof r === 'string' ? r : r.regionID));

    // Collect matched regions with both regionId and slug
    const matchedRegions = [];
    for (const rid of regions) {
        const slug = REGION_PDF_MAP[rid];
        if (slug) {
            matchedRegions.push({ regionId: rid, slug });
        }
    }

    const uuid = bulletin.id || bulletin.bulletinID;

    if (matchedRegions.length === 0) return;

    log.info(`Found relevant bulletin ${uuid || '(no uuid)'} for regions: ${matchedRegions.map(r => r.slug).join(', ')}`);

    let resultStatus;

    for (const { regionId, slug } of matchedRegions) {
        // Base filename: YYYY-MM-DD.pdf
        const baseDest = path.join(PATHS.pdfs, slug, `${dateStr}.pdf`);

        // For Tyrol (avalanche-report), try the official endpoint first; fallback to local generation
        if (sourceType === 'avalanche-report') {
            // The endpoint expects the bulletin date at 16:00:00.000Z (the valid date), not the publicationTime.
            // Use the dateStr we are processing, with fixed 16:00 UTC.
            const dateParam = `${dateStr}T16:00:00.000Z`;
            const url = `https://api.avalanche.report/albina/api/bulletins/pdf?date=${encodeURIComponent(dateParam)}&region=EUREGIO&microRegionId=${regionId}&lang=en&grayscale=false`;

            log.info(`  Attempting official PDF URL: ${url}`);

            try {
                // If file doesn't exist, try to download; on failure, fallback to local generation
                if (!fs.existsSync(baseDest)) {
                    const result = await downloadPdf(url, baseDest);
                    if (result) {
                        if (!resultStatus) resultStatus = 'new';
                        log.info(`  Downloaded PDF for ${slug}/${dateStr}.pdf`);
                    } else {
                        log.warn(`  Official PDF download failed for new file, generating locally`);
                        fs.mkdirSync(path.dirname(baseDest), { recursive: true });
                        const genOk = await generatePdf(bulletin, dateStr, baseDest);
                        if (genOk) {
                            if (!resultStatus) resultStatus = 'new';
                            log.info(`  Generated PDF for ${slug}/${dateStr}.pdf`);
                        } else {
                            log.error(`  Failed to generate PDF for ${slug}/${dateStr}.pdf`);
                        }
                    }
                    continue;
                }

                // File exists - check for update
                const tempDest = baseDest + '.tmp';
                try {
                    await downloadPdf(url, tempDest);

                    // Compare file sizes
                    const statExisting = fs.statSync(baseDest);
                    const statNew = fs.statSync(tempDest);
                    let isDifferent = (statExisting.size !== statNew.size);

                    if (isDifferent) {
                        const bufBase = fs.readFileSync(baseDest);
                        const bufNew = fs.readFileSync(tempDest);
                        if (bufBase.equals(bufNew)) {
                            log.info(`  Update matches existing ${dateStr}.pdf (content check). Skipping.`);
                            isDifferent = false;
                        }
                    }

                    if (isDifferent) {
                        log.info(`  Update detected for ${slug}/${dateStr}.pdf!`);
                        if (resultStatus !== 'new') resultStatus = 'updated';

                        // Archive versioned update
                        let suffix = '_v2';
                        if (bulletin.publicationTime) {
                            try {
                                const d = new Date(bulletin.publicationTime);
                                const y = d.getUTCFullYear();
                                const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                                const day = String(d.getUTCDate()).padStart(2, '0');
                                const H = String(d.getUTCHours()).padStart(2, '0');
                                const M = String(d.getUTCMinutes()).padStart(2, '0');
                                suffix = `_${y}${m}${day}-${H}${M}`;
                            } catch (err) {
                                log.error('Error formatting publicationTime for suffix:', err);
                            }
                        }

                        let versionDest = path.join(PATHS.pdfs, slug, `${dateStr}${suffix}.pdf`);

                        if (fs.existsSync(versionDest)) {
                            const bufExisting = fs.readFileSync(versionDest);
                            const bufNew = fs.readFileSync(tempDest);
                            if (bufExisting.equals(bufNew)) {
                                log.info(`  Update matches existing ${dateStr}${suffix}.pdf. Skipping.`);
                                isDifferent = false;
                            } else {
                                suffix += '_v2';
                                versionDest = path.join(PATHS.pdfs, slug, `${dateStr}${suffix}.pdf`);
                            }
                        }

                        if (isDifferent) {
                            fs.renameSync(tempDest, versionDest);
                            log.info(`  Archived update as: ${slug}/${dateStr}${suffix}.pdf`);
                        } else {
                            fs.unlinkSync(tempDest);
                        }
                    } else {
                        fs.unlinkSync(tempDest);
                    }
                } catch (e) {
                    log.error(`  Failed to download/compare: ${e.message}`);
                    if (fs.existsSync(tempDest)) fs.unlinkSync(tempDest);
                    // Throw to trigger fallback
                    throw e;
                }
            } catch (e) {
                log.warn(`  Official PDF fetch failed, falling back to local generation: ${e.message}`);
                // Ensure target directory exists
                fs.mkdirSync(path.dirname(baseDest), { recursive: true });
                const success = await generatePdf(bulletin, dateStr, baseDest);
                if (success) {
                    if (!resultStatus) resultStatus = 'new';
                    log.info(`  Generated PDF for ${slug}/${dateStr}.pdf`);
                } else {
                    log.error(`  Failed to generate PDF for ${slug}/${dateStr}.pdf`);
                }
            }
            continue;
        }

        // For lawinen-warnung (DE-BY, AT-08), use the remote PDF endpoint
        let url;
        if (sourceType === 'lawinen-warnung') {
            const isAt08 = regions.some(r => r.startsWith('AT-08'));
            const regionParam = isAt08 ? 'AT-08' : 'DE-BY';
            url = `https://admin.lawinen-warnung.eu/albina/api/bulletins/${uuid}/pdf?region=${regionParam}&lang=en&grayscale=false`;
        } else {
            // Fallback for unknown types - shouldn't happen
            log.warn(`Unknown sourceType: ${sourceType}, skipping`);
            continue;
        }

        log.info(`  PDF URL: ${url}`);

        // If file doesn't exist, simple download
        if (!fs.existsSync(baseDest)) {
            try {
                log.info(`  Downloading to: ${slug}/${dateStr}.pdf`);
                await downloadPdf(url, baseDest);
                if (!resultStatus) resultStatus = 'new';
            } catch (e) {
                log.error(`  Failed to download PDF: ${e.message}`);
            }
            continue;
        }

        // File exists - check for update
        // Download to temp file to compare
        const tempDest = baseDest + '.tmp';
        try {
            await downloadPdf(url, tempDest);

            // Compare file sizes (simple check)
            const statExisting = fs.statSync(baseDest);
            const statNew = fs.statSync(tempDest);

            let isDifferent = (statExisting.size !== statNew.size);

            if (isDifferent) {
                // Double check with buffer comparison to be sure (avoid size-only false positives)
                const bufBase = fs.readFileSync(baseDest);
                const bufNewBase = fs.readFileSync(tempDest);
                if (bufBase.equals(bufNewBase)) {
                    log.info(`  Update matches existing ${dateStr}.pdf (content check). Skipping.`);
                    isDifferent = false;
                }
            }

            if (isDifferent) {
                log.info(`  Update detected for ${slug}/${dateStr}.pdf!`);
                if (resultStatus !== 'new') resultStatus = 'updated';

                let suffix = '_v2';
                if (bulletin.publicationTime) {
                    try {
                        const d = new Date(bulletin.publicationTime);
                        const y = d.getUTCFullYear();
                        const m = String(d.getUTCMonth() + 1).padStart(2, '0');
                        const day = String(d.getUTCDate()).padStart(2, '0');
                        const H = String(d.getUTCHours()).padStart(2, '0');
                        const M = String(d.getUTCMinutes()).padStart(2, '0');
                        suffix = `_${y}${m}${day}-${H}${M}`;
                    } catch (err) {
                        log.error('Error formatting publicationTime for suffix:', err);
                    }
                }

                let versionDest = path.join(PATHS.pdfs, slug, `${dateStr}${suffix}.pdf`);

                // Check if this specific version already exists
                if (fs.existsSync(versionDest)) {
                    const bufExisting = fs.readFileSync(versionDest);
                    const bufNew = fs.readFileSync(tempDest);
                    if (bufExisting.equals(bufNew)) {
                        log.info(`  Update matches existing ${dateStr}${suffix}.pdf. Skipping.`);
                        isDifferent = false;
                    } else {
                        // Same timestamp but different content? Extremely rare. 
                        // Fallback to appending v2 to the timestamp
                        suffix += '_v2';
                        versionDest = path.join(PATHS.pdfs, slug, `${dateStr}${suffix}.pdf`);
                    }
                }

                if (isDifferent) {
                    fs.renameSync(tempDest, versionDest);
                    log.info(`  Archived update as: ${slug}/${dateStr}${suffix}.pdf`);
                } else {
                    // Was duplicate
                    fs.unlinkSync(tempDest);
                }
            } else {
                // No change
                fs.unlinkSync(tempDest);
            }

        } catch (e) {
            log.error(`  Failed to check update: ${e.message}`);
            // Cleanup temp if exists
            if (fs.existsSync(tempDest)) {
                fs.unlinkSync(tempDest);
            }
        }
    }
    return resultStatus;
}

module.exports = { processBulletinForPdfs };
