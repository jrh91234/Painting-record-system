/* Readable text colors.
   Much of the app's text gets hard-coded neon colors (inline styles and
   HTML built in JS) that were picked for the old dark theme. This pass looks
   at each text element against the surface behind it and, only where needed:
   - tones down glaring, over-saturated colors, and
   - darkens (light theme) or lightens (dark theme) the color until it reaches
     WCAG AA contrast (4.5:1).
   Hue is kept, so red still means bad and green still means good. Text on
   colored chips/buttons and on gradients is left alone. */
(function () {
    // A hair above 4.5 so rounding to whole RGB values never lands below AA.
    const TARGET_CONTRAST = 4.6;
    const MARK = 'kzColor';             // data-kz-color = the color we set
    const SOURCE = 'kzColorSource';     // data-kz-color-source = color before the fix
    const PAGE_LAYERS = 'html, body, .app-container, .main-wrapper, .auth-shell';
    const SKIP = 'svg, canvas, script, style, .kpi-icon-box, .page-tab-dot, .spray-cursor-canvas';

    function parse(value) {
        const match = value && value.match(/rgba?\(([^)]+)\)/);
        if (match) {
            const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
            return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] === undefined ? 1 : parts[3] };
        }
        const hex = value && value.trim().match(/^#([0-9a-f]{6})$/i);
        if (hex) {
            const n = parseInt(hex[1], 16);
            return { r: n >> 16, g: (n >> 8) & 255, b: n & 255, a: 1 };
        }
        return null;
    }

    function blend(top, bottom) {
        const a = top.a;
        return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 };
    }

    function luminance(c) {
        const channel = x => {
            x /= 255;
            return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
        };
        return 0.2126 * channel(c.r) + 0.7152 * channel(c.g) + 0.0722 * channel(c.b);
    }

    function contrast(a, b) {
        const la = luminance(a), lb = luminance(b);
        return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
    }

    function chroma(c) {
        return Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b);
    }

    function toHsl({ r, g, b }) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        const l = (max + min) / 2;
        if (max === min) return { h: 0, s: 0, l };
        const d = max - min;
        const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        let h;
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        return { h: h / 6, s, l };
    }

    function fromHsl({ h, s, l }) {
        if (s === 0) return { r: l * 255, g: l * 255, b: l * 255, a: 1 };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const hue = t => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        return { r: hue(h + 1 / 3) * 255, g: hue(h) * 255, b: hue(h - 1 / 3) * 255, a: 1 };
    }

    function css(c) {
        return `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;
    }

    let pageBackground = { r: 220, g: 220, b: 247, a: 1 };

    function averageOver(stops, baseColor) {
        const sum = stops.reduce((acc, c) => ({ r: acc.r + c.r, g: acc.g + c.g, b: acc.b + c.b, a: acc.a + c.a }), { r: 0, g: 0, b: 0, a: 0 });
        const n = stops.length;
        const avg = { r: sum.r / n, g: sum.g / n, b: sum.b / n, a: sum.a / n };
        return baseColor && baseColor.a > 0 && avg.a < 1 ? { ...blend(avg, { ...baseColor, a: 1 }), a: Math.max(avg.a, baseColor.a) } : avg;
    }

    // The solid color behind an element, or null when it sits on a gradient
    // or image we cannot measure.
    function backgroundOf(element, cache) {
        if (cache.has(element)) return cache.get(element);
        let result;
        if (!element || element.matches(PAGE_LAYERS)) {
            result = pageBackground;
        } else {
            const style = getComputedStyle(element);
            const image = style.backgroundImage;
            let own = parse(style.backgroundColor);
            if (image && image !== 'none') {
                // A plain color gradient reads as roughly its average color;
                // images (url) cannot be measured.
                const stops = /url\(/.test(image) ? [] : (image.match(/rgba?\([^)]+\)/g) || []).map(parse);
                own = stops.length ? averageOver(stops, own) : null;
                if (!own) {
                    cache.set(element, null);
                    return null;
                }
            }
            if (own && own.a >= 0.98) {
                result = own;
            } else {
                const below = backgroundOf(element.parentElement, cache);
                result = below && own && own.a > 0 ? blend(own, below) : below;
            }
        }
        cache.set(element, result);
        return result;
    }

    function fixColor(color, background, isDark) {
        const fg = color.a < 1 ? blend(color, background) : color;
        const hsl = toHsl(fg);
        let changed = false;

        // Tone down neon: cap saturation on clearly colored text.
        const maxSaturation = isDark ? 0.68 : 0.72;
        if (chroma(fg) > 90 && hsl.s > maxSaturation) {
            hsl.s = maxSaturation;
            changed = true;
        }
        // On dark surfaces very light colored text also glows; keep it calmer.
        if (isDark && chroma(fg) > 90 && hsl.l > 0.78) {
            hsl.l = 0.78;
            changed = true;
        }

        let candidate = fromHsl(hsl);
        if (contrast(candidate, background) < TARGET_CONTRAST) {
            // Move lightness away from the background until it is readable.
            let lo = isDark ? hsl.l : 0;
            let hi = isDark ? 1 : hsl.l;
            for (let i = 0; i < 14; i++) {
                const mid = (lo + hi) / 2;
                const ok = contrast(fromHsl({ h: hsl.h, s: hsl.s, l: mid }), background) >= TARGET_CONTRAST;
                if (isDark) {
                    if (ok) hi = mid; else lo = mid;
                } else if (ok) {
                    lo = mid;
                } else {
                    hi = mid;
                }
            }
            hsl.l = isDark ? hi : lo;
            candidate = fromHsl(hsl);
            changed = true;
        }
        return changed ? css(candidate) : null;
    }

    function hasOwnText(element) {
        for (const node of element.childNodes) {
            if (node.nodeType === 3 && node.textContent.trim()) return true;
        }
        return false;
    }

    // Undo our fix when the app has since set its own color on the element.
    function ownFixIsCurrent(element) {
        const ours = element.dataset[MARK];
        if (!ours) return false;
        const style = element.style;
        if (style.getPropertyValue('color') === ours && style.getPropertyPriority('color') === 'important') return true;
        delete element.dataset[MARK];
        delete element.dataset[SOURCE];
        return false;
    }

    function restoreAll() {
        document.querySelectorAll('[data-kz-color]').forEach(element => {
            if (ownFixIsCurrent(element)) {
                const source = element.dataset[SOURCE] || '';
                const [value, priority] = source.split('|');
                if (value) element.style.setProperty('color', value, priority || '');
                else element.style.removeProperty('color');
            }
            delete element.dataset[MARK];
            delete element.dataset[SOURCE];
        });
    }

    // Check the given subtrees (the whole page when called with no roots).
    function run(roots) {
        const root = document.documentElement;
        const isDark = root.getAttribute('data-theme') === 'dark';
        const bgVar = getComputedStyle(root).getPropertyValue('--kz-bg');
        pageBackground = parse(bgVar) || pageBackground;

        const elements = new Set();
        (roots || [document.body]).forEach(node => {
            if (!node.isConnected) return;
            elements.add(node);
            node.querySelectorAll('*').forEach(child => elements.add(child));
        });

        const cache = new Map();
        const updates = [];
        elements.forEach(element => {
            if (!hasOwnText(element) || element.closest(SKIP)) return;
            if (ownFixIsCurrent(element)) return;
            const color = parse(getComputedStyle(element).color);
            const background = backgroundOf(element, cache);
            if (!color || !background || chroma(background) > 60) return;
            const fixed = fixColor(color, background, isDark);
            if (fixed) updates.push([element, fixed]);
        });

        // Write after reading so the browser recalculates styles only once.
        updates.forEach(([element, fixed]) => {
            element.dataset[SOURCE] = element.style.getPropertyValue('color') + '|' + element.style.getPropertyPriority('color');
            element.style.setProperty('color', fixed, 'important');
            element.dataset[MARK] = element.style.getPropertyValue('color');
        });
    }

    // Some pages animate text every few milliseconds, so mutations are
    // throttled (never postponed forever) and only changed subtrees are checked.
    let timer = 0;
    let fullPass = false;
    const pendingRoots = new Set();

    function flush() {
        timer = 0;
        observer.disconnect();
        const roots = fullPass ? null : Array.from(pendingRoots).filter(node =>
            !Array.from(pendingRoots).some(other => other !== node && other.contains(node)));
        fullPass = false;
        pendingRoots.clear();
        run(roots);
        observe();
    }

    function schedule(delay, full) {
        if (full) {
            fullPass = true;
            window.clearTimeout(timer);
            timer = 0;
        }
        if (!timer) timer = window.setTimeout(flush, delay);
    }

    const observer = new MutationObserver(records => {
        records.forEach(record => {
            const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
            if (target) pendingRoots.add(target);
        });
        schedule(150, false);
    });
    function observe() {
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    window.addEventListener('painting-theme-change', () => {
        restoreAll();
        // Wait for the theme's color transitions to finish before measuring.
        schedule(400, true);
    });

    function start() {
        observe();
        schedule(50, true);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
        start();
    }
}());
