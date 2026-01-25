const path = require('path');

// Base directories
const TOOLS_DIR = path.resolve(__dirname, '../../tools');
const DATA_DIR = path.resolve(__dirname, '../../data');
const ARCHIVE_DIR = path.resolve(__dirname, '../../archive');
const ROOT_DIR = path.resolve(__dirname, '../..');

// Weather Stations Configuration
const WEATHER_STATIONS = [
    {
        name: 'Hochgrat (1715m) / Hörmoos (1300m)',
        id: '7',
        apiUrl: 'https://api-la-dok.bayern.de/public/weatherWeb/7',
        originalUrl: 'https://lawinenwarndienst.bayern.de/schnee-wetter-bayern/automatische-wetter-schnee-messstation/?weatherid=7',
        lat: 47.493444,
        lon: 10.073861,
        elevation: 1720
    },
    {
        name: 'Fellhorn (1967m)',
        id: '8',
        apiUrl: 'https://api-la-dok.bayern.de/public/weatherWeb/8',
        originalUrl: 'https://lawinenwarndienst.bayern.de/schnee-wetter-bayern/automatische-wetter-schnee-messstation/?weatherid=8',
        lat: 47.340806,
        lon: 10.22425,
        elevation: 1960
    },
    {
        name: 'Nebelhorn (2075m)',
        id: '4',
        apiUrl: 'https://api-la-dok.bayern.de/public/weatherWeb/4',
        originalUrl: 'https://lawinenwarndienst.bayern.de/schnee-wetter-bayern/automatische-wetter-schnee-messstation/?weatherid=4',
        lat: 47.420889,
        lon: 10.351056,
        elevation: 2220
    },
    {
        name: 'Schwarzenberg (1172m)',
        id: '19',
        apiUrl: 'https://api-la-dok.bayern.de/public/weatherWeb/19',
        originalUrl: 'https://lawinenwarndienst.bayern.de/schnee-wetter-bayern/automatische-wetter-schnee-messstation/?weatherid=19',
        lat: 47.427834,
        lon: 10.409694,
        elevation: 1355
    }
];

// Austrian TAWES Stations
const TAWES_STATIONS = [
    { id: '11012', name: 'Warth', lat: 47.2586, lon: 10.1764, elevation: 1478 },
    { id: '11003', name: 'Schoppernau', lat: 47.3117, lon: 10.0197, elevation: 835 },
    { id: '11004', name: 'Schröcken', lat: 47.2583, lon: 10.0917, elevation: 1260 },
    { id: '11010', name: 'Mittelberg', lat: 47.3242, lon: 10.1528, elevation: 1200 },
    { id: '10908', name: 'Reutte', lat: 47.4836, lon: 10.7183, elevation: 850 },
    { id: '10915', name: 'Ehrwald', lat: 47.3983, lon: 10.9189, elevation: 994 },
    { id: '10927', name: 'Tannheim', lat: 47.4994, lon: 10.5186, elevation: 1100 },
    { id: '10904', name: 'Holzgau', lat: 47.2625, lon: 10.3444, elevation: 1113 }
];

// Region Configuration for Bulletins
const REGION_CONFIG = {
    'allgau-prealps': {
        label: 'Allgäu Prealps (Sonthofen)',
        slug: 'allgau-prealps',
        type: 'pdf'
    },
    'allgau-alps-central': {
        label: 'Allgäu Alps Central (Oberstdorf)',
        slug: 'allgau-alps-central',
        type: 'pdf'
    },
    'allgau-alps-west': {
        label: 'Allgäu Alps West (Kleinwalsertal)',
        slug: 'allgau-alps-west',
        type: 'pdf'
    },
    'allgau-alps-east': {
        label: 'Allgäu Alps East (Tannheimer Tal)',
        slug: 'allgau-alps-east',
        type: 'pdf'
    }
};

// Map Region IDs to Slugs
const REGION_PDF_MAP = {
    'DE-BY-11': 'allgau-prealps',
    'DE-BY-12': 'allgau-alps-central',
    'AT-08-01': 'allgau-alps-west', // Kleinwalsertal
    'AT-07-01': 'allgau-alps-east'  // Außerfern (Tannheimer Tal)
};

// Bulletin Sources
const SOURCES = [
    {
        name: 'DE-BY',
        url: (date) => `https://static.avalanche.report/eaws_bulletins/eaws_bulletins/${date}/${date}-DE-BY.json`,
        type: 'lawinen-warnung'
    },
    {
        name: 'AT-08',
        url: (date) => `https://static.avalanche.report/eaws_bulletins/eaws_bulletins/${date}/${date}-AT-08.json`,
        type: 'lawinen-warnung'
    },
    {
        name: 'AT-07',
        url: (date) => `https://static.avalanche.report/eaws_bulletins/eaws_bulletins/${date}/${date}-AT-07.json`,
        type: 'avalanche-report'
    }
];

// File Paths
const PATHS = {
    data: DATA_DIR,
    archive: ARCHIVE_DIR,
    root: ROOT_DIR,
    tools: TOOLS_DIR,

    // Data files
    weatherStations: path.join(DATA_DIR, 'weather_stations.json'),
    incidents: path.join(DATA_DIR, 'incidents.json'),
    recentProfiles: path.join(DATA_DIR, 'recent_profiles.json'),
    historicWeather: path.join(DATA_DIR, 'historic_weather.txt'),
    weatherArchive: path.join(DATA_DIR, 'weather_archive.json'),
    translationCache: path.join(DATA_DIR, 'translation_cache.json'),

    // Directories
    bulletinCache: path.join(DATA_DIR, 'bulletin_cache'),
    pdfs: path.join(DATA_DIR, 'pdfs'),
    incidentBulletins: path.join(DATA_DIR, 'incident_bulletins'),
    incidentImages: path.join(DATA_DIR, 'incident_images'),
    profileImages: path.join(DATA_DIR, 'profile_images')
};

module.exports = {
    WEATHER_STATIONS,
    TAWES_STATIONS,
    REGION_CONFIG,
    REGION_PDF_MAP,
    SOURCES,
    PATHS
};
