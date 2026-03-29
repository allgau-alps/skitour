// update_pois_from_osm.mjs
// Fetch OSM data via Overpass API and merge with existing manual POIs.
// Run: node planning/scripts/update_pois_from_osm.mjs

import { promises as fs } from 'fs';

const BBOX = [47.0, 9.5, 48.0, 11.5]; // south,west,north,east (Allgäu region + buffer)
const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';

const query = `[out:json][timeout:180];
(
  node["natural"="peak"](${BBOX.join(',')});
  node["place"~"town|village|city"](${BBOX.join(',')});
  node["tourism"="alpine_hut"](${BBOX.join(',')});
  node["mountain_pass"="yes"](${BBOX.join(',')});
);
out body;`;

function normalizeName(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

async function main() {
  console.log('Requesting OSM data via Overpass...');
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    body: query,
    headers: { 'Content-Type': 'text/plain' }
  });
  if (!response.ok) {
    throw new Error(`Overpass request failed: ${response.status} ${response.statusText}`);
  }
  const json = await response.json();
  const elements = json.elements || [];
  console.log(`Received ${elements.length} OSM elements.`);

  const osmFeatures = [];
  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;

    let type = null;
    if (tags.natural === 'peak') type = 'peak';
    else if (tags.place && /town|village|city/.test(tags.place)) type = 'town';
    else if (tags.tourism === 'alpine_hut') type = 'hut';
    else if (tags.mountain_pass === 'yes') type = 'pass';
    if (!type) continue;

    let coordinates = null;
    if (typeof el.lat === 'number' && typeof el.lon === 'number') {
      coordinates = [el.lon, el.lat];
    } else if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') {
      coordinates = [el.center.lon, el.center.lat];
    } else {
      continue; // skip if no point geometry
    }

    const ele = tags.ele ? parseFloat(tags.ele) : undefined;
    osmFeatures.push({
      type: 'Feature',
      properties: { name, type, ele, source: 'osm' },
      geometry: { type: 'Point', 'coordinates': coordinates }
    });
  }
  console.log(`Parsed ${osmFeatures.length} features from OSM.`);

  // Load existing POIs
  const existingPath = 'planning/data/pois.json';
  let existing = [];
  try {
    const existingRaw = await fs.readFile(existingPath, 'utf8');
    existing = JSON.parse(existingRaw).features;
  } catch (e) {
    console.warn(`Could not read existing POIs: ${e.message}. Starting fresh.`);
  }

  // Normalize existing names for matching
  const existingByName = new Map();
  for (const f of existing) {
    const norm = normalizeName(f.properties.name);
    if (!existingByName.has(norm)) {
      existingByName.set(norm, []);
    }
    existingByName.get(norm).push(f);
  }

  const merged = [];
  const manualOnly = [];

  // Merge OSM features (authoritative)
  for (const osmF of osmFeatures) {
    const norm = normalizeName(osmF.properties.name);
    const matches = existingByName.get(norm);
    if (matches && matches.length > 0) {
      // OSM takes precedence; consume matching manual entries
      merged.push(osmF);
      existingByName.delete(norm);
    } else {
      merged.push(osmF);
    }
  }

  // Remaining manual entries (no OSM match)
  for (const list of existingByName.values()) {
    for (const manualF of list) {
      merged.push({
        ...manualF,
        properties: { ...manualF.properties, source: 'manual' }
      });
      manualOnly.push(manualF.properties.name);
    }
  }

  // Write merged
  const out = { type: 'FeatureCollection', features: merged };
  await fs.writeFile(existingPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${existingPath} (total ${merged.length} features, ${manualOnly.length} manual-only).`);
  if (manualOnly.length > 0) {
    console.log('Manual-only entries (not in OSM):', manualOnly);
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
