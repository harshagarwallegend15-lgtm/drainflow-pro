// ========================================
// Drainage Frame Animation — Hero Background
// Cinematic frame player with Ken Burns zoom,
// slow crossfade, and film-grain overlay.
// ========================================

(function () {
    const FRAME_URLS = [
        'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/2101187/pexels-photo-2101187.jpeg?auto=compress&cs=tinysrgb&w=1280',
        'https://images.pexels.com/photos/3826905/pexels-photo-3826905.jpeg?auto=compress&cs=tinysrgb&w=1280',
    ];

    // Each frame stays visible for 3.8s, then crossfades over 1.4s
    const HOLD_MS      = 3800;
    const CROSSFADE_MS = 1400;

    // Ken Burns: each frame gets a slow zoom/pan direction
    const KB_PRESETS = [
        { startScale: 1.08, endScale: 1.18, startX: 0,     startY: 0,     endX: -0.02, endY: -0.01 },
        { startScale: 1.12, endScale: 1.04, startX: -0.02, startY: 0.01,  endX: 0.01,  endY: -0.01 },
        { startScale: 1.06, endScale: 1.15, startX: 0.01,  startY: -0.01, endX: -0.01, endY: 0.02  },
        { startScale: 1.14, endScale: 1.06, startX: -0.01, startY: 0,     endX: 0.02,  endY: 0.01  },
        { startScale: 1.08, endScale: 1.16, startX: 0,     startY: 0.01,  endX: -0.02, endY: -0.01 },
        { startScale: 1.10, endScale: 1.04, startX: 0.02,  startY: -0.01, endX: -0.01, endY: 0     },
        { startScale: 1.06, endScale: 1.14, startX: -0.01, startY: 0.01,  endX: 0.01,  endY: -0.02 },
        { startScale: 1.12, endScale: 1.06, startX: 0.01,  startY: -0.01, endX: -0.01, endY: 0.01  },
    ];

    let canvas, ctx, w, h;
    let images = [];
    let currentIdx = 0;
    let phaseStart  = 0;   // when current HOLD phase began
    let phase = 'hold';    // 'hold' | 'fade'
    let animating = false;

    // Easing
    function easeInOutCubic(t) {
        return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2;
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

    // Draw a single image with Ken Burns transform applied at progress t (0→1)
    function drawKenBurns(img, kbIdx, t, alpha) {
        if (!img || !img.complete || img.naturalWidth === 0) return;

        const kb = KB_PRESETS[kbIdx % KB_PRESETS.length];
        const te = easeInOutSine(t);

        const scale  = kb.startScale + (kb.endScale  - kb.startScale)  * te;
        const offX   = kb.startX     + (kb.endX      - kb.startX)      * te;
        const offY   = kb.startY     + (kb.endY      - kb.startY)      * te;

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
        // Cinematic dark gradient — top and bottom bars fade to near-black
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0,    'rgba(10,14,26,0.80)');
        grad.addColorStop(0.25, 'rgba(10,14,26,0.45)');
        grad.addColorStop(0.55, 'rgba(10,14,26,0.38)');
        grad.addColorStop(0.80, 'rgba(10,14,26,0.55)');
        grad.addColorStop(1,    'rgba(10,14,26,0.88)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Left-side gradient for hero text legibility
        const sideGrad = ctx.createLinearGradient(0, 0, w * 0.55, 0);
        sideGrad.addColorStop(0,   'rgba(10,14,26,0.72)');
        sideGrad.addColorStop(0.6, 'rgba(10,14,26,0.10)');
        sideGrad.addColorStop(1,   'rgba(10,14,26,0)');
        ctx.fillStyle = sideGrad;
        ctx.fillRect(0, 0, w, h);

        // Teal brand tint
        ctx.fillStyle = 'rgba(0,245,212,0.055)';
        ctx.fillRect(0, 0, w, h);

        // Vignette
        const vig = ctx.createRadialGradient(w*0.5, h*0.5, h*0.2, w*0.5, h*0.5, h*0.82);
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, 'rgba(0,0,0,0.5)');
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, w, h);

        // Subtle film-grain via animated noise pattern
        const t = now * 0.001;
        ctx.save();
        ctx.globalAlpha = 0.028 + 0.012 * Math.sin(t * 7.3);
        // Draw sparse noise dots — cheap approximation
        const step = 4;
        for (let y = 0; y < h; y += step) {
            for (let x = 0; x < w; x += step) {
                // Use a fast pseudo-random based on position + time
                const rnd = Math.abs(Math.sin(x * 127.1 + y * 311.7 + t * 374.0));
                if (rnd > 0.62) {
                    const bright = rnd > 0.80 ? 255 : 0;
                    ctx.fillStyle = `rgba(${bright},${bright},${bright},0.6)`;
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
        ctx.restore();

        // Thin horizontal scan lines
        ctx.save();
        ctx.globalAlpha = 0.035;
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
            // Draw current image with Ken Burns — t goes from 0 to 1 over HOLD+CROSSFADE total
            const kbT = elapsed / (HOLD_MS + CROSSFADE_MS);
            drawKenBurns(images[currentIdx], currentIdx, Math.min(kbT, 1), 1);

            if (elapsed >= HOLD_MS) {
                phase = 'fade';
                phaseStart = now;
            }
        } else {
            // Crossfade phase
            const fadeT = Math.min(elapsed / CROSSFADE_MS, 1);
            const eased = easeInOutCubic(fadeT);

            const nextIdx = (currentIdx + 1) % images.length;

            // Current image — still doing Ken Burns from hold start
            const kbTCurrent = 1; // end of its travel
            drawKenBurns(images[currentIdx], currentIdx, kbTCurrent, 1 - eased);

            // Next image — Ken Burns starts fresh
            const kbTNext = (elapsed / (HOLD_MS + CROSSFADE_MS)) * 0.15; // starts slightly zoomed in
            drawKenBurns(images[nextIdx], nextIdx, kbTNext, eased);

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
