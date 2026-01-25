const fs = require('fs');
const path = require('path');
const { generateWeatherPage } = require('../templates');
const { PATHS } = require('../config');
const { log: logger } = require('../utils');

/**
 * Build Weather Report Archive Pages
 * @returns {number} Count of pages generated
 */
function buildWeatherPages() {
    let count = 0;
    if (fs.existsSync(PATHS.weatherArchive)) {
        const weatherData = JSON.parse(fs.readFileSync(PATHS.weatherArchive, 'utf8'));
        const weatherOutputDir = path.join(PATHS.archive, 'weather');
        if (!fs.existsSync(weatherOutputDir)) fs.mkdirSync(weatherOutputDir, { recursive: true });

        weatherData.forEach(w => {
            // Apply translation logic (similar to original build.js)
            const hasTranslation = w.translated_content && w.translated_content !== w.html_content;

            let content = w.html_content;
            if (hasTranslation) {
                content = `
                ${w.translated_content}
                <details class="original-text">
                    <summary>Show Original German Text</summary>
                    <div style="margin-top:1rem;">
                        ${w.html_content}
                    </div>
                </details>`;
            }

            const html = generateWeatherPage(w, content);
            try {
                fs.writeFileSync(path.join(weatherOutputDir, `${w.date}.html`), html);
                count++;
            } catch (err) {
                logger.error(`Failed to write weather page for ${w.date}:`, err);
            }
        });
        logger.info(`Generated ${count} weather report pages.`);
    }
    return count;
}

module.exports = { buildWeatherPages };
