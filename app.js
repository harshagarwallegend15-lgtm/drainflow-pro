// ========================================
// DrainFlow Pro — Main Application
// ========================================

let currentPage = 'home';
let leafletMap = null, mapMarker = null, currentTileLayer = null;

// ============ NAVIGATION ============
function navigateTo(page) {
    currentPage = page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    const pageEl = document.getElementById(`page-${page}`);
    const navLink = document.querySelector(`.nav-link[data-page="${page}"]`);
    if (pageEl) pageEl.classList.add('active');
    if (navLink) navLink.classList.add('active');
    // Show drainage video only on home page
    const drainCanvas = document.getElementById('drainageFrameCanvas');
    if (drainCanvas) drainCanvas.classList.toggle('active', page === 'home');
    // Show footer only on home page
    const footer = document.getElementById('siteFooter');
    if (footer) footer.style.display = page === 'home' ? 'block' : 'none';
    if (page === 'cad') setTimeout(() => CAD.init(), 50);
    if (page === 'viewer3d') setTimeout(() => init3DViewer(), 50);
    if (page === 'results') setTimeout(() => drawAllCharts(), 100);
    if (page === 'ai') setTimeout(() => populateAIContext(), 50);
    if (page === 'signin') setTimeout(() => initAuthUI(), 50);
    if (page === 'home') setTimeout(() => { animateStats(); drawHeroScene(); }, 100);
    if (page === 'map') setTimeout(() => initLeafletMap(), 100);
    window.scrollTo(0, 0);
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

async function onMapClick(e) {
    const { lat, lng } = e.latlng;
    if (mapMarker) leafletMap.removeLayer(mapMarker);
    mapMarker = L.circleMarker([lat, lng], { radius: 8, color: '#00f5d4', fillColor: '#00f5d4', fillOpacity: 0.6, weight: 2 }).addTo(leafletMap);
    
    // Set loading state
    document.getElementById('mapAddr').innerHTML = '<span class="pin-pulse" style="position:relative;display:inline-block;width:8px;height:8px;bottom:0;transform:none;"></span> Checking location...';
    
    try {
        // Use Nominatim API to check if it's an ocean (no landmass found)
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=3`);
        const data = await response.json();
        
        if (data.error && data.error === "Unable to geocode") {
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
        
        // Land location confirmed, parse address
        const addrParts = [];
        if (data.address.country) addrParts.push(data.address.country);
        if (data.address.state) addrParts.unshift(data.address.state);
        const address = addrParts.join(', ') || `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
        
        document.getElementById('mapAddr').innerHTML = '<span class="pin-pulse" style="position:relative;display:inline-block;width:8px;height:8px;bottom:0;transform:none;"></span> Fetching Live API Data...';

        // 1. Fetch Real Weather Data (Open-Meteo)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;
        const resWeather = await fetch(weatherUrl);
        const dataWeather = await resWeather.json();
        const weather = dataWeather.current || {temperature_2m: '--', relative_humidity_2m: '--', precipitation: '--', wind_speed_10m: '--'};

        // 2. Fetch Real Terrain/Elevation Profile (Open-Meteo)
        // Generate a 15-point line to the East for a quick terrain profile sample
        const lats = [lat], lngs = [lng];
        for(let i=1; i<=15; i++) {
            lats.push(lat);
            lngs.push(lng + i * 0.002); // ~2km sample line
        }
        
        const elevUrl = `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lngs.join(',')}`;
        const resElev = await fetch(elevUrl);
        const dataElev = await resElev.json();
        const elevArray = dataElev.elevation || Array(16).fill(0);
        
        const mainElev = elevArray[0];
        const profileElevs = elevArray.slice(1);

        // Derive approx terrain slope
        const maxE = Math.max(...profileElevs), minE = Math.min(...profileElevs);
        let slope = 0.5;
        const lenKm = 15 * 0.002 * 111 * Math.cos(lat * Math.PI / 180);
        if (lenKm > 0) {
            slope = ((maxE - minE) / (lenKm * 1000) * 100).toFixed(1);
        }

        // Soil is difficult via simple API, use coordinates hash
        const soils = ['Clay','Loam','Sand','Gravel','Silt'];
        const soilHash = Math.abs(Math.floor(lat * 100 + lng * 100));
        const soil = soils[soilHash % soils.length];

        // Rainfall
        const baseRain = 400 + soilHash % 800;
        const rain = weather.precipitation > 0 ? (weather.precipitation * 24 * 30).toFixed(0) : baseRain;

        // Apply Data to UI
        document.getElementById('mapLat').textContent = lat.toFixed(4) + '°';
        document.getElementById('mapLng').textContent = lng.toFixed(4) + '°';
        document.getElementById('mapAddr').textContent = address;
        
        document.getElementById('mapElev').textContent = (mainElev || 0).toFixed(1) + ' m';
        document.getElementById('mapSlope').textContent = slope + '%';
        document.getElementById('mapSoil').textContent = soil;
        document.getElementById('mapRain').textContent = rain + ' mm/yr';
        
        document.getElementById('mapTemp').textContent = weather.temperature_2m + '°C';
        document.getElementById('mapHumidity').textContent = weather.relative_humidity_2m + '%';
        document.getElementById('mapWind').textContent = weather.wind_speed_10m + ' km/h';

        window._mapData = { lat, lng, elev: mainElev, slope: slope, soil: soil, rain: rain };
        window._mapProfileData = profileElevs;
        
        drawElevProfileMini();
        
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
        document.getElementById('calcRainfall').value = window._mapData.rain;
        document.getElementById('calcSlope').value = window._mapData.slope;
        const soilMap = {Clay:'clay',Loam:'loam',Sand:'sand',Gravel:'gravel',Silt:'loam'};
        document.getElementById('calcSoil').value = soilMap[window._mapData.soil]||'loam';
        navigateTo('calculator');
    } else alert('Click on the map first.');
}

// ============ CALCULATOR ============
function calculateHydraulics() {
    const slope = parseFloat(document.getElementById('calcSlope').value)/100;
    const rainfall = parseFloat(document.getElementById('calcRainfall').value);
    const area = parseFloat(document.getElementById('calcArea').value);
    const manning = parseFloat(document.getElementById('calcManning').value);
    const soilType = document.getElementById('calcSoil').value;
    const C = {clay:0.65,loam:0.45,sand:0.25,gravel:0.15}[soilType]||0.45;
    const Q = C*(rainfall/1000/3600)*area/10000;
    const D_calc = Math.pow((Q*manning*Math.pow(4,2/3))/(Math.PI/4*Math.sqrt(slope||0.02)),3/8);
    const stdSizes = [110,150,200,225,250,300,375,450,525,600,750,900,1050,1200];
    const pipeDia = stdSizes.find(s=>s>=D_calc*1000)||stdSizes[stdSizes.length-1];
    const R = (pipeDia/1000)/4;
    const V = (1/manning)*Math.pow(R,2/3)*Math.sqrt(slope||0.02);
    const A_pipe = Math.PI*Math.pow(pipeDia/2000,2);
    let material = pipeDia>600?'RCC':pipeDia>300?'HDPE':'PVC';
    const Re = V*(pipeDia/1000)/1e-6;
    const Fr = V/Math.sqrt(9.81*(pipeDia/1000));
    window._calcResults = {Q,V,pipeDia,material,slope,rainfall,area,manning,C,Re,Fr};
    document.getElementById('calcResultsContent').innerHTML = `<div class="result-grid"><div class="result-item"><span class="rlabel">Flow Rate</span><span class="rvalue">${Q.toFixed(4)} m³/s</span></div><div class="result-item"><span class="rlabel">Velocity</span><span class="rvalue">${V.toFixed(2)} m/s</span></div><div class="result-item"><span class="rlabel">Pipe Diameter</span><span class="rvalue">${pipeDia} mm</span></div><div class="result-item"><span class="rlabel">Material</span><span class="rvalue">${material}</span></div><div class="result-item"><span class="rlabel">Reynolds No.</span><span class="rvalue">${Math.round(Re).toLocaleString()}</span></div><div class="result-item"><span class="rlabel">Froude No.</span><span class="rvalue">${Fr.toFixed(2)}</span></div></div><div style="margin-top:16px"><button class="btn btn-primary btn-full" onclick="navigateTo('results')">View Detailed Graphs →</button></div>`;
    document.getElementById('resFlowRate').textContent = Q.toFixed(4)+' m³/s';
    document.getElementById('resVelocity').textContent = V.toFixed(2)+' m/s';
    document.getElementById('resPipeDia').textContent = pipeDia+' mm';
    document.getElementById('resMaterial').textContent = material;
    document.getElementById('resReynolds').textContent = Math.round(Re).toLocaleString();
    document.getElementById('resFroude').textContent = Fr.toFixed(2);
}

// ============ 3D VIEWER (Enhanced - Three.js) ============
let viewer3D = {scene: null, camera: null, renderer: null, controls: null, animationId: null, autoRot: false, wireframe: false, showLabels: true, showShadows: true, showGround: true, showAxes: true};

function init3DViewer() {
    if (typeof THREE === 'undefined') {
        console.error("Three.js not loaded yet.");
        setTimeout(init3DViewer, 500);
        return;
    }

    const canvas = document.getElementById('viewer3dCanvas'); if(!canvas) return;
    const wrapper = canvas.parentElement;
    const w = wrapper.clientWidth, h = wrapper.clientHeight;
    
    if (viewer3D.animationId) cancelAnimationFrame(viewer3D.animationId);

    // Init Three
    if (!viewer3D.scene) {
        viewer3D.scene = new THREE.Scene();

        viewer3D.camera = new THREE.PerspectiveCamera(45, w / h, 1, 10000);
        
        viewer3D.renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
        viewer3D.renderer.setSize(w, h);
        viewer3D.renderer.setPixelRatio(window.devicePixelRatio);
        viewer3D.renderer.shadowMap.enabled = true;
        viewer3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        viewer3D.controls = new THREE.OrbitControls(viewer3D.camera, viewer3D.renderer.domElement);
        viewer3D.controls.enableDamping = true;
        viewer3D.controls.dampingFactor = 0.05;

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        viewer3D.scene.add(ambientLight);
        
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(150, 300, 100);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -600;
        dirLight.shadow.camera.right = 600;
        dirLight.shadow.camera.top = 600;
        dirLight.shadow.camera.bottom = -600;
        dirLight.shadow.bias = -0.001;
        viewer3D.scene.add(dirLight);
    } else {
        viewer3D.renderer.setSize(w, h);
        viewer3D.camera.aspect = w / h;
        viewer3D.camera.updateProjectionMatrix();
        
        // Clear scene meshes
        const toRemove = [];
        viewer3D.scene.children.forEach(c => {
            if (c.isMesh || c.type === 'GridHelper' || c.type === 'AxesHelper') toRemove.push(c);
        });
        toRemove.forEach(c => viewer3D.scene.remove(c));
    }

    // Ground Plane
    if (viewer3D.showGround) {
        const grid = new THREE.GridHelper(2000, 100, 0x00f5d4, 0x00f5d4);
        grid.material.opacity = 0.15;
        grid.material.transparent = true;
        viewer3D.scene.add(grid);

        const groundGeo = new THREE.PlaneGeometry(2000, 2000);
        const groundMat = new THREE.MeshStandardMaterial({ 
            color: 0x0a0e1a, 
            transparent: true, 
            opacity: 0.85 
        });
        const ground = new THREE.Mesh(groundGeo, groundMat);
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.5;
        ground.receiveShadow = viewer3D.showShadows;
        viewer3D.scene.add(ground);
    }

    // Axes
    if (viewer3D.showAxes) {
        const axes = new THREE.AxesHelper(150);
        viewer3D.scene.add(axes);
    }

    // Build Geometries
    const els = (typeof CAD!=='undefined' && CAD.elements) ? CAD.elements : [];
    
    // Fallback demo network if empty
    const nodes = els.filter(e => ['manhole', 'catchpit', 'outlet', 'junction'].includes(e.type));
    const pipes = els.filter(e => e.type === 'pipe');
    
    const displayNodes = els.length > 0 ? nodes : 
        [{x:-200,y:-200,c:'#7b61ff',type:'manhole'},{x:0,y:0,c:'#f59e0b',type:'catchpit'},{x:200,y:200,c:'#3b82f6',type:'outlet'}];
    const displayPipes = els.length > 0 ? pipes : [];

    if (els.length === 0) {
        for(let i=0; i<displayNodes.length-1; i++) {
            displayPipes.push({ x: displayNodes[i].x, y: displayNodes[i].y, x2: displayNodes[i+1].x, y2: displayNodes[i+1].y, color: '#00f5d4' });
        }
    }

    const materialCache = {};
    const getMaterial = (color) => {
        if (!materialCache[color]) {
            materialCache[color] = new THREE.MeshStandardMaterial({
                color: color,
                roughness: 0.2,
                metalness: 0.1,
                wireframe: viewer3D.wireframe
            });
        }
        materialCache[color].wireframe = viewer3D.wireframe;
        return materialCache[color];
    };

    // Draw Nodes
    displayNodes.forEach((n) => {
        const depth = 40 + Math.random()*20; // Simulated depth
        let geo;
        if (n.type === 'manhole' || n.type === 'junction') geo = new THREE.CylinderGeometry(15, 15, depth, 32);
        else geo = new THREE.BoxGeometry(25, depth, 25);
        
        const mesh = new THREE.Mesh(geo, getMaterial(n.c || n.color || '#7b61ff'));
        mesh.position.set(n.x, -depth/2, n.y); // 2D y -> 3D z
        mesh.castShadow = viewer3D.showShadows;
        mesh.receiveShadow = viewer3D.showShadows;
        viewer3D.scene.add(mesh);
    });

    // Draw Pipes
    displayPipes.forEach((p) => {
        const dx = p.x2 - p.x;
        const dz = p.y2 - p.y;
        const length = Math.hypot(dx, dz);
        const angle = Math.atan2(dz, dx);
        
        const geo = new THREE.CylinderGeometry(6, 6, length, 16);
        const mesh = new THREE.Mesh(geo, getMaterial(p.color || '#00f5d4'));
        
        mesh.position.set(p.x + dx/2, -20, p.y + dz/2);
        mesh.rotation.x = Math.PI / 2; // Lie flat
        mesh.rotation.z = angle - Math.PI/2; // Orient along direction
        
        mesh.castShadow = viewer3D.showShadows;
        mesh.receiveShadow = viewer3D.showShadows;
        viewer3D.scene.add(mesh);
    });

    update3DStats();
    drawSideCanvases();

    function render3D() {
        if(viewer3D.autoRot) {
            viewer3D.scene.rotation.y += 0.003;
        }
        viewer3D.controls.update();
        viewer3D.renderer.render(viewer3D.scene, viewer3D.camera);
        viewer3D.animationId = requestAnimationFrame(render3D);
    }
    
    if (displayNodes.length > 0 && !viewer3D.animationId) {
        let cx = 0, cz = 0;
        displayNodes.forEach(n => { cx += n.x; cz += n.y; });
        cx /= displayNodes.length; cz /= displayNodes.length;
        viewer3D.controls.target.set(cx, 0, cz);
        viewer3D.camera.position.set(cx + 400, 300, cz + 400);
        viewer3D.controls.update();
    }

    render3D();
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
    if(p==='top'){
        viewer3D.camera.position.set(tgt.x, tgt.y + 600, tgt.z);
    } else if(p==='front'){
        viewer3D.camera.position.set(tgt.x, tgt.y + 50, tgt.z + 600);
    } else {
        viewer3D.camera.position.set(tgt.x + 400, tgt.y + 300, tgt.z + 400); // Iso
    }
    viewer3D.scene.rotation.y = 0;
    viewer3D.controls.update();
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

function update3DStats(){
    const els=(typeof CAD!=='undefined')?CAD.elements:[];
    const pipes=els.filter(e=>e.type==='pipe'), nodes=els.filter(e=>['manhole','catchpit','outlet','junction'].includes(e.type));
    let totalLen=0; pipes.forEach(p=>totalLen+=Math.hypot((p.x2||0)-p.x,(p.y2||0)-p.y));
    document.getElementById('v3dPipes').textContent=pipes.length;
    document.getElementById('v3dNodes').textContent=nodes.length;
    document.getElementById('v3dLength').textContent=totalLen.toFixed(1)+' m';
    document.getElementById('v3dDepth').textContent=(pipes.length*0.3).toFixed(1)+' m';
}

function drawSideCanvases(){
    ['crossSectionCanvas','elevationProfileCanvas'].forEach((id,idx)=>{
        const c=document.getElementById(id);if(!c)return;
        c.width=c.parentElement.clientWidth*2;c.height=240;
        const ctx=c.getContext('2d'),w=c.width/2,h=120;
        ctx.setTransform(2,0,0,2,0,0);ctx.clearRect(0,0,w,h);
        if(idx===0){// Cross section - pipe circle
            ctx.strokeStyle='rgba(255,255,255,0.06)';ctx.lineWidth=0.5;for(let i=0;i<5;i++){ctx.beginPath();ctx.moveTo(0,h/5*i+10);ctx.lineTo(w,h/5*i+10);ctx.stroke();}
            ctx.fillStyle='rgba(139,92,46,0.2)';ctx.fillRect(0,h*0.6,w,h*0.4);
            ctx.strokeStyle='rgba(139,92,46,0.3)';ctx.beginPath();ctx.moveTo(0,h*0.6);ctx.lineTo(w,h*0.6);ctx.stroke();
            ctx.strokeStyle='#00f5d4';ctx.lineWidth=2;ctx.beginPath();ctx.arc(w/2,h*0.5,20,0,Math.PI*2);ctx.stroke();
            ctx.fillStyle='rgba(0,245,212,0.1)';ctx.beginPath();ctx.arc(w/2,h*0.5,20,0,Math.PI);ctx.fill();
            ctx.fillStyle='rgba(0,245,212,0.6)';ctx.font='9px Inter';ctx.textAlign='center';ctx.fillText('DN 220',w/2,h*0.5+4);
        } else {// Elevation
            const pts=Array.from({length:15},(_,i)=>50+Math.sin(i*0.4)*15-i*1.5+Math.random()*8);
            const grad=ctx.createLinearGradient(0,0,0,h);grad.addColorStop(0,'rgba(123,97,255,0.2)');grad.addColorStop(1,'rgba(123,97,255,0)');
            ctx.beginPath();ctx.moveTo(0,h);pts.forEach((v,i)=>ctx.lineTo(i*(w/(pts.length-1)),h-v));ctx.lineTo(w,h);ctx.closePath();ctx.fillStyle=grad;ctx.fill();
            ctx.beginPath();pts.forEach((v,i)=>i===0?ctx.moveTo(0,h-v):ctx.lineTo(i*(w/(pts.length-1)),h-v));ctx.strokeStyle='#7b61ff';ctx.lineWidth=1.5;ctx.stroke();
            pts.forEach((v,i)=>{if(i%3===0){ctx.beginPath();ctx.arc(i*(w/(pts.length-1)),h-v,3,0,Math.PI*2);ctx.fillStyle='#7b61ff';ctx.fill();}});
        }
    });
}


// ============ CHARTS (Chart.js) ============
let chartInstances = {};

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

function drawAllCharts(){
    drawFlowVelocityChart();
    drawDischargeChart();
    drawBarChart();
    drawDonutChart();
    drawRadarChart();
    drawGaugeChart();
    drawHGLChart();
    fillResultsTable();
}

function drawFlowVelocityChart() {
    const slopes = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
    const n = 0.013, D = 0.22, R = D / 4;
    const vel = slopes.map(s => (1 / n) * Math.pow(R, 2/3) * Math.sqrt(s / 100));
    const flow = vel.map(v => v * Math.PI * (D / 2) ** 2);

    initChart('chartFlowVelocity', 'line', {
        labels: slopes.map(s => s + '%'),
        datasets: [
            {
                label: 'Velocity (m/s)',
                data: vel,
                borderColor: '#00f5d4',
                backgroundColor: 'rgba(0, 245, 212, 0.1)',
                yAxisID: 'y',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: '#00f5d4'
            },
            {
                label: 'Flow Rate (m³/s)',
                data: flow,
                borderColor: '#3b82f6',
                backgroundColor: 'transparent',
                yAxisID: 'y1',
                tension: 0.4,
                borderWidth: 2,
                pointBackgroundColor: '#3b82f6'
            }
        ]
    }, {
        interaction: { mode: 'index', intersect: false },
        scales: {
            y: { type: 'linear', display: true, position: 'left', title: { display: true, text: 'Velocity (m/s)' } },
            y1: { type: 'linear', display: true, position: 'right', title: { display: true, text: 'Flow Rate (m³/s)' }, grid: { drawOnChartArea: false } }
        }
    });
}

function drawDischargeChart() {
    const rains = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000];
    const C = 0.45, area = 5000;
    const disc = rains.map(r => C * (r / 1000 / 3600) * area / 10000);

    initChart('chartDischarge', 'line', {
        labels: rains,
        datasets: [{
            label: 'Peak Discharge (m³/s)',
            data: disc.map(d => Number(d.toFixed(4))),
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245, 158, 11, 0.2)',
            fill: true,
            tension: 0.3,
            borderWidth: 2,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 4
        }]
    }, {
        scales: {
            x: { title: { display: true, text: 'Rainfall Intensity (mm/hr)' } },
            y: { title: { display: true, text: 'Discharge (m³/s)' } }
        }
    });
}

function drawBarChart() {
    const slopes = [0.5, 1, 1.5, 2, 2.5, 3, 4, 5];
    const n = 0.013;
    const sizes = slopes.map(sl => {
        const v = (1 / n) * Math.pow(0.055, 2/3) * Math.sqrt(sl / 100);
        const q = v * Math.PI * 0.11 ** 2;
        const d = Math.pow((q * n * Math.pow(4, 2/3)) / (Math.PI / 4 * Math.sqrt(sl / 100)), 3/8) * 1000;
        const std = [110, 150, 200, 225, 250, 300, 375, 450];
        return std.find(s => s >= d) || std[std.length - 1];
    });

    initChart('chartBarPipeSize', 'bar', {
        labels: slopes.map(s => s + '%'),
        datasets: [{
            label: 'Req. Pipe Size (mm)',
            data: sizes,
            backgroundColor: '#7b61ff',
            borderRadius: 4,
            barPercentage: 0.6
        }]
    }, {
        scales: {
            x: { title: { display: true, text: 'Longitudinal Slope (%)' } },
            y: { title: { display: true, text: 'Pipe Diameter (mm)' }, beginAtZero: true }
        }
    });
}

function drawDonutChart() {
    initChart('chartDonut', 'doughnut', {
        labels: ['PVC Pipes', 'HDPE Pipes', 'Manholes', 'Catch Pits', 'Fittings'],
        datasets: [{
            data: [45, 25, 12, 10, 8],
            backgroundColor: ['#00f5d4', '#7b61ff', '#f59e0b', '#3b82f6', '#ec4899'],
            borderWidth: 0,
            hoverOffset: 10
        }]
    }, {
        cutout: '75%',
        plugins: {
            legend: { position: 'right', labels: { boxWidth: 12, usePointStyle: true, color: 'rgba(232, 234, 237, 0.8)' } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.raw}%` } }
        }
    });
}

function drawRadarChart() {
    initChart('chartRadar', 'radar', {
        labels: ['Flow Efficiency', 'Velocity Comp.', 'Capacity', 'Erosion Res.', 'Cost Eff.', 'Strength'],
        datasets: [{
            label: 'System Score (%)',
            data: [85, 78, 92, 70, 88, 82],
            backgroundColor: 'rgba(0, 245, 212, 0.2)',
            borderColor: '#00f5d4',
            pointBackgroundColor: '#00f5d4',
            pointHoverBackgroundColor: '#fff',
            borderWidth: 2
        }]
    }, {
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

function drawGaugeChart() {
    const velocity = window._calcResults ? window._calcResults.V : 1.32;
    const maxV = 3.0;
    const val = Math.min(velocity, maxV);
    const remainder = Math.max(0, maxV - val);
    let color = velocity < 1.2 ? '#00f5d4' : (velocity <= 2.5 ? '#22c55e' : '#ef4444');

    initChart('chartGauge', 'doughnut', {
        labels: ['Velocity', ''],
        datasets: [{
            data: [val, remainder],
            backgroundColor: [color, 'rgba(255, 255, 255, 0.05)'],
            borderWidth: 0
        }]
    }, {
        circumference: 180,
        rotation: 270,
        cutout: '80%',
        plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
        }
    });
}

function drawHGLChart() {
    const stations = [0, 20, 40, 60, 80, 100, 120, 140];
    const ground = stations.map(s => Number((100 - s * 0.15 + Math.sin(s * 0.05) * 3).toFixed(2)));
    const invert = stations.map((s, i) => Number((ground[i] - 2.5 - i * 0.1).toFixed(2)));
    const hgl = stations.map((s, i) => Number((invert[i] + 1.8 + Math.sin(s * 0.03) * 0.5).toFixed(2)));
    const egl = hgl.map(h => Number((h + 0.3).toFixed(2)));

    initChart('chartHGL', 'line', {
        labels: stations.map(s => s + 'm'),
        datasets: [
            {
                label: 'Ground Level',
                data: ground,
                borderColor: 'rgba(139, 92, 46, 0.8)',
                backgroundColor: 'rgba(139, 92, 46, 0.1)',
                borderDash: [5, 5],
                fill: true,
                tension: 0.4,
                pointRadius: 0
            },
            {
                label: 'HGL',
                data: hgl,
                borderColor: '#00f5d4',
                backgroundColor: 'transparent',
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 3
            },
            {
                label: 'EGL',
                data: egl,
                borderColor: '#ef4444',
                backgroundColor: 'transparent',
                borderDash: [3, 3],
                tension: 0.4,
                borderWidth: 1.5,
                pointRadius: 3
            },
            {
                label: 'Pipe Invert',
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
        scales: {
            y: { title: { display: true, text: 'Elevation (m)' } }
        }
    });
}

function fillResultsTable(){
    const tbody=document.getElementById('resultsTableBody');if(!tbody)return;
    const slopes=[0.5,1,1.5,2,2.5,3,4,5],n=0.013,D=0.22,R=D/4;
    tbody.innerHTML=slopes.map(sl=>{
        const V=(1/n)*Math.pow(R,2/3)*Math.sqrt(sl/100);const Q=V*Math.PI*(D/2)**2;
        const std=[110,150,200,225,250,300,375,450];const dia=std.find(s=>s>=D*1000)||std[std.length-1];
        const Re=V*D/1e-6;const Fr=V/Math.sqrt(9.81*D);
        const st=V<0.6?'danger':V>2.5?'warn':'ok';const stL=V<0.6?'Too Slow':V>2.5?'Too Fast':'Optimal';
        return `<tr><td>${sl}</td><td>${Q.toFixed(4)}</td><td>${V.toFixed(2)}</td><td>${dia}</td><td>${Math.round(Re).toLocaleString()}</td><td>${Fr.toFixed(2)}</td><td><span class="status-badge ${st}">${stL}</span></td></tr>`;
    }).join('');
}
// ============ AI RECOMMENDATION ============
function populateAIContext() {
    const aiApiKey = localStorage.getItem('drainflow_gemini_key');
    if (aiApiKey) {
        document.getElementById('aiApiKey').value = aiApiKey;
    }
    
    if (window._mapData) {
        document.getElementById('aiContextAddr').textContent = document.getElementById('mapAddr').textContent || "Unknown Location";
        document.getElementById('aiContextTerrain').textContent = `Elev: ${window._mapData.elev}m, Slope: ${window._mapData.slope}%`;
        document.getElementById('aiContextHydraulics').textContent = `Soil: ${window._mapData.soil}, Rain: ${window._mapData.rain}mm/yr`;
    } else {
        document.getElementById('aiContextAddr').textContent = "No location selected";
        document.getElementById('aiContextTerrain').textContent = "—";
        document.getElementById('aiContextHydraulics').textContent = "—";
    }
}

async function generateAIRecommendation() {
    const btn = document.getElementById('btnGenerateAI');
    const err = document.getElementById('aiErrorMsg');
    const area = document.getElementById('aiResponseArea');
    const apiKey = document.getElementById('aiApiKey').value.trim();
    
    err.style.display = 'none';
    
    if (!apiKey) {
        err.textContent = "Please enter your Gemini API Key first.";
        err.style.display = 'block';
        return;
    }
    
    if (!window._mapData) {
        err.textContent = "Please select a location in the Map Designer first.";
        err.style.display = 'block';
        return;
    }
    
    localStorage.setItem('drainflow_gemini_key', apiKey);
    
    btn.classList.add('btn-generating');
    btn.innerHTML = '<span class="ai-loading-spinner"></span> <span>Running Live Internet Search & AI...</span>';
    
    area.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;"><div class="ai-loading-spinner" style="width:40px;height:40px;border-width:4px;"></div><span style="font-weight:600;margin-left:14px;font-size:1.1rem;color:var(--text-secondary)">AI is searching the live internet for local hydrology data...</span></div>';
    
    const locName = document.getElementById('mapAddr').textContent;
    const {lat, lng, elev, slope, soil, rain} = window._mapData;
    
    let calcContext = "";
    if (window._calcResults) {
        const c = window._calcResults;
        calcContext = `
### Current Hydraulic Engine Computations
- **Catchment Area:** ${c.area} m²
- **Computed Flow Rate (Q):** ${c.Q.toFixed(4)} m³/s
- **Flow Velocity (V):** ${c.V.toFixed(2)} m/s
- **Required Pipe Size:** ${c.pipeDia} mm
- **Initial Material Choice:** ${c.material}
- **Reynolds Number:** ${Math.round(c.Re)}
- **Froude Number:** ${c.Fr.toFixed(2)}
`;
    } else {
        calcContext = "\n*(No engine computations have been applied yet - provide theoretical sizing strategies based on the map parameters below).*\n";
    }

    let prompt = `Act as a Senior Level Civil and Hydraulic Engineering Consultant specializing in modern road drainage networks.
I am designing an infrastructure-grade drainage network for a specific real-world region: ${locName} (Latitude: ${lat}, Longitude: ${lng}).

### Empirical Site & Computation Context:
- **Average Elevation:** ${elev}m
- **Terrain Slope:** ${slope}%
- **Predominant Soil Type:** ${soil}
- **Annual Rainfall:** approximately ${rain}mm
${calcContext}

Your response MUST be an exhaustive, data-driven, professional-grade technical report specifically focusing on the parameters above. You must:

1. **Geographic Hydrological Risk Profiling:** Analyze this precise geographical region using your internet knowledge base. Detail local weather anomalies, geological hazards, ground freezing depths, or extreme seasonal precipitation traits inherent to this exact territory.
2. **Computational Validation & Hydraulics:** Critically analyze the actual numeric values (Flow Rate, Velocity, etc.) provided above (if any). Does the Froude number indicate sub-critical or super-critical flow? Assess the severe risks of hydraulic jumps, cavitation, or sedimentation based on the provided slope and soil type.
3. **Engineered Material Matrix:** Validate the initial material choice or aggressively argue for an alternative (e.g. RCP vs HDPE vs PVC) based purely on the physical characteristics required to survive this specific location's soil chemistry, groundwater levels, and structural compaction constraints.
4. **Site-Specific SUDS Deployment:** Suggest exact sustainable deployment patterns (e.g. infiltration trenches vs attenuation tanks) that have been proven to successfully operate in this specific terrain profile and climate.
5. **Real-World Internet Grounding:** You MUST use the Google Search tool to find real-world civil engineering data, recent flood events, or municipal drainage guidelines specific to the ${locName} region and cite them in your report.

Format the output strictly as a highly technical, aggressive engineering evaluation report using elegant Markdown. Embed critical data points in bold, and explicitly list your internet-sourced citations at the end.`;

    try {
        // Auto-discover the best available model for this API Key
        const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const modelsData = await modelsRes.json();
        
        if (modelsData.error) {
            throw new Error("API Key issue: " + modelsData.error.message);
        }
        
        let targetModel = "models/gemini-1.5-flash";
        if (modelsData.models) {
            const validModels = modelsData.models.filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent"));
            const pref = validModels.find(m => m.name.includes("-flash")) 
                         || validModels.find(m => m.name.includes("-pro")) 
                         || validModels.find(m => m.name.includes("gemini"));
            if (pref) {
                targetModel = pref.name;
            } else if (validModels.length > 0) {
                targetModel = validModels[0].name;
            } else {
                throw new Error("Your API key is valid but does not have access to any generateContent models.");
            }
        }
        
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/${targetModel}:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                tools: [{ googleSearch: {} }],
                generationConfig: { maxOutputTokens: 3000, temperature: 0.6 }
            })
        });
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message || "API Error");
        }
        
        let text = data.candidates[0].content.parts[0].text;
        
        text = text.replace(/### (.*?)\n/g, '<h3>$1</h3>\n')
                   .replace(/## (.*?)\n/g, '<h2>$1</h2>\n')
                   .replace(/# (.*?)\n/g, '<h1>$1</h1>\n')
                   .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                   .replace(/\*(.*?)\*/g, '<em>$1</em>')
                   .replace(/\n\n/g, '</p><p>');
                   
        text = text.replace(/(?:^|\n)\s*[\*\-]\s+(.*)/g, '<li>$1</li>');
        text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        area.innerHTML = `<div style="padding-bottom:20px; animation: fadeInUp 0.5s ease-out;"><p>${text}</p></div>`;
        
    } catch (e) {
        console.error(e);
        err.textContent = "Error: " + e.message;
        err.style.display = 'block';
        area.innerHTML = '<div class="placeholder-text-container"><p class="placeholder-text" style="color:#ef4444; font-weight:600">Failed to generate recommendation.</p><p style="color:var(--text-secondary); margin-top:10px;">Please check your API key and ensure you are connected to the internet.</p><p style="color:#ef4444; margin-top:10px; font-size:0.85rem; word-break:break-all;"><strong>Detailed Error:</strong> ' + e.message + '</p></div>';
    } finally {
        btn.classList.remove('btn-generating');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg> <span>Generate Recommendation</span>`;
    }
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
            document.getElementById('mapElev').textContent = data.map_data.elev.toFixed(1) + ' m';
            document.getElementById('mapSlope').textContent = data.map_data.slope + '%';
            document.getElementById('mapSoil').textContent = data.map_data.soil;
            document.getElementById('mapRain').textContent = data.map_data.rain + ' mm/yr';
            
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

// ============ INIT ============
document.addEventListener('DOMContentLoaded',()=>{
    setTimeout(() => { checkAuthState(); }, 500); // Check auth state globally on load
    navigateTo('home');
    window.addEventListener('scroll',()=>{const nb=document.getElementById('navbar'),sc=window.scrollY;nb.style.background=sc>50?'rgba(10,14,26,0.92)':'rgba(10,14,26,0.75)';nb.style.boxShadow=sc>50?'0 4px 20px rgba(0,0,0,0.3)':'none';});
});
