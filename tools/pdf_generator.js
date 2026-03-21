/**
 * PDF Generator for Tyrol Bulletins
 *
 * Generates a PDF from bulletin JSON data when the official endpoint is unavailable.
 * Uses Puppeteer to render a simple HTML template and print to PDF.
 */

const puppeteer = require('puppeteer');
const { log } = require('./lib/utils');

// HTML template for the bulletin PDF
function buildBulletinHtml(bulletin, dateStr, regionName) {
    const { avalancheActivity, avalancheProblems, dangerRatings, snowpackStructure, tendency, source, validTime, publicationTime } = bulletin;
    const mainDate = bulletin.customData?.ALBINA?.mainDate || dateStr;

    // Format danger ratings
    const dangerHtml = (dangerRatings || []).map(d => {
        const main = d.mainValue || 'N/A';
        const elev = d.elevation ? (d.elevation.lowerBound ? `≥${d.elevation.lowerBound}m` : d.elevation.upperBound ? `≤${d.elevation.upperBound}m` : '') : '';
        const time = d.validTimePeriod ? d.validTimePeriod.replace('_', ' ') : '';
        return `<div class="danger ${main}"><span class="label">${main.toUpperCase()}</span>${elev ? `<span class="elev">${elev}</span>` : ''}${time ? `<span class="time">${time}</span>` : ''}</div>`;
    }).join('');

    // Format avalanche problems
    const problemsHtml = (avalancheProblems || []).map(p => {
        const type = p.problemType || 'unknown';
        const size = p.avalancheSize || '?';
        const aspects = (p.aspects || []).join(', ');
        const elev = p.elevation ? (p.elevation.lowerBound ? `≥${p.elevation.lowerBound}m` : '') : '';
        return `<div class="problem">
            <div class="problem-type">${type} (Size ${size})</div>
            <div class="aspects">Aspects: ${aspects}</div>
            ${elev ? `<div class="elevation">${elev}</div>` : ''}
        </div>`;
    }).join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>AT-07-01 Bulletin ${dateStr}</title>
<style>
    body { font-family: Arial, sans-serif; padding: 20px; line-height: 1.4; }
    h1 { font-size: 18pt; margin-bottom: 5px; }
    h2 { font-size: 14pt; margin-top: 20px; margin-bottom: 5px; border-bottom: 1px solid #ccc; padding-bottom: 3px; }
    .meta { color: #666; font-size: 10pt; margin-bottom: 20px; }
    .danger { display: inline-block; padding: 4px 8px; margin: 2px; border-radius: 3px; color: white; font-weight: bold; }
    .danger.low { background: #22c55e; }
    .danger.moderate { background: #f59e0b; }
    .danger.considerable { background: #ef4444; }
    .danger.high { background: #991b1b; }
    .danger.very-high { background: #000; }
    .label { display: block; font-size: 12pt; }
    .elev, .time { display: block; font-size: 8pt; opacity: 0.9; }
    .problem { border: 1px solid #ddd; padding: 10px; margin: 10px 0; background: #f9f9f9; }
    .problem-type { font-weight: bold; font-size: 11pt; }
    .aspects { margin-top: 5px; color: #555; }
    .elevation { font-size: 9pt; color: #888; }
    .comment, .highlights, .tendency { margin: 10px 0; }
    .highlights { font-weight: bold; background: #ffffd0; padding: 10px; border-left: 3px solid #f59e0b; }
    .comment { background: #f0f0f0; padding: 10px; }
    .tendency { background: #e8f4e8; padding: 10px; border-left: 3px solid #22c55e; }
    .source { font-size: 9pt; color: #888; margin-top: 30px; }
    @media print { body { -webkit-print-color-adjust: exact; } }
</style>
</head>
<body>
    <h1>AT-07-01 - ${regionName || 'Allgäu Alps East'}</h1>
    <div class="meta">
        Date: ${dateStr} | Bulletin: ${mainDate} | Generated: ${new Date().toISOString()}
    </div>

    <h2>Danger Ratings</h2>
    ${dangerHtml}

    <h2>Avalanche Problems</h2>
    ${problemsHtml}

    <h2>Avalanche Activity & Snowpack</h2>
    <div class="highlights">${avalancheActivity?.highlights || ''}</div>
    <div class="comment">${avalancheActivity?.comment || ''}</div>
    ${snowpackStructure?.comment ? `<div class="comment"><strong>Snowpack:</strong> ${snowpackStructure.comment}</div>` : ''}

    ${tendency?.length ? `<h2>Tendency</h2><div class="tendency">${tendency.map(t => t.highlights).join(' ')}</div>` : ''}

    <div class="source">
        Source: ${source?.provider?.name || 'LWD Tirol'} (${source?.provider?.website || 'https://avalanche.report'})
    </div>
</body>
</html>`;
}

/**
 * Generate a PDF from a bulletin and save to disk.
 * @param {object} bulletin - The bulletin JSON object
 * @param {string} dateStr - Date string YYYY-MM-DD
 * @param {string} destPath - Full file path to save PDF
 * @returns {Promise<boolean>} True if successful
 */
async function generatePdf(bulletin, dateStr, destPath) {
    const html = buildBulletinHtml(bulletin, dateStr);

    let browser;
    try {
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setContent(html);

        await page.pdf({
            path: destPath,
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
        });

        log.info(`Generated PDF: ${destPath}`);
        return true;
    } catch (e) {
        log.error(`PDF generation failed for ${dateStr}: ${e.message}`);
        return false;
    } finally {
        if (browser) await browser.close();
    }
}

module.exports = { generatePdf, buildBulletinHtml };
