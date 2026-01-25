const fs = require('fs');
const path = require('path');
const { PATHS, REGION_CONFIG } = require('./lib/config');

console.log("💨 Running Smoke Test...");

let errors = [];

function assert(condition, message) {
    if (!condition) {
        console.error(`❌ ${message}`);
        errors.push(message);
    } else {
        console.log(`✅ ${message}`);
    }
}

function checkJson(filePath, label) {
    try {
        if (!fs.existsSync(filePath)) {
            assert(false, `Missing JSON file: ${label} (${filePath})`);
            return;
        }
        const content = fs.readFileSync(filePath, 'utf8');
        JSON.parse(content);
        assert(true, `Valid JSON: ${label}`);
    } catch (e) {
        assert(false, `Corrupt JSON: ${label} - ${e.message}`);
    }
}

// 1. Check Directories
assert(fs.existsSync(PATHS.data), "Data directory exists");
assert(fs.existsSync(PATHS.archive), "Archive directory exists");

// 2. Check Core Data Files
checkJson(PATHS.weatherStations, "Weather Stations");
checkJson(PATHS.incidents, "Incidents");
checkJson(PATHS.weatherArchive, "Weather Reports");

// 3. Check Archive Output
Object.keys(REGION_CONFIG).forEach(regionSlug => {
    const regionDir = path.join(PATHS.archive, regionSlug);
    const indexFile = path.join(regionDir, 'index.html');
    assert(fs.existsSync(indexFile), `Region archive exists: ${regionSlug}`);
});

const mainIndex = path.join(PATHS.archive, 'index.html');
assert(fs.existsSync(mainIndex), "Main index.html exists");

const headersFile = path.join(PATHS.archive, '_headers');
assert(fs.existsSync(headersFile), "_headers exists");

const healthFile = path.join(PATHS.archive, 'health.json');
checkJson(healthFile, "Health Check");

// Summary
console.log("\n--------------------------------");
if (errors.length > 0) {
    console.error(`💥 Smoke Test FAILED with ${errors.length} errors.`);
    process.exit(1);
} else {
    console.log("✨ All Systems Operational. Smoke Test PASSED.");
    process.exit(0);
}
