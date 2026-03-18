const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config();
const { log } = require('./lib/utils');
const { translateText } = require('./lib/translator');

const OUTPUT_FILE = path.join(__dirname, '../data/weather_archive.json');

// --- Fetching Logic ---

const main = async () => {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        let browser = null;

        try {
            log.info(`Fetching LWD Bayern Weather Report via Puppeteer (attempt ${attempt}/${maxRetries})...`);

            // Launch Puppeteer with improved CI stability settings
            browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-gpu',
                    '--disable-software-rasterizer',
                    '--single-process'
                ]
            });

            const page = await browser.newPage();

            // Set a reasonable viewport
            await page.setViewport({ width: 1280, height: 720 });

            // Set default timeout for all operations
            await page.setDefaultTimeout(30000);

            // Navigate with increased timeout and retry on detachment
            const url = 'https://lawinenwarndienst.bayern.de/webclient/weather-report';
            let navigationSuccess = false;

            for (let navAttempt = 1; navAttempt <= 2; navAttempt++) {
                try {
                    await page.goto(url, {
                        waitUntil: 'networkidle0',
                        timeout: 90000
                    });
                    navigationSuccess = true;
                    break;
                } catch (navError) {
                    if (navError.message.includes('detached') && navAttempt === 1) {
                        log.warn('Frame detached during navigation, retrying in 5s...');
                        await new Promise(r => setTimeout(r, 5000));
                    } else {
                        throw navError;
                    }
                }
            }

            if (!navigationSuccess) {
                throw new Error('Failed to navigate after frame detachment retry');
            }

            // Wait for the content to appear with reasonable timeout
            const selector = '.panel-body.weather-report.lwdb-p';
            try {
                await page.waitForSelector(selector, { timeout: 15000 });
            } catch (e) {
                log.warn('Specific weather report selector not found, trying fallback...');
                // Wait a bit longer for alternative rendering
                await new Promise(r => setTimeout(r, 5000));
            }

            // Extract HTML content
            const content = await page.evaluate(() => {
                const el = document.querySelector('.panel-body.weather-report.lwdb-p') ||
                          document.querySelector('.weather-report') ||
                          document.querySelector('.panel-body');
                return el ? el.outerHTML : null;
            });

            if (!content) {
                log.error('No weather report content found after navigation');
                await browser.close();
                // Continue to next retry instead of returning
                throw new Error('Empty content retrieved');
            }

            // Extract Date for Archiving
            let datePart, timePart;
            const germanDateMatch = content.match(/(\d{2}\.\d{2}\.\d{4}), um (\d{2}\.\d{2}) Uhr/);
            const englishDateMatch = content.match(/(\d{2}\.\d{2}\.\d{4}), at (\d{1,2}\.\d{2}) (a\.m\.|p\.m\.)/);

            let issuedDate;

            if (germanDateMatch) {
                datePart = germanDateMatch[1];
                timePart = germanDateMatch[2];
                const [day, month, year] = datePart.split('.');
                const [hour, minute] = timePart.split('.');
                issuedDate = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);
            } else if (englishDateMatch) {
                datePart = englishDateMatch[1];
                const timeRaw = englishDateMatch[2];
                const ampm = englishDateMatch[3];
                const [day, month, year] = datePart.split('.');
                let [hour, minute] = timeRaw.split('.').map(Number);
                if (ampm === 'p.m.' && hour !== 12) hour += 12;
                if (ampm === 'a.m.' && hour === 12) hour = 0;
                issuedDate = new Date(`${year}-${month}-${day}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`);
            } else {
                log.warn('Could not parse date from content, using current date as fallback');
                issuedDate = new Date();
            }

            log.info(`Report Issued: ${issuedDate.toLocaleString()}`);

            const hour = issuedDate.getHours();
            let targetDate = new Date(issuedDate);
            if (hour >= 14) {
                targetDate.setDate(targetDate.getDate() + 1);
            }
            const targetDateStr = targetDate.toISOString().split('T')[0];
            log.info(`Target Date for Archive: ${targetDateStr}`);

            // Translate with fallback
            log.info('Translating content...');
            let translatedHtml;
            try {
                translatedHtml = await translateText(content, { format: 'html' });
            } catch (transError) {
                log.warn(`Translation failed: ${transError.message}. Using original German content.`);
                translatedHtml = content; // Fallback to original
            }

            // Prepare Entry
            let archive = [];
            if (fs.existsSync(OUTPUT_FILE)) {
                try {
                    archive = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
                } catch (e) {
                    log.warn('Failed to parse existing weather archive, starting fresh');
                    archive = [];
                }
            }

            // Format Issued String
            const dayStr = issuedDate.toLocaleDateString('en-GB', { weekday: 'long' });
            const dateStr = issuedDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
            const timeStr = issuedDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }).replace(':', '.');
            const formattedIssued = `${dayStr}, ${dateStr}, at ${timeStr}`;

            const newEntry = {
                date: targetDateStr,
                title: `Mountain Weather Report (${targetDateStr})`,
                issued: formattedIssued,
                html_content: content,
                translated_content: translatedHtml || content,
                fetched_at: new Date().toISOString()
            };

            const existingIndex = archive.findIndex(a => a.date === targetDateStr);
            if (existingIndex >= 0) {
                log.info(`Updating existing entry for ${targetDateStr}`);
                archive[existingIndex] = newEntry;
            } else {
                log.info(`Creating new entry for ${targetDateStr}`);
                archive.push(newEntry);
                archive.sort((a, b) => b.date.localeCompare(a.date));
            }

            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(archive, null, 2));
            log.info(`Weather archive updated successfully.`);

            await browser.close();
            return; // Success - exit retry loop

        } catch (e) {
            log.error(`Attempt ${attempt}/${maxRetries} failed:`, e.message);

            // Ensure browser is closed on error
            if (browser) {
                try {
                    await browser.close();
                } catch (closeError) {
                    // Ignore close errors
                }
            }

            // If this was the last attempt, throw the error
            if (attempt === maxRetries) {
                log.error('All retry attempts exhausted. Weather fetch failed.');
                throw e;
            }

            // Exponential backoff: 2s, 4s, 8s
            const delay = Math.pow(2, attempt) * 1000;
            log.info(`Retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        }
    }
};

main();
