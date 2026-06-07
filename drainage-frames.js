// ========================================
// Drainage Frame Animation — Hero Background
// Cycles real drainage/construction imagery
// like a video player behind the hero UI.
// ========================================

(function () {
    // Real-world drainage & road construction imagery from Pexels
    // These depict: stormwater channels, pipe installation, water flow,
    // culverts, road drainage, flooding, construction trenches — matching
    // the content of the user's original drainage GIF frames.
    const FRAME_URLS = [
        'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=1280',  // road flooding
        'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=1280',  // construction excavation
        'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=1280',  // drainage pipe laying
        'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1280',  // water stream/channel
        'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=1280',  // road construction
        'https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=1280',  // flooding water
        'https://images.pexels.com/photos/2101187/pexels-photo-2101187.jpeg?auto=compress&cs=tinysrgb&w=1280',  // concrete drainage channel
        'https://images.pexels.com/photos/3826905/pexels-photo-3826905.jpeg?auto=compress&cs=tinysrgb&w=1280',  // construction site
        'https://images.pexels.com/photos/1078884/pexels-photo-1078884.jpeg?auto=compress&cs=tinysrgb&w=1280',  // road flooding (loop)
        'https://images.pexels.com/photos/1108101/pexels-photo-1108101.jpeg?auto=compress&cs=tinysrgb&w=1280',  // excavation (loop)
        'https://images.pexels.com/photos/3862130/pexels-photo-3862130.jpeg?auto=compress&cs=tinysrgb&w=1280',  // drainage pipe (loop)
        'https://images.pexels.com/photos/1216589/pexels-photo-1216589.jpeg?auto=compress&cs=tinysrgb&w=1280',  // water flow (loop)
        'https://images.pexels.com/photos/1108572/pexels-photo-1108572.jpeg?auto=compress&cs=tinysrgb&w=1280',  // road (loop)
        'https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=1280',  // water (loop)
        'https://images.pexels.com/photos/2101187/pexels-photo-2101187.jpeg?auto=compress&cs=tinysrgb&w=1280',  // channel (loop)
        'https://images.pexels.com/photos/3826905/pexels-photo-3826905.jpeg?auto=compress&cs=tinysrgb&w=1280',  // site (loop)
    ];

    const FRAME_DURATION_MS = 280;   // ~3.5 fps — cinematic / GIF-like speed
    const CROSSFADE_MS      = 180;   // crossfade between frames

    let canvas, ctx;
    let images = [];
    let loadedCount = 0;
    let currentFrame = 0;
    let lastSwitch = 0;
    let fadeAlpha = 1;
    let fading = false;
    let fadeStart = 0;
    let w, h;

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
        // Load all unique URLs (first 8 unique frames)
        const unique = FRAME_URLS.slice(0, 8);
        const imgCache = {};
        let loaded = 0;

        unique.forEach((url, i) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                loaded++;
                if (loaded === unique.length) {
                    // Build full 16-frame array by reusing the 8 images
                    images = FRAME_URLS.map((url, idx) => imgCache[url]);
                    startAnimation();
                }
            };
            img.onerror = () => {
                loaded++;
                // Still proceed even if some images fail
                if (loaded === unique.length) {
                    images = FRAME_URLS.map(url => imgCache[url]);
                    startAnimation();
                }
            };
            imgCache[url] = img;
            img.src = url;
        });
    }

    function drawFrame(img, alpha) {
        if (!img || !img.complete || img.naturalWidth === 0) return;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Cover-fit the image (like CSS background-size: cover)
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.max(w / iw, h / ih);
        const sw = iw * scale, sh = ih * scale;
        const sx = (w - sw) / 2, sy = (h - sh) / 2;

        ctx.drawImage(img, sx, sy, sw, sh);
        ctx.restore();
    }

    function drawOverlays() {
        // Dark cinematic overlay — keeps text readable
        const grad = ctx.createLinearGradient(0, 0, 0, h);
        grad.addColorStop(0,   'rgba(10,14,26,0.72)');
        grad.addColorStop(0.4, 'rgba(10,14,26,0.55)');
        grad.addColorStop(0.7, 'rgba(10,14,26,0.62)');
        grad.addColorStop(1,   'rgba(10,14,26,0.85)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);

        // Teal colour-grade tint — ties footage to brand palette
        ctx.fillStyle = 'rgba(0,245,212,0.07)';
        ctx.fillRect(0, 0, w, h);

        // Vignette edges
        const vignette = ctx.createRadialGradient(w*0.5, h*0.5, h*0.25, w*0.5, h*0.5, h*0.85);
        vignette.addColorStop(0, 'rgba(0,0,0,0)');
        vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
        ctx.fillStyle = vignette;
        ctx.fillRect(0, 0, w, h);

        // Subtle horizontal scan lines (CRT-film feel)
        ctx.save();
        ctx.globalAlpha = 0.04;
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

        const elapsed = now - lastSwitch;

        // Determine crossfade state
        if (!fading && elapsed >= FRAME_DURATION_MS) {
            // Start transition to next frame
            fading = true;
            fadeStart = now;
        }

        if (fading) {
            const fadeElapsed = now - fadeStart;
            if (fadeElapsed >= CROSSFADE_MS) {
                // Transition complete — commit to next frame
                currentFrame = (currentFrame + 1) % images.length;
                fading = false;
                lastSwitch = now;
                fadeAlpha = 1;
            } else {
                const t = fadeElapsed / CROSSFADE_MS;
                const nextFrame = (currentFrame + 1) % images.length;
                // Draw current frame fading out
                drawFrame(images[currentFrame], 1 - t * 0.6);
                // Draw next frame fading in
                drawFrame(images[nextFrame], t);
                drawOverlays();
                return;
            }
        }

        drawFrame(images[currentFrame], 1);
        drawOverlays();
    }

    function startAnimation() {
        lastSwitch = performance.now();
        requestAnimationFrame(render);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
