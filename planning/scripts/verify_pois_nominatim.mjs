// verify_pois_nominatim.mjs
// Rate-limited verification of POI coordinates using OSM Nominatim.
// Corrects entries where offset >100m. Updates pois.json in place.

import { promises as fs } from 'fs';

const EXISTING_PATH = 'planning/data/pois.json';
const USER_AGENT = 'OpenClaw-Skitour-Steward/1.0 (contact: lance)';
const R = 6371e3;

function haversine(lat1, lon1, lat2, lon2) {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const raw = await fs.readFile(EXISTING_PATH, 'utf8');
  const geo = JSON.parse(raw);
  const features = geo.features;

  console.log(`Verifying ${features.length} POIs via Nominatim...`);

  let corrected = 0, unchanged = 0, notFound = 0;

  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const name = f.properties.name;
    const [oldLng, oldLat] = f.geometry.coordinates;

    const query = encodeURIComponent(`${name}, Allgäu`);
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&addressdetails=0`;

    let newLat = oldLat, newLng = oldLng;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.length > 0) {
        const best = data[0];
        newLat = parseFloat(best.lat);
        newLng = parseFloat(best.lon);
      } else {
        console.warn(`[${i + 1}/${features.length}] ${name}: not found in Nominatim`);
        notFound++;
        await delay(1100);
        continue;
      }
    } catch (e) {
      console.error(`[${i + 1}/${features.length}] ${name}: request error ${e.message}`);
      notFound++;
      await delay(1100);
        continue;
    }

    const d = haversine(oldLat, oldLng, newLat, newLng);
    if (d > 100) {
      console.log(`[${i + 1}/${features.length}] ${name}: offset ${Math.round(d)} m → correcting to [${newLng.toFixed(6)}, ${newLat.toFixed(6)}]`);
      f.geometry.coordinates = [newLng, newLat];
      corrected++;
    } else {
      unchanged++;
    }

    // Rate limit: Nominatim asks for ≤1 req/s
    await delay(1100);
  }

  // Write updated file
  await fs.writeFile(EXISTING_PATH, JSON.stringify(geo, null, 2));
  console.log(`Verification complete. Corrected: ${corrected}, Unchanged: ${unchanged}, Not found: ${notFound}.`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
