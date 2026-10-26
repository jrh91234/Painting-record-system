/* Kurzgesagt-style chart colors.
   Every chart in the app picks its own hex/rgba colors, so instead of editing
   each one this global Chart.js plugin remaps them by hue onto one flat,
   saturated palette right before each update. Gray colors become the theme's
   muted ink, bars get rounded corners and line points get a "cut-out" ring. */
(function () {
    if (typeof Chart === 'undefined') return;

    // Each palette color's own hue falls inside its bucket, so remapping an
    // already-remapped color is a no-op.
    const HUE_BUCKETS = [
        { max: 15, rgb: [242, 92, 84] },    // red      #f25c54
        { max: 35, rgb: [255, 140, 66] },   // orange   #ff8c42
        { max: 65, rgb: [255, 204, 77] },   // yellow   #ffcc4d
        { max: 165, rgb: [61, 220, 151] },  // mint     #3ddc97
        { max: 185, rgb: [46, 196, 182] },  // teal     #2ec4b6
        { max: 205, rgb: [54, 197, 240] },  // sky      #36c5f0
        { max: 245, rgb: [77, 124, 254] },  // blue     #4d7cfe
        { max: 290, rgb: [142, 108, 255] }, // purple   #8e6cff
        { max: 345, rgb: [255, 93, 143] },  // pink     #ff5d8f
        { max: 361, rgb: [242, 92, 84] }    // red again
    ];

    const THEMES = {
        light: { text: '#5d5f86', title: '#45477a', axis: '#1a1a1a', grid: 'rgba(38, 42, 99, 0.08)', ink: [93, 95, 134], surface: '#f7f6fe', tooltip: '#24264f', tooltipText: '#f7f6fe' },
        dark: { text: '#a3a1d6', title: '#c9c8f0', grid: 'rgba(149, 147, 201, 0.14)', ink: [149, 147, 201], surface: '#23275c', tooltip: '#0e1030', tooltipText: '#f4f2ff' }
    };

    function currentTheme() {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? THEMES.dark : THEMES.light;
    }

    function parseColor(value) {
        if (typeof value !== 'string') return null;
        const color = value.trim();
        let match = color.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
        if (match) {
            let hex = match[1];
            if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
            return { r: parseInt(hex.slice(0, 2), 16), g: parseInt(hex.slice(2, 4), 16), b: parseInt(hex.slice(4, 6), 16), a: 1 };
        }
        match = color.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i);
        if (match) {
            return { r: +match[1], g: +match[2], b: +match[3], a: match[4] === undefined ? 1 : +match[4] };
        }
        return null;
    }

    function hueAndSaturation({ r, g, b }) {
        const rn = r / 255, gn = g / 255, bn = b / 255;
        const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn);
        const delta = max - min;
        const lightness = (max + min) / 2;
        if (delta === 0) return { hue: 0, saturation: 0 };
        const saturation = delta / (1 - Math.abs(2 * lightness - 1));
        let hue;
        if (max === rn) hue = 60 * (((gn - bn) / delta) % 6);
        else if (max === gn) hue = 60 * ((bn - rn) / delta + 2);
        else hue = 60 * ((rn - gn) / delta + 4);
        return { hue: (hue + 360) % 360, saturation };
    }

    function toRgba(rgb, alpha) {
        return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})`;
    }

    // Data colors: saturated hues snap to the palette, grays become muted ink.
    function remapColor(value, theme) {
        if (Array.isArray(value)) return value.map(item => remapColor(item, theme));
        const parsed = parseColor(value);
        if (!parsed) return value;
        const { hue, saturation } = hueAndSaturation(parsed);
        if (saturation < 0.25) return toRgba(theme.ink, parsed.a);
        const bucket = HUE_BUCKETS.find(entry => hue < entry.max);
        return toRgba(bucket.rgb, parsed.a);
    }

    // Axis text keeps any deliberately colored label, but grays follow the theme.
    function remapInk(value, theme, fallback) {
        if (typeof value === 'function') return value;
        const parsed = parseColor(value);
        if (!parsed) return fallback;
        return hueAndSaturation(parsed).saturation < 0.25 ? fallback : remapColor(value, theme);
    }

    const COLOR_KEYS = ['backgroundColor', 'borderColor', 'pointBackgroundColor', 'hoverBackgroundColor', 'hoverBorderColor', 'pointHoverBackgroundColor'];

    function styleDataset(dataset, chartType, theme) {
        // Datasets whose colors must match an HTML legend opt out of the remap.
        if (!dataset.kzKeepColors) COLOR_KEYS.forEach(key => {
            if (dataset[key] !== undefined) dataset[key] = remapColor(dataset[key], theme);
        });

        const type = dataset.type || chartType;
        if (type === 'bar') {
            if (!dataset.kzKeepBorder) dataset.borderWidth = 0;
            if (dataset.borderRadius === undefined) dataset.borderRadius = 5;
        } else if (type === 'line') {
            dataset.pointBorderColor = theme.surface;
            if (dataset.pointBorderWidth === undefined) dataset.pointBorderWidth = 2;
            if (dataset.borderWidth === undefined || dataset.borderWidth < 3) dataset.borderWidth = 3;
        } else if (type === 'doughnut' || type === 'pie') {
            // Flat slices separated by the card color, like cut paper.
            dataset.borderColor = theme.surface;
            dataset.borderWidth = 3;
        }
    }

    // In light mode axis text is plain black, even where a chart colored it
    // (yellow/red right-axis labels were hard to read on the light card).
    function axisInk(value, theme, fallback) {
        if (typeof value === 'function') return value;
        return theme.axis || remapInk(value, theme, fallback);
    }

    function styleScales(scales, theme) {
        if (!scales) return;
        Object.values(scales).forEach(scale => {
            if (!scale) return;
            if (scale.ticks) scale.ticks.color = axisInk(scale.ticks.color, theme, theme.text);
            if (scale.title) scale.title.color = axisInk(scale.title.color, theme, theme.title);
            if (scale.grid) scale.grid.color = theme.grid;
            if (scale.border) scale.border.display = false;
        });
    }

    const kurzgesagtChartPlugin = {
        id: 'kurzgesagtStyle',
        beforeUpdate(chart) {
            const theme = currentTheme();
            const chartType = chart.config.type;
            (chart.data.datasets || []).forEach(dataset => styleDataset(dataset, chartType, theme));

            const options = chart.options || {};
            styleScales(options.scales, theme);

            const plugins = options.plugins || {};
            if (plugins.legend && plugins.legend.labels) {
                plugins.legend.labels.color = remapInk(plugins.legend.labels.color, theme, theme.title);
                plugins.legend.labels.usePointStyle = true;
                plugins.legend.labels.pointStyle = 'circle';
            }
            if (plugins.tooltip) {
                plugins.tooltip.backgroundColor = theme.tooltip;
                plugins.tooltip.titleColor = theme.tooltipText;
                plugins.tooltip.bodyColor = theme.tooltipText;
                plugins.tooltip.borderWidth = 0;
                plugins.tooltip.cornerRadius = 12;
                plugins.tooltip.padding = 10;
            }
        }
    };

    Chart.register(kurzgesagtChartPlugin);
    Chart.defaults.font.family = "'Sarabun', 'Plus Jakarta Sans', sans-serif";
}());
