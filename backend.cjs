require('dotenv').config({ path: __dirname + '/.env' });
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const DATA_DIR = path.join(__dirname, '.drainflow_data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
    '.cjs': 'application/javascript', '.mjs': 'application/javascript'
};

function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', c => body += c);
        req.on('end', () => {
            try { resolve(JSON.parse(body)); }
            catch { resolve({}); }
        });
        req.on('error', reject);
    });
}

function sendJSON(res, data, status = 200) {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(data));
}

function sendError(res, msg, status = 400) {
    sendJSON(res, { error: msg }, status);
}

// ==================== GROQ API PROXY ====================

/** Proxy a chat completion request to Groq API using the server-side API key.
 *  POST body: { messages, options?, clientKey? }
 *  - If clientKey is provided, it takes priority over the .env key.
 *  - Returns: { content: "..." } 
 */
function proxyGroq(body) {
    return new Promise((resolve, reject) => {
        const { messages, options, clientKey } = body;
        const key = clientKey || GROQ_API_KEY;
        if (!key) return reject(new Error('No Groq API key configured. Set GROQ_API_KEY in .env or provide a client key.'));
        if (!messages || !Array.isArray(messages) || messages.length === 0)
            return reject(new Error('Messages array is required'));

        const payload = JSON.stringify({
            model: options?.model || 'llama-3.3-70b-versatile',
            messages: messages,
            max_tokens: options?.maxTokens || 1000,
            temperature: options?.temperature ?? 0.7
        });

        const reqOpts = {
            hostname: 'api.groq.com',
            path: '/openai/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const req = https.request(reqOpts, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
                        return reject(new Error(json.error?.message || `Groq API error (${res.statusCode})`));
                    }
                    const content = json.choices?.[0]?.message?.content;
                    if (content === undefined || content === null) {
                        return reject(new Error('No content in Groq response'));
                    }
                    resolve({ content });
                } catch (e) {
                    reject(new Error('Failed to parse Groq response: ' + (e.message || data?.slice(0,200))));
                }
            });
        });

        req.on('error', reject);
        req.write(payload);
        req.end();
    });
}

// ==================== API ROUTES ====================

const routes = {

    // POST /api/groq — proxy to Groq API (uses .env key unless clientKey provided)
    async 'POST /api/groq'(req, res) {
        try {
            const body = await parseBody(req);
            const result = await proxyGroq(body);
            sendJSON(res, result);
        } catch (e) {
            sendError(res, e.message, 500);
        }
    },

    // POST /api/groq/soil — fetch soil data via AI
    async 'POST /api/groq/soil'(req, res) {
        try {
            const body = await parseBody(req);
            const prompt = `Based on the location "${body.location}" at lat=${body.lat}, lng=${body.lng}, what is the most likely soil type for drainage engineering purposes? Respond with exactly one of: Clay, Sandy Clay, Silty Clay, Clay Loam, Loam, Silt Loam, Sandy Loam, Sand, Loamy Sand, Silt, Peat. Also provide estimated percentages of clay, sand, and silt that sum to 100. Format: SOIL: <type> | CLAY: <num>% | SAND: <num>% | SILT: <num>%`;
            const result = await proxyGroq({
                messages: [{ role: 'user', content: prompt }],
                options: { maxTokens: 150, temperature: 0.1 },
                clientKey: body.clientKey
            });
            sendJSON(res, { raw: result.content });
        } catch (e) {
            sendError(res, e.message, 500);
        }
    },

    // POST /api/groq/chat — chatbot proxy
    async 'POST /api/groq/chat'(req, res) {
        try {
            const body = await parseBody(req);
            const result = await proxyGroq(body);
            sendJSON(res, result);
        } catch (e) {
            sendError(res, e.message, 500);
        }
    },

    // POST /api/calculate — server-side hydraulic calculation
    async 'POST /api/calculate'(req, res) {
        const body = await parseBody(req);
        const { area, rainfall, slope, manning, pipeDia, C } = body;
        if (!area || !rainfall || slope === undefined) {
            return sendError(res, 'Missing required fields: area, rainfall, slope');
        }
        const n = manning || 0.013;
        const diam = pipeDia || 225;
        const runoffC = C || 0.8;
        const intensity = rainfall;
        const Q = runoffC * intensity * area / (1000 * 3600);
        const area_m2 = Math.PI * (diam / 2000) ** 2;
        const R = (diam / 2000) / 4;
        const S = slope / 100;
        const V = (1 / n) * Math.pow(R, 2 / 3) * Math.sqrt(S);
        const Qfull = area_m2 * V;
        const Vfull = V;
        const capacityUse = Q / (Qfull || 0.0001);
        const Re = (Vfull * (diam / 1000)) / 1.004e-6;
        const Fr = Vfull / Math.sqrt(9.81 * R * 4);
        sendJSON(res, {
            Q: parseFloat(Q.toFixed(6)),
            V: parseFloat(Vfull.toFixed(3)),
            pipeDia: diam,
            capacityUse: parseFloat(capacityUse.toFixed(4)),
            Re: Math.round(Re),
            Fr: parseFloat(Fr.toFixed(3)),
            Qfull: parseFloat(Qfull.toFixed(6)),
            Vfull: parseFloat(Vfull.toFixed(3)),
            intensity: parseFloat(intensity.toFixed(1))
        });
    },

    // POST /api/report — generate engineering report HTML
    async 'POST /api/report'(req, res) {
        const data = await parseBody(req);
        const { location, Q, V, pipeDia, material, slope, soil, Fr, capacityUse } = data;
        const frStatus = Fr < 1 ? 'Sub-critical (Stable)' : Fr > 1 ? 'Super-critical (Scour Risk)' : 'Critical';
        const velStatus = V > 3 ? 'HIGH — Erosion risk' : V > 1.5 ? 'Moderate' : 'Low';
        const capStatus = capacityUse > 0.9 ? 'Near surcharge — consider upsizing' : capacityUse > 0.7 ? 'Adequate' : 'Over-designed';
        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>DrainFlow Pro — Engineering Report</title>
<style>body{font-family:'Segoe UI',sans-serif;max-width:900px;margin:40px auto;padding:0 20px;color:#1a1a2e;line-height:1.6}
h1{color:#0a9396;border-bottom:3px solid #0a9396;padding-bottom:8px}h2{color:#005f73;margin-top:30px}
table{width:100%;border-collapse:collapse;margin:16px 0}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#0a9396;color:#fff}
.high{color:#d62828;font-weight:700}.ok{color:#2a9d8f;font-weight:700}.warn{color:#e9c46a;font-weight:700}
.footer{margin-top:40px;font-size:0.85rem;color:#666;border-top:1px solid #ddd;padding-top:16px}
@media print{body{margin:20px}table{page-break-inside:avoid}}</style></head><body>
<h1>DrainFlow Pro — Engineering Analysis Report</h1>
<p><strong>Project:</strong> ${location || 'Unnamed Location'} | <strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
<h2>Hydraulic Design Summary</h2>
<table><tr><th>Parameter</th><th>Value</th><th>Status</th></tr>
<tr><td>Design Flow (Q)</td><td>${(Q || 0).toFixed(4)} m³/s</td><td>—</td></tr>
<tr><td>Flow Velocity (V)</td><td>${(V || 0).toFixed(2)} m/s</td><td class="${V > 3 ? 'high' : V > 1.5 ? 'warn' : 'ok'}">${velStatus}</td></tr>
<tr><td>Pipe Diameter</td><td>${pipeDia || '—'} mm</td><td>—</td></tr>
<tr><td>Material</td><td>${material || '—'}</td><td>—</td></tr>
<tr><td>Design Slope</td><td>${slope || '—'}%</td><td>—</td></tr>
<tr><td>Soil Type</td><td>${soil || '—'}</td><td>—</td></tr>
<tr><td>Froude Number</td><td>${(Fr || 0).toFixed(2)}</td><td class="${Fr > 1 ? 'high' : Fr > 0.7 ? 'warn' : 'ok'}">${frStatus}</td></tr>
<tr><td>Capacity Utilization</td><td>${((capacityUse || 0) * 100).toFixed(1)}%</td><td class="${capacityUse > 0.9 ? 'warn' : 'ok'}">${capStatus}</td></tr>
</table>
<h2>Material Recommendations</h2>
<p><strong>Selected Material:</strong> ${material || 'Not specified'}</p>
<ul><li><strong>PVC (n=0.009):</strong> Lowest friction, best value, max V=3.0 m/s</li>
<li><strong>HDPE (n=0.011):</strong> Flexible, good for unstable soil, max V=3.5 m/s</li>
<li><strong>Concrete/RCP (n=0.013):</strong> Durable, high strength, max V=6.0 m/s</li>
<li><strong>Ductile Iron (n=0.012):</strong> High strength, abrasion resistant, max V=5.0 m/s</li></ul>
<h2>Construction Notes</h2>
<p><strong>Soil Conditions:</strong> ${soil || 'Unknown'} — adjust trench shoring and bedding accordingly.</p>
<p><strong>Bedding:</strong> 150mm min granular Class I material for all pipe types.</p>
<p><strong>Backfill:</strong> 300mm lifts, compact to 95% Standard Proctor density.</p>
<p><strong>Testing:</strong> Hydrostatic test at 1.5× design pressure for 30 minutes.</p>
<h2>Quality Control Hold Points</h2>
<ol><li>Trench excavation — verify depth and width before bedding</li>
<li>Bedding placement — confirm grade and compaction</li>
<li>Pipe jointing — inspect gasket seating and alignment</li>
<li>Backfill compaction — test density every 50m</li>
<li>Final CCTV inspection — record full pipeline condition</li></ol>
<div class="footer"><p>Generated by DrainFlow Pro Engineering System | This report is for design guidance only and should be reviewed by a licensed professional engineer.</p></div>
</body></html>`;
        res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Disposition': 'attachment; filename="drainflow-report.html"' });
        res.end(html);
    },

    // POST /api/save — save project
    async 'POST /api/save'(req, res) {
        const data = await parseBody(req);
        if (!data.id) data.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const filePath = path.join(DATA_DIR, `${data.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        sendJSON(res, { id: data.id, saved: true });
    },

    // GET /api/load/:id — load project
    async 'GET /api/load'(req, res, id) {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return sendError(res, 'Project not found', 404);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        sendJSON(res, data);
    },

    // GET /api/projects — list all projects
    async 'GET /api/projects'(req, res) {
        const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
        const projects = files.map(f => {
            try {
                const d = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf-8'));
                return { id: d.id, name: d.name || 'Unnamed', date: d.date || null };
            } catch { return null; }
        }).filter(Boolean);
        sendJSON(res, { projects });
    },

    // DELETE /api/delete/:id
    async 'DELETE /api/delete'(req, res, id) {
        const filePath = path.join(DATA_DIR, `${id}.json`);
        if (!fs.existsSync(filePath)) return sendError(res, 'Not found', 404);
        fs.unlinkSync(filePath);
        sendJSON(res, { deleted: true });
    }
};

// ==================== SERVER ====================
const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const method = req.method;

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    // API routing
    for (const [key, handler] of Object.entries(routes)) {
        const [m, route] = key.split(' ');
        if (method !== m) continue;
        const match = pathname.match(new RegExp('^' + route.replace(/:\w+/g, '([^/]+)') + '$'));
        if (match) {
            const param = match[1];
            try { await handler(req, res, param); }
            catch (e) { console.error('API error:', e); sendError(res, 'Internal server error', 500); }
            return;
        }
    }

    // Static file serving
    let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
    const ext = path.extname(filePath);

    // SPA fallback — serve index.html for unknown routes
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        filePath = path.join(__dirname, 'index.html');
    }

    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`DrainFlow Pro Server running at http://localhost:${PORT}/`);
    console.log(`  API: http://localhost:${PORT}/api/`);
    console.log(`  Data: ${DATA_DIR}`);
    console.log(`  Groq API key: ${GROQ_API_KEY ? 'loaded from .env' : 'NOT SET — add GROQ_API_KEY to .env'}`);
});
