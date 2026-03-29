// restructure_panel.mjs
// Transforms the planning tool's control panel into collapsible sections: Search, Overlays, GPX.
import { readFile, writeFile } from 'fs';

const path = 'planning/index.html';
const html = await readFile(path, 'utf8');

// Regex to match the three control-section blocks in order.
// We'll replace each <div class="control-section">...</div> with a collapsible wrapper.
function wrapSection(html, title, innerHtml) {
  return `
    <div class="collapsible-section">
      <button class="collapsible-header" aria-expanded="${title === 'Search' ? 'true' : 'false'}">${title}</button>
      <div class="collapsible-content" style="display: ${title === 'Search' ? 'block' : 'none'};">
        <div class="control-section">
          <h3>${title}</h3>
          ${innerHtml}
        </div>
      </div>
    </div>
  `;
}

// We'll parse by splitting at known markers to avoid complex HTML parsing.
// The order is: Search Places, Overlay Layers, GPX Tools.
const sections = [];

// 1. Search Places
const searchStart = html.indexOf('<div class="control-section">\n            <h3>Search Places</h3>');
if (searchStart === -1) throw new Error('Search section not found');
const searchEnd = html.indexOf('</div>', searchStart) + 6; // closing control-section div
const searchContent = html.slice(searchStart, searchEnd);
sections.push({ title: 'Search', content: searchContent });

// 2. Overlay Layers
const overlayStart = html.indexOf('<div class="control-section">\n            <h3>Overlay Layers</h3>', searchEnd);
if (overlayStart === -1) throw new Error('Overlay section not found');
const overlayEnd = html.indexOf('</div>', overlayStart) + 6;
const overlayContent = html.slice(overlayStart, overlayEnd);
sections.push({ title: 'Overlays', content: overlayContent });

// 3. GPX Tools
const gpxStart = html.indexOf('<div class="control-section">\n            <h3>GPX Tools</h3>', overlayEnd);
if (gpxStart === -1) throw new Error('GPX section not found');
const gpxEnd = html.indexOf('</div>', gpxStart) + 6;
const gpxContent = html.slice(gpxStart, gpxEnd);
sections.push({ title: 'GPX', content: gpxContent });

// Build replacement HTML
const before = html.slice(0, searchStart);
const after = html.slice(gpxEnd); // everything after the closing GPX control-section

let replacement = '';
for (const sec of sections) {
  replacement += wrapSection(html, sec.title, sec.content);
}

const newHtml = before + replacement + after;

// Write back
await writeFile(path, newHtml);
console.log(`Restructured panel: ${sections.length} sections collapsed.`);
