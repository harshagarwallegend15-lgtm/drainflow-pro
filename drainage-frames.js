// ========================================
// Drainage Frame Animation — Hero Background
// Cinematic frame player with Ken Burns zoom,
// slow crossfade, and film-grain overlay.
// All images: road drainage, culverts, pipes,
// stormwater construction, flooding — on-topic
// with this drainage engineering platform.
// ========================================

(function () {
    // Verified Pexels photo IDs — road drainage, culvert, pipe laying,
    // stormwater, flooding, road construction, trench excavation topics.
    const FRAME_URLS = [
        // Concrete storm drain culvert — murky water flowing into tunnel
        'https://images.pexels.com/photos/18928152/pexels-photo-18928152.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Concrete pipes at a construction site during sunset
        'https://images.pexels.com/photos/12387207/pexels-photo-12387207.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Drainage pipe installation in trench — Elk Grove
        'https://images.pexels.com/photos/37627673/pexels-photo-37627673.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Rural drainage pipe pouring water into ravine
        'https://images.pexels.com/photos/15954727/pexels-photo-15954727.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Road construction — wide road with machinery
        'https://images.pexels.com/photos/2760243/pexels-photo-2760243.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Flooded road / stormwater on road surface
        'https://images.pexels.com/photos/1118869/pexels-photo-1118869.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Heavy excavator / construction trench digging
        'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=1280',
        // Water flowing through concrete channel / open drain
        'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=1280',
    ];

    // Each frame stays visible for 3.8s, then crossfades over 1.4s
    const HOLD_MS      = 3800;
    const CROSSFADE_MS = 1400;

    // Ken Burns: each frame gets a unique slow zoom/pan direction
    const KB_PRESETS = [
        { startScale: 1.08, endScale: 1.18, startX:  0,     startY:  0,     endX: -0.02, endY: -0.01 },
        { startScale: 1.12, endScale: 1.04, startX: -0.02,  startY:  0.01,  endX:  0.01, endY: -0.01 },
        { startScale: 1.06, endScale: 1.15, startX:  0.01,  startY: -0.01,  endX: -0.01, endY:  0.02 },
        { startScale: 1.14, endScale: 1.06, startX: -0.01,  startY:  0,     endX:  0.02, endY:  0.01 },
        { startScale: 1.08, endScale: 1.16, startX:  0,     startY:  0.01,  endX: -0.02, endY: -0.01 },
        { startScale: 1.10, endScale: 1.04, startX:  0.02,  startY: -0.01,  endX: -0.01, endY:  0     },
        { startScale: 1.06, endScale: 1.14, startX: -0.01,  startY:  0.01,  endX:  0.01, endY: -0.02 },
        { startScale: 1.12, endScale: 1.06, startX:  0.01,  startY: -0.01,  endX: -0.01, endY:  0.01 },
    ];

    let canvas, ctx, w, h;
    let images = [];
    let currentIdx = 0;
    let phaseStart  = 0;
    let phase = 'hold';
    let animating = false;

    function easeInOutCubic(t) {
        return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    }
    function easeInOutSine(t) {
        return -(Math.cos(Math.PI * t) - 1) / 2;
    }

    function init() {
        canvas = document.getElementById('drainageFrameCanvas');
        if (!canvas) return;
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
        preloadImages();
    }

    function resize() {
        if (!canvas) return;
        w = canvas.width  = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function preloadImages() {
        let loaded = 0;
        images = FRAME_URLS.map(url => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = img.onerror = () => {
                loaded++;
                if (loaded === FRAME_URLS.length && !animating) {
                    animating = true;
                    phaseStart = performance.now();
                    requestAnimationFrame(render);
                }
            };
            img.src = url;
            return img;
        });
    }

    function drawKenBurns(img, kbIdx, t, alpha) {
        if (!img || !img.complete || img.naturalWidth === 0) return;

        const kb  = KB_PRESETS[kbIdx % KB_PRESETS.length];
        const te  = easeInOutSine(Math.min(Math.max(t, 0), 1));

        const scale = kb.startScale + (kb.endScale - kb.startScale) * te;
        const offX  = kb.startX     + (kb.endX     - kb.startX)     * te;
        const offY  = kb.startY     + (kb.endY     - kb.startY)     * te;

        const iw = img.naturalWidth, ih = img.naturalHeight;
        const base = Math.max(w / iw, h / ih);
        const sw = iw * base * scale;
        const sh = ih * base * scale;
        const sx = (w - sw) / 2 + offX * w;
        const sy = (h - sh) / 2 + offY * h;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.restore();
    }

    function drawOverlays(now) {
        // Dark gradient — top heavy for navbar, bottom heavy for footer
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0,    'rgba(10,14,26,0.80)');
        grad.addColorStop(0.22, 'rgba(10,14,26,0.42)');
        grad.addColorStop(0.55, 'rgba(10,14,26,0.35)');
        grad.addColorStop(0.80, 'rgba(10,14,26,0.52)');
        grad.addColorStop(1,    'rgba(10,14,26,0.90)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Left panel fog — keeps hero text legible
        const leftGrad = ctx.createLinearGradient(0, 0, w * 0.58, 0);
        leftGrad.addColorStop(0,   'rgba(10,14,26,0.75)');
        leftGrad.addColorStop(0.5, 'rgba(10,14,26,0.20)');
        leftGrad.addColorStop(1,   'rgba(10,14,26,0)');
        ctx.fillStyle = leftGrad;
        ctx.fillRect(0, 0, w, h);

        // Teal brand colour-grade tint
        ctx.fillStyle = 'rgba(0,245,212,0.055)';
        ctx.fillRect(0, 0, w, h);

        // Edge vignette
        const vig = ctx.createRadialGradient(w*0.5, h*0.5, h*0.2, w*0.5, h*0.5, h*0.82);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.52)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Animated film-grain noise
        const t = now * 0.001;
        ctx.save();
        ctx.globalAlpha = 0.025 + 0.010 * Math.sin(t * 7.3);
        const step = 4;
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                const rnd = Math.abs(Math.sin(x * 127.1 + y * 311.7 + t * 374.0));
                if (rnd > 0.62) {
                    const bright = rnd > 0.80 ? 255 : 0;
                    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.55)`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        ctx.restore();

        // Subtle horizontal scan lines — CRT / film feel
        ctx.save();
        ctx.globalAlpha = 0.030;
        for (let y = 0; y < h; y += 4) {
            ctx.fillStyle = 'rgba(0,0,0,1)';
            ctx.fillRect(0, y, w, 2);
        }
        ctx.restore();
    }

    function render(now) {
        requestAnimationFrame(render);
        if (images.length === 0) return;

        ctx.clearRect(0, 0, w, h);
        const elapsed = now - phaseStart;

        if (phase === 'hold') {
            const kbT = elapsed / (HOLD_MS + CROSSFADE_MS);
            drawKenBurns(images[currentIdx], currentIdx, kbT, 1);

            if (elapsed >= HOLD_MS) {
                phase = 'fade';
                phaseStart = now;
            }
        } else {
            const fadeT  = Math.min(elapsed / CROSSFADE_MS, 1);
            const eased  = easeInOutCubic(fadeT);
            const nextIdx = (currentIdx + 1) % images.length;

            // Current frame finishing its Ken Burns travel
            drawKenBurns(images[currentIdx], currentIdx, 1, 1 - eased);

            // Next frame starting its Ken Burns from zero
            const kbNext = (elapsed / (HOLD_MS + CROSSFADE_MS)) * 0.12;
            drawKenBurns(images[nextIdx], nextIdx, kbNext, eased);

            if (fadeT >= 1) {
                currentIdx = nextIdx;
                phase = 'hold';
                phaseStart = now;
            }
        }

        drawOverlays(now);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
