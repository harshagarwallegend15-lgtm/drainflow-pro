// ========================================
// DrainFlow Pro — Main Application
// ========================================

let currentPage = null;
let leafletMap = null, mapMarker = null, currentTileLayer = null;

// ============ NAVIGATION ============
function navigateTo(page) {
    if (currentPage === page) return;
    const isInitial = currentPage === null;
    currentPage = page;

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const showPage = () => {
        const pageEl = document.getElementById(`page-${page}`);
        const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
        if (pageEl) pageEl.classList.add('active');
        if (navLink) navLink.classList.add('active');
        const drainCanvas = document.getElementById('drainageFrameCanvas');
        if (drainCanvas) drainCanvas.classList.toggle('active', page === 'home');
        const footer = document.getElementById('siteFooter');
        if (footer) footer.style.display = page === 'home' ? 'block' : 'none';
        if (page === 'cad') setTimeout(() => { CAD.init(); CAD.syncDesignParams(); }, 50);
        if (page === 'viewer3d') setTimeout(() => init3DViewer(), 50);
        if (page === 'results') setTimeout(() => drawAllCharts(), 100);
        if (page === 'ai') setTimeout(() => populateAIContext(), 50);
        if (page === 'signin') setTimeout(() => initAuthUI(), 50);
        if (page === 'home') setTimeout(() => { animateStats(); drawHeroScene(); }, 50);
        if (page === 'map') setTimeout(() => { initLeafletMap(); initMapSearch(); }, 100);
    };

    if (isInitial) {
        showPage();
    } else {
        setTimeout(showPage, 70);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}
function toggleNav() { document.getElementById('navLinks').classList.toggle('open'); }

// ============ HERO ============
function animateStats() {
    document.querySelectorAll('.stat-value[data-count]').forEach(el => {
        const target = parseInt(el.dataset.count); let current = 0;
        const step = target / 125;
        const timer = setInterval(() => { current += step; if (current >= target) { current = target; clearInterval(timer); } el.textContent = Math.round(current); }, 16);
    });
}

function drawHeroScene() {
    const canvas = document.getElementById('heroCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
    let frame = 0;
    let startTime = performance.now();

    // Pipe network layout
    const cx = w / 2, cy = h / 2 + 30;
    const pipes = [
        // Main horizontal trunk
        [{x:cx-145,y:cy+10},{x:cx-70,y:cy-18},{x:cx,y:cy-8},{x:cx+70,y:cy-25},{x:cx+145,y:cy+5}],
        // Branch up-left
        [{x:cx-70,y:cy-18},{x:cx-110,y:cy-65},{x:cx-70,y:cy-90}],
        // Branch up-right
        [{x:cx+70,y:cy-25},{x:cx+105,y:cy-70},{x:cx+60,y:cy-95}],
        // Branch down
        [{x:cx,y:cy-8},{x:cx+20,y:cy+45},{x:cx-10,y:cy+80}],
    ];
    const nodeColors = ['#00f5d4','#7b61ff','#f59e0b','#3b82f6','#ec4899','#00f5d4','#7b61ff'];
    const nodes = [
        {x:cx-145,y:cy+10,c:'#3b82f6'},
        {x:cx-70, y:cy-18,c:'#7b61ff'},
        {x:cx,    y:cy-8, c:'#00f5d4'},
        {x:cx+70, y:cy-25,c:'#f59e0b'},
        {x:cx+145,y:cy+5, c:'#ec4899'},
        {x:cx-110,y:cy-65,c:'#00f5d4'},
        {x:cx-70, y:cy-90,c:'#7b61ff'},
        {x:cx+105,y:cy-70,c:'#00f5d4'},
        {x:cx+60, y:cy-95,c:'#3b82f6'},
        {x:cx+20, y:cy+45,c:'#f59e0b'},
        {x:cx-10, y:cy+80,c:'#ec4899'},
    ];

    function glowLine(x1,y1,x2,y2,color,width,glowSize) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize;
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        ctx.restore();
    }

    function glowCircle(x,y,r,color,glowSize,fillColor) {
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = glowSize;
        ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
        ctx.fillStyle = fillColor || color;
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
    }

    function drawPolyline(pts, color, width, glow) {
        if (pts.length < 2) return;
        ctx.save();
        ctx.shadowColor = color; ctx.shadowBlur = glow;
        ctx.strokeStyle = color; ctx.lineWidth = width;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        ctx.beginPath(); pts.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y));
        ctx.stroke();
        ctx.restore();
    }

    function flowDotOnPipe(pts, progress, color) {
        const totalSegs = pts.length - 1;
        const scaled = progress * totalSegs;
        const seg = Math.min(Math.floor(scaled), totalSegs - 1);
        const t = scaled - seg;
        const px = pts[seg].x + (pts[seg+1].x - pts[seg].x) * t;
        const py = pts[seg].y + (pts[seg+1].y - pts[seg].y) * t;
        glowCircle(px, py, 3.5, color, 14, color);
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);
        const elapsed = (performance.now() - startTime) * 0.001;
        const t = elapsed;

        // ---- Background platform ----
        ctx.save();
        ctx.fillStyle = 'rgba(8,12,26,0.65)';
        const rx = 170, ry = 100;
        ctx.beginPath();
        ctx.ellipse(cx, cy + 40, rx, ry * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // ---- Draw pipes ----
        drawPolyline(pipes[0], 'rgba(0,245,212,0.75)', 2.5, 12);
        drawPolyline(pipes[1], 'rgba(123,97,255,0.65)', 2,   10);
        drawPolyline(pipes[2], 'rgba(59,130,246,0.65)',  2,   10);
        drawPolyline(pipes[3], 'rgba(0,245,212,0.55)',   1.8, 8);

        // ---- Animated flow dots (5 dots across the network) ----
        const sp = 0.18; // flow speed
        flowDotOnPipe(pipes[0], (t * sp) % 1, '#00f5d4');
        flowDotOnPipe(pipes[0], ((t * sp) + 0.4) % 1, '#00f5d4');
        flowDotOnPipe(pipes[1], (t * sp * 1.3) % 1, '#7b61ff');
        flowDotOnPipe(pipes[2], (t * sp * 1.1 + 0.5) % 1, '#3b82f6');
        flowDotOnPipe(pipes[3], (t * sp * 0.9 + 0.2) % 1, '#00f5d4');

        // ---- Nodes ----
        nodes.forEach((n, i) => {
            const bob = Math.sin(t * 1.8 + i * 0.7) * 2.5;
            const pulse = 1 + 0.12 * Math.sin(t * 2.5 + i * 1.1);
            // Outer ring pulse
            ctx.save();
            ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2 + i);
            glowCircle(n.x, n.y + bob, 11 * pulse, n.c, 0, 'transparent');
            ctx.restore();
            // Core node
            glowCircle(n.x, n.y + bob, 6, n.c, 16, n.c + 'cc');
        });

        // ---- Label — positioned inside the canvas box, not above it ----
        ctx.save();
        ctx.globalAlpha = 0.42 + 0.1 * Math.sin(t * 0.8);
        ctx.fillStyle = 'rgba(0,245,212,0.88)';
        ctx.font = 'bold 10px "Outfit", "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '2px';
        ctx.shadowColor = '#00f5d4'; ctx.shadowBlur = 10;
        // Positioned at top-centre of the canvas (not above it)
        ctx.fillText('DRAINAGE NETWORK', cx, 22);
        ctx.restore();

        // ---- Subtle data readouts ----
        const labels = [
            {x:cx-100, y:cy-30, text:'Q=0.42m³/s'},
            {x:cx+85,  y:cy-45, text:'v=1.8m/s'},
            {x:cx-15,  y:cy+105, text:'Ø300mm'},
        ];
        labels.forEach((l, i) => {
            const fade = 0.5 + 0.3 * Math.sin(t * 1.2 + i * 2.1);
            ctx.save();
            ctx.globalAlpha = fade;
            ctx.fillStyle = 'rgba(232,234,237,0.8)';
            ctx.font = '9px "JetBrains Mono","Fira Code",monospace';
            ctx.textAlign = 'center';
            ctx.fillText(l.text, l.x, l.y);
            ctx.restore();
        });

        frame++;
        requestAnimationFrame(draw);
    }
    draw();
}

// ============ LEAFLET MAP ============
const tileLayers = {
    street: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    terrain: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
};

function initLeafletMap() {
    if (leafletMap) { leafletMap.invalidateSize(); return; }
    leafletMap = L.map('leafletMap', { zoomControl: true }).setView([28.6139, 77.2090], 5);
    currentTileLayer = L.tileLayer(tileLayers.dark, { attribution: '&copy; CartoDB', maxZoom: 19 }).addTo(leafletMap);
    leafletMap.on('click', onMapClick);
    setTimeout(() => leafletMap.invalidateSize(), 200);
}

function setMapLayer(type) {
    document.querySelectorAll('.map-tool-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    if (currentTileLayer) leafletMap.removeLayer(currentTileLayer);
    const attrs = { street:'&copy; OSM', satellite:'&copy; Esri', terrain:'&copy; OpenTopoMap', dark:'&copy; CartoDB' };
    currentTileLayer = L.tileLayer(tileLayers[type], { attribution: attrs[type], maxZoom: 19 }).addTo(leafletMap);
}

// ============ MAP SEARCH ============
let searchDebounceTimer = null;
let mapSearchInitialized = false;

function initMapSearch() {
    const input = document.getElementById('mapSearchInput');
    if (!input || mapSearchInitialized) return;
    mapSearchInitialized = true;
    input.addEventListener('input', handleSearchInput);
    input.addEventListener('keydown', handleSearchKeydown);
    document.addEventListener('click', (e) => {
        const suggestions = document.getElementById('mapSearchSuggestions');
        if (suggestions && !e.target.closest('.map-search-wrapper')) {
            suggestions.style.display = 'none';
        }
    });
}

async function handleSearchInput(e) {
    const query = e.target.value.trim();
    const suggestionsEl = document.getElementById('mapSearchSuggestions');
    if (query.length < 2) {
        suggestionsEl.style.display = 'none';
        return;
    }
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => fetchSuggestions(query), 300);
}

function handleSearchKeydown(e) {
    if (e.key === 'Enter') {
        e.preventDefault();
        searchLocation();
    } else if (e.key === 'Escape') {
        document.getElementById('mapSearchSuggestions').style.display = 'none';
    }
}

function normalizeSearchText(value) {
    return String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^\w\s,.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseCoordinateQuery(query) {
    const match = String(query || '').trim().match(/^(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)$/);
    if (!match) return null;
    const lat = parseFloat(match[1]);
    const lon = parseFloat(match[2]);
    if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
    return { lat, lon };
}

function buildSearchLabel(primary, secondary) {
    return [primary, secondary ? secondary.split(',').slice(-1)[0].trim() : ''].filter(Boolean).join(', ');
}

function createSearchCandidate(data) {
    return {
        lat: parseFloat(data.lat),
        lon: parseFloat(data.lon),
        primaryName: data.primaryName,
        secondaryText: data.secondaryText,
        displayName: data.displayName,
        population: data.population || 0,
        importance: data.importance || 0,
        featureType: data.featureType || '',
        searchLabel: buildSearchLabel(data.primaryName, data.secondaryText)
    };
}

function transformOpenMeteoResult(result) {
    const secondary = [result.admin4, result.admin3, result.admin2, result.admin1, result.country]
        .filter(Boolean)
        .filter((part, index, parts) => parts.indexOf(part) === index)
        .join(', ');
    return createSearchCandidate({
        lat: result.latitude,
        lon: result.longitude,
        primaryName: result.name,
        secondaryText: secondary,
        displayName: [result.name, secondary].filter(Boolean).join(', '),
        population: result.population || 0,
        importance: result.feature_code === 'PPLC' ? 1 : 0.65,
        featureType: result.feature_code || 'settlement'
    });
}

function transformNominatimResult(result) {
    const addr = result.address || {};
    const primaryName = result.namedetails?.name
        || result.name
        || addr.city
        || addr.town
        || addr.village
        || addr.hamlet
        || addr.county
        || addr.state
        || result.display_name.split(',')[0];
    const secondary = [
        addr.suburb,
        addr.city || addr.town || addr.village,
        addr.county,
        addr.state,
        addr.country
    ]
        .filter(Boolean)
        .filter((part, index, parts) => parts.indexOf(part) === index && part !== primaryName)
        .join(', ');

    return createSearchCandidate({
        lat: result.lat,
        lon: result.lon,
        primaryName,
        secondaryText: secondary,
        displayName: result.display_name,
        population: parseInt(result.extratags?.population || '0', 10) || 0,
        importance: Number(result.importance) || 0,
        featureType: result.type || result.addresstype || result.category || ''
    });
}

function scoreSearchCandidate(candidate, query) {
    const normalizedQuery = normalizeSearchText(query);
    const primary = normalizeSearchText(candidate.primaryName);
    const secondary = normalizeSearchText(candidate.secondaryText);
    const feature = String(candidate.featureType || '').toLowerCase();
    let score = 0;

    if (primary === normalizedQuery) score += 120;
    else if (primary.startsWith(normalizedQuery)) score += 70;
    else if (primary.includes(normalizedQuery)) score += 40;

    if (secondary.includes(normalizedQuery)) score += 18;

    normalizedQuery.split(' ').filter(Boolean).forEach(token => {
        if (primary.includes(token)) score += 10;
        else if (secondary.includes(token)) score += 4;
        else score -= 4;
    });

    if (/pplc|ppla|city|town|village|settlement|administrative/.test(feature)) score += 12;
    score += Math.min((candidate.importance || 0) * 35, 35);
    score += Math.min(Math.log10((candidate.population || 0) + 1) * 6, 30);

    return score;
}

function dedupeSearchCandidates(candidates) {
    const seen = new Set();
    return candidates.filter(candidate => {
        const key = `${candidate.lat.toFixed(4)}|${candidate.lon.toFixed(4)}|${normalizeSearchText(candidate.primaryName)}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function fetchJson(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) throw new Error(`Request failed with ${response.status}`);
        return await response.json();
    } finally {
        clearTimeout(timer);
    }
}

async function fetchLocationCandidates(query) {
    const encoded = encodeURIComponent(query);
    const [geoData, nominatimData] = await Promise.all([
        fetchJson(`https://geocoding-api.open-meteo.com/v1/search?name=${encoded}&count=5&language=en&format=json`, 9000)
            .catch(() => ({ results: [] })),
        fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encoded}&limit=5&addressdetails=1&namedetails=1&extratags=1&accept-language=en`, 9000)
            .catch(() => [])
    ]);

    const openMeteoResults = (geoData.results || []).map(transformOpenMeteoResult);
    const nominatimResults = (Array.isArray(nominatimData) ? nominatimData : []).map(transformNominatimResult);

    return dedupeSearchCandidates([...openMeteoResults, ...nominatimResults])
        .sort((a, b) => scoreSearchCandidate(b, query) - scoreSearchCandidate(a, query))
        .slice(0, 6);
}

function renderSearchSuggestions(results) {
    const suggestionsEl = document.getElementById('mapSearchSuggestions');
    if (!suggestionsEl) return;

    if (!results.length) {
        suggestionsEl.innerHTML = '<div class="suggestion-item no-results">No matching places found</div>';
        suggestionsEl.style.display = 'block';
        return;
    }

    suggestionsEl.innerHTML = results.map((result, i) => `
        <div class="suggestion-item" data-index="${i}">
            <span class="suggestion-icon">📍</span>
            <span class="suggestion-text"><strong>${escapeHtml(result.primaryName)}</strong><br>${escapeHtml(result.secondaryText || result.displayName)}</span>
        </div>
    `).join('');
    suggestionsEl.querySelectorAll('.suggestion-item[data-index]').forEach(item => {
        item.addEventListener('click', () => selectSuggestion(item));
    });
    suggestionsEl.style.display = 'block';
}

function focusMapLocation(lat, lon, label) {
    if (!leafletMap) initLeafletMap();
    leafletMap.setView([lat, lon], 14);
    simulateMapClick(lat, lon, label);
}

async function fetchSuggestions(query) {
    const coordinateMatch = parseCoordinateQuery(query);
    if (coordinateMatch) {
        window._searchResults = [{
            lat: coordinateMatch.lat,
            lon: coordinateMatch.lon,
            primaryName: 'Coordinates',
            secondaryText: `${coordinateMatch.lat.toFixed(4)}, ${coordinateMatch.lon.toFixed(4)}`,
            displayName: `${coordinateMatch.lat.toFixed(4)}, ${coordinateMatch.lon.toFixed(4)}`,
            searchLabel: `${coordinateMatch.lat.toFixed(4)}, ${coordinateMatch.lon.toFixed(4)}`
        }];
        renderSearchSuggestions(window._searchResults);
        return;
    }

    try {
        window._searchResults = await fetchLocationCandidates(query);
        renderSearchSuggestions(window._searchResults);
    } catch (err) {
        const suggestionsEl = document.getElementById('mapSearchSuggestions');
        suggestionsEl.innerHTML = '<div class="suggestion-item no-results">Search service unavailable</div>';
        suggestionsEl.style.display = 'block';
    }
}

function selectSuggestion(item) {
    const result = (window._searchResults || [])[parseInt(item.dataset.index, 10)];
    if (!result) return;
    document.getElementById('mapSearchInput').value = result.searchLabel || result.primaryName;
    document.getElementById('mapSearchSuggestions').style.display = 'none';
    focusMapLocation(result.lat, result.lon, result.displayName);
}

async function searchLocation() {
    const input = document.getElementById('mapSearchInput');
    const query = input.value.trim();
    if (!query) return;

    const coordinateMatch = parseCoordinateQuery(query);
    if (coordinateMatch) {
        document.getElementById('mapSearchSuggestions').style.display = 'none';
        focusMapLocation(coordinateMatch.lat, coordinateMatch.lon, `${coordinateMatch.lat.toFixed(4)}, ${coordinateMatch.lon.toFixed(4)}`);
        return;
    }

    try {
        const results = await fetchLocationCandidates(query);
        if (results.length > 0) {
            const topResult = results[0];
            focusMapLocation(topResult.lat, topResult.lon, topResult.displayName);
        }
        document.getElementById('mapSearchSuggestions').style.display = 'none';
    } catch (err) {
        console.error('Search error:', err);
    }
}

function simulateMapClick(lat, lng, address) {
    if (mapMarker) leafletMap.removeLayer(mapMarker);
    mapMarker = L.circleMarker([lat, lng], { radius: 8, color: '#00f5d4', fillColor: '#00f5d4', fillOpacity: 0.6, weight: 2 }).addTo(leafletMap);
    onMapClick({ latlng: { lat, lng }, displayName: address });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function buildLocationTitle(data, fallback) {
    const addr = data?.address || {};
    const locality = addr.city || addr.town || addr.village || addr.hamlet || addr.suburb || addr.county;
    const parts = [locality, addr.state, addr.country]
        .filter(Boolean)
        .filter((part, index, partsList) => partsList.indexOf(part) === index);
    return parts.join(', ') || fallback || 'Unknown location';
}

function toRadians(value) {
    return value * (Math.PI / 180);
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
    const earthRadius = 6371000;
    const dLat = toRadians(lat2 - lat1);
    const dLon = toRadians(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function buildElevationSamplingGrid(lat, lng) {
    const offsets = [-0.015, -0.012, -0.009, -0.006, -0.003, 0, 0.003, 0.006, 0.009, 0.012, 0.015];
    const points = [];

    offsets.forEach(offset => points.push({ lat, lng: lng + offset, axis: 'ew' }));
    offsets.forEach(offset => points.push({ lat: lat + offset, lng, axis: 'ns' }));

    return { points, centerIndex: Math.floor(offsets.length / 2) };
}

function deriveTerrainData(lat, lng, elevations, samplingGrid) {
    const splitIndex = samplingGrid.centerIndex * 2 + 1;
    const eastWestProfile = elevations.slice(0, splitIndex);
    const northSouthProfile = elevations.slice(splitIndex);
    const centerElevation = eastWestProfile[samplingGrid.centerIndex] ?? northSouthProfile[samplingGrid.centerIndex] ?? 0;
    let maxSlopePct = 0;

    samplingGrid.points.forEach((point, index) => {
        const elevation = elevations[index];
        if (!Number.isFinite(elevation)) return;
        const distanceM = haversineDistanceMeters(lat, lng, point.lat, point.lng);
        if (distanceM <= 0) return;
        const slopePct = Math.abs((elevation - centerElevation) / distanceM) * 100;
        maxSlopePct = Math.max(maxSlopePct, slopePct);
    });

    return {
        mainElev: Number.isFinite(centerElevation) ? centerElevation : 0,
        slope: maxSlopePct.toFixed(1),
        profileElevs: eastWestProfile.filter(v => Number.isFinite(v))
    };
}

function sumNumbers(values) {
    return (values || []).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function averageNumbers(values) {
    if (!values || !values.length) return 0;
    return sumNumbers(values) / values.length;
}

function getSoilLayerValue(data, layerName, depthLabel = null) {
    const layer = data?.properties?.layers?.find(entry => entry.name === layerName);
    if (!layer?.depths?.length) return null;

    const depths = depthLabel
        ? layer.depths.filter(entry => entry.label === depthLabel)
        : layer.depths;

    const factor = layer.unit_measure?.d_factor || 1;
    const values = depths
        .map(entry => entry.values?.mean)
        .filter(value => Number.isFinite(value))
        .map(value => value / factor);

    if (!values.length) return null;
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeTexturePercentages(clay, sand, silt) {
    if (![clay, sand, silt].every(Number.isFinite)) return null;
    const total = clay + sand + silt;
    if (total <= 0) return null;
    return {
        clay: (clay / total) * 100,
        sand: (sand / total) * 100,
        silt: (silt / total) * 100
    };
}

function classifySoilTexture(clay, sand, silt) {
    const texture = normalizeTexturePercentages(clay, sand, silt);
    if (!texture) return null;

    const { clay: c, sand: s, silt: si } = texture;
    if (s >= 85 && c <= 10) return 'Sand';
    if (s >= 70 && c <= 15 && si + 1.5 * c <= 30) return 'Loamy Sand';
    if (c >= 40 && s >= 45) return 'Sandy Clay';
    if (c >= 40 && si >= 40) return 'Silty Clay';
    if (c >= 40) return 'Clay';
    if (c >= 27 && s >= 45) return 'Sandy Clay Loam';
    if (c >= 27 && si >= 40) return 'Silty Clay Loam';
    if (c >= 27) return 'Clay Loam';
    if (s >= 52 && c < 20) return 'Sandy Loam';
    if (s >= 43 && c < 20 && si < 50) return 'Sandy Loam';
    if (si >= 50 && c >= 12 && c < 27) return 'Silt Loam';
    if (si >= 80 && c < 12) return 'Silt';
    if (c >= 7 && c < 27 && si >= 28 && s >= 23 && s <= 52) return 'Loam';
    if (si >= 50) return 'Silt Loam';
    return 'Loam';
}

function mapUsdaToRunoff(usdaClass) {
    const label = String(usdaClass || '').toLowerCase();
    if (label.includes('gravel')) return 'gravel';
    if (label === 'sand' || label === 'loamy sand') return 'sand';
    if (label.includes('clay')) return 'clay';
    if (label === 'silt') return 'loam';
    return 'loam';
}

function mapWrbToRunoff(wrbClass) {
    const wrb = String(wrbClass || '').toLowerCase();
    if (['arenosols', 'regosols'].includes(wrb)) return 'sand';
    if (['leptosols', 'gypsisols'].includes(wrb)) return 'gravel';
    if (['vertisols', 'solonetz', 'solonchaks', 'gleysols', 'planosols', 'albeluvisols'].includes(wrb)) return 'clay';
    if (['ferralsols', 'nitisols', 'acrisols', 'luvisols', 'cambisols', 'fluvisols', 'chernozems', 'kastanozems', 'calcisols', 'podzols', 'histosols', 'andosols'].includes(wrb)) return 'loam';
    return 'loam';
}

function mapWrbToLabel(wrbClass) {
    const runoff = mapWrbToRunoff(wrbClass);
    const labels = { clay: 'Clay', sand: 'Sand', gravel: 'Gravel', loam: 'Loam' };
    return labels[runoff] || 'Loam';
}

function buildSoilSamplingOffsets() {
    return [
        [0, 0],
        [0.012, 0],
        [-0.012, 0],
        [0, 0.012],
        [0, -0.012],
        [0.008, 0.008],
        [-0.008, -0.008]
    ];
}

async function fetchSoilClassification(lat, lng) {
    try {
        const data = await fetchJson(`https://rest.isric.org/soilgrids/v2.0/classification/query?lon=${lng}&lat=${lat}`, 9000);
        if (!data?.wrb_class_name) return null;
        return {
            wrb: data.wrb_class_name,
            probability: data.wrb_class_probability || []
        };
    } catch (err) {
        console.warn('Soil classification API unavailable:', err);
        return null;
    }
}

async function fetchSoilTextureAtPoint(lat, lng) {
    const url = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lng}&lat=${lat}&property=clay&property=sand&property=silt&property=cfvo&depth=0-5cm&depth=5-15cm&depth=15-30cm&depth=30-60cm&value=mean`;
    const soilData = await fetchJson(url, 9000);
    const clay = getSoilLayerValue(soilData, 'clay');
    const sand = getSoilLayerValue(soilData, 'sand');
    const silt = getSoilLayerValue(soilData, 'silt');
    const cfvo = getSoilLayerValue(soilData, 'cfvo');
    if (![clay, sand, silt].every(Number.isFinite)) return null;
    return { clay, sand, silt, cfvo, source: 'soilgrids-texture' };
}

async function fetchSoilTextureWithSampling(lat, lng) {
    const direct = await fetchSoilTextureAtPoint(lat, lng);
    if (direct) return direct;

    const offsets = buildSoilSamplingOffsets().filter(([dLat, dLng]) => dLat !== 0 || dLng !== 0);
    const samples = await Promise.all(
        offsets.slice(0, 4).map(([dLat, dLng]) => fetchSoilTextureAtPoint(lat + dLat, lng + dLng))
    );
    const valid = samples.filter(Boolean);
    if (!valid.length) return null;

    const avg = key => valid.reduce((sum, sample) => sum + sample[key], 0) / valid.length;
    return {
        clay: avg('clay'),
        sand: avg('sand'),
        silt: avg('silt'),
        cfvo: valid.some(sample => Number.isFinite(sample.cfvo)) ? avg('cfvo') : null,
        source: 'soilgrids-nearby'
    };
}

function buildSoilLabels(texture, classification) {
    if (texture?.cfvo >= 35) {
        const display = classification?.wrb ? `Gravelly · ${classification.wrb}` : 'Gravelly Soil';
        return { display, detail: display };
    }

    if (texture && [texture.clay, texture.sand, texture.silt].every(Number.isFinite)) {
        const usda = classifySoilTexture(texture.clay, texture.sand, texture.silt);
        const pct = `${texture.clay.toFixed(0)}% clay · ${texture.sand.toFixed(0)}% sand · ${texture.silt.toFixed(0)}% silt`;
        const display = classification?.wrb ? `${usda} · ${classification.wrb}` : usda;
        return { display, detail: `${display} — ${pct}` };
    }

    if (classification?.wrb) {
        const label = mapWrbToLabel(classification.wrb);
        const topProb = classification.probability?.[0];
        const probText = topProb ? ` (${topProb[1]}%)` : '';
        return {
            display: `${label} · ${classification.wrb}`,
            detail: `${label} (${classification.wrb}${probText})`
        };
    }

    return { display: 'Loam (estimated)', detail: 'Loam (estimated)' };
}

function resolveRunoffType(texture, classification) {
    if (texture?.cfvo >= 35) return 'gravel';

    if (texture && [texture.clay, texture.sand, texture.silt].every(Number.isFinite)) {
        const usda = classifySoilTexture(texture.clay, texture.sand, texture.silt);
        const textureRunoff = mapUsdaToRunoff(usda);
        if (!classification?.wrb) return textureRunoff;

        const wrbRunoff = mapWrbToRunoff(classification.wrb);
        if (textureRunoff === wrbRunoff) return textureRunoff;
        if (wrbRunoff === 'clay' || textureRunoff === 'clay') return 'clay';
        if (wrbRunoff === 'sand' || textureRunoff === 'sand') return 'sand';
        return textureRunoff;
    }

    if (classification?.wrb) return mapWrbToRunoff(classification.wrb);
    return 'loam';
}

function estimateSoilFromCoordinates(lat, lng) {
    const absLat = Math.abs(lat);

    // Major desert regions
    if (lat > 15 && lat < 35 && lng > -18 && lng < 35) // Sahara
        return { label: 'Sand — Sahara arid desert', displayLabel: 'Sand · Arid Desert', runoffType: 'sand' };
    if (lat > 12 && lat < 32 && lng > 35 && lng < 60) // Arabian
        return { label: 'Sand — Arabian arid desert', displayLabel: 'Sand · Arid Desert', runoffType: 'sand' };
    if (lat > 40 && lat < 50 && lng > 75 && lng < 120) // Gobi / Central Asia
        return { label: 'Sandy Loam — cold desert steppe', displayLabel: 'Sandy Loam · Cold Desert', runoffType: 'sand' };
    if (lat > -40 && lat < -22 && lng > 113 && lng < 155) // Australia
        return { label: 'Sand — Australian outback', displayLabel: 'Sand · Arid Outback', runoffType: 'sand' };
    if (lat > -30 && lat < -22 && lng > 14 && lng < 30) // Kalahari
        return { label: 'Sand — Kalahari semi-desert', displayLabel: 'Sand · Semi-Desert', runoffType: 'sand' };
    if (lat > 25 && lat < 42 && lng > -125 && lng < -98) // SW North America (Sonoran, Mojave)
        return { label: 'Sandy Loam — arid SW North America', displayLabel: 'Sandy Loam · Arid', runoffType: 'sand' };

    // Tropical rainforest basins — highly weathered clay
    if (lat > -20 && lat < 10 && lng > -82 && lng < -40) // Amazon
        return { label: 'Clay — Amazon rainforest', displayLabel: 'Clay · Tropical Rainforest', runoffType: 'clay', clay: 60, sand: 15, silt: 25 };
    if (lat > -12 && lat < 10 && lng > 8 && lng < 35) // Congo
        return { label: 'Clay — Congo rainforest', displayLabel: 'Clay · Tropical Rainforest', runoffType: 'clay', clay: 55, sand: 18, silt: 27 };
    if (lat > -12 && lat < 22 && lng > 95 && lng < 145) // SE Asia / Indonesia
        return { label: 'Clay — Southeast Asia tropical', displayLabel: 'Clay · Tropical Monsoon', runoffType: 'clay', clay: 50, sand: 20, silt: 30 };
    if (lat > 6 && lat < 30 && lng > 68 && lng < 92) // Indian subcontinent
        return { label: 'Clay — Vertisols (black cotton soil)', displayLabel: 'Clay · Vertisols', runoffType: 'clay', clay: 55, sand: 20, silt: 25 };

    // Temperate regions by latitude band
    if (absLat < 15) // Equatorial / tropical
        return { label: 'Clay Loam — equatorial zone', displayLabel: 'Clay Loam · Equatorial', runoffType: 'clay' };
    if (absLat < 35) // Subtropical / transition
        return { label: 'Sandy Loam — subtropical zone', displayLabel: 'Sandy Loam · Subtropical', runoffType: 'loam' };
    if (absLat < 50) // Temperate
        return { label: 'Loam — temperate zone', displayLabel: 'Loam · Temperate', runoffType: 'loam' };
    // Boreal / Arctic
    return { label: 'Silt Loam — boreal zone', displayLabel: 'Silt Loam · Boreal', runoffType: 'loam' };
}

// Groq API helper — tries backend proxy first, falls back to direct API call
async function callGroq(messages, apiKey, options = {}) {
    const model = options.model || 'llama-3.3-70b-versatile';

    // Try backend proxy first (served from same origin)
    try {
        const body = { messages, options: { model, maxTokens: options.maxTokens || 800, temperature: options.temperature ?? 0.7 } };
        if (apiKey) body.clientKey = apiKey;
        const proxyRes = await fetch('/api/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (proxyRes.ok) {
            const proxyData = await proxyRes.json();
            if (proxyData.content) return proxyData.content;
        }
    } catch (e) {
        // Backend proxy unavailable — fall through to direct call
    }

    // Fallback: direct Groq API call (requires apiKey)
    if (!apiKey) throw new Error('No API key available. Set GROQ_API_KEY in .env or provide a key in the AI panel.');
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
            model,
            messages,
            max_tokens: options.maxTokens || 800,
            temperature: options.temperature ?? 0.7
        })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `HTTP ${res.status}`);
    return data?.choices?.[0]?.message?.content || '';
}

async function fetchSoilFromAI(lat, lng, locationName, apiKey) {
    const prompt = `You are a soil scientist. For the location "${locationName}" at latitude ${lat}, longitude ${lng}, identify the most likely soil type.
Respond with ONLY a JSON object, no other text:
{"soilType": "Clay|Loam|Sand|Silt Loam|Sandy Loam|Clay Loam|Silty Clay", "runoffType": "clay|loam|sand|gravel", "wrbClass": "optional WRB classification", "clayPct": <number>, "sandPct": <number>, "siltPct": <number>}
Base your answer on the known climate zone, major soil order maps, and geographic region of this location.`;
    try {
        const text = await callGroq([{ role: 'user', content: prompt }], apiKey, { maxTokens: 200, temperature: 0.1 });
        if (!text) return null;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) return null;
        const parsed = JSON.parse(jsonMatch[0]);
        return {
            label: `${parsed.soilType} — AI estimated`,
            displayLabel: parsed.soilType + (parsed.wrbClass ? ` · ${parsed.wrbClass}` : ''),
            runoffType: parsed.runoffType || 'loam',
            source: 'ai-estimate',
            wrb: parsed.wrbClass || null,
            clay: parsed.clayPct ?? null,
            sand: parsed.sandPct ?? null,
            silt: parsed.siltPct ?? null
        };
    } catch (err) {
        console.warn('AI soil lookup failed:', err);
        return null;
    }
}

async function fetchSoilType(lat, lng) {
    try {
        const [classification, texture] = await Promise.all([
            fetchSoilClassification(lat, lng),
            fetchSoilTextureWithSampling(lat, lng)
        ]);

        if (texture || classification) {
            const runoffType = resolveRunoffType(texture, classification);
            const labels = buildSoilLabels(texture, classification);
            const source = texture?.source || (classification ? 'soilgrids-wrb' : 'fallback');
            return {
                label: labels.detail,
                displayLabel: labels.display,
                runoffType,
                source,
                wrb: classification?.wrb || null,
                clay: texture?.clay ?? null,
                sand: texture?.sand ?? null,
                silt: texture?.silt ?? null
            };
        }
    } catch (err) {
        console.warn('Soil API unavailable:', err);
    }

    // Fallback to coordinate-based estimation
    return { ...estimateSoilFromCoordinates(lat, lng), source: 'coordinates-estimate' };
}

function extractBaseSoilType(soilLabel) {
    const label = String(soilLabel || '').toLowerCase();
    if (label.includes('gravel')) return 'Gravel';
    if (label.includes('clay')) return 'Clay';
    if (label.includes('sand')) return 'Sand';
    if (label.includes('silt')) return 'Silt';
    return 'Loam';
}

async function onMapClick(e) {
    const { lat, lng } = e.latlng;
    if (mapMarker) leafletMap.removeLayer(mapMarker);
    mapMarker = L.circleMarker([lat, lng], { radius: 8, color: '#00f5d4', fillColor: '#00f5d4', fillOpacity: 0.6, weight: 2 }).addTo(leafletMap);
    
    // Set loading state
    document.getElementById('mapAddr').innerHTML = '<span class="pin-pulse" style="position:relative;display:inline-block;width:8px;height:8px;bottom:0;transform:none;"></span> Checking location...';
    
    try {
        const samplingGrid = buildElevationSamplingGrid(lat, lng);
        const startDate = new Date(Date.now() - (365 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
        const endDate = new Date(Date.now() - (24 * 60 * 60 * 1000)).toISOString().slice(0, 10);

        const [locationData, weatherData, climateHistory, elevationData, soilData] = await Promise.all([
            fetchJson(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&zoom=18&addressdetails=1&namedetails=1&extratags=1&accept-language=en`, 9000),
            fetchJson(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m&daily=precipitation_sum,precipitation_hours,temperature_2m_max,temperature_2m_min,wind_speed_10m_max&forecast_days=7&timezone=auto`, 9000),
            fetchJson(`https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lng}&daily=precipitation_sum,temperature_2m_mean,wind_speed_10m_max&timezone=auto&start_date=${startDate}&end_date=${endDate}`, 12000),
            fetchJson(`https://api.open-meteo.com/v1/elevation?latitude=${samplingGrid.points.map(point => point.lat).join(',')}&longitude=${samplingGrid.points.map(point => point.lng).join(',')}`, 9000),
            fetchSoilType(lat, lng)
        ]);
        
        if (locationData.error && locationData.error === "Unable to geocode") {
            // It's likely an ocean
            document.getElementById('mapLat').textContent = lat.toFixed(4) + '°';
            document.getElementById('mapLng').textContent = lng.toFixed(4) + '°';
            document.getElementById('mapAddr').innerHTML = '<span style="color:#ef4444">⚠️ Ocean Location Detected</span>';
            const clearFields = ['mapElev','mapSlope','mapSoil','mapRain','mapTemp','mapHumidity','mapWind'];
            clearFields.forEach(id => document.getElementById(id).textContent = '—');
            window._mapData = null;
            
            const c = document.getElementById('elevProfileMini');
            const ctx = c.getContext('2d');
            ctx.clearRect(0, 0, c.width, c.height);
            ctx.fillStyle = 'rgba(239, 68, 68, 0.2)';
            ctx.font = '12px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('No elevation data in ocean', c.width/4, c.height/4);
            return;
        }
        
        const terrain = deriveTerrainData(lat, lng, elevationData.elevation || [], samplingGrid);
        const weather = weatherData.current || { temperature_2m: '--', relative_humidity_2m: '--', wind_speed_10m: '--' };
        const rainfallLastYear = Math.round(sumNumbers(climateHistory.daily?.precipitation_sum));
        const averageTemp = averageNumbers(climateHistory.daily?.temperature_2m_mean);
        const averageWind = averageNumbers(climateHistory.daily?.wind_speed_10m_max);
        const address = buildLocationTitle(locationData, e.displayName || `${lat.toFixed(2)}, ${lng.toFixed(2)}`);
        
        document.getElementById('mapLat').textContent = lat.toFixed(4) + '°';
        document.getElementById('mapLng').textContent = lng.toFixed(4) + '°';
        document.getElementById('mapAddr').textContent = address;
        
        document.getElementById('mapElev').textContent = (terrain.mainElev || 0).toFixed(1) + ' m';
        document.getElementById('mapSlope').textContent = terrain.slope + '%';
        document.getElementById('mapSoil').textContent = soilData.displayLabel || soilData.label;
        document.getElementById('mapSoil').title = soilData.label;
        document.getElementById('mapRain').textContent = rainfallLastYear + ' mm/yr';
        
        document.getElementById('mapTemp').textContent = weather.temperature_2m + '°C';
        document.getElementById('mapHumidity').textContent = weather.relative_humidity_2m + '%';
        document.getElementById('mapWind').textContent = weather.wind_speed_10m + ' km/h';

        window._mapData = {
            lat,
            lng,
            address,
            elev: terrain.mainElev,
            slope: terrain.slope,
            soil: soilData.label,
            soilRunoff: soilData.runoffType,
            soilClay: soilData.clay,
            soilSand: soilData.sand,
            soilSilt: soilData.silt,
            soilWrb: soilData.wrb,
            rain: rainfallLastYear,
            temp: weather.temperature_2m,
            humidity: weather.relative_humidity_2m,
            wind: weather.wind_speed_10m,
            annualRainSource: 'Last 365 days',
            avgTemp: averageTemp,
            avgWind: averageWind,
            soilSource: soilData.source,
            timezone: weatherData.timezone || climateHistory.timezone || 'UTC',
            profile: terrain.profileElevs
        };
        window._mapProfileData = terrain.profileElevs;
        
        drawElevProfileMini();

        // --- Soil refinement via Groq AI (when ISRIC fails and API key present) ---
        if (soilData.source === 'coordinates-estimate' || soilData.source === 'fallback') {
            const apiKey = document.getElementById('aiApiKey')?.value?.trim();
            const useAI = document.getElementById('aiUseSearch')?.checked;
            if (useAI) {
                fetchSoilFromAI(lat, lng, address, apiKey).then(aiSoil => {
                    if (!aiSoil) return;
                    document.getElementById('mapSoil').textContent = aiSoil.displayLabel || aiSoil.label;
                    document.getElementById('mapSoil').title = aiSoil.label;
                    if (window._mapData) {
                        window._mapData.soil = aiSoil.label;
                        window._mapData.soilRunoff = aiSoil.runoffType;
                        window._mapData.soilClay = aiSoil.clay;
                        window._mapData.soilSand = aiSoil.sand;
                        window._mapData.soilSilt = aiSoil.silt;
                        window._mapData.soilWrb = aiSoil.wrb;
                        window._mapData.soilSource = aiSoil.source;
                    }
                }).catch(() => {});
            }
        }

        // Clear previous CAD elements and calculator results when location changes
        if (typeof CAD !== 'undefined' && CAD.elements) {
            if (CAD.elements.length > 0) {
                CAD.undoStack.push(JSON.stringify(CAD.elements));
                CAD.redoStack = [];
                CAD.elements = [];
                CAD.selectedElement = null;
                CAD.selectedElements = [];
                CAD.render();
                CAD.updateCount();
            }
            if (CAD.syncDesignParams) CAD.syncDesignParams();
        }
        window._calcResults = null;
        const calcFields = ['calcFlow', 'calcVelocity', 'calcPipeDia', 'calcMaterial', 'calcSlope', 'calcReynolds', 'calcFroude'];
        calcFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        // Reset results page stats
        const resFields = ['resFlowRate', 'resVelocity', 'resPipeDia', 'resMaterial', 'resReynolds', 'resFroude'];
        resFields.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
        
    } catch (err) {
        console.error("API Fetch failed", err);
        document.getElementById('mapAddr').textContent = "API Error - Data Unavailable";
    }
}

function drawElevProfileMini() {
    const c = document.getElementById('elevProfileMini'); if (!c) return;
    c.width = c.parentElement.clientWidth * 2; c.height = 160;
    const ctx = c.getContext('2d'), w = c.width/2, h = 80;
    ctx.setTransform(2,0,0,2,0,0); ctx.clearRect(0,0,w,h);
    
    let pts = window._mapProfileData;
    if (!pts || pts.length === 0) {
        pts = Array.from({length:20},(_,i)=>40+Math.sin(i*0.5)*20+Math.random()*15);
    }
    
    // Normalize data to fit perfectly in canvas logic
    let minP = Math.min(...pts)*0.9, maxP = Math.max(...pts)*1.1;
    if (minP === maxP) maxP = minP + 10;
    const range = maxP - minP;
    const normalizedPts = pts.map(p => Math.abs((p - minP)/range * h * 0.8));

    const grad = ctx.createLinearGradient(0,0,0,h);
    grad.addColorStop(0,'rgba(0,245,212,0.3)'); grad.addColorStop(1,'rgba(0,245,212,0)');
    ctx.beginPath(); ctx.moveTo(0,h);
    normalizedPts.forEach((v,i) => ctx.lineTo(i*(w/(normalizedPts.length-1)),h-v));
    ctx.lineTo(w,h); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); normalizedPts.forEach((v,i) => i===0?ctx.moveTo(0,h-v):ctx.lineTo(i*(w/(normalizedPts.length-1)),h-v));
    ctx.strokeStyle = '#00f5d4'; ctx.lineWidth = 1.5; ctx.stroke();
}

function applyMapData() {
    if (window._mapData) {
        const md = window._mapData;
        document.getElementById('calcRainfall').value = md.rain;
        document.getElementById('calcSlope').value = md.slope;
        const soilMap = {Clay:'clay',Loam:'loam',Sand:'sand',Gravel:'gravel',Silt:'loam'};
        const soilType = md.soilRunoff || soilMap[extractBaseSoilType(md.soil)] || 'loam';
        document.getElementById('calcSoil').value = soilType;
        // Auto-set Manning's n based on terrain/soil
        const suggestedN = MANNING_N.autoSuggest(soilType, parseFloat(md.slope), md.landUse);
        const manningInput = document.getElementById('calcManning');
        if (manningInput) {
            manningInput.value = suggestedN;
            // Update the custom option if using dropdown
            const manningSelect = document.getElementById('calcManningSelect');
            if (manningSelect) {
                const matchingOpt = Array.from(manningSelect.options).find(o => Math.abs(parseFloat(o.value) - suggestedN) < 0.001);
                if (matchingOpt) {
                    manningSelect.value = matchingOpt.value;
                } else {
                    manningSelect.value = 'custom';
                    manningInput.value = suggestedN;
                }
            }
            // Show terrain-based suggestion
            const manningHint = document.getElementById('calcManningHint');
            if (manningHint) {
                const terrainLabels = {
                    urban: 'Urban/developed area',
                    agriculture: 'Agricultural/farmland',
                    forest: 'Forest/woodland',
                    wetland: 'Wetland/marsh'
                };
                const terrainLabel = terrainLabels[md.landUse] || `${soilType} soil terrain`;
                manningHint.textContent = `Auto-set: n=${suggestedN} (${terrainLabel})`;
                manningHint.style.display = 'block';
            }
        }
        navigateTo('calculator');
    } else alert('Click on the map first.');
}

// ============ CALCULATOR ============
function getRunoffCoefficient(soilType) {
    return {clay: 0.65, loam: 0.45, sand: 0.25, gravel: 0.15}[soilType] || 0.45;
}

function normalizeRainfallInput(rainfallValue) {
    // Map data is annual rainfall; manual calculator entry may already be storm intensity.
    return rainfallValue > 250 ? rainfallValue / 24 : rainfallValue;
}

function onManningSelectChange() {
    const select = document.getElementById('calcManningSelect');
    const input = document.getElementById('calcManning');
    const hint = document.getElementById('calcManningHint');
    if (select.value === 'custom') {
        input.style.display = 'block';
        input.focus();
    } else {
        input.style.display = 'none';
        input.value = select.value;
    }
    if (hint) hint.style.display = 'none';
}

function calculateHydraulics() {
    const slopePct = parseFloat(document.getElementById('calcSlope').value);
    const rainfall = parseFloat(document.getElementById('calcRainfall').value);
    const area = parseFloat(document.getElementById('calcArea').value);
    const manning = parseFloat(document.getElementById('calcManning').value);
    const soilType = document.getElementById('calcSoil').value;

    if ([slopePct, rainfall, area, manning].some(v => Number.isNaN(v) || v <= 0)) {
        document.getElementById('calcResultsContent').innerHTML = '<p class="placeholder-text">Please enter valid positive values for all calculator inputs.</p>';
        return;
    }

    const slope = Math.max(slopePct / 100, 0.001);
    const rainfallIntensity = normalizeRainfallInput(rainfall);
    const C = getRunoffCoefficient(soilType);
    const Q = C * (rainfallIntensity / 1000 / 3600) * area;
    const D_calc = Math.pow((Q * manning * Math.pow(4, 2/3)) / ((Math.PI / 4) * Math.sqrt(slope)), 3/8);
    const stdSizes = [110,150,200,225,250,300,375,450,525,600,750,900,1050,1200];
    const pipeDia = stdSizes.find(s => s >= D_calc * 1000) || stdSizes[stdSizes.length - 1];
    const diameterM = pipeDia / 1000;
    const R = diameterM / 4;
    const A_pipe = Math.PI * Math.pow(diameterM / 2, 2);
    const Vfull = (1 / manning) * Math.pow(R, 2/3) * Math.sqrt(slope);
    const capacity = Vfull * A_pipe;
    const V = Q / A_pipe;
    const capacityUse = capacity > 0 ? Q / capacity : 0;
    const manningSelect = document.getElementById('calcManningSelect');
    const selOpt = manningSelect?.options[manningSelect.selectedIndex];
    const material = selOpt?.dataset?.material || (pipeDia > 600 ? 'RCC' : pipeDia > 300 ? 'HDPE' : 'PVC');
    const Re = V * diameterM / 1e-6;
    const Fr = V / Math.sqrt(9.81 * Math.max(diameterM / 4, 0.001));
    const capacityAlert = capacityUse > 1
        ? '<div style="margin-top:16px;padding:12px 14px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.08);border-radius:12px;color:#fecaca">Selected standard pipe is overloaded at this flow. Increase the diameter or revise slope and roughness assumptions.</div>'
        : '';

    // Compute multi-material comparison
    const suitableMats = MANNING_N.getSuitableMaterials(pipeDia);
    const materialComparisons = suitableMats.map(m => {
        const vMat = manningVelocity(m.n, diameterM, slope);
        const qMat = vMat * A_pipe;
        const capUse = qMat > 0 ? Q / qMat : 0;
        const velOk = vMat >= 0.6 && vMat <= m.maxV;
        const costEst = Math.round(m.costPerM * Math.max(Math.sqrt(area) * 2.5, 50) * (pipeDia / 300));
        const isSelected = m.key === material;
        return `<div class="mat-compare-item ${isSelected ? 'mat-selected' : ''}">
            <div class="mat-compare-header">
                <span class="mat-compare-name">${m.label}</span>
                ${isSelected ? '<span class="mat-compare-badge">Selected</span>' : ''}
            </div>
            <div class="mat-compare-detail">n=${m.n} · Vf=${vMat.toFixed(2)} m/s · Qf=${qMat.toFixed(4)} m³/s · Cap: ${(capUse * 100).toFixed(0)}%</div>
            <div class="mat-compare-detail">Est. cost: $${costEst.toLocaleString()} · Max V: ${m.maxV} m/s · ${velOk ? '✓ Velocity OK' : (vMat < 0.6 ? '⚠ Too slow' : '⚠ Exceeds max')}</div>
            <div class="mat-compare-desc">${m.desc}</div>
        </div>`;
    }).join('');

    window._calcResults = {
        Q, V, pipeDia, diameterM, material, slope, slopePct, rainfall, rainfallIntensity,
        area, manning, C, Re, Fr, capacity, capacityUse, Vfull, soilType,
        materialComparisons, suitableMats: suitableMats.map(m => {
            const vMat = manningVelocity(m.n, diameterM, slope);
            const qMat = vMat * A_pipe;
            return { ...m, Vfull: vMat, Qfull: qMat };
        })
    };
    document.getElementById('calcResultsContent').innerHTML = `<div class="result-grid"><div class="result-item"><span class="rlabel">Flow Rate</span><span class="rvalue">${Q.toFixed(4)} m³/s</span></div><div class="result-item"><span class="rlabel">Velocity</span><span class="rvalue">${V.toFixed(2)} m/s</span></div><div class="result-item"><span class="rlabel">Pipe Diameter</span><span class="rvalue">${pipeDia} mm</span></div><div class="result-item"><span class="rlabel">Selected Material</span><span class="rvalue">${material}</span></div><div class="result-item"><span class="rlabel">Design Rainfall</span><span class="rvalue">${rainfallIntensity.toFixed(1)} mm/hr</span></div><div class="result-item"><span class="rlabel">Capacity Use</span><span class="rvalue">${(capacityUse * 100).toFixed(1)}%</span></div><div class="result-item"><span class="rlabel">Reynolds No.</span><span class="rvalue">${Math.round(Re).toLocaleString()}</span></div><div class="result-item"><span class="rlabel">Froude No.</span><span class="rvalue">${Fr.toFixed(2)}</span></div></div><div style="margin-top:16px"><div class="mat-compare-title">Material Comparison for ${pipeDia}mm Pipe</div>${materialComparisons}</div>${capacityAlert}<div style="margin-top:16px"><button class="btn btn-primary btn-full" onclick="navigateTo('results')">View Detailed Graphs →</button></div>`;
    document.getElementById('resFlowRate').textContent = Q.toFixed(4)+' m³/s';
    document.getElementById('resVelocity').textContent = V.toFixed(2)+' m/s';
    document.getElementById('resPipeDia').textContent = pipeDia+' mm';
    document.getElementById('resMaterial').textContent = material;
    document.getElementById('resReynolds').textContent = Math.round(Re).toLocaleString();
    document.getElementById('resFroude').textContent = Fr.toFixed(2);
    if (typeof CAD !== 'undefined') CAD.syncDesignParams();
    drawAllCharts();
}

// ============ 3D VIEWER (Enhanced - Three.js) ============
let viewer3D = {
    scene: null, camera: null, renderer: null, controls: null, animationId: null,
    autoRot: false, wireframe: false, showLabels: true, showShadows: true,
    showGround: true, showAxes: true, showFlow: true, constructAnim: false,
    constructProgress: 1, buildMeshes: [], labelSprites: [],
    cutawayHeight: 0, showCutaway: false, fogEnabled: true,
    buildSpeed: 1.5, highlightedMesh: null, raycaster: null, mouse: null,
    flowPhase: 0, flowParticles: [],
    // --- Guided Tour ---
    tourActive: false, tourStep: 0, tourHighlighted: [],
    tourSteps: [
        { title: 'Welcome to DrainFlow Pro', desc: 'This interactive 3D view shows your complete drainage network — pipes, manholes, catchpits, outlets, and roads — all built from your CAD design.', phase: 'overview', camera: 'iso' },
        { title: 'Pipe Network', desc: 'Cylindrical pipes carry stormwater underground. Each pipe is sized by diameter (Ø) and sloped for gravity flow. The cyan glow indicates flow direction and capacity.', phase: 'pipes', camera: 'front', highlight: 'pipe' },
        { title: 'Manholes', desc: 'Manholes provide access for inspection and maintenance. They are vertical shafts with heavy-duty covers, placed at pipe junctions and direction changes.', phase: 'nodes', camera: 'iso', highlight: 'manhole' },
        { title: 'Catch Pits', desc: 'Catch pits collect surface runoff from roads and pavements. A grated inlet traps debris while water flows into the underground pipe network.', phase: 'nodes', camera: 'iso', highlight: 'catchpit' },
        { title: 'Outlets', desc: 'The outlet discharges collected stormwater to a safe location — river, channel, or soakaway. Riprap stones prevent scour at the discharge point.', phase: 'nodes', camera: 'iso', highlight: 'outlet' },
        { title: 'Junctions', desc: 'Pipe junctions connect multiple branch lines into a single trunk main, optimizing the network layout and reducing construction costs.', phase: 'nodes', camera: 'iso', highlight: 'junction' },
        { title: 'Roads & Terrain', desc: 'Roads are integrated into the drainage layout. Catch pits sit at road edges, and pipes run beneath the pavement within the right-of-way.', phase: 'roads', camera: 'top', highlight: 'road' },
        { title: 'Water Flow', desc: 'Animated particles travel along pipes, showing flow direction and velocity. The flow rate (Q) depends on rainfall intensity, catchment area, slope, and pipe material.', phase: 'flow', camera: 'iso', highlight: 'flow' },
        { title: 'Climate Scenarios', desc: 'Click any scenario below to see how the network performs under normal rain, heavy storms, floods, or drought. Watch flow rates, water levels, and visual effects change in real time.', phase: 'scenarios', camera: 'iso' },
        { title: 'Construction Sequence', desc: 'Press "Play Construction" to watch the network build itself — ground first, then roads, pipes, nodes, and finally water flow. Adjust speed with the slider.', phase: 'construction', camera: 'iso' },
    ],
    // --- Scenarios ---
    scenario: 'normal',
    scenarioData: {
        normal: { name: 'Normal', color: '#22c55e', flowMul: 1, rain: 0, waterLevel: 1, desc: 'Typical rainfall — system operates at design capacity.', bg: 0x0a0e1a, fog: 0.0012, ambient: 0.45 },
        'heavy-rain': { name: 'Heavy Rain', color: '#3b82f6', flowMul: 2.5, rain: 0.4, waterLevel: 1.8, desc: 'Intense rainfall — pipes run near full capacity. Catchpits collect significant runoff.', bg: 0x0c1428, fog: 0.0018, ambient: 0.3 },
        storm: { name: 'Storm', color: '#8b5cf6', flowMul: 4, rain: 0.7, waterLevel: 2.5, desc: 'Severe storm event — system under high load. Emergency overflow pathways activated.', bg: 0x0a0a1a, fog: 0.0025, ambient: 0.2 },
        flood: { name: 'Flood', color: '#ef4444', flowMul: 6, rain: 0.9, waterLevel: 3.5, desc: 'Extreme flood — water levels exceed pipe capacity. Surface flooding modeled for emergency planning.', bg: 0x1a0a0a, fog: 0.003, ambient: 0.15 },
        drought: { name: 'Drought', color: '#f59e0b', flowMul: 0.1, rain: 0, waterLevel: 0.3, desc: 'Dry conditions — minimal flow. System remains ready but water conservation measures are active.', bg: 0x1a1a0a, fog: 0.0008, ambient: 0.6 },
        extreme: { name: 'Extreme Weather', color: '#ec4899', flowMul: 5, rain: 0.8, waterLevel: 3, desc: 'Climate extremes — rapid switching between heavy rain and dry spells tests the system resilience.', bg: 0x100a1a, fog: 0.002, ambient: 0.2 },
    },
    rainParticles: [],
    windParticles: [],
    waterTableMesh: null,
    floodMesh: null,
    dimLabels: [],
    _lightningTimer: 0,
    // --- Auto Demo ---
    demoMode: false, demoTimer: 0, demoIdx: 0,
    demoPhases: [
        { scenario: 'normal', tourStep: 0, duration: 7 },
        { scenario: 'heavy-rain', tourStep: 7, duration: 7 },
        { scenario: 'storm', tourStep: 7, duration: 7 },
        { scenario: 'flood', tourStep: 7, duration: 7 },
        { scenario: 'drought', tourStep: 7, duration: 6 },
        { scenario: 'extreme', tourStep: 7, duration: 7 },
        { scenario: 'normal', tourStep: 8, duration: 5 },
    ],
};

function create3DTextSprite(text, color = '#e8eaed', scale = 1) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.fillStyle = 'rgba(10,14,26,0.75)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = color;
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(40 * scale, 10 * scale, 1);
    return sprite;
}

function create3DDimLabel(text, color = '#ffaa44', scale = 0.55) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 48;
    ctx.fillStyle = 'rgba(10,14,26,0.82)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
    ctx.fillStyle = color;
    ctx.font = 'bold 17px "JetBrains Mono", "Fira Code", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(24 * scale, 5 * scale, 1);
    sprite.userData.isDimLabel = true;
    return sprite;
}

function getNodeDepthM(node, defaultDepth = 1.5) {
    if (node.depthM != null) return node.depthM;
    if (node.invertElev != null && node.groundElev != null) return node.groundElev - node.invertElev + 0.1;
    return defaultDepth;
}

function getPipeDepths(pipe, calc) {
    const radiusM = (pipe.diameterMm || calc?.pipeDia || 225) / 2000;
    const cover = 1.0;
    let startY, endY;
    if (pipe.invertStart != null && pipe.invertEnd != null) {
        const gStart = pipe.groundElevStart ?? pipe.groundElev ?? 100;
        const gEnd = pipe.groundElevEnd ?? pipe.groundElev ?? gStart;
        startY = -(gStart - pipe.invertStart) * 8;
        endY = -(gEnd - pipe.invertEnd) * 8;
    } else {
        const d = (cover + radiusM) * 8;
        startY = -d;
        endY = -d - (pipe.lengthM || 10) * (calc?.slopePct || 2) / 100 * 8;
    }
    const rawRadius = Math.max(1.5, radiusM * 40);
    const minDepth = Math.min(Math.abs(startY), Math.abs(endY));
    const radius = Math.min(rawRadius, Math.max(1.5, minDepth * 0.8));
    return { startY, endY, radius };
}

function build3DTerrain(scene, design, showShadows) {
    const profile = design.profile;
    const roads = design.elements.filter(e => e.type === 'road');
    let points = [];
    if (roads.length && roads[0].points?.length > 2) {
        points = roads[0].points.map((p, i) => ({
            x: p.x, z: p.y,
            y: 0
        }));
    } else if (profile?.length >= 3) {
        const len = profile.length;
        points = profile.map((elev, i) => ({
            x: (i - len / 2) * 15,
            z: 0,
            y: (elev - profile[0]) * 0.5
        }));
    }
    if (points.length < 3) return;

    // --- Triangulated terrain strip with width ---
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const uvs = [];
    const halfW = 200;

    for (let i = 0; i < points.length - 1; i++) {
        const p0 = points[i], p1 = points[i + 1];
        // Two triangles forming a quad strip
        // Triangle 1: bottom-left, bottom-right, top-left
        verts.push(
            p0.x, p0.y, p0.z - halfW,
            p1.x, p1.y, p1.z - halfW,
            p0.x, p0.y, p0.z + halfW
        );
        // Triangle 2: bottom-right, top-right, top-left
        verts.push(
            p1.x, p1.y, p1.z - halfW,
            p1.x, p1.y, p1.z + halfW,
            p0.x, p0.y, p0.z + halfW
        );
        uvs.push(0, 0, 1, 0, 0, 1, 1, 0, 1, 1, 0, 1);
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
        color: 0x3d4f3a,
        roughness: 0.85,
        metalness: 0,
        side: THREE.DoubleSide,
        flatShading: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = showShadows;
    mesh.userData.buildOrder = 0;
    scene.add(mesh);
    viewer3D.buildMeshes.push(mesh);

    // --- Terrain edge glow (subtle line) ---
    const edgeMat = new THREE.LineBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.08 });
    const edgePoints = [];
    for (let i = 0; i < points.length; i++) {
        edgePoints.push(new THREE.Vector3(points[i].x, points[i].y, points[i].z - halfW));
    }
    for (let i = points.length - 1; i >= 0; i--) {
        edgePoints.push(new THREE.Vector3(points[i].x, points[i].y, points[i].z + halfW));
    }
    edgePoints.push(edgePoints[0]);
    const edgeGeo = new THREE.BufferGeometry().setFromPoints(edgePoints);
    const edgeLine = new THREE.Line(edgeGeo, edgeMat);
    edgeLine.userData.buildOrder = 0;
    scene.add(edgeLine);
    viewer3D.buildMeshes.push(edgeLine);
}

function build3DRoad(scene, road, getMaterial, showShadows) {
    if (!road.points || road.points.length < 2) return;
        const rw = road.roadWidth || 14;
    for (let i = 0; i < road.points.length - 1; i++) {
        const p0 = road.points[i], p1 = road.points[i + 1];
        const dx = p1.x - p0.x, dz = p1.y - p0.y;
        const len = Math.hypot(dx, dz);
        const geo = new THREE.BoxGeometry(len, 0.4, rw);
        const mesh = new THREE.Mesh(geo, getMaterial(0x555d66));
        mesh.position.set(p0.x + dx / 2, 0.2, p0.y + dz / 2);
        mesh.rotation.y = -Math.atan2(dz, dx);
        mesh.castShadow = showShadows;
        mesh.receiveShadow = showShadows;
        mesh.userData.buildOrder = 1;
        mesh.userData.elementData = road;
        scene.add(mesh);
        viewer3D.buildMeshes.push(mesh);
    }
}

function build3DNode(scene, node, getMaterial, showShadows, showLabels) {
    const depth = getNodeDepthM(node) * 8;
    const x = node.x, z = node.y;
    let mesh;

    if (node.type === 'manhole') {
        // --- Shaft (main cylinder) ---
        const shaft = new THREE.Mesh(new THREE.CylinderGeometry(8, 9, depth, 24), getMaterial(0x7b61ff));
        shaft.position.set(x, -depth / 2, z);
        shaft.castShadow = showShadows;
        shaft.receiveShadow = showShadows;
        shaft.userData.buildOrder = 3;
        shaft.userData.elementData = node;
        scene.add(shaft);
        viewer3D.buildMeshes.push(shaft);
        // --- Cover slab ---
        const cover = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.8, 24), getMaterial(0x44403c));
        cover.position.set(x, 0.4, z);
        cover.castShadow = showShadows;
        cover.userData.buildOrder = 3;
        cover.userData.elementData = node;
        scene.add(cover);
        viewer3D.buildMeshes.push(cover);
        // --- Cover ring ---
        const ring = new THREE.Mesh(new THREE.TorusGeometry(10.5, 0.6, 8, 24), getMaterial(0x5a5a5a));
        ring.position.set(x, 0.05, z);
        ring.rotation.x = Math.PI / 2;
        ring.userData.buildOrder = 3;
        ring.userData.elementData = node;
        scene.add(ring);
        viewer3D.buildMeshes.push(ring);
        // --- Steps inside shaft ---
        for (let i = 0; i < Math.min(8, Math.floor(depth / 10)); i++) {
            const stepY = -1.5 - i * 10;
            const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 4), getMaterial(0x666666));
            step.position.set(x - 4, stepY, z);
            step.userData.buildOrder = 3;
            scene.add(step);
            viewer3D.buildMeshes.push(step);
        }
        mesh = shaft;
    } else if (node.type === 'catchpit') {
        // --- Main pit box ---
        mesh = new THREE.Mesh(new THREE.BoxGeometry(18, depth, 18), getMaterial(0xf59e0b));
        mesh.position.set(x, -depth / 2, z);
        mesh.castShadow = showShadows;
        mesh.receiveShadow = showShadows;
        mesh.userData.elementData = node;
        scene.add(mesh);
        viewer3D.buildMeshes.push(mesh);
        // --- Grate on top ---
        const grate = new THREE.Mesh(new THREE.BoxGeometry(20, 0.5, 20), getMaterial(0x333333));
        grate.position.set(x, 0.25, z);
        grate.userData.buildOrder = 3;
        grate.userData.elementData = node;
        scene.add(grate);
        viewer3D.buildMeshes.push(grate);
        // --- Grate bars ---
        for (let i = -7; i <= 7; i += 4) {
            const bar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 16), getMaterial(0x555555));
            bar.position.set(x + i, 0.5, z);
            bar.userData.buildOrder = 3;
            bar.userData.elementData = node;
            scene.add(bar);
            viewer3D.buildMeshes.push(bar);
        }
    } else if (node.type === 'outlet') {
        // --- Headwall ---
        mesh = new THREE.Mesh(new THREE.BoxGeometry(22, depth * 0.7, 16), getMaterial(0x3b82f6));
        mesh.position.set(x, -depth * 0.35, z);
        mesh.castShadow = showShadows;
        mesh.receiveShadow = showShadows;
        mesh.userData.elementData = node;
        scene.add(mesh);
        viewer3D.buildMeshes.push(mesh);
        // --- Pipe opening ---
        const opening = new THREE.Mesh(new THREE.TorusGeometry(6, 1.5, 8, 16), getMaterial(0x888888));
        opening.position.set(x + 12, -depth * 0.2, z);
        opening.userData.buildOrder = 3;
        opening.userData.elementData = node;
        scene.add(opening);
        viewer3D.buildMeshes.push(opening);
        // --- Water pool ---
        const water = new THREE.Mesh(new THREE.CircleGeometry(14, 16),
            new THREE.MeshStandardMaterial({ color: 0x3b82f6, transparent: true, opacity: 0.4 }));
        water.rotation.x = -Math.PI / 2;
        water.position.set(x + 20, 0.1, z);
        water.userData.buildOrder = 4;
        water.userData.elementData = node;
        scene.add(water);
        viewer3D.buildMeshes.push(water);
        // --- Riprap stones ---
        for (let i = 0; i < 5; i++) {
            const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(1.5 + Math.random() * 1.5),
                getMaterial(0x777777));
            stone.position.set(x + 24 + Math.random() * 8 - 4, 0.2, z + Math.random() * 10 - 5);
            stone.userData.buildOrder = 3;
            stone.userData.elementData = node;
            scene.add(stone);
            viewer3D.buildMeshes.push(stone);
        }
    } else {
        // --- Junction ---
        mesh = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, depth, 16), getMaterial(node.color || 0xec4899));
        mesh.position.set(x, -depth / 2, z);
        mesh.castShadow = showShadows;
        mesh.receiveShadow = showShadows;
        mesh.userData.elementData = node;
        scene.add(mesh);
        viewer3D.buildMeshes.push(mesh);
        // --- Top cap ---
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 0.5, 16), getMaterial(0x44403c));
        cap.position.set(x, 0.25, z);
        cap.userData.buildOrder = 3;
        cap.userData.elementData = node;
        scene.add(cap);
        viewer3D.buildMeshes.push(cap);
    }

    if (showLabels) {
        const label = create3DTextSprite(node.name, node.color || '#e8eaed');
        label.position.set(x, Math.max(12, depth + 5), z);
        label.userData.buildOrder = 4;
        scene.add(label);
        viewer3D.labelSprites.push(label);
        viewer3D.buildMeshes.push(label);
    }

    // --- Construction dimension label (depth) ---
    const nodeDepth = getNodeDepthM(node, 1.5);
    let dimText = '';
    if (node.type === 'manhole') dimText = `MH  D=${nodeDepth.toFixed(1)}m`;
    else if (node.type === 'catchpit') dimText = `CP  D=${nodeDepth.toFixed(1)}m`;
    else if (node.type === 'outlet') dimText = `OUT  D=${nodeDepth.toFixed(1)}m`;
    else dimText = `J  D=${nodeDepth.toFixed(1)}m`;
    const dimLabel = create3DDimLabel(dimText, node.color || '#e8eaed', 0.5);
    dimLabel.position.set(x + 4, Math.max(3, depth * 0.5), z + 4);
    dimLabel.userData.buildOrder = 5;
    scene.add(dimLabel);
    viewer3D.dimLabels.push(dimLabel);
    viewer3D.buildMeshes.push(dimLabel);
}

function build3DPipe(scene, pipe, getMaterial, showShadows, showLabels, calc) {
    const dx = pipe.x2 - pipe.x, dz = pipe.y2 - pipe.y;
    const length = Math.hypot(dx, dz);
    if (length < 1) return;
    const depths = getPipeDepths(pipe, calc);
    const dy = depths.endY - depths.startY;
    const midX = (pipe.x + pipe.x2) / 2, midZ = (pipe.y + pipe.y2) / 2;
    const midY = (depths.startY + depths.endY) / 2;
    const radius = depths.radius;

    // Direction vector from pipe start to end (including elevation change)
    const dir = new THREE.Vector3(dx, dy, dz).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // --- Pipe barrel ---
    const geo = new THREE.CylinderGeometry(radius, radius, length, 20);
    const mesh = new THREE.Mesh(geo, getMaterial(pipe.color || 0x00f5d4));
    mesh.position.set(midX, midY, midZ);
    mesh.quaternion.setFromUnitVectors(up, dir);
    mesh.castShadow = showShadows;
    mesh.receiveShadow = showShadows;
    mesh.userData.buildOrder = 2;
    mesh.userData.pipeLine = { x1: pipe.x, z1: pipe.y, x2: pipe.x2, z2: pipe.y2, y: midY };
    mesh.userData.elementData = pipe;
    mesh.userData._origColor = pipe.color || 0x00f5d4;
    scene.add(mesh);
    viewer3D.buildMeshes.push(mesh);

    // --- Joint flanges at pipe ends ---
    [0, 1].forEach(end => {
        const flange = new THREE.Mesh(
            new THREE.TorusGeometry(radius + 2, 1.5, 8, 16),
            getMaterial(0x888888)
        );
        const t = end;
        const fx = pipe.x + dx * t;
        const fz = pipe.y + dz * t;
        const fy = depths.startY + dy * t;
        flange.position.set(fx, fy, fz);
        flange.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        flange.userData.buildOrder = 2;
        flange.userData.elementData = pipe;
        scene.add(flange);
        viewer3D.buildMeshes.push(flange);
    });

    // --- Water flow indicator (thin line along pipe) ---
    const flowLine = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.25, radius * 0.25, length * 0.7, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.12 })
    );
    flowLine.position.set(midX, midY, midZ);
    flowLine.quaternion.setFromUnitVectors(up, dir);
    flowLine.userData.buildOrder = 2;
    scene.add(flowLine);
    viewer3D.buildMeshes.push(flowLine);

    // --- Flow direction arrow (cone pointing downhill) ---
    const arrowPos = 0.65;
    const ax = pipe.x + dx * arrowPos;
    const az = pipe.y + dz * arrowPos;
    const ay = depths.startY + dy * arrowPos;
    const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 1.3, radius * 3, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.3 })
    );
    arrow.position.set(ax, ay, az);
    arrow.quaternion.setFromUnitVectors(up, dir);
    arrow.userData.buildOrder = 2;
    scene.add(arrow);
    viewer3D.buildMeshes.push(arrow);

    if (showLabels && pipe.diameterMm) {
        const label = create3DTextSprite(`Ø${pipe.diameterMm}mm ${pipe.material || ''}`, '#00f5d4', 0.8);
        label.position.set(pipe.x + dx / 2, Math.max(8, -midY + 5), pipe.y + dz / 2);
        label.userData.buildOrder = 4;
        scene.add(label);
        viewer3D.labelSprites.push(label);
        viewer3D.buildMeshes.push(label);
    }

    // --- Construction dimension label (length, diameter, slope) ---
    if (pipe.diameterMm || pipe.lengthM) {
        const pipeLen = pipe.lengthM || length;
        const pipeSlope = pipe.slopePct != null ? pipe.slopePct : (calc?.slopePct || 2);
        const dimText = `L=${pipeLen.toFixed(1)}m  Ø${pipe.diameterMm || calc?.pipeDia || 225}mm  S=${pipeSlope}%`;
        const dimLabel = create3DDimLabel(dimText, pipe.color || '#00f5d4', 0.6);
        dimLabel.position.set(pipe.x + dx / 2, Math.max(2, -midY + 2), pipe.y + dz / 2);
        dimLabel.userData.buildOrder = 5;
        scene.add(dimLabel);
        viewer3D.dimLabels.push(dimLabel);
        viewer3D.buildMeshes.push(dimLabel);
    }
}

function init3DViewer() {
    if (typeof THREE === 'undefined') {
        setTimeout(init3DViewer, 500);
        return;
    }

    const canvas = document.getElementById('viewer3dCanvas'); if (!canvas) return;
    const wrapper = canvas.parentElement;
    const w = wrapper.clientWidth, h = wrapper.clientHeight;

    if (viewer3D.animationId) cancelAnimationFrame(viewer3D.animationId);

    if (!viewer3D.scene) {
        viewer3D.scene = new THREE.Scene();
        viewer3D.scene.background = new THREE.Color(0x0a0e1a);
        viewer3D.camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        viewer3D.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
        viewer3D.renderer.setSize(w, h);
        viewer3D.renderer.setPixelRatio(window.devicePixelRatio);
        viewer3D.renderer.shadowMap.enabled = true;
        viewer3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        viewer3D.controls = new THREE.OrbitControls(viewer3D.camera, viewer3D.renderer.domElement);
        viewer3D.controls.enableDamping = true;
        viewer3D.controls.dampingFactor = 0.05;
        viewer3D.controls.maxPolarAngle = Math.PI / 1.8;
        const ambient = new THREE.AmbientLight(0xffffff, 0.45);
        viewer3D.scene.add(ambient);
        const hemi = new THREE.HemisphereLight(0x00f5d4, 0x7b61ff, 0.25);
        viewer3D.scene.add(hemi);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
        dirLight.position.set(200, 400, 150);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -800;
        dirLight.shadow.camera.right = 800;
        dirLight.shadow.camera.top = 800;
        dirLight.shadow.camera.bottom = -800;
        viewer3D.scene.add(dirLight);
        // --- Fog for depth perception ---
        viewer3D.scene.fog = new THREE.FogExp2(0x0a0e1a, 0.0012);
        // --- Raycaster for click-to-highlight ---
        viewer3D.raycaster = new THREE.Raycaster();
        viewer3D.mouse = new THREE.Vector2();
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            viewer3D.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            viewer3D.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            viewer3D.raycaster.setFromCamera(viewer3D.mouse, viewer3D.camera);
            const intersects = viewer3D.raycaster.intersectObjects(viewer3D.buildMeshes, false);
            // Reset previous highlight
            if (viewer3D.highlightedMesh) {
                viewer3D.highlightedMesh.material.emissive?.setHex(0x000000);
                viewer3D.highlightedMesh.material.emissiveIntensity = 0;
                viewer3D.highlightedMesh = null;
            }
            const infoEl = document.querySelector('.viewer3d-info p');
            if (intersects.length > 0) {
                const hit = intersects[0].object;
                const el = hit.userData.elementData;
                if (el) {
                    viewer3D.highlightedMesh = hit;
                    if (hit.material.emissive) {
                        hit.material.emissive.setHex(0x00f5d4);
                        hit.material.emissiveIntensity = 0.4;
                    }
                    if (infoEl) {
                        const typeName = el.type.charAt(0).toUpperCase() + el.type.slice(1);
                        const name = el.name || typeName;
                        if (el.type === 'pipe') {
                            infoEl.textContent = `${name} — Ø${el.diameterMm || '?'}mm ${el.material || ''} · Slope: ${el.slopePct ?? '?'}%`;
                        } else if (['manhole', 'catchpit', 'outlet', 'junction'].includes(el.type)) {
                            infoEl.textContent = `${el.name || typeName} — Depth: ${(getNodeDepthM(el, 1.5)).toFixed(1)}m`;
                        } else {
                            infoEl.textContent = `${name} — ${el.type}`;
                        }
                    }
                } else {
                    if (infoEl) infoEl.textContent = 'Drag to rotate · Scroll to zoom · Click element for details';
                }
            } else {
                if (infoEl) infoEl.textContent = 'Drag to rotate · Scroll to zoom · Click element for details';
            }
        });
    } else {
        viewer3D.renderer.setSize(w, h);
        viewer3D.camera.aspect = w / h;
        viewer3D.camera.updateProjectionMatrix();
        viewer3D.buildMeshes.forEach(m => viewer3D.scene.remove(m));
        viewer3D.buildMeshes = [];
        viewer3D.labelSprites = [];
        viewer3D.flowParticles = [];
        viewer3D.dimLabels = [];
    }
    viewer3D.scene.fog = viewer3D.fogEnabled ? new THREE.FogExp2(0x0a0e1a, 0.0012) : null;

    const design = (typeof CAD !== 'undefined' && CAD.exportDesignFor3D) ? CAD.exportDesignFor3D() : { elements: [], params: {}, profile: null };
    const els = design.elements;
    const calc = window._calcResults;
    const nodes = els.filter(e => ['manhole', 'catchpit', 'outlet', 'junction'].includes(e.type));
    const pipes = els.filter(e => e.type === 'pipe');
    const roads = els.filter(e => e.type === 'road');

    // --- Ground plane with subtle gradient ---
    if (viewer3D.showGround) {
        const groundGeo = new THREE.PlaneGeometry(4000, 4000);
        const groundMat = new THREE.MeshStandardMaterial({
            color: 0x111622,
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0.6,
            side: THREE.DoubleSide
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = viewer3D.showShadows;
        ground.userData.buildOrder = 0;
        viewer3D.scene.add(ground);
        viewer3D.buildMeshes.push(ground);

        const grid = new THREE.GridHelper(4000, 120, 0x00f5d4, 0x1a2035);
        grid.material.opacity = 0.15;
        grid.material.transparent = true;
        grid.position.y = -0.4;
        grid.userData.buildOrder = 0;
        viewer3D.scene.add(grid);
        viewer3D.buildMeshes.push(grid);
    }

    if (viewer3D.showAxes) {
        const axes = new THREE.AxesHelper(120);
        axes.userData.buildOrder = 0;
        viewer3D.scene.add(axes);
        viewer3D.buildMeshes.push(axes);
    }

    const materialCache = {};
    function get3DMaterial(color) {
        const hex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
        if (!materialCache[hex]) {
            materialCache[hex] = new THREE.MeshStandardMaterial({
                color: hex, roughness: 0.35, metalness: 0.15,
                wireframe: viewer3D.wireframe
            });
        }
        materialCache[hex].wireframe = viewer3D.wireframe;
        return materialCache[hex];
    }

    build3DTerrain(viewer3D.scene, design, viewer3D.showShadows);
    roads.forEach(r => build3DRoad(viewer3D.scene, r, get3DMaterial, viewer3D.showShadows));

    let demoNodes = null;
    if (els.length === 0) {
        // Show a demo interconnected drainage network when no CAD design exists
        demoNodes = [
            { x: -200, y: 40, type: 'catchpit', name: 'CP-1', color: '#f59e0b' },
            { x: -120, y: 25, type: 'catchpit', name: 'CP-2', color: '#f59e0b' },
            { x: -40, y: 10, type: 'manhole', name: 'MH-1', color: '#7b61ff' },
            { x: 50, y: -5, type: 'catchpit', name: 'CP-3', color: '#f59e0b' },
            { x: 140, y: -20, type: 'manhole', name: 'MH-2', color: '#7b61ff' },
            { x: 240, y: -40, type: 'outlet', name: 'OUT-1', color: '#3b82f6' }
        ];
        // Road along the same line
        const roadPts = demoNodes.map(n => ({ x: n.x, y: n.y + 18 }));
        build3DRoad(viewer3D.scene, { type: 'road', points: roadPts, roadWidth: 10, color: '#94a3b8' }, get3DMaterial, viewer3D.showShadows);
        // Connect each node to the next with pipes
        for (let i = 0; i < demoNodes.length - 1; i++) {
            const a = demoNodes[i], b = demoNodes[i + 1];
            build3DPipe(viewer3D.scene, { x: a.x, y: a.y, x2: b.x, y2: b.y, color: 0x00f5d4, diameterMm: calc?.pipeDia || 225, material: calc?.material || 'PVC', slopePct: calc?.slopePct || 2, lengthM: Math.hypot(b.x - a.x, b.y - a.y) }, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels, calc);
        }
        // Flow particles for demo network
        if (viewer3D.showFlow) {
            viewer3D.flowParticles = [];
            for (let i = 0; i < demoNodes.length - 1; i++) {
                const a = demoNodes[i], b = demoNodes[i + 1];
                const dx = b.x - a.x, dz = b.y - a.y;
                const count = Math.max(1, Math.floor(Math.hypot(dx, dz) / 20));
                for (let j = 0; j < count; j++) {
                const geo = new THREE.SphereGeometry(4, 8, 8);
                    const mat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.85 });
                    const particle = new THREE.Mesh(geo, mat);
                    const demoDepths = getPipeDepths({ x: a.x, y: a.y, x2: b.x, y2: b.y }, calc);
                    particle.userData.pipeLine = {
                        x1: a.x, z1: a.y, y1: demoDepths.startY,
                        x2: b.x, z2: b.y, y2: demoDepths.endY,
                        t: j / count
                    };
                    particle.userData.buildOrder = 4;
                    viewer3D.scene.add(particle);
                    viewer3D.flowParticles.push(particle);
                    viewer3D.buildMeshes.push(particle);
                }
            }
        }
        demoNodes.forEach(n => build3DNode(viewer3D.scene, n, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels));
    } else {
        pipes.forEach(p => build3DPipe(viewer3D.scene, p, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels, calc));
        nodes.forEach(n => build3DNode(viewer3D.scene, n, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels));
    }

    // --- Flow particles along pipes with height following slope ---
    viewer3D.flowParticles = [];
    if (viewer3D.showFlow && els.length > 0 && pipes.length > 0) {
        pipes.forEach(pipe => {
            const count = Math.max(1, Math.floor(Math.hypot(pipe.x2 - pipe.x, pipe.y2 - pipe.y) / 20));
            for (let i = 0; i < count; i++) {
                const geo = new THREE.SphereGeometry(4, 8, 8);
                const mat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.85 });
                const particle = new THREE.Mesh(geo, mat);
                const depths = getPipeDepths(pipe, calc);
                particle.userData.pipeLine = {
                    x1: pipe.x, z1: pipe.y, y1: depths.startY,
                    x2: pipe.x2, z2: pipe.y2, y2: depths.endY,
                    t: i / count
                };
                particle.userData.buildOrder = 4;
                viewer3D.scene.add(particle);
                viewer3D.flowParticles.push(particle);
                viewer3D.buildMeshes.push(particle);
            }
        });
    }

    update3DStats();
    drawSideCanvases();

    // --- Center camera on network centroid ---
    let cx = 0, cz = 0, count = 0;
    const camNodes = els.length > 0 ? [...nodes, ...pipes] : (demoNodes || []);
    camNodes.forEach(el => {
        cx += el.x; cz += (el.y ?? el.z ?? 0); count++;
        if (el.x2 != null) { cx += el.x2; cz += el.y2; count++; }
    });
    if (count > 0) { cx /= count; cz /= count; }
    // Estimate extent from elements to set camera distance dynamically
    let maxDist = 200;
    camNodes.forEach(el => {
        const ex = el.x2 != null ? Math.max(el.x, el.x2) : el.x;
        const ez = el.y2 != null ? Math.max(el.y, el.y2) : el.y;
        const d = Math.hypot(ex - cx, ez - cz);
        if (d > maxDist) maxDist = d;
    });
    const camDist = Math.max(120, maxDist * 1.2);
    viewer3D.controls.target.set(cx, -8, cz);
    viewer3D.camera.position.set(cx + camDist, camDist * 0.6, cz + camDist);
    viewer3D.controls.update();

        // --- Animation loop ---
    function animate3D() {
        if (viewer3D.autoRot) {
            viewer3D.scene.rotation.y += 0.003;
        } else {
            viewer3D.scene.rotation.y = 0;
        }

        // --- Construction animation ---
        const constrOverlay = document.getElementById('v3dConstructionOverlay');
        const constrProgress = document.getElementById('v3dConstrProgress');
        const constrPhase = document.getElementById('v3dConstrPhase');
        const constrPct = document.getElementById('v3dConstrPct');
        const constrSteps = document.querySelectorAll('.constr-step');

        const phases = ['Preparing site...', 'Building roads...', 'Laying pipes...', 'Installing nodes...', 'Starting water flow...'];
        const phaseNames = ['Ground', 'Road', 'Pipes', 'Nodes', 'Flow'];

        if (viewer3D.constructAnim && viewer3D.constructProgress < 1) {
            const speed = 0.004 * (viewer3D.buildSpeed || 1.5);
            viewer3D.constructProgress = Math.min(1, viewer3D.constructProgress + speed);

            if (constrOverlay) constrOverlay.style.display = 'block';
            if (constrPct) constrPct.textContent = Math.round(viewer3D.constructProgress * 100) + '%';
            if (constrProgress) constrProgress.style.width = (viewer3D.constructProgress * 100) + '%';

            const currentPhase = Math.min(4, Math.floor(viewer3D.constructProgress * 5));
            if (constrPhase) constrPhase.textContent = phases[currentPhase] || 'Complete!';
            constrSteps.forEach((step, i) => {
                step.classList.toggle('done', i <= currentPhase);
                step.classList.toggle('active', i === currentPhase);
            });
        } else if (viewer3D.constructAnim && viewer3D.constructProgress >= 1) {
            if (constrPhase) constrPhase.textContent = 'Construction complete!';
            if (constrPct) constrPct.textContent = '100%';
            if (constrProgress) constrProgress.style.width = '100%';
            if (constrOverlay) {
                setTimeout(() => { constrOverlay.style.display = 'none'; }, 3000);
            }
            viewer3D.constructAnim = false;
        } else {
            if (constrOverlay) constrOverlay.style.display = 'none';
        }

        const prog = viewer3D.constructAnim ? viewer3D.constructProgress : 1;
        viewer3D.buildMeshes.forEach(m => {
            const order = m.userData.buildOrder ?? 0;
            const threshold = order / 5;
            m.visible = prog >= threshold;
            if (m.visible && viewer3D.constructAnim) {
                const s = Math.min(1, (prog - threshold) * 5);
                m.scale.set(s, s, s);
            } else if (!viewer3D.constructAnim) {
                m.scale.set(1, 1, 1);
            }
            // --- Cutaway: hide mesh above cutaway plane ---
            if (viewer3D.showCutaway && m.type !== 'Sprite' && m.geometry) {
                m.material.clippingPlanes = m.material.clippingPlanes || [];
                if (m.material.clippingPlanes.length === 0) {
                    m.material.clippingPlanes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), viewer3D.cutawayHeight));
                    m.material.clipShadows = true;
                } else {
                    m.material.clippingPlanes[0].constant = viewer3D.cutawayHeight;
                }
                m.material.needsUpdate = true;
            } else if (m.material && m.material.clippingPlanes) {
                m.material.clippingPlanes = [];
                m.material.needsUpdate = true;
            }
        });

        // --- Dimension labels only visible during construction ---
        if (viewer3D.dimLabels) {
            viewer3D.dimLabels.forEach(l => {
                l.visible = viewer3D.constructAnim && viewer3D.constructProgress < 1;
            });
        }

        // --- Flow particles along pipe slopes (scenario-aware) ---
        const scenarioMul = viewer3D.scenarioData[viewer3D.scenario]?.flowMul || 1;
        viewer3D.flowPhase += 0.016 * scenarioMul;
        viewer3D.flowParticles.forEach(p => {
            if (!p.visible) return;
            const line = p.userData.pipeLine;
            line.t = (line.t + 0.003 * scenarioMul) % 1;
            const t = line.t;
            // Color shift based on scenario
            const scColor = viewer3D.scenarioData[viewer3D.scenario]?.color || '#22c55e';
            p.material.color.set(scColor);
            p.position.set(
                line.x1 + (line.x2 - line.x1) * t,
                line.y1 + (line.y2 - line.y1) * t - 2 + Math.sin(viewer3D.flowPhase + t * 8) * 1.5,
                line.z1 + (line.z2 - line.z1) * t
            );
            // Pulse opacity with scenario emphasis
            const baseOp = viewer3D.scenario === 'drought' ? 0.15 : 0.5;
            p.material.opacity = baseOp + (0.5 - baseOp + 0.5) * Math.sin(viewer3D.flowPhase * 2 + t * 10);
        });

        // --- Rain particle animation ---
        viewer3D.rainParticles.forEach(rain => {
            if (!rain.geometry) return;
            const pos = rain.geometry.attributes.position;
            const arr = pos.array;
            for (let i = 0; i < arr.length; i += 3) {
                arr[i + 1] -= 3 * scenarioMul; // fall speed
                if (arr[i + 1] < -50) arr[i + 1] = 350;
                arr[i] += Math.sin(viewer3D.flowPhase + i) * 0.2; // slight sway
            }
            pos.needsUpdate = true;
        });

        // --- Wind particle animation ---
        viewer3D.windParticles?.forEach(wind => {
            if (!wind.geometry) return;
            const pos = wind.geometry.attributes.position;
            const arr = pos.array;
            const intensity = wind.userData.windIntensity || 0.3;
            for (let i = 0; i < arr.length; i += 3) {
                arr[i] += 1.5 * intensity; // horizontal drift
                if (arr[i] > 400) arr[i] = -400;
                arr[i + 1] += Math.sin(viewer3D.flowPhase * 2 + i) * 0.15; // slight vertical gust
            }
            pos.needsUpdate = true;
        });

        // --- Lightning timer reset ---
        if (viewer3D._lightningTimer != null) {
            viewer3D._lightningTimer = (viewer3D._lightningTimer + 1) % 180;
        }

        // --- Tour highlight pulse ---
        if (viewer3D.tourActive) {
            const pulse = 0.3 + 0.4 * Math.sin(viewer3D.flowPhase * 3);
            viewer3D.tourHighlighted.forEach(m => {
                if (m.material && m.material.emissive) {
                    m.material.emissiveIntensity = pulse;
                }
            });
        }

        // --- Auto-demo timer ---
        if (viewer3D.demoMode) {
            viewer3D.demoTimer += 0.016;
            const phase = viewer3D.demoPhases[viewer3D.demoIdx];
            if (phase && viewer3D.demoTimer >= phase.duration) {
                viewer3D.demoIdx++;
                if (viewer3D.demoIdx >= viewer3D.demoPhases.length) {
                    stopAutoDemo();
                } else {
                    applyDemoPhase();
                }
            }
        }

        viewer3D.controls.update();
        viewer3D.renderer.render(viewer3D.scene, viewer3D.camera);
        viewer3D.animationId = requestAnimationFrame(animate3D);
    }
    animate3D();
}

function reset3DView(){
    if (viewer3D.controls) {
        viewer3D.controls.reset();
        viewer3D.scene.rotation.y = 0;
        init3DViewer(); // Re-center
    }
}
function zoom3D(d){
    if (viewer3D.camera) {
        const zoomSpeed = 50;
        const dir = new THREE.Vector3();
        viewer3D.camera.getWorldDirection(dir);
        viewer3D.camera.position.addScaledVector(dir, d * zoomSpeed);
    }
}
function set3DPreset(p){
    if (!viewer3D.camera || !viewer3D.controls) return;
    const tgt = viewer3D.controls.target;
    viewer3D.scene.rotation.y = 0;
    if(p==='top'){
        viewer3D.camera.position.set(tgt.x, tgt.y + 120, tgt.z + 1);
    } else if(p==='front'){
        viewer3D.camera.position.set(tgt.x, tgt.y + 20, tgt.z + 100);
    } else if(p==='left'){
        viewer3D.camera.position.set(tgt.x - 100, tgt.y + 30, tgt.z);
    } else if(p==='right'){
        viewer3D.camera.position.set(tgt.x + 100, tgt.y + 30, tgt.z);
    } else if(p==='section'){
        viewer3D.camera.position.set(tgt.x, tgt.y + 15, tgt.z + 60);
    } else {
        viewer3D.camera.position.set(tgt.x + 80, tgt.y + 50, tgt.z + 80);
    }
    viewer3D.controls.update();
}
function play3DConstruction(){
    viewer3D.constructAnim = true;
    viewer3D.constructProgress = 0;
    const overlay = document.getElementById('v3dConstructionOverlay');
    if (overlay) { overlay.style.display = 'block'; }
    const progress = document.getElementById('v3dConstrProgress');
    if (progress) { progress.style.width = '0%'; }
    const pct = document.getElementById('v3dConstrPct');
    if (pct) { pct.textContent = '0%'; }
    const phase = document.getElementById('v3dConstrPhase');
    if (phase) { phase.textContent = 'Preparing site...'; }
    init3DViewer();
}
function set3DBuildSpeed(val){
    viewer3D.buildSpeed = parseFloat(val) || 1.5;
    const label = document.getElementById('v3dBuildSpeedVal');
    if (label) label.textContent = viewer3D.buildSpeed.toFixed(1) + 's';
}
// --- Guided Tour ---
function startDesignTour(stepIdx) {
    viewer3D.tourActive = true;
    viewer3D.tourStep = stepIdx || 0;
    const overlay = document.getElementById('v3dTourOverlay');
    if (overlay) overlay.style.display = 'flex';
    updateTourStep();
    set3DPreset(viewer3D.tourSteps[viewer3D.tourStep].camera || 'iso');
    applyTourHighlight();
}
function exitTour() {
    viewer3D.tourActive = false;
    viewer3D.tourHighlighted.forEach(m => { if (m.material) { m.material.emissive?.setHex(0x000000); m.material.emissiveIntensity = 0; } });
    viewer3D.tourHighlighted = [];
    const overlay = document.getElementById('v3dTourOverlay');
    if (overlay) overlay.style.display = 'none';
    const infoEl = document.querySelector('.viewer3d-info p');
    if (infoEl) infoEl.textContent = 'Drag to rotate · Scroll to zoom · Click element for details';
}
function tourNext() {
    if (viewer3D.tourStep < viewer3D.tourSteps.length - 1) {
        viewer3D.tourStep++;
        updateTourStep();
        set3DPreset(viewer3D.tourSteps[viewer3D.tourStep].camera || 'iso');
        applyTourHighlight();
    }
}
function tourPrev() {
    if (viewer3D.tourStep > 0) {
        viewer3D.tourStep--;
        updateTourStep();
        set3DPreset(viewer3D.tourSteps[viewer3D.tourStep].camera || 'iso');
        applyTourHighlight();
    }
}
function updateTourStep() {
    const step = viewer3D.tourSteps[viewer3D.tourStep];
    const titleEl = document.getElementById('v3dTourTitle');
    const descEl = document.getElementById('v3dTourDesc');
    const progEl = document.getElementById('v3dTourProgress');
    const prevBtn = document.getElementById('v3dTourPrev');
    const nextBtn = document.getElementById('v3dTourNext');
    const total = viewer3D.tourSteps.length;
    if (titleEl) titleEl.textContent = step.title;
    if (descEl) descEl.innerHTML = step.desc;
    if (progEl) progEl.textContent = `${viewer3D.tourStep + 1} / ${total}`;
    if (prevBtn) prevBtn.style.display = viewer3D.tourStep === 0 ? 'none' : 'flex';
    if (nextBtn) nextBtn.textContent = viewer3D.tourStep === total - 1 ? 'Finish' : 'Next →';
    // Update dots
    document.querySelectorAll('.v3d-tour-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i === viewer3D.tourStep);
    });
    // Update info bar
    const infoEl = document.querySelector('.viewer3d-info p');
    if (infoEl) infoEl.textContent = `Tour: ${step.title} — ${step.desc.slice(0, 80)}...`;
}
function applyTourHighlight() {
    viewer3D.tourHighlighted.forEach(m => { if (m.material) { m.material.emissive?.setHex(0x000000); m.material.emissiveIntensity = 0; } });
    viewer3D.tourHighlighted = [];
    const step = viewer3D.tourSteps[viewer3D.tourStep];
    if (!step.highlight) return;
    viewer3D.buildMeshes.forEach(m => {
        const ed = m.userData.elementData;
        if (ed && ed.type === step.highlight) {
            if (m.material && m.material.emissive) {
                m.material.emissive.setHex(0x00f5d4);
                m.material.emissiveIntensity = 0.6;
                viewer3D.tourHighlighted.push(m);
                // Make sure element is visible during tour
                m.visible = true;
                m.scale.set(1, 1, 1);
            }
        }
    });
}
// --- Climate Scenarios ---
// ---- Climate water table mesh ----
function updateWaterTable(level) {
    if (!viewer3D.scene) return;
    // Remove old water table
    if (viewer3D.waterTableMesh) {
        viewer3D.scene.remove(viewer3D.waterTableMesh);
        viewer3D.waterTableMesh.geometry.dispose();
        viewer3D.waterTableMesh.material.dispose();
        viewer3D.waterTableMesh = null;
    }
    if (level <= 0.5) return;
    // Semi-transparent water plane that rises with water level
    const waterLevelY = -2 + (level - 0.5) * 6;
    const geo = new THREE.PlaneGeometry(600, 600);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: Math.min(0.35, level * 0.08),
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = waterLevelY;
    mesh.userData.buildOrder = 6;
    viewer3D.scene.add(mesh);
    viewer3D.waterTableMesh = mesh;
    viewer3D.buildMeshes.push(mesh);
}

// ---- Climate wind particles ----
function updateWindParticles(intensity) {
    if (!viewer3D.scene || typeof THREE === 'undefined') return;
    // Remove old wind
    if (viewer3D.windParticles) {
        viewer3D.windParticles.forEach(p => viewer3D.scene.remove(p));
        viewer3D.windParticles = [];
    }
    if (intensity <= 0) return;
    const count = Math.round(intensity * 80);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 800;
        positions[i * 3 + 1] = Math.random() * 300 - 20;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 800;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0xffffff, size: 1.2, transparent: true, opacity: intensity * 0.5,
    });
    const wind = new THREE.Points(geo, mat);
    wind.userData.buildOrder = 6;
    wind.userData.isWind = true;
    wind.userData.windIntensity = intensity;
    viewer3D.scene.add(wind);
    viewer3D.windParticles = [wind];
    viewer3D.buildMeshes.push(wind);
}

// ---- Surface flooding mesh ----
function updateSurfaceFlood(level) {
    if (!viewer3D.scene) return;
    if (viewer3D.floodMesh) {
        viewer3D.scene.remove(viewer3D.floodMesh);
        viewer3D.floodMesh.geometry.dispose();
        viewer3D.floodMesh.material.dispose();
        viewer3D.floodMesh = null;
    }
    if (level < 2.5) return;
    const floodOpacity = Math.min(0.25, (level - 2.5) * 0.12);
    const geo = new THREE.PlaneGeometry(800, 800);
    const mat = new THREE.MeshBasicMaterial({
        color: 0x1a3a5c,
        transparent: true,
        opacity: floodOpacity,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.15;
    mesh.userData.buildOrder = 6;
    viewer3D.scene.add(mesh);
    viewer3D.floodMesh = mesh;
    viewer3D.buildMeshes.push(mesh);
}

// ---- Pipe surcharge color update ----
function updatePipeSurcharge(level) {
    if (!viewer3D.scene) return;
    const isSurcharged = level > 1.8;
    viewer3D.buildMeshes.forEach(m => {
        const ed = m.userData.elementData;
        if (ed && ed.type === 'pipe' && m.material && m.material.color) {
            if (isSurcharged) {
                const t = Math.min(1, (level - 1.8) / 2);
                const r = 1, g = 1 - t * 0.6, b = 1 - t * 0.8;
                m.material.color.setRGB(r, g, b);
                m.material.emissive = m.material.emissive || new THREE.Color(0xff0000);
                m.material.emissive.setRGB(t * 0.5, 0, 0);
            } else if (m.userData._origColor) {
                m.material.color.set(m.userData._origColor);
                if (m.material.emissive) m.material.emissive.setHex(0x000000);
            }
        }
    });
}

function setScenario(name) {
    viewer3D.scenario = name;
    const data = viewer3D.scenarioData[name];
    if (!data) return;
    // Update UI
    document.querySelectorAll('.scenario-btn').forEach(b => b.classList.toggle('active', b.dataset.scenario === name));
    const descEl = document.getElementById('v3dScenarioDesc');
    if (descEl) descEl.textContent = data.desc;
    if (!viewer3D.scene) return; // 3D not initialized yet
    // Update scene ambiance
    if (viewer3D.scene) {
        viewer3D.scene.background = new THREE.Color(data.bg);
        viewer3D.scene.fog = new THREE.FogExp2(data.bg, data.fog);
        // Adjust ambient light
        viewer3D.scene.children.forEach(c => {
            if (c.isAmbientLight) c.intensity = data.ambient;
        });
    }
    // Update rain particles
    updateRainParticles(data.rain);
    // --- Enhanced climate effects ---
    updateWaterTable(data.waterLevel);
    // Wind intensity based on scenario
    const windMap = { normal: 0.1, 'heavy-rain': 0.4, storm: 0.8, flood: 0.3, drought: 0.3, extreme: 0.7 };
    updateWindParticles(windMap[name] || 0);
    updateSurfaceFlood(data.waterLevel);
    updatePipeSurcharge(data.waterLevel);
    // Lightning flash during storm/extreme
    if (name === 'storm' || name === 'extreme') {
        viewer3D._lightningTimer = (viewer3D._lightningTimer || 0) + 1;
        if (viewer3D._lightningTimer % 90 < 3) {
            if (viewer3D.scene) {
                viewer3D.scene.background = new THREE.Color(0xffffff);
                setTimeout(() => {
                    if (viewer3D.scene) viewer3D.scene.background = new THREE.Color(data.bg);
                }, 80);
            }
        }
    }
    triggerScenarioNotification(name);
}
function getDrainageStats(scenarioName) {
    const calc = window._calcResults;
    if (!calc) return null;
    const stats = {
        normal: { flowMul: 1, surcharge: 'None', floodRisk: 'Low', infil: 'Normal', velocityDesc: 'Design velocity' },
        'heavy-rain': { flowMul: 2.5, surcharge: 'Moderate', floodRisk: 'Medium', infil: 'Reduced (saturated)', velocityDesc: 'Near full capacity' },
        storm: { flowMul: 4, surcharge: 'High', floodRisk: 'High', infil: 'Minimal (saturated)', velocityDesc: 'Scour risk — erosion protection needed' },
        flood: { flowMul: 6, surcharge: 'Critical', floodRisk: 'Extreme', infil: 'Zero (saturated)', velocityDesc: 'Overloaded — emergency overflow active' },
        drought: { flowMul: 0.1, surcharge: 'None', floodRisk: 'None', infil: 'High (dry soil)', velocityDesc: 'Minimal flow — sediment may settle' },
        extreme: { flowMul: 5, surcharge: 'Extreme', floodRisk: 'Very High', infil: 'Rapidly varying', velocityDesc: 'Cyclic loading — system under maximum stress' },
    };
    const s = stats[scenarioName] || stats.normal;
    const Q = calc.Q * s.flowMul;
    const capacity = calc.capacity || (calc.Vfull * Math.PI * Math.pow((calc.pipeDia || 225) / 2000 / 2, 2)) || 0.01;
    const capUtil = Math.min(100, (Q / Math.max(capacity, 0.001)) * 100);
    return { ...s, Q, capUtil, pipeDia: calc.pipeDia, material: calc.material };
}

function triggerScenarioNotification(name) {
    const data = viewer3D.scenarioData[name];
    if (!data) return;
    const notif = document.getElementById('v3dScenarioNotif');
    const notifName = document.getElementById('v3dScenarioNotifName');
    const notifDesc = document.getElementById('v3dScenarioNotifDesc');
    const notifDrainage = document.getElementById('v3dScenarioNotifDrainage');
    if (notif && notifName && notifDesc) {
        notifName.textContent = data.name;
        notifName.style.color = data.color;
        notifDesc.textContent = data.desc;
        // Add drainage performance stats
        if (notifDrainage) {
            const ds = getDrainageStats(name);
            if (ds) {
                notifDrainage.innerHTML = `
                    <div class="drainage-stats-grid">
                        <span><strong>Flow:</strong> ${ds.Q.toFixed(4)} m³/s (×${ds.flowMul})</span>
                        <span><strong>Capacity:</strong> ${ds.capUtil.toFixed(0)}%</span>
                        <span><strong>Surcharge:</strong> ${ds.surcharge}</span>
                        <span><strong>Flood Risk:</strong> ${ds.floodRisk}</span>
                        <span><strong>Infiltration:</strong> ${ds.infil}</span>
                        <span><strong>Velocity:</strong> ${ds.velocityDesc}</span>
                    </div>
                `;
            } else {
                notifDrainage.innerHTML = '<div class="drainage-stats-placeholder">Run Calculator to see drainage performance per scenario</div>';
            }
        }
        notif.style.display = 'block';
        notif.style.opacity = '1';
        notif.style.transform = 'translateX(0)';
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transform = 'translateX(120%)';
            setTimeout(() => { notif.style.display = 'none'; }, 500);
        }, 5000);
    }
}
function updateRainParticles(intensity) {
    if (!viewer3D.scene || typeof THREE === 'undefined') return;
    // Remove old rain
    viewer3D.rainParticles.forEach(p => viewer3D.scene.remove(p));
    viewer3D.rainParticles = [];
    if (intensity <= 0) return;
    const count = Math.round(intensity * 300);
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 1200;
        positions[i * 3 + 1] = Math.random() * 400 - 50;
        positions[i * 3 + 2] = (Math.random() - 0.5) * 1200;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
        color: 0x88ccff, size: 2, transparent: true, opacity: intensity * 0.6,
    });
    const rain = new THREE.Points(geo, mat);
    rain.userData.buildOrder = 5;
    rain.userData.isRain = true;
    viewer3D.scene.add(rain);
    viewer3D.rainParticles.push(rain);
}
// --- Auto Demo ---
function startAutoDemo() {
    viewer3D.demoMode = true;
    viewer3D.demoIdx = 0;
    viewer3D.demoTimer = 0;
    viewer3D.autoRot = true;
    document.getElementById('btn3dRotate')?.classList.add('active');
    const btn = document.getElementById('v3dDemoBtn');
    if (btn) { btn.textContent = '■ Stop Demo'; btn.classList.add('active'); }
    const demoNotif = document.getElementById('v3dDemoNotif');
    if (demoNotif) demoNotif.style.display = 'flex';
    applyDemoPhase();
}
function stopAutoDemo() {
    viewer3D.demoMode = false;
    viewer3D.demoTimer = 0;
    viewer3D.autoRot = false;
    document.getElementById('btn3dRotate')?.classList.remove('active');
    const btn = document.getElementById('v3dDemoBtn');
    if (btn) { btn.textContent = '▶ Auto Demo'; btn.classList.remove('active'); }
    const demoNotif = document.getElementById('v3dDemoNotif');
    if (demoNotif) demoNotif.style.display = 'none';
    const infoEl = document.querySelector('.viewer3d-info p');
    if (infoEl) infoEl.textContent = 'Drag to rotate · Scroll to zoom · Click element for details';
    if (viewer3D.tourActive) exitTour();
}
function applyDemoPhase() {
    const phase = viewer3D.demoPhases[viewer3D.demoIdx];
    if (!phase) { stopAutoDemo(); return; }
    setScenario(phase.scenario);
    // Auto-advance tour to show relevant step
    if (viewer3D.tourActive) {
        viewer3D.tourStep = phase.tourStep;
        updateTourStep();
        applyTourHighlight();
    }
    // Update demo notification with drainage stats
    const phaseNameEl = document.getElementById('v3dDemoPhaseName');
    const phaseDescEl = document.getElementById('v3dDemoPhaseDesc');
    const phaseProgEl = document.getElementById('v3dDemoPhaseProg');
    const phaseDrainageEl = document.getElementById('v3dDemoPhaseDrainage');
    if (phaseNameEl) phaseNameEl.textContent = viewer3D.scenarioData[phase.scenario]?.name || phase.scenario;
    if (phaseDescEl) phaseDescEl.textContent = viewer3D.scenarioData[phase.scenario]?.desc || '';
    if (phaseProgEl) phaseProgEl.textContent = `${viewer3D.demoIdx + 1} / ${viewer3D.demoPhases.length}`;
    // Show drainage behavior per climate
    if (phaseDrainageEl) {
        const ds = getDrainageStats(phase.scenario);
        if (ds) {
            phaseDrainageEl.innerHTML = `
                <div class="demo-drainage-info">
                    <div class="demo-drainage-row"><span>Flow Rate</span><strong>${ds.Q.toFixed(4)} m³/s</strong></div>
                    <div class="demo-drainage-row"><span>Capacity Use</span><strong>${ds.capUtil.toFixed(0)}%</strong></div>
                    <div class="demo-drainage-row"><span>Surcharge</span><strong>${ds.surcharge}</strong></div>
                    <div class="demo-drainage-row"><span>Flood Risk</span><strong>${ds.floodRisk}</strong></div>
                    <div class="demo-drainage-row"><span>Infiltration</span><strong>${ds.infil}</strong></div>
                </div>
            `;
        } else {
            phaseDrainageEl.innerHTML = '<div class="demo-drainage-placeholder">Run Calculator for drainage data</div>';
        }
    }
    viewer3D.demoTimer = 0;
}

function toggle3DFlow(){
    viewer3D.showFlow = !viewer3D.showFlow;
    const btn = document.getElementById('btn3dFlow');
    if (btn) btn.classList.toggle('active', viewer3D.showFlow);
    init3DViewer();
}
function toggle3DWireframe(){
    viewer3D.wireframe=!viewer3D.wireframe;
    document.getElementById('btn3dWireframe').classList.toggle('active',viewer3D.wireframe);
    init3DViewer(); 
}
function toggle3DAutoRotate(){viewer3D.autoRot=!viewer3D.autoRot;document.getElementById('btn3dRotate').classList.toggle('active',viewer3D.autoRot);}
function toggle3DLabels(){viewer3D.showLabels=!viewer3D.showLabels;document.getElementById('btn3dLabels').classList.toggle('active',!viewer3D.showLabels); init3DViewer();}
function toggle3DShadows(){viewer3D.showShadows=document.getElementById('v3dShadows').checked; init3DViewer();}
function toggle3DGround(){viewer3D.showGround=document.getElementById('v3dGround').checked; init3DViewer();}
function toggle3DAxes(){viewer3D.showAxes=document.getElementById('v3dAxes').checked; init3DViewer();}
function toggle3DFog(){viewer3D.fogEnabled=!viewer3D.fogEnabled; init3DViewer();}
function set3DCutaway(val){
    viewer3D.cutawayHeight = parseFloat(val) || 0;
    viewer3D.showCutaway = viewer3D.cutawayHeight < 0;
}

function update3DStats(){
    const els=(typeof CAD!=='undefined')?CAD.elements:[];
    const pipes=els.filter(e=>e.type==='pipe'), nodes=els.filter(e=>['manhole','catchpit','outlet','junction'].includes(e.type));
    let totalLen=0, minDepth=Infinity, maxDepth=0;
    pipes.forEach(p=>totalLen+=Math.hypot((p.x2||0)-p.x,(p.y2||0)-p.y));
    nodes.forEach(n=>{
        const d = getNodeDepthM(n, 1.5);
        minDepth = Math.min(minDepth, d);
        maxDepth = Math.max(maxDepth, d);
    });
    document.getElementById('v3dPipes').textContent=pipes.length;
    document.getElementById('v3dNodes').textContent=nodes.length;
    document.getElementById('v3dLength').textContent=totalLen.toFixed(1)+' m';
    document.getElementById('v3dDepth').textContent=nodes.length
        ? `${minDepth.toFixed(1)}–${maxDepth.toFixed(1)} m`
        : '—';
}

function drawSideCanvases(){
    const calc = window._calcResults;
    const pipeDia = calc?.pipeDia || 225;
    const design = (typeof CAD !== 'undefined' && CAD.exportDesignFor3D) ? CAD.exportDesignFor3D() : null;
    const profile = design?.profile || window._mapProfileData;
    const els = design?.elements || [];

    ['crossSectionCanvas','elevationProfileCanvas'].forEach((id,idx)=>{
        const c=document.getElementById(id);if(!c)return;
        c.width=c.parentElement.clientWidth*2;c.height=240;
        const ctx=c.getContext('2d'),w=c.width/2,h=120;
        ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,w,h);

        if(idx===0){
            // --- Cross-section with pipe, trench & layers ---
            // Background
            ctx.fillStyle='rgba(10,14,26,0.3)';ctx.fillRect(0,0,w,h);

            // Horizontal guides
            ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.5;
            for(let i=0;i<9;i++){ctx.beginPath();ctx.moveTo(0,h/9*i+5);ctx.lineTo(w,h/9*i+5);ctx.stroke();}

            // Ground surface
            ctx.fillStyle='rgba(139,92,46,0.3)';
            ctx.fillRect(0,h*0.48,w,h*0.52);
            ctx.strokeStyle='rgba(139,92,46,0.5)';
            ctx.lineWidth=1.5;
            ctx.beginPath();ctx.moveTo(0,h*0.48);ctx.lineTo(w,h*0.48);
            ctx.stroke();

            // Trench excavation zone
            const trenchTop = h*0.48;
            const trenchBot = h*0.78;
            ctx.fillStyle='rgba(245,158,11,0.08)';
            ctx.fillRect(w*0.15,trenchTop,w*0.7,trenchBot-trenchTop);
            ctx.strokeStyle='rgba(245,158,11,0.15)';
            ctx.lineWidth=0.8;
            ctx.setLineDash([3,3]);
            ctx.beginPath();
            ctx.moveTo(w*0.15,trenchTop);ctx.lineTo(w*0.15,trenchBot);
            ctx.moveTo(w*0.85,trenchTop);ctx.lineTo(w*0.85,trenchBot);
            ctx.stroke();
            ctx.setLineDash([]);

            // Pipe diameter and bed
            const r = Math.max(10, pipeDia / 10);
            const pipeY = h*0.65;
            // Pipe bed (sand/gravel)
            ctx.fillStyle='rgba(200,180,140,0.2)';
            ctx.fillRect(w/2-r-6,pipeY+r-2,r*2+12,6);
            // Pipe circle
            ctx.strokeStyle='#00f5d4';ctx.lineWidth=2.5;
            ctx.beginPath();ctx.arc(w/2,pipeY,r,0,Math.PI*2);ctx.stroke();
            // Pipe fill (half for partial flow)
            ctx.fillStyle='rgba(0,245,212,0.12)';
            ctx.beginPath();ctx.arc(w/2,pipeY,r,0,Math.PI);ctx.fill();
            // Water level line
            ctx.strokeStyle='rgba(0,245,212,0.5)';
            ctx.lineWidth=1;
            ctx.setLineDash([2,3]);
            ctx.beginPath();ctx.arc(w/2,pipeY,r,-Math.PI*0.8,-Math.PI*0.2);ctx.stroke();
            ctx.setLineDash([]);

            // Pipe label
            ctx.fillStyle='rgba(0,245,212,0.9)';
            ctx.font='bold 9px Inter';ctx.textAlign='center';
            ctx.fillText(`DN ${pipeDia}mm · ${calc?.material || 'PVC'}`,w/2,pipeY-8);
            ctx.fillStyle='rgba(232,234,237,0.5)';
            ctx.font='8px Inter';
            ctx.fillText(`S=${calc?.slopePct || 2}% · n=${calc?.manning || 0.013}`,w/2,pipeY+r+14);

            // Cover depth annotation
            const coverM = Math.max(0.9, pipeDia/1000+0.4);
            ctx.fillStyle='rgba(232,234,237,0.6)';ctx.font='8px Inter';
            ctx.textAlign='left';
            ctx.fillText(`Cover: ${coverM.toFixed(1)}m`,w*0.16,trenchTop-4);
            ctx.fillText(`Invert: ${calc?.pipeDia ? (100-coverM-pipeDia/2000).toFixed(2)+'m' : '—'}`,w*0.16,trenchBot-4);

            // Annotations
            ctx.fillStyle='rgba(232,234,237,0.35)';ctx.font='7px Inter';
            ctx.textAlign='left';
            ctx.fillText('Ground',4,h*0.48-4);
            ctx.textAlign='right';
            ctx.fillText('Trench',w-4,trenchTop+10);
        } else {
            // --- Elevation profile with pipe grade line ---
            const pts = profile?.length >= 3 ? profile : Array.from({length:12},(_,i)=>100-i*1.2);
            const minP=Math.min(...pts), maxP=Math.max(...pts), range=maxP-minP||1;
            const scaled=pts.map(p=>((p-minP)/range)*h*0.7+15);

            // Gradient fill under profile
            const grad=ctx.createLinearGradient(0,0,0,h);
            grad.addColorStop(0,'rgba(123,97,255,0.25)');
            grad.addColorStop(1,'rgba(123,97,255,0)');
            ctx.beginPath();
            ctx.moveTo(0,h);
            scaled.forEach((v,i)=>ctx.lineTo(i*(w/(scaled.length-1)),h-v));
            ctx.lineTo(w,h);ctx.closePath();
            ctx.fillStyle=grad;ctx.fill();

            // Profile line
            ctx.beginPath();
            scaled.forEach((v,i)=>i===0?ctx.moveTo(0,h-v):ctx.lineTo(i*(w/(scaled.length-1)),h-v));
            ctx.strokeStyle='rgba(123,97,255,0.8)';ctx.lineWidth=1.8;ctx.stroke();

            // Profile points
            scaled.forEach((v,i)=>{
                if(i%2===0){
                    ctx.beginPath();
                    ctx.arc(i*(w/(scaled.length-1)),h-v,2.5,0,Math.PI*2);
                    ctx.fillStyle='rgba(123,97,255,0.9)';ctx.fill();
                }
            });

            // Pipe grade line (if profile available)
            if (pts.length > 2) {
                const slopeFrac = (calc?.slopePct || 2) / 100;
                const pipeY = scaled.map((v,i)=>{
                    const base = h - v;
                    return base + i * slopeFrac * 8;
                });
                ctx.beginPath();
                pipeY.forEach((v,i)=>i===0?ctx.moveTo(0,v):ctx.lineTo(i*(w/(pipeY.length-1)),v));
                ctx.strokeStyle='rgba(0,245,212,0.4)';
                ctx.lineWidth=1.2;
                ctx.setLineDash([4,4]);
                ctx.stroke();
                ctx.setLineDash([]);
            }

            // Label
            ctx.fillStyle='rgba(232,234,237,0.6)';ctx.font='8px Inter';ctx.textAlign='left';
            ctx.fillText(profile?.length >= 3 ? 'Terrain & pipe grade' : 'Design profile',8,12);
            ctx.fillStyle='rgba(0,245,212,0.5)';ctx.font='7px Inter';
            ctx.fillText('—  Pipe invert grade',8,22);
        }
    });
}


// ============ CHARTS (Chart.js) ============
let chartInstances = {};

// ============ MANNING'S N REFERENCE TABLES ============
const MANNING_N = {
    // Pipe materials
    pipe: {
        PVC: { n: 0.009, label: 'PVC (Smooth)', maxV: 3.0, costPerM: 85, desc: 'Smooth plastic — lowest friction, best for small diameters' },
        HDPE: { n: 0.011, label: 'HDPE (Smooth)', maxV: 3.5, costPerM: 125, desc: 'Durable plastic — good for medium diameters, flexible' },
        'Concrete': { n: 0.013, label: 'Concrete Pipe', maxV: 2.5, costPerM: 160, desc: 'Rigid — standard for large diameters, high structural strength' },
        'RCC': { n: 0.014, label: 'RCC (Reinforced)', maxV: 2.5, costPerM: 210, desc: 'Reinforced concrete — heaviest duty, best for >600mm' },
        'Ductile Iron': { n: 0.012, label: 'Ductile Iron', maxV: 4.0, costPerM: 280, desc: 'High strength — excellent for high pressure and shallow cover' },
        'Steel': { n: 0.010, label: 'Steel (Corrugated)', maxV: 4.5, costPerM: 195, desc: 'Very smooth — highest flow capacity, susceptible to corrosion' },
        'Vitrified Clay': { n: 0.013, label: 'Vitrified Clay', maxV: 3.0, costPerM: 145, desc: 'Chemically resistant — ideal for aggressive wastewater' },
    },
    // Channel / surface types for overland flow
    surface: {
        'Smooth Concrete': 0.012,
        'Rough Concrete': 0.015,
        'Brick/Tile': 0.015,
        'Asphalt': 0.016,
        'Earth (Smooth)': 0.018,
        'Earth (Firm)': 0.025,
        'Gravel': 0.025,
        'Grass (Short)': 0.030,
        'Grass (Long)': 0.040,
        'Dense Weeds': 0.050,
        'Forest Floor': 0.060,
        'Rock Cut': 0.035,
        'Corrugated Metal': 0.024,
    },
    // Auto-suggestion based on soil type and terrain
    autoSuggest(soilType, slopePct, landUse) {
        if (landUse === 'urban' || landUse === 'developed') return 0.013;
        if (landUse === 'agriculture' || landUse === 'farmland') return 0.035;
        if (landUse === 'forest' || landUse === 'woodland') return 0.050;
        if (landUse === 'wetland') return 0.060;
        // Fallback based on soil type
        const soilMap = { clay: 0.025, loam: 0.030, sand: 0.020, gravel: 0.025 };
        return soilMap[soilType] || 0.030;
    },
    // Get all pipe materials sorted by n value
    getPipeMaterials() {
        return Object.entries(this.pipe).sort((a, b) => a[1].n - b[1].n);
    },
    // Get suitable materials for a given diameter
    getSuitableMaterials(diameterMm) {
        return Object.entries(this.pipe)
            .filter(([key, mat]) => {
                if (diameterMm <= 300 && ['PVC', 'HDPE', 'Vitrified Clay'].includes(key)) return true;
                if (diameterMm > 300 && diameterMm <= 600 && ['HDPE', 'Concrete', 'Ductile Iron', 'Vitrified Clay'].includes(key)) return true;
                if (diameterMm > 600 && ['Concrete', 'RCC', 'Ductile Iron', 'Steel'].includes(key)) return true;
                return false;
            })
            .map(([key, mat]) => ({ key, ...mat }));
    },
    // Get suggested pipe material based on diameter
    suggestPipeMaterial(diameterMm) {
        if (diameterMm <= 300) return 'PVC';
        if (diameterMm <= 600) return 'HDPE';
        return 'RCC';
    }
};

const gaugeTextPlugin = {
    id: 'gaugeText',
    beforeDraw(chart) {
        if (chart.config.options.circumference !== 180) return;
        const {ctx, chartArea: {top, bottom, left, right, width, height}} = chart;
        ctx.save();
        const velocity = window._calcResults ? window._calcResults.V : 1.32;
        ctx.fillStyle = '#00f5d4';
        ctx.font = 'bold 32px Outfit';
        ctx.textAlign = 'center';
        // Adjust for padding
        const centerX = (left + right) / 2;
        const centerY = bottom - 30;
        ctx.fillText(velocity.toFixed(2), centerX, centerY);
        ctx.fillStyle = 'rgba(232, 234, 237, 0.5)';
        ctx.font = '14px Inter';
        ctx.fillText('m/s', centerX, centerY + 20);
        
        const status = velocity < 1.2 ? 'OK' : velocity < 2.5 ? 'GOOD' : 'WARNING';
        const stColor = velocity < 2.5 ? '#22c55e' : '#f59e0b';
        ctx.fillStyle = stColor;
        ctx.font = 'bold 12px Inter';
        ctx.fillText(status, centerX, centerY + 40);
        ctx.restore();
    }
};

function initChart(id, type, data, options) {
    if (typeof Chart === 'undefined') {
        setTimeout(() => initChart(id, type, data, options), 200);
        return;
    }
    
    // Check if plugin is registered
    if (!Chart.registry.plugins.get('gaugeText')) {
        Chart.register(gaugeTextPlugin);
    }

    const canvas = document.getElementById(id);
    if (!canvas) return;
    
    if (chartInstances[id]) chartInstances[id].destroy();
    
    Chart.defaults.color = 'rgba(232, 234, 237, 0.7)';
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';
    Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(10, 14, 26, 0.9)';
    Chart.defaults.plugins.tooltip.titleColor = '#00f5d4';
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.borderColor = 'rgba(0, 245, 212, 0.3)';
    Chart.defaults.plugins.tooltip.borderWidth = 1;

    chartInstances[id] = new Chart(canvas, {
        type: type,
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            ...options
        }
    });
}

const STD_PIPE_SIZES = [110, 150, 200, 225, 250, 300, 375, 450, 525, 600, 750, 900, 1050, 1200];

function getCalcResults() {
    const c = window._calcResults;
    if (!c) return null;
    return {
        ...c,
        slopePct: c.slopePct ?? c.slope * 100,
        diameterM: c.diameterM ?? c.pipeDia / 1000,
        soilType: c.soilType ?? ({ 0.65: 'clay', 0.45: 'loam', 0.25: 'sand', 0.15: 'gravel' }[c.C] || 'loam')
    };
}

function selectStandardPipe(dCalcMm) {
    return STD_PIPE_SIZES.find(s => s >= dCalcMm) || STD_PIPE_SIZES[STD_PIPE_SIZES.length - 1];
}

function manningVelocity(n, diameterM, slopeFraction) {
    const R = diameterM / 4;
    return (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(slopeFraction);
}

function pipeFlowAtFull(n, diameterM, slopeFraction) {
    const V = manningVelocity(n, diameterM, slopeFraction);
    const area = Math.PI * Math.pow(diameterM / 2, 2);
    return { V, Q: V * area };
}

function requiredPipeSizeMm(Q, n, slopeFraction) {
    const dCalc = Math.pow((Q * n * Math.pow(4, 2 / 3)) / ((Math.PI / 4) * Math.sqrt(slopeFraction)), 3 / 8) * 1000;
    return selectStandardPipe(dCalc);
}

function velocityStatus(V) {
    if (V < 0.6) return { cls: 'danger', label: 'Too Slow' };
    if (V > 2.5) return { cls: 'warn', label: 'Too Fast' };
    return { cls: 'ok', label: 'Optimal' };
}

function buildSlopeSweep(designSlopePct) {
    const base = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8];
    if (!designSlopePct || base.includes(designSlopePct)) return base;
    return [...base, Number(designSlopePct.toFixed(2))].sort((a, b) => a - b);
}

function computeMaterialBreakdown(c) {
    const lengthM = Math.max(Math.sqrt(c.area) * 2.5, 50);
    const pipeRate = { PVC: 85, HDPE: 125, RCC: 210 }[c.material] || 85;
    const pipeCost = pipeRate * lengthM * (c.pipeDia / 300);
    const manholeCost = Math.ceil(lengthM / 50) * 2500;
    const catchpitCost = Math.max(1, Math.ceil(c.area / 2000)) * 800;
    const fittingCost = pipeCost * 0.18;
    const total = pipeCost + manholeCost + catchpitCost + fittingCost;
    const pct = v => Math.round((v / total) * 100);
    const pipeLabel = `${c.material} Pipes (${c.pipeDia} mm)`;
    return {
        labels: [pipeLabel, 'Manholes', 'Catch Pits', 'Fittings'],
        values: [pct(pipeCost), pct(manholeCost), pct(catchpitCost), pct(fittingCost)],
        colors: [c.material === 'RCC' ? '#94a3b8' : c.material === 'HDPE' ? '#7b61ff' : '#00f5d4', '#f59e0b', '#3b82f6', '#ec4899']
    };
}

function computePerformanceScores(c) {
    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const flowEfficiency = clamp(100 - Math.abs(c.capacityUse - 0.75) * 80, 20, 100);
    const velocityComp = c.V >= 0.6 && c.V <= 2.5
        ? clamp(100 - Math.abs(c.V - 1.5) * 25, 40, 100)
        : clamp(55 - Math.abs(c.V - 1.5) * 20, 10, 60);
    const capacity = c.capacityUse <= 1
        ? clamp(100 - Math.max(0, 0.85 - c.capacityUse) * 40, 35, 100)
        : clamp(100 - (c.capacityUse - 1) * 120, 0, 100);
    const erosionRes = clamp(100 - Math.max(0, c.V - 2.0) * 35 - Math.max(0, c.Fr - 0.9) * 30, 15, 100);
    const costEff = { PVC: 92, HDPE: 74, RCC: 48 }[c.material] || 70;
    const strength = clamp(45 + c.pipeDia / 18 + (c.material === 'RCC' ? 25 : c.material === 'HDPE' ? 12 : 0), 30, 100);
    return [flowEfficiency, velocityComp, capacity, erosionRes, costEff, strength].map(v => Math.round(v));
}

function showResultsPlaceholder(show) {
    const page = document.getElementById('page-results');
    if (!page) return;
    let banner = document.getElementById('resultsNoCalcBanner');
    if (show) {
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'resultsNoCalcBanner';
            banner.className = 'glass-card';
            banner.style.cssText = 'margin-bottom:24px;padding:20px;text-align:center;color:var(--text-secondary)';
            banner.innerHTML = '<p style="margin-bottom:14px">Run the <strong>Hydraulic Calculator</strong> first — graphs and tables are generated from your slope, rainfall, catchment area, Manning&rsquo;s n, and soil inputs.</p><button class="btn btn-primary" onclick="navigateTo(\'calculator\')">Go to Calculator</button>';
            page.querySelector('.page-header').after(banner);
        }
        banner.style.display = 'block';
    } else if (banner) {
        banner.style.display = 'none';
    }
}

function clearResultCharts() {
    Object.keys(chartInstances).forEach(id => {
        chartInstances[id]?.destroy();
        delete chartInstances[id];
    });
}

// ============ CHART EXPLANATIONS ============
const chartExplanations = {
    flowVelocity: {
        title: 'Flow Rate & Velocity vs Slope',
        purpose: 'Shows how the pipe slope (gradient) affects flow velocity and discharge capacity for the selected pipe diameter. Steeper slopes increase velocity and flow rate due to greater gravitational driving force.',
        axes: 'X-axis: Longitudinal slope of the pipe (% grade). Y-axis (left): Flow velocity in meters per second (m/s), calculated from Manning\'s equation. Y-axis (right): Volumetric flow rate in cubic meters per second (m³/s). The design point is highlighted with a larger marker at your selected slope.',
        interp: 'Look at how velocity changes with slope — a steeper slope (moving right) increases velocity but may exceed the recommended maximum of 2.5 m/s, risking pipe erosion. A shallower slope may cause sediment deposition below 0.6 m/s. The ideal slope keeps velocity between 0.6-2.5 m/s for self-cleansing flow without scour.',
        tip: 'If velocity is too high (>2.5 m/s), consider a flatter slope, larger diameter, or more erosion-resistant material like RCC. If too low (<0.6 m/s), increase the slope or reduce pipe diameter to maintain self-cleansing velocity.'
    },
    discharge: {
        title: 'Peak Discharge vs Rainfall',
        purpose: 'Illustrates how the peak stormwater runoff (Q) increases with rainfall intensity. This uses the Rational Method: Q = C·I·A, where C is the runoff coefficient (based on soil type), I is rainfall intensity, and A is catchment area.',
        axes: 'X-axis: Rainfall intensity in mm/hr (millimeters per hour), ranging from 40% to 200% of your design intensity. Y-axis: Peak discharge in m³/s. The solid curve shows how runoff grows non-linearly with rainfall. Your design point is marked with a highlighted circle.',
        interp: 'Find your design rainfall intensity on the x-axis and read the corresponding discharge. If actual rainfall exceeds the design intensity (e.g., during a 100-year storm), the discharge will surpass pipe capacity, potentially causing surface flooding. The curve helps you assess what safety factor your design provides.',
        tip: 'For critical infrastructure, consider designing for a 1.5x to 2x safety factor on rainfall intensity. This ensures the system can handle extreme events beyond the design storm without catastrophic failure.'
    },
    barPipeSize: {
        title: 'Pipe Size Comparison by Slope',
        purpose: 'Shows the minimum standard pipe diameter required to convey the design flow (Q) at different slopes, based on Manning\'s equation. Bars represent calculated requirements, while the dashed line shows your selected pipe size.',
        axes: 'X-axis: Slope categories (%). Y-axis: Pipe diameter in millimeters (mm). Each bar is the smallest standard pipe size that can handle the design flow at that slope. The highlighted bar (green) corresponds to your design slope. The orange dashed line is your selected pipe diameter.',
        interp: 'Compare the bar at your design slope to the dashed line — if the bar is taller than the line, your selected pipe is undersized for that slope. Steeper slopes require smaller pipes (gravity assists flow), while flatter slopes need larger diameters to maintain capacity.',
        tip: 'If the required pipe at your design slope is significantly larger than selected, either increase the pipe diameter or steepen the slope. The standard sizes jump from 225mm to 250mm to 300mm etc. — choose the next size up for safety margin.'
    },
    donut: {
        title: 'Material Cost Distribution',
        purpose: 'Breaks down the estimated cost of the drainage network by component: pipes, manholes, catch pits, and fittings. This helps visualize where the budget is allocated and identify cost-saving opportunities.',
        axes: 'The donut chart shows percentage allocation. Hover over each segment to see the exact percentage. Pipe material costs dominate and are proportional to pipe length, diameter, and material unit rate (PVC: $85/m, HDPE: $125/m, RCC: $210/m).',
        interp: 'Pipes typically account for 50-70% of total cost. Manholes (at ~$2,500 each) are the second major cost, with spacing every ~50m. Catch pits serve each ~2,000 m² of catchment. Fittings add ~18% to pipe cost. A material change from PVC to HDPE increases pipe cost but may reduce maintenance.',
        tip: 'For cost optimization on long runs, use PVC (cheapest) where cover depth and loading allow. Switch to RCC only for large diameters (>600mm) or where high structural strength is needed. Reduce manhole count by aligning pipes in straight runs where possible.'
    },
    radar: {
        title: 'Performance Radar Analysis',
        purpose: 'Provides a multi-dimensional score (0-100) of your drainage design across six key performance criteria. This helps quickly identify strengths and weaknesses of the design at a glance.',
        axes: 'Six axes: Flow Efficiency (how close to 75% capacity utilization), Velocity Compliance (within 0.6-2.5 m/s range), Capacity (margin below full pipe flow), Erosion Resistance (resistance to scour at high velocities), Cost Efficiency (material-based comparison), and Structural Strength (based on diameter and material).',
        interp: 'A larger polygon area indicates better overall design. Scores below 40 in any category suggest a design deficiency. The ideal design has balanced scores across all six axes. Note that cost efficiency often trades off against structural strength (PVC is cheap but less strong than RCC).',
        tip: 'Target a minimum score of 60 in all categories. If Flow Efficiency is low, adjust pipe diameter. If Erosion Resistance is low, consider velocity reduction or tougher materials. Use this as a comparative tool between design alternatives.'
    },
    gauge: {
        title: 'Velocity Compliance Gauge',
        purpose: 'A quick visual check of whether the actual flow velocity falls within the recommended range for self-cleansing drainage pipes. The gauge fills from 0 to 3.0 m/s with color-coded zones.',
        axes: 'The gauge reads velocity from 0 m/s (empty) to 3.0 m/s (full). Color zones: Red (0-0.6 m/s) — too slow, risk of sediment deposition. Green (0.6-1.2 m/s) — acceptable. Bright Green (1.2-2.5 m/s) — optimal. Red (>2.5 m/s) — too fast, erosion risk.',
        interp: 'The needle position shows current velocity. The status text (OK/GOOD/WARNING) is shown below. For stormwater systems, 1.0-2.0 m/s is ideal — fast enough to keep solids in suspension but slow enough to avoid pipe scour. The subtitle shows the optimal range reference.',
        tip: 'If in the red zone (low), increase slope or reduce diameter. If in the red zone (high), add flow control structures or increase diameter. For combined sewers, maintain at least 0.75 m/s at average flow to prevent solids deposition.'
    },
    hgl: {
        title: 'Hydraulic Grade Line & Energy Line',
        purpose: 'Shows the energy profile of the drainage system along its length. The Hydraulic Grade Line (HGL) represents the water surface elevation in the pipe, while the Energy Grade Line (EGL) includes velocity head. The difference between ground and HGL shows available burial depth.',
        axes: 'X-axis: Station along the pipe (meters). Y-axis: Elevation (meters). Four lines: Ground level (brown, dashed) — surface terrain. Pipe Invert (blue) — bottom of pipe. HGL (cyan) — water surface under design flow. EGL (red, dashed) — total energy including velocity.',
        interp: 'The HGL must stay below ground level to prevent surcharging (water escaping the pipe). If HGL crosses above ground, the pipe is overloaded and surface flooding will occur. The vertical gap between ground and invert is the cover depth. The gap between HGL and EGL is the velocity head (V²/2g). Where HGL drops below pipe crown, the pipe flows partially full — this is normal for gravity systems.',
        tip: 'If HGL approaches or exceeds ground level, increase pipe diameter or add relief structures. A HGL that stays well below ground (2m+) provides good safety factor for future flow increases. The EGL should always be above or equal to HGL — if not, check for data errors.'
    }
};

function showChartExplain(key) {
    const data = chartExplanations[key];
    if (!data) return;
    document.getElementById('chartExplainTitle').textContent = data.title;
    document.getElementById('chartExplainPurpose').textContent = data.purpose;
    document.getElementById('chartExplainAxes').textContent = data.axes;
    document.getElementById('chartExplainInterp').textContent = data.interp;
    document.getElementById('chartExplainTip').textContent = data.tip;
    document.getElementById('chartExplainOverlay').style.display = 'flex';
}
function closeChartExplain(e) {
    if (e && e.target !== e.currentTarget) return;
    document.getElementById('chartExplainOverlay').style.display = 'none';
}

function drawAllCharts() {
    const c = getCalcResults();
    showResultsPlaceholder(!c);
    if (!c) {
        clearResultCharts();
        const tbody = document.getElementById('resultsTableBody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-secondary)">No calculation data — run the calculator first.</td></tr>';
        }
        return;
    }

    drawFlowVelocityChart(c);
    drawDischargeChart(c);
    drawBarChart(c);
    drawDonutChart(c);
    drawRadarChart(c);
    drawGaugeChart(c);
    drawHGLChart(c);
    fillMaterialComparison(c);
    fillResultsTable(c);
}

function drawFlowVelocityChart(c) {
    const slopes = buildSlopeSweep(c.slopePct);
    const n = c.manning;
    const D = c.diameterM;
    const designIdx = slopes.findIndex(s => Math.abs(s - c.slopePct) < 0.01);
    const vel = slopes.map(s => manningVelocity(n, D, s / 100));
    const flow = vel.map(v => v * Math.PI * Math.pow(D / 2, 2));
    // Actual velocity based on real flow Q, not full-pipe velocity
    const actualV = c.Q / (Math.PI * Math.pow(D / 2, 2));
    const actualDepthRatio = c.capacityUse; // Depth ratio when flowing partially full

    initChart('chartFlowVelocity', 'line', {
        labels: slopes.map(s => s + '%'),
        datasets: [
            {
                label: `Velocity @ ${c.pipeDia} mm (n=${n})`,
                data: vel,
                borderColor: '#00f5d4',
                backgroundColor: 'rgba(0, 245, 212, 0.1)',
                yAxisID: 'y',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: slopes.map((_, i) => i === designIdx ? '#fff' : '#00f5d4'),
                pointRadius: slopes.map((_, i) => i === designIdx ? 8 : 3),
                pointBorderColor: slopes.map((_, i) => i === designIdx ? '#00f5d4' : '#00f5d4'),
                pointBorderWidth: slopes.map((_, i) => i === designIdx ? 3 : 1)
            },
            {
                label: `Flow @ ${c.pipeDia} mm`,
                data: flow,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                yAxisID: 'y1',
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6',
                pointRadius: 3
            },
            {
                label: `Design Q=${c.Q.toFixed(4)} m³/s`,
                data: slopes.map(() => c.Q),
                borderColor: '#f59e0b',
                borderDash: [6, 4],
                borderWidth: 1.5,
                yAxisID: 'y1',
                pointRadius: 0,
                fill: false
            }
        ]
    }, {
        interaction: { mode: 'index', intersect: false },
        plugins: {
            subtitle: { display: true, text: `Design: ${c.slopePct}% → V=${c.V.toFixed(2)} m/s · Actual flow Q=${c.Q.toFixed(4)} m³/s at ${(c.capacityUse * 100).toFixed(0)}% depth`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } }
        },
        scales: {
            y: {
                type: 'linear', display: true, position: 'left', title: { display: true, text: 'Velocity (m/s)' },
                min: 0
            },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Flow Rate (m³/s)' }, grid: { drawOnChartArea: false } }
        }
    });
}

function drawDischargeChart(c) {
    const designIntensity = c.rainfallIntensity;
    const multipliers = [0.3, 0.5, 0.7, 0.85, 1.0, 1.15, 1.3, 1.5, 1.75, 2.0, 2.5, 3.0];
    const intensities = multipliers.map(m => Number((designIntensity * m).toFixed(1)));
    const disc = intensities.map(i => c.C * (i / 1000 / 3600) * c.area);
    const designIdx = multipliers.findIndex(m => Math.abs(m - 1.0) < 0.01);
    const pipeCapacity = c.capacity;

    initChart('chartDischarge', 'line', {
        labels: intensities,
        datasets: [
            {
                label: `Peak Runoff Q (C=${c.C}, A=${c.area.toLocaleString()} m²)`,
                data: disc.map(d => Number(d.toFixed(4))),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.2)',
                fill: true,
                tension: 0.3,
                borderWidth: 2,
                pointBackgroundColor: intensities.map((_, i) => i === designIdx ? '#fff' : '#f59e0b'),
                pointRadius: intensities.map((_, i) => i === designIdx ? 8 : 4),
                pointBorderColor: '#f59e0b',
                pointBorderWidth: intensities.map((_, i) => i === designIdx ? 2 : 1)
            },
            {
                label: `Pipe Capacity (${c.pipeDia}mm) = ${pipeCapacity.toFixed(4)} m³/s`,
                data: intensities.map(() => pipeCapacity),
                borderColor: '#00f5d4',
                borderDash: [4, 4],
                borderWidth: 2,
                pointRadius: 0,
                fill: false
            }
        ]
    }, {
        plugins: {
            subtitle: { display: true, text: `Design: ${designIntensity.toFixed(1)} mm/hr → ${c.Q.toFixed(4)} m³/s (${c.soilType}) · Capacity use: ${(c.capacityUse * 100).toFixed(1)}%`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } }
        },
        scales: {
            x: { title: { display: true, text: 'Rainfall Intensity (mm/hr)' } },
            y: { title: { display: true, text: 'Discharge (m³/s)' } }
        }
    });
}

function drawBarChart(c) {
    const slopes = buildSlopeSweep(c.slopePct);
    const designIdx = slopes.findIndex(s => Math.abs(s - c.slopePct) < 0.01);
    const sizes = slopes.map(sl => requiredPipeSizeMm(c.Q, c.manning, sl / 100));
    const sizeLabels = ['110','150','200','225','250','300','375','450','525','600','750','900','1050','1200'];

    initChart('chartBarPipeSize', 'bar', {
        labels: slopes.map((s, i) => s + '%' + (i === designIdx ? ' ★' : '')),
        datasets: [{
            label: `Required diameter for Q=${c.Q.toFixed(4)} m³/s`,
            data: sizes,
            backgroundColor: slopes.map((_, i) => i === designIdx ? '#00f5d4' : '#7b61ff'),
            borderRadius: 4,
            barPercentage: 0.6,
            datalabels: {
                anchor: 'end',
                align: 'end',
                color: '#e8eaed',
                font: { size: 9 },
                formatter: (v) => v + 'mm'
            }
        }, {
            label: `Selected pipe (${c.pipeDia} mm)`,
            data: slopes.map(() => c.pipeDia),
            type: 'line',
            borderColor: '#f59e0b',
            borderDash: [6, 4],
            borderWidth: 2.5,
            pointRadius: 0,
            fill: false
        }, {
            label: `Design slope (${c.slopePct}%)`,
            data: slopes.map((s, i) => i === designIdx ? sizes[designIdx] : undefined),
            type: 'bar',
            backgroundColor: 'transparent',
            borderColor: '#fff',
            borderWidth: 2,
            borderRadius: 4,
            barPercentage: 0.6,
            pointRadius: 0
        }]
    }, {
        plugins: {
            subtitle: { display: true, text: `Manning n=${c.manning} · Bars: required size · Dashed line: selected ${c.pipeDia}mm pipe`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } }
        },
        scales: {
            x: { title: { display: true, text: 'Longitudinal Slope (%)' } },
            y: { title: { display: true, text: 'Pipe Diameter (mm)' }, beginAtZero: true, ticks: { callback: (v) => v + 'mm' } }
        }
    });
}

function drawDonutChart(c) {
    const breakdown = computeMaterialBreakdown(c);
    const lengthM = Math.max(Math.sqrt(c.area) * 2.5, 50);
    const pipeRate = { PVC: 85, HDPE: 125, RCC: 210 }[c.material] || 85;
    const pipeCost = Math.round(pipeRate * lengthM * (c.pipeDia / 300));
    const manholeCost = Math.ceil(lengthM / 50) * 2500;
    const catchpitCost = Math.max(1, Math.ceil(c.area / 2000)) * 800;
    const fittingCost = Math.round(pipeCost * 0.18);
    const total = pipeCost + manholeCost + catchpitCost + fittingCost;
    const actualValues = [pipeCost, manholeCost, catchpitCost, fittingCost];

    initChart('chartDonut', 'doughnut', {
        labels: breakdown.labels.map((l, i) => `${l} ($${actualValues[i].toLocaleString()})`),
        datasets: [{
            data: breakdown.values,
            backgroundColor: breakdown.colors,
            borderWidth: 0,
            hoverOffset: 12
        }]
    }, {
        cutout: '70%',
        plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, color: 'rgba(232, 234, 237, 0.8)', font: { size: 10 } } },
            subtitle: { display: true, text: `Estimated total: $${total.toLocaleString()} for ~${lengthM.toFixed(0)}m network (${c.material})`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } },
            tooltip: {
                callbacks: {
                    label: (ctx) => {
                        const val = actualValues[ctx.dataIndex];
                        return ` ${ctx.raw}% ($${val.toLocaleString()})`;
                    }
                }
            }
        }
    });
}

function drawRadarChart(c) {
    const scores = computePerformanceScores(c);
    const labels = ['Flow Efficiency', 'Velocity Comp.', 'Capacity', 'Erosion Res.', 'Cost Eff.', 'Strength'];
    const scoreLabels = [
        `${(c.capacityUse * 100).toFixed(0)}% utilization`,
        `${c.V.toFixed(2)} m/s (target 0.6-2.5)`,
        `${(c.capacityUse <= 1 ? ((1 - c.capacityUse) * 100).toFixed(0) : 'OVER')}% margin`,
        `Fr=${c.Fr.toFixed(2)}, V=${c.V.toFixed(2)} m/s`,
        c.material,
        `${c.pipeDia}mm ${c.material}`
    ];

    initChart('chartRadar', 'radar', {
        labels: labels,
        datasets: [{
            label: `Score (${c.material}, ${c.pipeDia} mm)`,
            data: scores,
            backgroundColor: 'rgba(0, 245, 212, 0.2)',
            borderColor: '#00f5d4',
            pointBackgroundColor: '#00f5d4',
            pointHoverBackgroundColor: '#fff',
            borderWidth: 2,
            pointRadius: 5
        }]
    }, {
        plugins: {
            subtitle: { display: true, text: `Capacity ${(c.capacityUse * 100).toFixed(0)}% · V=${c.V.toFixed(2)} m/s · Fr=${c.Fr.toFixed(2)} · ${c.material}`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } },
            tooltip: {
                callbacks: {
                    afterLabel: (ctx) => ` ${scoreLabels[ctx.dataIndex]}`
                }
            }
        },
        scales: {
            r: {
                angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                pointLabels: { color: 'rgba(232, 234, 237, 0.8)', font: { size: 10 } },
                ticks: { display: false, min: 0, max: 100 }
            }
        }
    });
}

function drawGaugeChart(c) {
    const velocity = c ? c.V : 1.32;
    const maxV = 3.0;
    const val = Math.min(velocity, maxV);
    const remainder = Math.max(0, maxV - val);
    let color = velocity < 0.6 ? '#ef4444' : velocity < 1.2 ? '#00f5d4' : (velocity <= 2.5 ? '#22c55e' : '#ef4444');
    const status = velocity < 0.6 ? 'TOO SLOW' : velocity < 1.2 ? 'OK' : (velocity <= 2.5 ? 'GOOD' : 'TOO FAST');
    const statusColor = velocity < 0.6 ? '#ef4444' : velocity < 1.2 ? '#00f5d4' : (velocity <= 2.5 ? '#22c55e' : '#ef4444');

    initChart('chartGauge', 'doughnut', {
        labels: ['Velocity', 'Remaining'],
        datasets: [{
            data: [val, remainder],
            backgroundColor: [color, 'rgba(255, 255, 255, 0.05)'],
            borderWidth: 0,
            hoverOffset: 0
        }]
    }, {
        circumference: 180,
        rotation: 270,
        cutout: '78%',
        plugins: {
            legend: { display: false },
            tooltip: {
                enabled: true,
                callbacks: {
                    title: () => 'Flow Velocity',
                    label: (ctx) => ctx.dataIndex === 0 ? ` ${velocity.toFixed(2)} m/s` : ` ${(maxV - velocity).toFixed(2)} m/s to max`,
                    afterLabel: () => ` Status: ${status}`
                }
            },
            subtitle: c ? { display: true, text: `${velocity.toFixed(2)} m/s · ${status} · Optimal range: 0.6–2.5 m/s`, color: statusColor, font: { size: 11, weight: 'bold' } } : {}
        }
    });
}

function drawHGLChart(c) {
    let ground;
    let stations;
    const profile = window._mapProfileData;
    const lengthM = Math.max(Math.sqrt(c.area) * 2, 80);

    if (profile && profile.length >= 3) {
        stations = profile.map((_, i) => Math.round(i * lengthM / (profile.length - 1)));
        ground = profile.map(e => Number(e.toFixed(2)));
    } else {
        const baseElev = window._mapData?.elev ?? 100;
        const numPts = 10;
        stations = Array.from({ length: numPts }, (_, i) => Math.round(i * lengthM / (numPts - 1)));
        // Create a realistic terrain profile with rolling hills
        ground = stations.map(s => Number((baseElev - s * 0.015 + Math.sin(s * 0.025 + baseElev * 0.01) * 3 + Math.sin(s * 0.008) * 1.5 + 0.5 * Math.random()).toFixed(2)));
    }

    const invert = [];
    let inv = ground[0] - 2.5 - 0.5 * Math.random();
    for (let i = 0; i < stations.length; i++) {
        if (i > 0) inv -= (stations[i] - stations[i - 1]) * c.slope;
        // Add small random variation to invert for realism
        invert.push(Number(inv.toFixed(2)));
    }

    const pipeCrown = invert.map(inv => Number((inv + c.diameterM).toFixed(2)));
    const depth = c.diameterM * Math.min(c.capacityUse, 1);
    const velocityHead = (c.V * c.V) / (2 * 9.81);
    const hgl = invert.map(inv => Number((inv + depth).toFixed(2)));
    const egl = hgl.map(h => Number((h + velocityHead).toFixed(2)));

    // Compute cover depth at each station
    const covers = ground.map((g, i) => (g - invert[i]).toFixed(1));

    initChart('chartHGL', 'line', {
        labels: stations.map((s, i) => s + 'm' + (covers[i] ? ` (c=${covers[i]}m)` : '')),
        datasets: [
            {
                label: `Ground Level`,
                data: ground,
                borderColor: 'rgba(139, 92, 46, 0.8)',
                backgroundColor: 'rgba(139, 92, 46, 0.15)',
                borderDash: [5, 5],
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0
            },
            {
                label: `Pipe Crown (${c.pipeDia}mm Ø)`,
                data: pipeCrown,
                borderColor: 'rgba(59, 130, 246, 0.5)',
                backgroundColor: 'transparent',
                borderDash: [2, 4],
                tension: 0.4,
                borderWidth: 1,
                pointRadius: 2
            },
            {
                label: `HGL (water surface)`,
                data: hgl,
                borderColor: '#00f5d4',
                backgroundColor: 'rgba(0, 245, 212, 0.08)',
                fill: '+1',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 4,
                pointBackgroundColor: '#00f5d4'
            },
            {
                label: `EGL (total energy)`,
                data: egl,
                borderColor: '#ef4444',
                backgroundColor: 'transparent',
                borderDash: [3, 3],
                tension: 0.4,
                borderWidth: 1.5,
                pointRadius: 3
            },
            {
                label: `Pipe Invert (bottom)`,
                data: invert,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3
            }
        ]
    }, {
        interaction: { mode: 'index', intersect: false },
        plugins: {
            subtitle: { display: true, text: `Slope ${c.slopePct}% · Q=${c.Q.toFixed(4)} m³/s · Cover depth: ${covers[0]}–${covers[covers.length - 1]}m · ${profile?.length >= 3 ? 'Real terrain' : 'Synthetic terrain'}`, color: 'rgba(232,234,237,0.6)', font: { size: 11 } }
        },
        scales: {
            y: { title: { display: true, text: 'Elevation (m AMSL)' } }
        }
    });
}

function fillMaterialComparison(c) {
    const container = document.getElementById('resultsMaterialComparison');
    if (!container || !c) return;
    const mats = MANNING_N.getSuitableMaterials(c.pipeDia);
    if (!mats.length) { container.innerHTML = '<p class="placeholder-text">No suitable materials found for this diameter.</p>'; return; }

    const lengthM = Math.max(Math.sqrt(c.area) * 2.5, 50);
    container.innerHTML = `<div style="overflow-x:auto">
        <table class="mat-compare-table">
            <thead>
                <tr>
                    <th>Material</th>
                    <th>Manning's n</th>
                    <th>Full Velocity</th>
                    <th>Full Flow</th>
                    <th>Capacity Use</th>
                    <th>Max Safe V</th>
                    <th>Est. Cost</th>
                    <th>Status</th>
                </tr>
            </thead>
            <tbody>
                ${mats.map(m => {
                    const vMat = manningVelocity(m.n, c.diameterM, c.slope);
                    const qMat = vMat * (Math.PI * Math.pow(c.diameterM / 2, 2));
                    const capUse = qMat > 0 ? c.Q / qMat : 0;
                    const costEst = Math.round(m.costPerM * lengthM * (c.pipeDia / 300));
                    const isSelected = m.key === c.material;
                    const velStatus = vMat < 0.6 ? 'danger' : vMat > m.maxV ? 'warn' : 'ok';
                    const velLabel = vMat < 0.6 ? 'Too Slow' : vMat > m.maxV ? 'Too Fast' : 'Optimal';
                    const capStatus = capUse > 1 ? 'danger' : capUse > 0.85 ? 'warn' : 'ok';
                    return `<tr${isSelected ? ' class="mat-selected-row"' : ''}>
                        <td><strong>${m.label}</strong>${isSelected ? ' ★' : ''}</td>
                        <td>${m.n}</td>
                        <td>${vMat.toFixed(2)} m/s</td>
                        <td>${qMat.toFixed(4)} m³/s</td>
                        <td><span class="status-badge ${capStatus}">${(capUse * 100).toFixed(0)}%</span></td>
                        <td>${m.maxV} m/s</td>
                        <td>$${costEst.toLocaleString()}</td>
                        <td><span class="status-badge ${velStatus}">${velLabel}</span></td>
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
        <div style="font-size:0.7rem;color:var(--text-muted);margin-top:8px">★ = selected material · Estimated for ~${lengthM.toFixed(0)}m network length · Costs in USD</div>
    </div>`;
}

function fillResultsTable(c) {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody || !c) return;

    const slopes = buildSlopeSweep(c.slopePct);
    const n = c.manning;
    const D = c.diameterM;

    tbody.innerHTML = slopes.map(sl => {
        const slopeFrac = sl / 100;
        const { V, Q } = pipeFlowAtFull(n, D, slopeFrac);
        const reqDia = requiredPipeSizeMm(c.Q, n, slopeFrac);
        const Re = V * D / 1e-6;
        const Fr = V / Math.sqrt(9.81 * Math.max(D / 4, 0.001));
        const { cls, label } = velocityStatus(V);
        const isDesign = Math.abs(sl - c.slopePct) < 0.01;
        const rowStyle = isDesign ? ' style="background:rgba(0,245,212,0.08)"' : '';
        return `<tr${rowStyle}><td>${sl}${isDesign ? ' ★' : ''}</td><td>${Q.toFixed(4)}</td><td>${V.toFixed(2)}</td><td>${c.pipeDia} (req ${reqDia})</td><td>${Math.round(Re).toLocaleString()}</td><td>${Fr.toFixed(2)}</td><td><span class="status-badge ${cls}">${label}</span></td></tr>`;
    }).join('');
}
// ============ AI RECOMMENDATION ============
function populateAIContext() {
    const savedKey = localStorage.getItem('drainflow_groq_key');
    if (savedKey) {
        document.getElementById('aiApiKey').value = savedKey;
    }
    
    const md = window._mapData;
    if (md) {
        document.getElementById('aiContextAddr').textContent = document.getElementById('mapAddr').textContent || "Unknown Location";
        document.getElementById('aiContextTerrain').textContent = `Elev: ${md.elev}m, Slope: ${md.slope}%`;
        document.getElementById('aiContextHydraulics').textContent = `Soil: ${md.soil}, Rain: ${md.rain}mm/yr`;
        document.getElementById('aiContextClimate').textContent = `${md.temp ?? '—'}°C, ${md.humidity ?? '—'}% humidity, Wind ${md.wind ?? '—'}km/h`;
        document.getElementById('aiContextSoil').textContent = `${md.soil} (Runoff: ${md.soilRunoff ?? '—'}, Clay: ${md.soilClay ?? '—'}%, Sand: ${md.soilSand ?? '—'}%, Silt: ${md.soilSilt ?? '—'}%)`;
    } else {
        document.getElementById('aiContextAddr').textContent = "No location selected";
        document.getElementById('aiContextTerrain').textContent = "—";
        document.getElementById('aiContextHydraulics').textContent = "—";
        document.getElementById('aiContextClimate').textContent = "—";
        document.getElementById('aiContextSoil').textContent = "—";
    }
    
    // CAD context
    const cadCount = document.getElementById('aiCadCount');
    const cadNetwork = document.getElementById('aiCadNetwork');
    const cad3d = document.getElementById('aiCad3d');
    if (typeof CAD !== 'undefined' && CAD.elements && CAD.elements.length > 0) {
        const pipes = CAD.elements.filter(e => e.type === 'pipe').length;
        const nodes = CAD.elements.filter(e => ['manhole','catchpit','outlet','junction'].includes(e.type)).length;
        const roads = CAD.elements.filter(e => e.type === 'road').length;
        const labels = CAD.elements.filter(e => ['text','label','dimension'].includes(e.type)).length;
        cadCount.textContent = `${CAD.elements.length} total (${pipes} pipes · ${nodes} nodes · ${roads} roads · ${labels} labels)`;
        cadNetwork.textContent = pipes > 0 && nodes > 0 ? `${pipes} pipes × ${nodes} nodes network` : 'No network drawn';
        cad3d.textContent = document.querySelector('[data-page="3d"].nav-link.active') ? '3D Viewer active' : (document.getElementById('page-3d')?.style.display !== 'none' ? 'Viewer ready' : 'Not viewed');
    } else {
        cadCount.textContent = 'No CAD elements';
        cadNetwork.textContent = '—';
        cad3d.textContent = '—';
    }
}

// ============ INSTANT LOCAL ANALYSIS (no API key needed) ============
function computeRecommendedNetwork(c) {
    if (!c) return null;
    const area = c.area || 5000;
    const pipeDia = c.pipeDia || 225;
    const roadLength = Math.max(Math.sqrt(area) * 1.8, 100);
    // Recommended spacing from engineering layout
    const catchSpacing = Math.max(30, Math.min(50, Math.sqrt(area) / 10));
    const mhSpacing = Math.max(60, Math.min(100, 60 + pipeDia / 8));
    const estCatchpits = Math.max(3, Math.ceil(roadLength / catchSpacing));
    const estManholes = Math.max(2, Math.floor(roadLength / mhSpacing));
    const estPipes = estCatchpits;
    const estOutlets = 1;
    const estNodes = estCatchpits + estManholes + estOutlets;
    return { roadLength, catchSpacing, mhSpacing, estCatchpits, estManholes, estPipes, estOutlets, estNodes, pipeDia };
}

function generateLocalAnalysis() {
    const area = document.getElementById('aiResponseArea');
    try {
    const md = window._mapData;
    const c = window._calcResults;
    if (!md) return;
    
    const locName = document.getElementById('mapAddr').textContent || 'Selected location';
    const {slope, soil, rain, elev} = md;
    
    const opt = window._optimizationResults;
    const optBadge = (key) => {
        const v = opt?.[key];
        if (!v) return '';
        const unit = key === 'pipeDia' ? 'mm' : key === 'slope' ? '%' : '';
        return `<span style="display:inline-flex;align-items:center;gap:3px;margin-left:6px;background:rgba(0,245,212,0.15);color:#00f5d4;border-radius:3px;padding:1px 6px;font-size:0.65rem;font-weight:600">✓ ${v.from}→${v.to}${unit}</span>`;
    };
    const optSummary = () => {
        if (!opt) return '';
        const p = [];
        if (opt.pipeDia) p.push(`Ø${opt.pipeDia.from}→${opt.pipeDia.to}mm`);
        if (opt.slope) p.push(`${opt.slope.from}%→${opt.slope.to}%`);
        if (opt.material) p.push(`${opt.material.from}→${opt.material.to}`);
        if (opt.manning) p.push(`n=${opt.manning.from}→${opt.manning.to}`);
        if (!p.length) return '';
        return `<span style="float:right;display:inline-flex;align-items:center;gap:4px;background:rgba(0,245,212,0.12);color:#00f5d4;border:1px solid rgba(0,245,212,0.2);border-radius:4px;padding:1px 8px;font-size:0.65rem;font-weight:700;line-height:1.8;white-space:nowrap">⚡ ${p.join(' · ')}</span>`;
    };
    const optDir = (key, val, unit, fallback) => {
        if (!opt?.[key]) return fallback;
        return `<span style="display:inline-flex;align-items:center;gap:4px"><span style="background:rgba(0,245,212,0.15);color:#00f5d4;border-radius:3px;padding:1px 6px;font-size:0.65rem;font-weight:600">✓ Optimized</span> → ${opt[key].to}${unit} <span style="color:rgba(232,234,237,0.25);text-decoration:line-through">${opt[key].from}${unit}</span></span>`;
    };
    let optBanner = '';
    if (opt) {
        const parts = [];
        if (opt.pipeDia) parts.push(`diameter ${opt.pipeDia.from}→${opt.pipeDia.to}mm`);
        if (opt.slope) parts.push(`slope ${opt.slope.from}%→${opt.slope.to}%`);
        if (opt.material) parts.push(`material ${opt.material.from}→${opt.material.to}`);
        if (opt.manning) parts.push(`n ${opt.manning.from}→${opt.manning.to}`);
        if (parts.length > 0) {
            optBanner = `<div style="background:rgba(0,245,212,0.1);border:1px solid rgba(0,245,212,0.25);border-radius:8px;padding:10px 14px;margin:10px 0;font-size:0.78rem;display:flex;align-items:center;gap:10px"><span style="background:#00f5d4;color:#0a0e1a;border-radius:4px;padding:2px 8px;font-weight:700;font-size:0.68rem;white-space:nowrap">✓ OPTIMIZED</span><span>${parts.join(' · ')}</span></div>`;
        }
    }

    let cadSummary = 'No CAD elements drawn yet.';
    let hasCAD = false;
    let actualPipes = 0, actualNodes = 0, actualRoads = 0;
    if (typeof CAD !== 'undefined' && CAD.elements && CAD.elements.length > 0) {
        actualPipes = CAD.elements.filter(e => e.type === 'pipe').length;
        actualNodes = CAD.elements.filter(e => ['manhole','catchpit','outlet','junction'].includes(e.type)).length;
        actualRoads = CAD.elements.filter(e => e.type === 'road').length;
        cadSummary = `${CAD.elements.length} elements (${actualPipes} pipes, ${actualNodes} nodes, ${actualRoads} roads).`;
        hasCAD = true;
    }

    const rec = computeRecommendedNetwork(c);
    let recHTML = '';
    if (rec) {
        const status = (act, rec) => {
            if (!hasCAD) return '<span style="color:rgba(232,234,237,0.35)">Not drawn</span>';
            const ratio = act / Math.max(rec, 1);
            if (ratio < 0.5) return '<span style="color:#f59e0b">⚠ Too few</span>';
            if (ratio > 1.5) return '<span style="color:#ef4444">⚠ Too many</span>';
            return '<span style="color:#00f5d4">✓ Optimal</span>';
        };
        recHTML = `<table class="ai-recommended-table"><thead><tr><th>Element</th><th>Recommended</th><th>Actual</th><th>Status</th></tr></thead><tbody>
            <tr><td>Pipes</td><td>${rec.estPipes}</td><td>${hasCAD ? actualPipes : '—'}</td><td>${status(actualPipes, rec.estPipes)}</td></tr>
            <tr><td>Catch Pits</td><td>${rec.estCatchpits}</td><td>${hasCAD ? CAD.elements.filter(e => e.type === 'catchpit').length : '—'}</td><td>${status(CAD.elements.filter(e => e.type === 'catchpit').length, rec.estCatchpits)}</td></tr>
            <tr><td>Manholes</td><td>${rec.estManholes}</td><td>${hasCAD ? CAD.elements.filter(e => e.type === 'manhole').length : '—'}</td><td>${status(CAD.elements.filter(e => e.type === 'manhole').length, rec.estManholes)}</td></tr>
            <tr><td>Outlets</td><td>${rec.estOutlets}</td><td>${hasCAD ? CAD.elements.filter(e => e.type === 'outlet').length : '—'}</td><td>${status(CAD.elements.filter(e => e.type === 'outlet').length, rec.estOutlets)}</td></tr>
            <tr><td>Total Nodes</td><td>${rec.estNodes}</td><td>${hasCAD ? actualNodes : '—'}</td><td>${status(actualNodes, rec.estNodes)}</td></tr>
        </tbody></table>
        <p style="font-size:0.65rem;color:rgba(232,234,237,0.35);margin-top:4px">Based on: Catch pit spacing = ${rec.catchSpacing.toFixed(0)}m · Manhole spacing = ${rec.mhSpacing.toFixed(0)}m · Road length = ${rec.roadLength.toFixed(0)}m</p>`;
    }

    let matHTML = '<p>No calculations performed yet.</p>';
    if (c && c.suitableMats && c.suitableMats.length > 0) {
        const rows = c.suitableMats.map(sm => {
            const capUse = ((c.Q / (sm.Qfull || 0.0001)) * 100).toFixed(1);
            const vSafe = sm.maxV || 6;
            const vOk = (sm.Vfull || 0) <= vSafe;
            return `<tr>
                <td><strong>${sm.label || sm.name}</strong></td>
                <td>${(sm.n || sm.manningsN).toFixed(3)}</td>
                <td>${(sm.Vfull || 0).toFixed(2)} m/s</td>
                <td>${(sm.Qfull || 0).toFixed(4)} m³/s</td>
                <td>${capUse}%</td>
                <td>$${(sm.costPerM || 0).toFixed(0)}/m</td>
                <td><span class="status-badge ${vOk ? 'ok' : 'warn'}">${vOk ? 'OK' : 'Over Vmax'}</span></td>
            </tr>`;
        }).join('');
        matHTML = `<table class="mat-compare-table"><thead><tr><th>Material</th><th>n</th><th>V<sub>full</sub></th><th>Q<sub>full</sub></th><th>Use %</th><th>Cost</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`;
    }

    // --- Optimization target section ---
    let optTargets = '';
    if (c) {
        const capOk = c.capacityUse <= 0.85;
        const velOk = c.V >= 0.75 && c.V <= 3;
        const frOk = c.Fr < 0.8;
        const reOk = (c.Re || 0) > 4000;
        const capacityDir = c.capacityUse > 0.85 ? '↓ Reduce (upsize pipe)' : (c.capacityUse < 0.3 ? '↑ Increase (downsize pipe)' : '✓ Optimal');
        const velDir = c.V > 3 ? '↓ Reduce slope / increase diameter' : (c.V < 0.75 ? '↑ Increase slope / reduce diameter' : '✓ Optimal');
        const slopeDir = c.V > 3 ? '↓ Reduce to ' + Math.max(0.5, (c.slopePct * 0.7).toFixed(1)) + '%' : (c.V < 0.75 ? '↑ Increase to ' + Math.min(15, (c.slopePct * 1.5).toFixed(1)) + '%' : '✓ Keep');
        
        const bestMat = c.suitableMats?.length > 0 ? [...c.suitableMats].sort((a,b) => a.costPerM - b.costPerM)[0] : null;
        const matRec = bestMat ? (bestMat.key === (c.suitableMats.find(m => m.key === c.material)?.key || c.material) ? '✓ Optimal' : '→ Switch to ' + (bestMat.label || bestMat.key)) : '—';
        
        optTargets = `<div style="background:rgba(10,14,26,0.5);border-radius:8px;padding:14px;margin:12px 0">
            <h4 style="color:#00f5d4;margin:0 0 10px;font-size:0.85rem">⚡ Optimization Targets${optSummary()}</h4>
            <table style="width:100%;border-collapse:collapse;font-size:0.75rem">
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                <td style="padding:4px 8px;color:rgba(232,234,237,0.5)">Capacity Use</td>
                <td style="padding:4px 8px">${(c.capacityUse * 100).toFixed(0)}%</td>
                <td style="padding:4px 8px;color:${capOk ? '#00f5d4' : '#ef4444'}">${capacityDir}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                <td style="padding:4px 8px;color:rgba(232,234,237,0.5)">Velocity</td>
                <td style="padding:4px 8px">${c.V.toFixed(2)} m/s</td>
                <td style="padding:4px 8px;color:${velOk ? '#00f5d4' : '#f59e0b'}">${velDir}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                <td style="padding:4px 8px;color:rgba(232,234,237,0.5)">Pipe Slope${optBadge('slope')}</td>
                <td style="padding:4px 8px">${c.slopePct}%</td>
                <td style="padding:4px 8px;color:${velOk ? '#00f5d4' : '#f59e0b'}">${optDir('slope', c.slopePct, '%', slopeDir)}</td>
            </tr>
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04)">
                <td style="padding:4px 8px;color:rgba(232,234,237,0.5)">Pipe Diameter${optBadge('pipeDia')}</td>
                <td style="padding:4px 8px">${c.pipeDia} mm</td>
                <td style="padding:4px 8px;color:${capOk ? '#00f5d4' : '#ef4444'}">${optDir('pipeDia', c.pipeDia, 'mm', c.capacityUse > 0.85 ? '→ ' + Math.round(c.pipeDia * 1.25) + ' mm recommended' : c.capacityUse < 0.3 ? '→ ' + Math.max(150, Math.round(c.pipeDia * 0.75)) + ' mm possible' : '✓ Optimal')}</td>
            </tr>
            <tr>
                <td style="padding:4px 8px;color:rgba(232,234,237,0.5)">Material${optBadge('material')}</td>
                <td style="padding:4px 8px">${c.material}</td>
                <td style="padding:4px 8px;color:${matRec.startsWith('✓') ? '#00f5d4' : '#f59e0b'}">${optDir('material', c.material, '', matRec)}</td>
            </tr>
            </table>
        </div>`;
    }

    let pros = '', cons = '', gaps = '';
    if (c) {
        const velOk = c.V > 0.75 && c.V <= 3;
        const capOk = c.capacityUse < 0.9;
        const frOk = c.Fr < 0.8;
        pros = '<ul>';
        if (capOk) pros += `<li><strong>Adequate capacity</strong> — pipe utilization at ${(c.capacityUse*100).toFixed(0)}% leaves headroom for peak flows.</li>`;
        else pros += `<li><strong>High utilization</strong> at ${(c.capacityUse*100).toFixed(0)}% — may surcharge during extreme events.</li>`;
        if (velOk) pros += `<li><strong>Acceptable velocity</strong> (${c.V.toFixed(2)} m/s) — within erosion-safe range for most materials.</li>`;
        else pros += `<li><strong>Velocity ${c.V < 0.75 ? 'too low' : 'too high'}</strong> (${c.V.toFixed(2)} m/s) — ${c.V < 0.75 ? 'sedimentation risk, increase slope' : 'erosion risk, specify reinforced joints'}.</li>`;
        if (c.material) pros += `<li><strong>Material selected</strong> (${c.material}) — enables cost and durability analysis.</li>`;
        if (c.suitableMats?.length > 0) {
            const cheapest = [...c.suitableMats].sort((a,b) => a.costPerM - b.costPerM)[0];
            const currentCost = c.suitableMats.find(m => m.key === c.material)?.costPerM || 0;
            const savings = currentCost - cheapest.costPerM;
            if (savings > 20) pros += `<li><strong>Potential savings</strong> — $${savings}/m by switching to ${cheapest.label}.</li>`;
        }
        pros += '</ul>';
        
        cons = '<ul>';
        if (c.Fr > 0.7) cons += `<li><strong>Near-critical flow</strong> (Fr=${c.Fr.toFixed(2)}) — risk of hydraulic instability and surface waves.</li>`;
        if (c.V < 0.75) cons += `<li><strong>Low velocity</strong> (${c.V.toFixed(2)} m/s) — below self-cleansing threshold (0.75 m/s), sedimentation risk.</li>`;
        if (c.V > 3) cons += `<li><strong>Erosion risk</strong> at ${c.V.toFixed(2)} m/s — specify Class 4 or better pipe material.</li>`;
        if (c.capacityUse > 0.95) cons += `<li><strong>Near-surcharge</strong> — pipe will flow full during design storm; consider upsizing.</li>`;
        if (!hasCAD) cons += `<li><strong>No CAD network</strong> — pipe routing and connectivity not verified.</li>`;
        cons += '</ul>';
        
        gaps = '<ul>';
        if (!hasCAD) gaps += '<li>Draw pipe network in <strong>2D Designer</strong> to verify routing and connectivity.</li>';
        else gaps += '<li>CAD network present — verify all nodes are properly connected.</li>';
        gaps += '<li>Check <strong>3D Viewer</strong> for underground clash detection.</li>';
        if (!window._calcResults?.suitableMats) gaps += '<li>Run <strong>Calculator</strong> with multiple materials for cost optimization.</li>';
        gaps += '<li>Verify <strong>freeboard</strong> and <strong>cover depth</strong> requirements per local code.</li>';
        gaps += '</ul>';
    } else {
        pros = '<p>Run hydraulic calculations in the <strong>Calculator</strong> to enable detailed analysis.</p>';
        cons = '<p>No calculation data available.</p>';
        gaps = '<p>Complete the <strong>Calculator</strong> with your design parameters.</p>';
    }
    
    let soilAdvice = '';
    if (soil.toLowerCase().includes('clay')) {
        soilAdvice = 'Clay soil: slow infiltration, high runoff. Use perforated pipes with geotextile wrap. Ensure 15% min slope for self-cleansing. Provide 300mm min bedding depth. Test compaction at 95% Standard Proctor.';
    } else if (soil.toLowerCase().includes('sand') || soil.toLowerCase().includes('loam')) {
        soilAdvice = 'Sandy soil: good infiltration but low cohesion. Use trench shields. Bedding: 150mm Class I material. Compact to 92% Standard Proctor. Watch for pipe flotation in high water table.';
    } else if (soil.toLowerCase().includes('silt')) {
        soilAdvice = 'Silty soil: frost-susceptible, poor bearing. Over-excavate 300mm and replace with granular fill. Use geotextile separation layer. Drainage required during construction.';
    } else {
        soilAdvice = `${soil} soil: assess bearing capacity before trench design. Adjust bedding depth per ASTM D2321.`;
    }
    
    const vStatus = c ? (c.V > 3 ? 'High' : c.V > 1.5 ? 'Moderate' : c.V > 0.75 ? 'Low' : 'Very Low') : 'N/A';
    const vColor = c ? (c.V > 3 ? '#ef4444' : c.V > 1.5 ? '#f59e0b' : '#00f5d4') : '#666';
    
    const html = `<div style="padding-bottom:20px;animation:fadeInUp 0.4s ease-out">
    
<h2>Engineering Analysis Report: ${locName}</h2>
<p style="color:rgba(232,234,237,0.5);font-size:0.85rem">Generated from site data · No API key required · Works offline</p>

${optBanner}${optTargets}

<h3 style="margin-top:20px">1. Recommended Network Layout${optSummary()}</h3>
<div style="background:rgba(0,245,212,0.05);padding:12px;border-radius:8px;margin:8px 0">
${cadSummary ? `<p style="margin:0 0 6px;font-size:0.8rem;display:flex;justify-content:space-between"><span>Current CAD: <strong>${cadSummary}</strong></span><span style="color:rgba(232,234,237,0.3)">Recommended: <strong>${rec ? `${rec.estPipes}p · ${rec.estNodes}n` : '—'}</strong></span></p>` : ''}
${recHTML}
</div>

<h3 style="margin-top:20px">2. Design Pros &amp; Cons${optSummary()}</h3>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:12px 0">
<div style="background:rgba(0,245,212,0.06);padding:14px;border-radius:8px;border-left:3px solid #00f5d4">
<strong style="color:#00f5d4">✓ Pros</strong>${pros}</div>
<div style="background:rgba(239,68,68,0.06);padding:14px;border-radius:8px;border-left:3px solid #ef4444">
<strong style="color:#ef4444">✗ Cons &amp; Risks</strong>${cons}</div>
</div>

<h4 style="color:var(--text-secondary);margin:4px 0 8px">⚠ Critical Gaps</h4>${gaps}

<h3 style="margin-top:20px">3. Hydraulic Assessment Summary${optSummary()}</h3>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin:12px 0">
${c ? `
<div class="ai-stat"><span class="ai-stat-label">Flow Rate (Q)</span><span class="ai-stat-val">${c.Q.toFixed(4)} m³/s</span></div>
<div class="ai-stat" style="border-left-color:${vColor}"><span class="ai-stat-label">Velocity (V)</span><span class="ai-stat-val">${c.V.toFixed(2)} m/s</span><span class="ai-stat-sub">${vStatus}</span></div>
<div class="ai-stat"><span class="ai-stat-label">Pipe Diameter</span><span class="ai-stat-val">${c.pipeDia} mm</span></div>
<div class="ai-stat"><span class="ai-stat-label">Capacity Use</span><span class="ai-stat-val">${(c.capacityUse*100).toFixed(0)}%</span></div>
<div class="ai-stat"><span class="ai-stat-label">Froude #</span><span class="ai-stat-val">${c.Fr?.toFixed(2)??'N/A'}</span><span class="ai-stat-sub">${c.Fr < 1 ? 'Sub-critical' : c.Fr > 1 ? 'Super-critical' : 'Critical'}</span></div>
<div class="ai-stat"><span class="ai-stat-label">Reynolds #</span><span class="ai-stat-val">${Math.round(c.Re??0).toLocaleString()}</span><span class="ai-stat-sub">${(c.Re??0) > 4000 ? 'Turbulent' : (c.Re??0) > 2000 ? 'Transition' : 'Laminar'}</span></div>
` : '<p style="color:var(--text-secondary)">No hydraulic data — run Calculator first.</p>'}
</div>

<h3 style="margin-top:20px">4. Material Comparison${optSummary()}</h3>
${matHTML}

<h3 style="margin-top:20px">5. Construction Recommendations${optSummary()}</h3>
<div style="background:rgba(123,97,255,0.06);padding:14px;border-radius:8px;margin:12px 0">
<p><strong>Sequence:</strong> Site prep → Trench excavation → Bedding (150mm min) → Pipe laying → Jointing → Backfill (300mm lifts) → Compaction → Manhole construction → Testing → Restoration</p>
<p><strong>Soil-Specific:</strong> ${soilAdvice}</p>
${slope > 5 ? '<p><strong>⚠ Steep slope:</strong> Use trench shoring, install check dams in trench, anchor pipes at 10m intervals, provide scour protection at outlets.</p>' : ''}
${hasCAD ? '<p><strong>CAD:</strong> Network present — verify all pipe-node connections and road alignment in 2D Designer.</p>' : '<p><strong>CAD:</strong> No network drawn — create pipe layout in 2D Designer for construction drawings.</p>'}
</div>

<h3 style="margin-top:20px">6. Top 3 Recommended Actions${optSummary()}</h3>
<ol style="margin:12px 0;padding-left:20px">
${c ? `<li><strong>${c.capacityUse > 0.85 ? 'Upsize pipe diameter for safety factor' : c.V > 3 ? 'Add energy dissipation at outlets' : 'Verify invert levels and cover depth'}</strong> — based on current hydraulics.</li>
<li><strong>${c.suitableMats && c.suitableMats.length > 0 ? 'Select final material from comparison table below — prioritize ' + c.suitableMats.sort((a,b) => a.costPerM - b.costPerM)[0]?.label + ' for best value' : 'Run Calculator to compare material costs and performance'}</strong></li>` : '<li>Run Calculator to get hydraulic analysis.</li>'}
<li><strong>Validate with 3D viewer</strong> — check for pipe clashes, cover depth violations, and construction sequencing.</li>
</ol>

<p style="color:rgba(232,234,237,0.4);font-size:0.75rem;margin-top:20px;border-top:1px solid rgba(255,255,255,0.05);padding-top:12px">Local analysis · Computed from design parameters · Add Groq API key for AI-powered engineering analysis</p>
<div style="margin-top:16px;padding:16px;background:rgba(0,245,212,0.06);border-radius:10px;border:1px solid rgba(0,245,212,0.15);text-align:center">
<button onclick="applyRecommendations()" style="background:#00f5d4;color:#0a0e1a;border:none;padding:12px 32px;border-radius:8px;font-weight:700;font-size:0.9rem;cursor:pointer;transition:all 0.25s ease;box-shadow:0 0 20px rgba(0,245,212,0.25)" onmouseover="this.style.filter='brightness(1.15)';this.style.boxShadow='0 0 30px rgba(0,245,212,0.4)'" onmouseout="this.style.filter='';this.style.boxShadow='0 0 20px rgba(0,245,212,0.25)'">⚡ Auto-Optimize Design</button>
<p style="font-size:0.7rem;color:rgba(232,234,237,0.35);margin-top:8px">Applies optimized slope, material, pipe diameter to Calculator · CAD drawing · 3D viewer</p>
</div>
</div>`;
    
    area.innerHTML = html;
    } catch (e) {
        console.error('generateLocalAnalysis error:', e);
        area.innerHTML = `<div style="padding:20px;color:#ef4444;text-align:center"><p>Analysis error: ${e.message}</p><p style="font-size:0.8rem;color:rgba(232,234,237,0.4);margin-top:8px">Check console (F12) for details.</p></div>`;
    }
}

// ============ AUTO-OPTIMIZE: applies AI recommendations to Calculator, CAD, and 3D ============
function applyRecommendations() {
    const btn = document.querySelector('button[onclick*="applyRecommendations"]');
    const statusArea = document.getElementById('optimizeStatus');
    const mkStatus = (msg, ok) => {
        if (statusArea) {
            statusArea.innerHTML = `<span style="color:${ok ? '#00f5d4' : '#ef4444'}">${ok ? '✓' : '✗'}</span> ${msg}`;
            statusArea.style.display = 'block';
        }
    };
    if (btn) { btn.textContent = '⚡ Optimizing...'; btn.disabled = true; }
    if (statusArea) { statusArea.style.display = 'none'; }

    try {
        const c = window._calcResults;
        if (!c) {
            alert('Run the Hydraulic Calculator first — no design data to optimize.');
            if (btn) { btn.textContent = '⚡ Auto-Optimize Design'; btn.disabled = false; }
            return;
        }

        // --- 1. Determine optimal pipe diameter ---
        const stdSizes = [110,150,200,225,250,300,375,450,525,600,750,900,1050,1200];
        let optimalDia = c.pipeDia || 225;
        if (c.capacityUse > 0.85) {
            const idx = stdSizes.indexOf(optimalDia);
            if (idx >= 0 && idx < stdSizes.length - 1) optimalDia = stdSizes[idx + 1];
            else optimalDia = Math.round(optimalDia * 1.25);
        } else if (c.capacityUse < 0.3 && optimalDia > 150) {
            const idx = stdSizes.indexOf(optimalDia);
            if (idx > 0) optimalDia = stdSizes[idx - 1];
        }

        // --- 2. Determine optimal material ---
        let optimalMat = c.material || 'PVC';
        let optimalManning = c.manning || 0.013;
        if (c.suitableMats && c.suitableMats.length > 0) {
            const sorted = [...c.suitableMats].sort((a, b) => a.costPerM - b.costPerM);
            const best = sorted[0];
            if (best) {
                optimalMat = best.key || best.label || best.name;
                optimalManning = best.n || best.manningsN || optimalManning;
            }
        }

        // --- 3. Determine optimal slope ---
        let optimalSlope = c.slopePct || 2;
        if (c.V > 3) optimalSlope = Math.max(0.5, optimalSlope * 0.7);
        else if (c.V < 0.75) optimalSlope = Math.min(15, optimalSlope * 1.5);

        // --- 3b. Capture old values for optimization tracking ---
        const _oldSlope = parseFloat(document.getElementById('calcSlope')?.value) || c.slopePct;
        const _oldPipeDia = c.pipeDia;
        const _oldMaterial = c.material;
        const _oldManning = c.manning;

        // --- 4. Update ALL calculator form fields ---
        const slopeInput = document.getElementById('calcSlope');
        if (slopeInput) slopeInput.value = optimalSlope.toFixed(1);

        const manningSelect = document.getElementById('calcManningSelect');
        if (manningSelect) {
            let found = false;
            for (let i = 0; i < manningSelect.options.length; i++) {
                if (manningSelect.options[i].text.toLowerCase().includes(optimalMat.toLowerCase())) {
                    manningSelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found && c.material) {
                for (let i = 0; i < manningSelect.options.length; i++) {
                    if (manningSelect.options[i].text.toLowerCase().includes(c.material.toLowerCase())) {
                        manningSelect.selectedIndex = i;
                        break;
                    }
                }
            }
            // Sync the hidden input to match the select value
            if (typeof onManningSelectChange === 'function') onManningSelectChange();
        }
        const manningInput = document.getElementById('calcManning');
        if (manningInput) manningInput.value = optimalManning.toFixed(4);

        // --- 5. Re-run the calculator with fresh values ---
        calculateHydraulics();

        // --- 6. Regenerate CAD auto-design (silent) ---
        if (typeof CAD !== 'undefined') {
            CAD.syncDesignParams();
            CAD.generateAutomatedDesign(true, true);
            CAD.fitToView();
            CAD.render();
        }

        // --- 7. Rebuild 3D scene directly (no page navigation) ---
        if (typeof viewer3D !== 'undefined' && viewer3D.scene && typeof CAD !== 'undefined') {
            // Clear existing 3D meshes
            viewer3D.buildMeshes.forEach(m => viewer3D.scene.remove(m));
            viewer3D.buildMeshes = [];
            viewer3D.labelSprites = [];
            viewer3D.flowParticles = [];
            viewer3D.dimLabels = [];

            // Rebuild using the same logic as init3DViewer (lines 1624–1776)
            const design = CAD.exportDesignFor3D ? CAD.exportDesignFor3D() : { elements: [], params: {}, profile: null };
            const els = design.elements;
            const calc2 = window._calcResults;
            const nodes = els.filter(e => ['manhole', 'catchpit', 'outlet', 'junction'].includes(e.type));
            const pipes = els.filter(e => e.type === 'pipe');
            const roads = els.filter(e => e.type === 'road');

            const materialCache = {};
            function get3DMaterial(color) {
                const hex = typeof color === 'string' ? parseInt(color.replace('#', ''), 16) : color;
                if (!materialCache[hex]) {
                    materialCache[hex] = new THREE.MeshStandardMaterial({
                        color: hex, roughness: 0.35, metalness: 0.15,
                        wireframe: viewer3D.wireframe
                    });
                }
                materialCache[hex].wireframe = viewer3D.wireframe;
                return materialCache[hex];
            }

            // Re-add ground if it was removed
            if (viewer3D.showGround) {
                const groundGeo = new THREE.PlaneGeometry(4000, 4000);
                const groundMat = new THREE.MeshStandardMaterial({
                    color: 0x111622, roughness: 1, metalness: 0,
                    transparent: true, opacity: 0.6, side: THREE.DoubleSide
                });
                const ground = new THREE.Mesh(groundGeo, groundMat);
                ground.rotation.x = -Math.PI / 2;
                ground.position.y = -0.5;
                ground.receiveShadow = viewer3D.showShadows;
                ground.userData.buildOrder = 0;
                viewer3D.scene.add(ground);
                viewer3D.buildMeshes.push(ground);

                const grid = new THREE.GridHelper(4000, 120, 0x00f5d4, 0x1a2035);
                grid.material.opacity = 0.15;
                grid.material.transparent = true;
                grid.position.y = -0.4;
                grid.userData.buildOrder = 0;
                viewer3D.scene.add(grid);
                viewer3D.buildMeshes.push(grid);
            }

            if (viewer3D.showAxes) {
                const axes = new THREE.AxesHelper(120);
                axes.userData.buildOrder = 0;
                viewer3D.scene.add(axes);
                viewer3D.buildMeshes.push(axes);
            }

            // Rebuild terrain
            if (typeof build3DTerrain === 'function') build3DTerrain(viewer3D.scene, design, viewer3D.showShadows);
            // Rebuild roads
            roads.forEach(r => build3DRoad(viewer3D.scene, r, get3DMaterial, viewer3D.showShadows));
            // Rebuild nodes & pipes
            pipes.forEach(p => build3DPipe(viewer3D.scene, p, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels, calc2));
            nodes.forEach(n => build3DNode(viewer3D.scene, n, get3DMaterial, viewer3D.showShadows, viewer3D.showLabels));

            // Flow particles
            viewer3D.flowParticles = [];
            if (viewer3D.showFlow && pipes.length > 0) {
                pipes.forEach(pipe => {
                    const count = Math.max(1, Math.floor(Math.hypot(pipe.x2 - pipe.x, pipe.y2 - pipe.y) / 20));
                    for (let i = 0; i < count; i++) {
                        const geo = new THREE.SphereGeometry(4, 8, 8);
                        const mat = new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.85 });
                        const particle = new THREE.Mesh(geo, mat);
                        const depths = getPipeDepths(pipe, calc2);
                        particle.userData.pipeLine = {
                            x1: pipe.x, z1: pipe.y, y1: depths.startY,
                            x2: pipe.x2, z2: pipe.y2, y2: depths.endY,
                            t: 0
                        };
                        particle.userData.buildOrder = 4;
                        viewer3D.scene.add(particle);
                        viewer3D.flowParticles.push(particle);
                        viewer3D.buildMeshes.push(particle);
                    }
                });
            }

            // Re-center camera
            let cx = 0, cz = 0, cnt = 0;
            [...nodes, ...pipes].forEach(el => {
                cx += el.x; cz += (el.y ?? el.z ?? 0); cnt++;
                if (el.x2 != null) { cx += el.x2; cz += el.y2; cnt++; }
            });
            if (cnt > 0) { cx /= cnt; cz /= cnt; }
            let maxDist = 200;
            [...nodes, ...pipes].forEach(el => {
                const ex = el.x2 != null ? Math.max(el.x, el.x2) : el.x;
                const ez = el.y2 != null ? Math.max(el.y, el.y2) : el.y;
                const d = Math.hypot(ex - cx, ez - cz);
                if (d > maxDist) maxDist = d;
            });
            const camDist = Math.max(120, maxDist * 1.2);
            viewer3D.controls.target.set(cx, -8, cz);
            viewer3D.camera.position.set(cx + camDist, camDist * 0.6, cz + camDist);
            viewer3D.controls.update();

            // Update stats
            if (typeof update3DStats === 'function') update3DStats();
        }

        // --- 8. Store optimization results for UI badges ---
        const _changes = {
            pipeDia: _oldPipeDia !== optimalDia ? { from: _oldPipeDia, to: optimalDia } : null,
            slope: Math.abs(_oldSlope - optimalSlope) > 0.01 ? { from: _oldSlope, to: optimalSlope } : null,
            material: _oldMaterial !== optimalMat ? { from: _oldMaterial, to: optimalMat } : null,
            manning: Math.abs(_oldManning - optimalManning) > 0.0001 ? { from: _oldManning, to: optimalManning } : null,
        };
        window._optimizationResults = Object.values(_changes).some(v => v !== null) ? _changes : null;

        // --- 9. Refresh the local analysis on the current page ---
        if (typeof generateLocalAnalysis === 'function') generateLocalAnalysis();

        // --- 10. Show success & restore button ---
        mkStatus(`Design optimized — Ø${optimalDia}mm ${optimalMat}, slope ${optimalSlope}%, CAD and 3D updated.`, true);
        if (btn) { btn.textContent = '⚡ Auto-Optimize Design'; btn.disabled = false; }

    } catch (e) {
        console.error('Optimization error:', e);
        mkStatus('Optimization failed: ' + (e.message || e), false);
        if (btn) { btn.textContent = '⚡ Auto-Optimize Design'; btn.disabled = false; }
    }
}

// ============ AI-POWERED ANALYSIS (with Groq API) ============
const AI_SYS_PROMPT = `You are a senior drainage design engineer with 25+ years of experience in stormwater management, hydraulic design, and infrastructure planning. Provide precise, data-driven recommendations with clear engineering justification.

=== HYDRAULIC PRINCIPLES ===
- Rational Method: Q = C × I × A (peak flow = runoff coefficient × rainfall intensity × area). C depends on soil/surface: paved=0.9, clay=0.7, loam=0.5, sand=0.3, gravel=0.15. I from historical climate data. A in hectares.
- Manning's Equation: V = (1/n) × R^(2/3) × S^(1/2). n values: PVC=0.009, HDPE=0.011, Concrete=0.013, RCC=0.015, DI=0.013, Steel=0.012, VC=0.014. R = D/4 for full pipe. Q = V × A.
- Pipe sizing: D = ((Q × n) / (0.463 × √S))^(3/8). Standard sizes: 150,200,225,250,300,350,375,400,450,500,525,600,675,750,900,1050,1200mm.
- Flow regime: Re = VD/ν (turbulent >4000). Fr = V/√(gy) — sub-critical <1, super-critical >1. Self-cleansing: min 0.6 m/s (0.75 for combined). Max velocity: PVC 2.0, concrete 2.5, DI 3.0 m/s.
- Capacity utilization target: 75-85%. HGL must remain below ground level. Cover depth minimum 1m for frost.

=== SOIL ENGINEERING ===
- Clay: low infiltration (C≈0.7), requires geotextile wrap, 300mm granular bedding, compaction to 95% Standard Proctor, min 15% slope for self-cleansing.
- Sand: high infiltration (C≈0.3), low cohesion, use trench shields, 150mm Class I bedding, compaction to 92%, risk of pipe flotation in high water table.
- Loam/Silt: moderate infiltration (C≈0.4-0.5), frost-susceptible, over-excavate 300mm and replace with granular fill.
- Soil composition (clay/sand/silt %) determines plasticity, bearing capacity, and trench design per ASTM D2321.

=== OUTPUT FORMAT ===
Structure every recommendation as a professional engineering report with EXACTLY these sections (use markdown headings):

## 1. Site & Context Summary
Brief 2-3 sentence summary of the site conditions. Include key numbers: location, elevation, slope, soil type, annual rainfall. Identify critical factors affecting design.

## 2. Hydraulic Performance Evaluation
Evaluate the current hydraulic design citing actual values:
- Flow rate (Q), velocity (V), pipe diameter, slope, capacity utilization
- Froude and Reynolds numbers with engineering interpretation
- Is capacity adequate? Is velocity within self-cleansing and scour limits?
- Use Manning's equation and Rational Method to justify assessments

## 3. Design Recommendations
Concrete, actionable recommendations. For each:
- What to change and why (cite specific values)
- Engineering basis (formula, code, or best practice)
- Expected improvement in performance

## 4. Material Selection Guidance
- Compare at least 2-3 materials for the given soil and slope
- Consider: cost, durability, hydraulic efficiency (n value), installation complexity
- Recommend one with clear justification using the actual cost data

## 5. Construction Considerations
- Soil-specific trench design and bedding requirements
- Cover depth, frost protection, and traffic loading
- Testing and inspection requirements
- Any special measures for steep slopes (>5%) or challenging soil

## 6. Top 3 Priority Actions
Numbered list of the three most important actions, prioritized by impact.

Keep each section concise (3-6 lines). Bold key numbers with **. Use professional civil engineering terminology. Reference specific values from the provided data.`;

async function generateAIPoweredAnalysis(returnHTML) {
    const area = document.getElementById('aiResponseArea');
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const md = window._mapData;
    const locName = document.getElementById('mapAddr').textContent || 'Selected location';
    if (!md) throw new Error('No map data');
    const {lat, lng, elev, slope, soil, rain} = md;
    const c = window._calcResults;
    
    if (!returnHTML) {
        area.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px">
            <div class="ai-loading-spinner" style="width:36px;height:36px;border-width:4px;"></div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
                <span style="font-weight:600;font-size:1rem;color:var(--text-secondary)">Generating engineering analysis for "${locName}"...</span>
                <span style="font-size:0.8rem;color:rgba(232,234,237,0.4)">Groq AI (llama-3.3-70b) · ~3-5s</span>
            </div>
        </div>`;
        await new Promise(r => setTimeout(r, 30));
    }
    
    // Build comprehensive context block
    let ctx = `SITE DATA:
- Location: ${locName} (${lat},${lng})
- Elevation: ${elev ?? '?'}m, Slope: ${slope ?? '?'}%
- Soil: ${soil ?? '?'} (composition: clay=${md.soilClay ?? '?'}%, sand=${md.soilSand ?? '?'}%, silt=${md.soilSilt ?? '?'}%)
- Runoff Coefficient C: ${md.soilRunoff ?? '?'}
- Rainfall: ${rain ?? '?'}mm/yr, Temperature: ${md.temp ?? '?'}°C
- Humidity: ${md.humidity ?? '?'}%, Wind: ${md.wind ?? '?'}km/h
`;
    if (md.profile && md.profile.length > 0) {
        const elevs = md.profile.map(p => p.elev).filter(v => v != null);
        if (elevs.length > 1) {
            ctx += `- Elevation profile: ${elevs.length} points, range ${Math.min(...elevs).toFixed(1)}-${Math.max(...elevs).toFixed(1)}m, avg ${(elevs.reduce((a,b)=>a+b,0)/elevs.length).toFixed(1)}m\n`;
        }
    }

    if (c) {
        const capPct = (c.capacityUse * 100).toFixed(0);
        ctx += `\nHYDRAULIC CALCULATIONS:
- Catchment area: ${c.area?.toFixed(2) ?? '?'} ha
- Rainfall intensity: ${c.rainfallIntensity?.toFixed(1) ?? '?'} mm/hr
- Peak flow Q: ${c.Q?.toFixed(4) ?? '?'} m³/s (Rational Method)
- Velocity V: ${c.V?.toFixed(2) ?? '?'} m/s
- Pipe diameter: ${c.pipeDia ?? '?'}mm, Material: ${c.material ?? '?'}
- Pipe slope: ${c.slopePct ?? '?'}%, Manning's n: ${c.manning ?? '?'}
- Capacity utilization: ${capPct}%
- Froude number: ${c.Fr?.toFixed(3) ?? '?'} (${c.Fr != null ? (c.Fr < 1 ? 'sub-critical' : c.Fr > 1 ? 'super-critical' : 'critical') : '?'})
- Reynolds number: ${Math.round(c.Re ?? 0)?.toLocaleString() ?? '?'} (${(c.Re ?? 0) > 4000 ? 'turbulent' : '?'})
- Self-cleansing check: ${c.V >= 0.75 ? 'OK ≥0.75 m/s' : 'BELOW 0.75 m/s — sedimentation risk'}
- Scour check: ${c.V > 3 ? 'EXCEEDS 3 m/s — erosion risk' : c.V > 2 ? 'Near limit for PVC (2 m/s)' : 'OK'}
`;
        if (c.suitableMats && c.suitableMats.length > 0) {
            ctx += `\nMATERIAL COMPARISON:\n`;
            c.suitableMats.forEach(sm => {
                ctx += `- ${sm.label || sm.name}: n=${(sm.n || sm.manningsN).toFixed(3)}, Vfull=${(sm.Vfull??0).toFixed(2)}m/s, Qfull=${(sm.Qfull??0).toFixed(4)}m³/s, $${(sm.costPerM??0).toFixed(0)}/m\n`;
            });
        }
    }

    if (typeof CAD !== 'undefined' && CAD.elements) {
        const pipes = CAD.elements.filter(e => e.type === 'pipe');
        const nodes = CAD.elements.filter(e => ['manhole','catchpit','outlet','junction'].includes(e.type));
        const roads = CAD.elements.filter(e => e.type === 'road');
        ctx += `\nCAD NETWORK: ${CAD.elements.length} total elements
- Pipes: ${pipes.length}, Nodes: ${nodes.length}, Roads: ${roads.length}
`;
        if (pipes.length > 0) {
            const totalLen = pipes.reduce((sum, p) => {
                const dx = (p.x2 ?? p.x) - (p.x ?? 0);
                const dy = (p.y2 ?? p.y) - (p.y ?? 0);
                return sum + Math.hypot(dx, dy);
            }, 0);
            ctx += `- Total pipe length: ~${totalLen.toFixed(0)}m\n`;
        }
    }

    const opt = window._optimizationResults;
    if (opt) {
        const changes = [];
        if (opt.pipeDia) changes.push(`diameter ${opt.pipeDia.from}→${opt.pipeDia.to}mm`);
        if (opt.slope) changes.push(`slope ${opt.slope.from}%→${opt.slope.to}%`);
        if (opt.material) changes.push(`material ${opt.material.from}→${opt.material.to}`);
        if (changes.length > 0) ctx += `\nOPTIMIZATION APPLIED: ${changes.join(', ')}\n`;
    }

    ctx += `\nProvide a professional engineering recommendation for this drainage design using the format specified in your instructions. Base your analysis on the actual calculated values above and engineering best practices.`;

    try {
        const rawText = await callGroq([
            { role: 'system', content: AI_SYS_PROMPT },
            { role: 'user', content: ctx }
        ], apiKey, { maxTokens: 1500, temperature: 0.3 });

        let text = rawText;
        // Convert markdown headings
        text = text.replace(/^### (.*?)$/gm, '<h3>$1</h3>')
                   .replace(/^## (.*?)$/gm, '<h2>$1</h2>')
                   .replace(/^# (.*?)$/gm, '<h1>$1</h1>');
        // Bold/italic
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>');
        // Lists
        text = text.replace(/^[\*\-]\s+(.*?)$/gm, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>\n?)+/gs, m => '<ul>' + m.replace(/\n$/, '') + '</ul>');
        // Line breaks
        text = text.replace(/\n{2,}/g, '</p><p>');
        text = text.replace(/\n/g, '<br>');
        
        const html = `<div style="padding-bottom:20px;font-size:0.9rem;line-height:1.65;animation:fadeInUp 0.4s ease-out"><p>${text}</p>
<p style="color:rgba(232,234,237,0.3);font-size:0.7rem;margin-top:20px;border-top:1px solid rgba(255,255,255,0.04);padding-top:10px">Analysis by Groq AI (llama-3.3-70b) · Data from your current session</p></div>`;
        
        if (returnHTML) return html;
        area.innerHTML = html;
    } catch (e) {
        console.error(e);
        if (returnHTML) throw e;
        document.getElementById('aiErrorMsg').textContent = "AI request failed. Check your API key and try again.";
        document.getElementById('aiErrorMsg').style.display = 'block';
        area.innerHTML = '<div class="placeholder-text-container"><p style="color:#ef4444">AI request failed. ' + e.message + '</p></div>';
    }
}

// ============ MAIN ENTRY — mixed approach (local instant + background AI) ============
async function generateAIRecommendation() {
    const btn = document.getElementById('btnGenerateAI');
    const err = document.getElementById('aiErrorMsg');
    const area = document.getElementById('aiResponseArea');
    const apiKey = document.getElementById('aiApiKey').value.trim();
    const useSearch = document.getElementById('aiUseSearch')?.checked ?? true;
    
    err.style.display = 'none';
    
    if (!window._mapData) {
        err.textContent = "Please select a location in the Map Designer first.";
        err.style.display = 'block';
        return;
    }
    
    if (apiKey) localStorage.setItem('drainflow_groq_key', apiKey);
    
    btn.classList.add('btn-generating');
    
    // Phase 1: Show local analysis IMMEDIATELY (no waiting)
    await new Promise(r => setTimeout(r, 30));
    delete window._optimizationResults;
    try { generateLocalAnalysis(); } catch (e) { console.error('Local analysis failed:', e); }
    
    if (useSearch) {
        btn.innerHTML = '<span class="ai-loading-spinner"></span> <span>Generating AI engineering analysis...</span>';
        // Phase 2: Fetch AI in background and append
        const areaEl = document.getElementById('aiResponseArea');
        // Add loading indicator for AI section
        areaEl.innerHTML += `<div id="aiAppendLoader" style="margin-top:20px;padding:16px;border-top:1px solid rgba(255,255,255,0.06);text-align:center">
            <div class="ai-loading-spinner" style="width:20px;height:20px;border-width:3px;margin:0 auto 8px"></div>
            <span style="font-size:0.85rem;color:rgba(232,234,237,0.5)">🤖 Generating AI-powered engineering analysis for "${document.getElementById('mapAddr').textContent}"...</span>
        </div>`;
        
        try {
            const aiHTML = await generateAIPoweredAnalysis(true); // returns HTML instead of setting content
            const loader = document.getElementById('aiAppendLoader');
            if (loader) {
                loader.outerHTML = `<div style="margin-top:20px;padding-top:16px;border-top:2px solid rgba(0,245,212,0.15);animation:fadeInUp 0.4s ease-out">
                    <h3 style="color:var(--accent-primary);font-size:0.95rem;margin-bottom:12px;display:flex;align-items:center;gap:8px">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
                        🤖 AI Engineering Analysis
                        <span style="font-size:0.65rem;color:rgba(232,234,237,0.35);font-weight:400">via Groq AI</span>
                    </h3>
                    <div style="font-size:0.9rem">${aiHTML}</div>
                </div>`;
            }
        } catch (e) {
            console.error(e);
            const loader = document.getElementById('aiAppendLoader');
            if (loader) loader.remove();
        }
    } else {
        // Hint that AI is available
        area.innerHTML += '<p style="color:rgba(232,234,237,0.35);font-size:0.72rem;margin-top:12px;text-align:center">API key stored. Enable "Use AI" to get Groq AI-powered recommendations on top of local analysis.</p>';
    }
    
    btn.classList.remove('btn-generating');
    btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> <span>Generate Recommendation</span>`;
}

// ============ SUPABASE AUTH ============
let supabaseClient = null;
let lastUsedSupaUrl = null;
let lastUsedSupaKey = null;

function initAuthUI() {
    const savedUrl = localStorage.getItem('supabase_url');
    const savedKey = localStorage.getItem('supabase_key');
    if(savedUrl) document.getElementById('supaUrl').value = savedUrl;
    if(savedKey) document.getElementById('supaKey').value = savedKey;
    checkAuthState();
}

function getSupabase() {
    const url = document.getElementById('supaUrl')?.value.trim() || localStorage.getItem('supabase_url');
    const key = document.getElementById('supaKey')?.value.trim() || localStorage.getItem('supabase_key');
    if(!url || !key) return null;

    // Only recreate if keys changed
    if (supabaseClient && url === lastUsedSupaUrl && key === lastUsedSupaKey) {
        return supabaseClient;
    }
    
    if(!window.supabase) {
        console.error("Supabase library not loaded from CDN");
        return null;
    }
    
    lastUsedSupaUrl = url;
    lastUsedSupaKey = key;
    localStorage.setItem('supabase_url', url);
    localStorage.setItem('supabase_key', key);
    
    try {
        supabaseClient = window.supabase.createClient(url, key);
        return supabaseClient;
    } catch (e) {
        console.error("Failed to create Supabase client:", e);
        return null;
    }
}

async function checkAuthState() {
    const supa = getSupabase();
    if(!supa) return;
    
    try {
        const { data: { session } } = await supa.auth.getSession();
        const formCard = document.querySelector('.signin-card');
        const dashCard = document.getElementById('userDashboard');
        const navBadge = document.getElementById('navUserBadge');
    
    if (session) {
        if(formCard) formCard.style.display = 'none';
        if(dashCard) dashCard.style.display = 'flex';
        
        const username = session.user.user_metadata?.username || 'User';
        const nameDisp = document.getElementById('userNameDisplay');
        if(nameDisp) nameDisp.textContent = `Welcome Back, ${username}!`;
        const emailDisp = document.getElementById('userEmailDisplay');
        if(emailDisp) emailDisp.textContent = session.user.email;
        const avatar = document.getElementById('userAvatar');
        if(avatar) avatar.textContent = username.charAt(0).toUpperCase();
        if(navBadge) navBadge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> ${username}`;
        
        // Refresh project list on login
        fetchUserProjects();
    } else {
        if(formCard) formCard.style.display = 'block';
        if(dashCard) dashCard.style.display = 'none';
        if(navBadge) navBadge.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg> Sign In`;
    }
    } catch (e) {
        console.error("Auth session check failed:", e);
    }
}

async function handleAuth(type) {
    const supa = getSupabase();
    const status = document.getElementById('authStatus');
    status.style.display = 'block';
    
    if(!supa) {
        status.style.background = 'rgba(239,68,68,0.1)';
        status.style.color = '#ef4444';
        status.textContent = 'Please provide Supabase URL and Key first.';
        return;
    }
    
    const email = document.getElementById('authEmail').value.trim();
    const password = document.getElementById('authPassword').value;
    const username = document.getElementById('authUsername').value.trim();
    
    if(!email || !password) {
        status.style.background = 'rgba(239,68,68,0.1)';
        status.style.color = '#ef4444';
        status.textContent = 'Email and Password are required.';
        return;
    }

    try {
        status.innerHTML = '<span class="ai-loading-spinner"></span> Processing request...';
        status.style.background = 'rgba(255,255,255,0.05)';
        status.style.color = 'var(--text-secondary)';
        
        if(type === 'register') {
            if(!username) throw new Error("Username is required for registration.");
            const { data, error } = await supa.auth.signUp({
                email, password, options: { data: { username } }
            });
            
            if(error) throw error;
            
            // Sync to profiles table (added step for persistence)
            if (data.user) {
                const { error: profileError } = await supa
                    .from('profiles')
                    .insert([{ 
                        id: data.user.id, 
                        username: username, 
                        email: email 
                    }]);
                if (profileError) {
                    console.error("Profile sync issue:", profileError);
                    // We don't throw here so the user can still log in, but we log the error
                }
            }

            // Check if user is created but requires email confirmation
            if(data.user && data.session === null) {
                status.style.background = 'rgba(255,193,7,0.1)';
                status.style.color = '#ffc107';
                status.innerHTML = '<strong>Success!</strong> Account created, but you must check your email to confirm before you can log in.<br><br><small>Tip: You can disable "Email Confirmation" in your Supabase Auth settings to skip this.</small>';
                return;
            }

            if(data.user && data.user.identities && data.user.identities.length === 0) {
                 throw new Error("User already exists. Please login instead.");
            }
            
            status.style.background = 'rgba(0,245,212,0.1)';
            status.style.color = 'var(--accent-primary)';
            status.textContent = 'Registration successful! Logged in.';
            await checkAuthState();
        } else {
            const { error } = await supa.auth.signInWithPassword({ email, password });
            if(error) throw error;
            status.style.display = 'none';
            await checkAuthState();
        }
    } catch(err) {
        status.style.background = 'rgba(239,68,68,0.1)';
        status.style.color = '#ef4444';
        
        let msg = err.message;
        if (msg.includes("Invalid login credentials")) msg = "Incorrect Email or Password.";
        if (msg.includes("API key")) msg = "Invalid Supabase API Key. Please check the 'Anon Key' field.";
        
        status.textContent = msg;
    }
}

async function handleLogout() {
    const supa = getSupabase();
    if(supa) await supa.auth.signOut();
    supabaseClient = null; 
    await checkAuthState();
    document.getElementById('authPassword').value = '';
    // Clear project list on logout
    const list = document.getElementById('projectList');
    if(list) list.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem;">Login to see your saved projects.</p>';
}

// ============ PROJECT MANAGEMENT ============
function saveProjectPrompt(source) {
    const name = prompt("Enter a name for this project:", `Project - ${new Date().toLocaleDateString()}`);
    if (name) saveProject(name, source);
}

async function saveProject(name, source) {
    const supa = getSupabase();
    if (!supa) { alert("Please Sign In first to save projects to the cloud."); navigateTo('signin'); return; }

    const { data: { session } } = await supa.auth.getSession();
    if (!session) { alert("Session expired. Please Sign In again."); navigateTo('signin'); return; }

    const btn = source === 'map' ? document.getElementById('btnSaveMap') : null;
    if(btn) { btn.disabled = true; btn.innerHTML = '<span class="ai-loading-spinner"></span> Saving...'; }

    try {
        const projectData = {
            user_id: session.user.id,
            name: name,
            map_data: window._mapData || null,
            calc_data: window._calcResults || null
        };

        const { error } = await supa.from('projects').insert([projectData]);
        if (error) throw error;

        alert(`Success! "${name}" has been saved to your cloud profile.`);
        fetchUserProjects(); // Refresh list
    } catch (err) {
        console.error("Save failed:", err);
        alert("Failed to save project: " + err.message);
    } finally {
        if(btn) { 
            btn.disabled = false; 
            btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> Save Map to Cloud`;
        }
    }
}

async function fetchUserProjects() {
    const supa = getSupabase();
    const list = document.getElementById('projectList');
    if (!supa || !list) return;

    try {
        const { data: { session } } = await supa.auth.getSession();
        if(!session) return;

        const { data, error } = await supa
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (!data || data.length === 0) {
            list.innerHTML = '<p class="placeholder-text" style="font-size:0.85rem;">You haven\'t saved any projects yet.</p>';
            return;
        }

        list.innerHTML = data.map(pj => `
            <div class="project-card">
                <div class="project-info">
                    <h4>${pj.name}</h4>
                    <p>${new Date(pj.created_at).toLocaleDateString()} • ${pj.map_data ? 'Map Linked' : 'No Map'} • ${pj.calc_data ? 'Calc Ready' : 'No Data'}</p>
                </div>
                <div class="project-actions">
                    <button class="btn-icon-sm" onclick="loadProject('${pj.id}')" title="Load Project">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    </button>
                    <button class="btn-icon-sm btn-delete" onclick="deleteProject('${pj.id}')" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    </button>
                </div>
            </div>
        `).join('');
    } catch (err) {
        console.error("Fetch projects failed:", err);
    }
}

async function loadProject(id) {
    const supa = getSupabase();
    if (!supa) return;

    try {
        const { data, error } = await supa.from('projects').select('*').eq('id', id).single();
        if (error) throw error;

        // Restore Map Data
        if (data.map_data) {
            window._mapData = data.map_data;
            document.getElementById('mapLat').textContent = data.map_data.lat.toFixed(4) + '°';
            document.getElementById('mapLng').textContent = data.map_data.lng.toFixed(4) + '°';
            document.getElementById('mapAddr').textContent = data.map_data.address || `${data.map_data.lat.toFixed(2)}, ${data.map_data.lng.toFixed(2)}`;
            document.getElementById('mapElev').textContent = data.map_data.elev.toFixed(1) + ' m';
            document.getElementById('mapSlope').textContent = data.map_data.slope + '%';
            document.getElementById('mapSoil').textContent = data.map_data.soil;
            document.getElementById('mapRain').textContent = data.map_data.rain + ' mm/yr';
            document.getElementById('mapTemp').textContent = data.map_data.temp != null ? data.map_data.temp + '°C' : '—';
            document.getElementById('mapHumidity').textContent = data.map_data.humidity != null ? data.map_data.humidity + '%' : '—';
            document.getElementById('mapWind').textContent = data.map_data.wind != null ? data.map_data.wind + ' km/h' : '—';
            window._mapProfileData = data.map_data.profile || [];
            drawElevProfileMini();
            
            // Move map to location if leaflet exists
            if (leafletMap) {
                leafletMap.setView([data.map_data.lat, data.map_data.lng], 13);
                if (mapMarker) mapMarker.setLatLng([data.map_data.lat, data.map_data.lng]);
            }
        }

        // Restore Calc Data
        if (data.calc_data) {
            window._calcResults = data.calc_data;
            document.getElementById('calcSlope').value = (data.calc_data.slope * 100).toFixed(1);
            document.getElementById('calcRainfall').value = data.calc_data.rainfall;
            document.getElementById('calcArea').value = data.calc_data.area;
            document.getElementById('calcManning').value = data.calc_data.manning;
            document.getElementById('calcSoil').value = {0.65:'clay', 0.45:'loam', 0.25:'sand', 0.15:'gravel'}[data.calc_data.C] || 'loam';
            
            // Re-run UI update to show the box
            calculateHydraulics(); 
        }

        alert(`Project "${data.name}" loaded successfully!`);
        navigateTo('home');
    } catch (err) {
        alert("Load project failed: " + err.message);
    }
}

async function deleteProject(id) {
    if (!confirm("Are you sure you want to delete this project?")) return;
    const supa = getSupabase();
    if (!supa) return;

    try {
        const { error } = await supa.from('projects').delete().eq('id', id);
        if (error) throw error;
        fetchUserProjects();
    } catch (err) {
        alert("Delete failed: " + err.message);
    }
}

// ============ AI CHATBOT ============
let chatOpen = false;
const CHAT_SYS_PROMPT = `You are a senior drainage design engineer and AI assistant for drainflow-pro — a professional web-based drainage design, hydraulic analysis, and 3D visualization platform. Provide expert-level, thorough responses demonstrating deep engineering knowledge.

=== CORE HYDRAULIC KNOWLEDGE ===

**Rational Method (Q = C × I × A):**
- Q = peak flow rate (m³/s) — the design discharge the pipe must carry
- C = runoff coefficient (0-1) — depends on surface type: 0.9 for paved roads, 0.7 for compacted gravel, 0.3-0.5 for grass/soil. Clay soils have higher C (~0.7), sandy soils lower (~0.3). Loam is ~0.5.
- I = rainfall intensity (mm/hr) — from Open-Meteo API using historical data for the selected location. Higher intensity = more runoff. Design storms typically use 50-100 mm/hr for urban drainage.
- A = catchment area (ha) — the area draining to the pipe. Larger area = more runoff. The tool auto-calculates from the map location context.

**Manning's Equation (V = (1/n) × R^(2/3) × S^(1/2)):**
- V = flow velocity (m/s) — target 0.6-2.5 m/s for self-cleansing without scour
- n = Manning's roughness coefficient: PVC=0.009 (smooth), HDPE=0.011, Concrete=0.013, RCC=0.015, Ductile Iron=0.013, Steel=0.012, Vitrified Clay=0.014
- R = hydraulic radius (m) = cross-sectional area / wetted perimeter. For full pipe: R = D/4 where D is diameter in meters
- S = slope (m/m) — pipe gradient. Steeper = faster flow. Typical range 0.5-5%
- Q = V × A (continuity equation) — pipe capacity at given slope
- Capacity utilization = Q_design / Q_full — target ~75% for safety margin

**Pipe Sizing:**
- Minimum diameter: 150mm for lateral drains, 225mm for branch sewers, 300mm+ for trunk mains
- Calculated from Q_design using Manning's equation solved for D: D = ((Q × n) / (0.463 × S^(1/2)))^(3/8) for full pipe flow
- Standard sizes: 150, 200, 225, 250, 300, 350, 375, 400, 450, 500, 525, 600, 675, 750, 900, 1050, 1200mm
- Material cost per meter: PVC ~$85/m, HDPE ~$125/m, Concrete ~$175/m, RCC ~$210/m, DI ~$245/m, Steel ~$220/m, VC ~$160/m

**Flow Regime Indicators:**
- Reynolds number (Re) = (V × D) / ν — dimensionless. Re < 2000 = laminar, Re > 4000 = turbulent. Stormwater is almost always turbulent (Re >> 4000). Higher Re = more mixing, higher friction.
- Froude number (Fr) = V / √(g × y) — where y = hydraulic depth. Fr < 1 = sub-critical (tranquil, controlled by downstream conditions). Fr > 1 = super-critical (rapid, controlled by upstream). Fr = 1 = critical.
- Self-cleansing velocity: 0.6 m/s minimum to keep solids suspended. 0.75 m/s for combined sewers.
- Maximum velocity: 2.5 m/s for concrete, 3.0 m/s for ductile iron, 2.0 m/s for PVC to prevent scour.

**Hydraulic Grade Line (HGL) and Energy Grade Line (EGL):**
- HGL = elevation of water surface in the pipe (piezometric head)
- EGL = HGL + V²/(2g) — total energy including velocity head
- HGL must stay below ground level to prevent surcharging
- The difference between ground and pipe invert = burial depth (minimum 1m for frost protection)
- If HGL > ground, surface flooding occurs

=== MAP DESIGNER PARAMETERS ===

**Terrain Data:**
- Elevation (m) — from Open-Meteo API elevation API. Determines hydraulic head available for gravity flow
- Slope (%) — calculated from elevation profile over the drainage area. Steeper slopes = faster runoff = higher Q
- Soil Type — from ISRIC SoilGrids API or coordinate estimation or AI refinement:
  - Clay: low infiltration, high runoff (C=0.7), risk of erosion, poor drainage
  - Sand: high infiltration, low runoff (C=0.3), good drainage, risk of pipe settlement
  - Loam: moderate (C=0.5), ideal for drainage
  - Silt Loam: moderate-low infiltration
  - Sandy Loam: moderate-high infiltration
  - Clay Loam: moderate-low infiltration
  - Silty Clay: very low infiltration
- Rainfall (mm/yr) — annual total. Higher rainfall = larger design storm intensity
- Temperature (°C) — affects evaporation, frost depth, and material selection (PVC embrittlement below 0°C)
- Humidity (%) — affects evapotranspiration
- Wind (km/h) — affects driving rain on vertical surfaces

**Runoff Coefficient (C):**
- Determined by soil type and surface cover
- Used in Rational Method: higher C = more runoff = larger pipe needed
- The tool auto-selects C based on the soil texture detected at the map location

=== RESULTS SECTION — GRAPHS & CHARTS ===

**1. Flow Rate & Velocity vs Slope:**
- Dual Y-axis chart: left = velocity (m/s), right = flow rate (m³/s)
- X-axis = pipe slope (%); shows how changing slope affects both velocity and capacity
- Design point highlighted as larger marker
- Key insight: small slope changes dramatically affect flow (Manning's V ∝ S^(1/2))

**2. Peak Discharge vs Rainfall:**
- X-axis = rainfall intensity (mm/hr) from 40% to 200% of design intensity
- Y-axis = peak discharge (m³/s)
- Uses Rational Method at each intensity level
- Safety factor assessment: how much extra rainfall can the system handle before flooding?

**3. Pipe Size Comparison by Slope:**
- Bar chart showing minimum required pipe diameter at each slope
- Dashed line = your selected diameter
- Steeper slopes = smaller required pipes (gravity assists)
- Bar at design slope highlighted green

**4. Material Cost Distribution:**
- Donut chart breaking down costs: pipes (50-70%), manholes (~$2,500 each), catch pits, fittings (~18% of pipe cost)
- Material unit rates vary: PVC < HDPE < VC < Concrete < Steel < DI < RCC
- Larger diameters = more expensive per meter

**5. Performance Radar:**
- Six axes: Flow Efficiency, Velocity Compliance, Capacity, Erosion Resistance, Cost Efficiency, Structural Strength
- Score 0-100 each. Target all ≥ 60. Ideal = balanced polygon
- Trade-offs: Cost Efficiency vs Structural Strength (PVC cheap but weak, RCC expensive but strong)

**6. Velocity Compliance Gauge:**
- Speedometer-style gauge: 0-3.0 m/s range
- Red (0-0.6): sediment deposition risk
- Green (0.6-1.2): acceptable
- Bright Green (1.2-2.5): optimal
- Red (>2.5): erosion/scour risk

**7. Hydraulic Grade Line & Energy Line:**
- Four lines: Ground level (dashed brown), Pipe Invert (blue), HGL (cyan), EGL (red dashed)
- HGL below ground = no surcharging. HGL above ground = flooding.
- Gap between ground and invert = cover depth
- Gap between HGL and EGL = velocity head (V²/2g)
- Where HGL drops below pipe crown = partially full flow (normal)

=== OTHER SECTIONS ===

**CAD Designer:** 2D canvas with roads, pipes, manholes, catchpits, outlets, junctions. Auto-generate from calculator parameters. Layers: roads/pipes/nodes/annotations/dimensions. Snaps: endpoint, midpoint, intersection, grid. Ortho mode constrains to 45° angles.

**3D Viewer:** Three.js scene with terrain mesh, road geometry, pipe cylinders with flanges, manhole/catchpit/outlet/junction models, animated flow particles. Orbit controls, wireframe mode, cutaway view, construction animation, weather effects (rain/snow particles, wind lines). Scenarios adjust flow multipliers and water levels.

**AI Recommendation:** Generates detailed Engineering Analysis Report. Pros/cons analysis, hydraulic assessment with Fr and Re interpretation, material recommendation for specific soil type and slope, construction notes (excavation, bedding, backfill, testing), prioritized action list.

**Auto-Optimize:** Automatically adjusts pipe diameter, slope, and material to find the combination that minimizes cost while satisfying all hydraulic constraints (velocity within 0.6-2.5 m/s, capacity < 100%, standard diameter sizes). Updates CAD and 3D automatically.

=== RESPONSE GUIDELINES ===
- Take a moment to thoroughly analyze the user's question before responding
- Provide comprehensive, well-structured answers (4-8 sentences when appropriate)
- Use professional engineering terminology naturally
- When asked about any factor, explain: what it is, why it's used, its engineering significance, typical values, and how changing it affects the design
- For questions about specific numbers/values in the current session, reference the context data provided below
- When explaining graphs, describe what each axis represents, what to look for, and engineering implications
- For technical questions, include relevant formulas and parameter relationships
- Format responses with clear structure — **bold** for key terms, line breaks for readability
- Always maintain a professional, knowledgeable, and helpful tone befitting a senior engineer
- If asked about something NOT related to drainflow-pro, respond with 1-2 sentences politely redirecting back to the tool's capabilities`;

function toggleChat() {
    chatOpen = !chatOpen;
    document.getElementById('chatPanel').classList.toggle('open', chatOpen);
    if (chatOpen) document.getElementById('chatInp').focus();
}

function addChatMsg(text, role) {
    const el = document.createElement('div');
    el.className = 'chat-msg ' + role;
    el.innerHTML = text;
    document.getElementById('chatMsgs').appendChild(el);
    el.scrollIntoView({ behavior: 'smooth', block: 'end' });
}

function removeTyping() {
    const t = document.querySelector('.chat-msg.typing');
    if (t) t.remove();
}

async function sendChat() {
    const inp = document.getElementById('chatInp');
    const msg = inp.value.trim();
    if (!msg) return;
    inp.value = '';
    inp.style.height = 'auto';

    addChatMsg(escapeHtml(msg), 'user');

    const apiKey = document.getElementById('aiApiKey')?.value?.trim() || localStorage.getItem('drainflow_groq_key') || '';

    document.getElementById('chatSend').disabled = true;

    // Analyzing phase — progressive steps for professional feel
    addChatMsg('<div class="analyzing-indicator"><div class="analyzing-step active">🔍 Analyzing your question…</div><div class="analyzing-step">📐 Consulting engineering knowledge base…</div><div class="analyzing-step">💡 Crafting response…</div></div>', 'analyzing');
    await new Promise(r => setTimeout(r, 800));

    const steps = document.querySelectorAll('.analyzing-step');
    if (steps.length >= 2) { steps[0].classList.remove('active'); steps[1].classList.add('active'); }
    await new Promise(r => setTimeout(r, 800));

    if (steps.length >= 3) { steps[1].classList.remove('active'); steps[2].classList.add('active'); }
    await new Promise(r => setTimeout(r, 800));

    const analyzingEl = document.querySelector('.chat-msg.analyzing');
    if (analyzingEl) analyzingEl.remove();

    // Show animated typing dots
    addChatMsg('<span class="chat-typing"><span></span><span></span><span></span></span>', 'typing');

    // Build current session context
    let contextBlock = '';
    const md = window._mapData;
    if (md) {
        contextBlock += `\n[Current Session — Map Data: Address="${md.address||''}", Lat=${md.lat}, Lng=${md.lng}, Elev=${md.elev}m, Slope=${md.slope}%, Soil=${md.soil}, Rainfall=${md.rain}mm/yr, Temp=${md.temp}°C, Humidity=${md.humidity}%, Wind=${md.wind}km/h, Runoff Coeff C=${md.soilRunoff||'N/A'}]`;
    }
    const cr = window._calcResults;
    if (cr) {
        contextBlock += `\n[Current Session — Hydraulic Results: Q=${cr.Q?.toFixed(4)} m³/s, V=${cr.V?.toFixed(2)} m/s, Pipe=Ø${cr.pipeDia}mm ${cr.material}, Slope=${cr.slopePct}%, Re=${Math.round(cr.Re||0)}, Fr=${cr.Fr?.toFixed(2)}, Capacity=${((cr.capacityUse||0)*100).toFixed(0)}%, Rainfall Intensity=${cr.rainfallIntensity?.toFixed(1)} mm/hr, Area=${cr.area?.toFixed(2)} ha, Manning's n=${cr.manning}]`;
    }
    if (typeof CAD !== 'undefined' && CAD.elements) {
        contextBlock += `\n[Current Session — CAD: ${CAD.elements.length} elements, ${CAD.elements.filter(e=>e.type==='pipe').length} pipes, ${CAD.elements.filter(e=>['manhole','catchpit','outlet','junction'].includes(e.type)).length} nodes]`;
    }

    try {
        const text = await callGroq([
            { role: 'system', content: CHAT_SYS_PROMPT },
            { role: 'user', content: msg + (contextBlock ? '\n\n' + contextBlock : '') }
        ], apiKey, { maxTokens: 1000, temperature: 0.7 });
        removeTyping();
        document.getElementById('chatSend').disabled = false;
        if (!text) { addChatMsg('I apologize, but I was unable to generate a response. Could you please rephrase your question?', 'bot'); return; }
        const formatted = text.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        addChatMsg(formatted, 'bot');
    } catch (err) {
        removeTyping();
        document.getElementById('chatSend').disabled = false;
        addChatMsg('Error: ' + err.message, 'bot');
    }
}

// ============ INIT ============
document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(() => { checkAuthState(); }, 500); // Check auth state globally on load
    navigateTo('home');
    window.addEventListener('scroll',()=>{const nb=document.getElementById('navbar'),sc=window.scrollY;nb.style.background=sc>50?'rgba(10,14,26,0.92)':'rgba(10,14,26,0.75)';nb.style.boxShadow=sc>50?'0 4px 20px rgba(0,0,0,0.3)':'none';});
});
