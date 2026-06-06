// ========================================
// Particle System — Vivid Ambient Background
// ========================================

(function() {
    const canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let particles = [];
    let w, h;
    const PARTICLE_COUNT = 110;
    const CONNECTION_DIST = 160;
    const MOUSE_RADIUS = 220;
    let mouseX = -1000, mouseY = -1000;

    // Color palette — teal, purple, blue
    const COLORS = [
        'rgba(0,245,212,',
        'rgba(123,97,255,',
        'rgba(59,130,246,',
        'rgba(0,245,212,',   // double weight teal
    ];

    function resize() {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    function createParticles() {
        particles = [];
        for (let i = 0; i < PARTICLE_COUNT; i++) {
            particles.push({
                x: Math.random() * w,
                y: Math.random() * h,
                vx: (Math.random() - 0.5) * 0.55,
                vy: (Math.random() - 0.5) * 0.55,
                r: Math.random() * 2.2 + 0.8,
                color: COLORS[Math.floor(Math.random() * COLORS.length)],
                baseOpacity: Math.random() * 0.55 + 0.25,
                phase: Math.random() * Math.PI * 2,   // for twinkle
            });
        }
    }

    function update() {
        const t = performance.now() * 0.001;
        for (let p of particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Mouse repulsion
            const dx = p.x - mouseX;
            const dy = p.y - mouseY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < MOUSE_RADIUS) {
                const force = (MOUSE_RADIUS - dist) / MOUSE_RADIUS * 0.025;
                p.vx += dx * force;
                p.vy += dy * force;
            }

            // Gentle dampen
            p.vx *= 0.992;
            p.vy *= 0.992;

            // Wrap around
            if (p.x < 0) p.x = w;
            if (p.x > w) p.x = 0;
            if (p.y < 0) p.y = h;
            if (p.y > h) p.y = 0;

            // Twinkle: oscillate opacity slightly
            p.currentOpacity = p.baseOpacity * (0.7 + 0.3 * Math.sin(t * 1.5 + p.phase));
        }
    }

    function draw() {
        ctx.clearRect(0, 0, w, h);

        // Draw connections
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < CONNECTION_DIST) {
                    const opacity = (1 - dist / CONNECTION_DIST) * 0.22;
                    ctx.beginPath();
                    ctx.moveTo(particles[i].x, particles[i].y);
                    ctx.lineTo(particles[j].x, particles[j].y);
                    ctx.strokeStyle = `rgba(0,245,212,${opacity})`;
                    ctx.lineWidth = 0.7;
                    ctx.stroke();
                }
            }
        }

        // Draw particles with glow
        for (let p of particles) {
            const op = p.currentOpacity || p.baseOpacity;

            // Outer glow halo
            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 5);
            grad.addColorStop(0, p.color + (op * 0.5) + ')');
            grad.addColorStop(1, p.color + '0)');
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r * 5, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            // Core dot
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = p.color + op + ')';
            ctx.fill();
        }
    }

    function animate() {
        update();
        draw();
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);

    document.addEventListener('mousemove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
    });

    resize();
    createParticles();
    animate();
})();
