/* Powder spray gun cursor.
   On mouse/pen devices the cursor becomes a spray gun, and pressing the button
   puffs powder out of the nozzle (held down = keeps spraying). Touch screens and
   users who prefer reduced motion keep the normal cursor. */
(function () {
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!finePointer.matches) return;

    document.documentElement.classList.add('spray-cursor');
    if (reducedMotion.matches) return;

    const COLORS = ['#ff8c42', '#ffcc4d', '#ff5d8f', '#2ec4b6', '#4d7cfe', '#8e6cff', '#3ddc97'];
    const MAX_PARTICLES = 600;
    const particles = [];
    let canvas = null;
    let ctx = null;
    let dpr = 1;
    let frame = 0;
    let spraying = false;
    let sprayColor = COLORS[0];
    let pointer = { x: 0, y: 0 };

    function ensureCanvas() {
        if (canvas) return;
        canvas = document.createElement('canvas');
        canvas.className = 'spray-cursor-canvas';
        canvas.setAttribute('aria-hidden', 'true');
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');
        resize();
        window.addEventListener('resize', resize);
    }

    function resize() {
        dpr = window.devicePixelRatio || 1;
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // The gun is tilted like an arrow pointer: the nozzle points up-left, so
    // powder leaves in a cone around 225 degrees.
    function emit(x, y, count, burst) {
        for (let i = 0; i < count && particles.length < MAX_PARTICLES; i++) {
            const angle = Math.PI * 1.25 + (Math.random() - 0.5) * (burst ? 0.9 : 0.6);
            const speed = (burst ? 2.5 : 3.2) + Math.random() * 4.5;
            particles.push({
                x: x - 1,
                y: y - 1,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                r: 0.8 + Math.random() * 2.2,
                life: 1,
                decay: 0.012 + Math.random() * 0.02,
                color: Math.random() < 0.8 ? sprayColor : COLORS[(Math.random() * COLORS.length) | 0]
            });
        }
    }

    function tick() {
        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
        if (spraying) emit(pointer.x, pointer.y, 7, false);

        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            // Powder slows quickly in air, drifts down a little and spreads out.
            p.vx *= 0.9;
            p.vy = p.vy * 0.9 + 0.03;
            p.r += 0.06;
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            ctx.globalAlpha = Math.max(0, p.life) * 0.85;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        frame = (particles.length || spraying) ? requestAnimationFrame(tick) : 0;
    }

    function start() {
        if (!frame) frame = requestAnimationFrame(tick);
    }

    function isTextField(target) {
        return target instanceof Element && target.closest('input, textarea, select, [contenteditable="true"]');
    }

    document.addEventListener('pointerdown', event => {
        if (event.pointerType === 'touch' || event.button !== 0 || isTextField(event.target)) return;
        ensureCanvas();
        pointer = { x: event.clientX, y: event.clientY };
        sprayColor = COLORS[(Math.random() * COLORS.length) | 0];
        spraying = true;
        emit(pointer.x, pointer.y, 40, true);
        start();
    }, { passive: true });

    document.addEventListener('pointermove', event => {
        pointer = { x: event.clientX, y: event.clientY };
    }, { passive: true });

    ['pointerup', 'pointercancel', 'blur'].forEach(type => {
        window.addEventListener(type, () => { spraying = false; }, { passive: true });
    });
}());
