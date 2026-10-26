/* Line %Eff (ประสิทธิภาพไลน์พ่นสี).
   Every painted piece is converted to the line time it needs (standard time =
   3600 / (line speed × 60 / hanger pitch × pieces per hanger)), summed over all
   parts painted that day, and compared with the shift time available:
       %Eff = earned minutes ÷ available minutes
   Available time comes from the time slots in the LineTimeSlots sheet, read
   in sheet order as one timeline from the first slot (08.00) through
   midnight. Each run of Normal/Break slots starts a shift and the OT slots
   after it belong to that shift (day: 08-17 + OT 17-20, night: 20-05 + OT
   05-08). A shift counts only on days it has a production record; its
   normal time counts in full and its OT up to the last OT slot with a
   record. No one has to log stop times. */
(function () {
    const TARGET = 80;
    const FALLBACK_URL = 'data/line-capacity.json';
    const state = { config: null, rows: [], chart: null, prodChart: null, from: '', to: '', preset: '30d', expanded: new Set() };
    const CACHE_KEYS = [
        ['PAINTING_OUTPUTDIARY_CACHE_REVIEWED', 'NEW'],
        ['PAINTING_OUTPUTDIARY_CACHE_PENDING', 'NEW'],
        ['PAINTING_REWORK_CACHE_REVIEWED', 'REWORK'],
        ['PAINTING_REWORK_CACHE_PENDING', 'REWORK']
    ];

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // "NVE96528 Box" → "NVE96528"; part codes are the first token.
    function normalizeCode(value) {
        return String(value || '').trim().split(/\s+/)[0].toUpperCase();
    }

    // Records use d/m/yyyy (sometimes with time); also accept yyyy-mm-dd.
    function toDateKey(value) {
        const text = String(value || '').trim();
        let m = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
        m = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
        return '';
    }

    function formatDateKey(key) {
        const [y, mo, d] = key.split('-');
        return `${Number(d)}/${Number(mo)}/${y}`;
    }

    function slotStartMinutes(slot) {
        const m = String(slot || '').match(/(\d{1,2})[.:](\d{2})/);
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }

    function fmtMin(minutes) {
        const total = Math.round(minutes);
        const h = Math.floor(total / 60);
        const m = Math.abs(total % 60);
        return h ? `${h} ชม. ${m} น.` : `${m} น.`;
    }

    function fmtPct(value) {
        return Number.isFinite(value) ? value.toFixed(1) + '%' : '-';
    }

    function effClass(value) {
        if (!Number.isFinite(value)) return '';
        if (value >= TARGET) return 'is-good';
        if (value >= 60) return 'is-warn';
        return 'is-bad';
    }

    // The bundled copy loads instantly; the sheet version replaces it when the
    // Apps Script answers, so the page never waits on the network to draw.
    async function loadBundledConfig() {
        const response = await fetch(FALLBACK_URL, { cache: 'no-store' });
        const json = await response.json();
        return { capacity: json.capacity, slots: json.slots, source: 'fallback' };
    }

    async function loadSheetConfig() {
        const baseUrl = typeof getApiUrl === 'function' ? getApiUrl() : '';
        if (!baseUrl || typeof fetchAppsScriptJsonWithRetry !== 'function') return null;
        try {
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getLineCapacity';
            const json = await fetchAppsScriptJsonWithRetry(url, 'Load line capacity', { attempts: 1, timeoutMs: 15000 });
            if (json && json.status === 'success' && Array.isArray(json.capacity) && json.capacity.length) {
                return { capacity: json.capacity, slots: json.slots || [], source: 'sheet' };
            }
        } catch (error) {
            console.warn('Line capacity API unavailable, using bundled copy:', error);
        }
        return null;
    }

    // Pending and reviewed sheets can both hold a record, and some rows are
    // entered twice; count each (date, part, slot, qty, color) once.
    function dedupe(rows) {
        const seen = new Set();
        return rows.filter(row => {
            const key = [toDateKey(row.date), normalizeCode(row.model), String(row.timeSlot || '').replace(/\s+/g, ''), row.prodQty, row.color || ''].join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    function combine(tagged) {
        const byType = { NEW: [], REWORK: [] };
        tagged.forEach(row => byType[row.workType].push(row));
        return dedupe(byType.NEW).concat(dedupe(byType.REWORK));
    }

    // Production data the app already cached from earlier visits.
    function readCachedRows() {
        const tagged = [];
        CACHE_KEYS.forEach(([key, workType]) => {
            try {
                const rows = JSON.parse(localStorage.getItem(key) || '[]');
                if (Array.isArray(rows)) rows.forEach(row => tagged.push({ ...row, workType }));
            } catch (error) {
                // Ignore unreadable cache entries.
            }
        });
        return combine(tagged);
    }

    async function loadRows() {
        const sources = [];
        if (typeof fetchDailyReportDataFromAPI === 'function') {
            sources.push(fetchDailyReportDataFromAPI('', { scope: 'reviewed' }).then(rows => rows.map(r => ({ ...r, workType: 'NEW' }))));
            sources.push(fetchDailyReportDataFromAPI('', { scope: 'pending' }).then(rows => rows.map(r => ({ ...r, workType: 'NEW' }))));
        }
        if (typeof fetchReworkReportDataFromAPI === 'function') {
            sources.push(fetchReworkReportDataFromAPI('', { scope: 'reviewed' }).then(rows => rows.map(r => ({ ...r, workType: 'REWORK' }))));
            sources.push(fetchReworkReportDataFromAPI('', { scope: 'pending' }).then(rows => rows.map(r => ({ ...r, workType: 'REWORK' }))));
        }
        const results = await Promise.allSettled(sources);
        return combine(results.flatMap(result => (result.status === 'fulfilled' && Array.isArray(result.value)) ? result.value : []));
    }

    function slotEndMinutes(slot) {
        const m = String(slot || '').match(/-\s*(\d{1,2})[.:](\d{2})/);
        return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    }

    // Split the sheet's slots into shifts on one timeline that starts at the
    // first slot and wraps past midnight (so 00.00-08.00 sits after 23.00).
    function buildSlots(slots) {
        const parsed = slots
            .map(slot => ({ ...slot, start: slotStartMinutes(slot.timeSlot), end: slotEndMinutes(slot.timeSlot), isOT: String(slot.type).toUpperCase() === 'OT' }))
            .filter(slot => slot.start !== null);
        const base = parsed.length ? parsed[0].start : 0;
        const rel = minutes => ((minutes - base) % 1440 + 1440) % 1440;
        const shifts = [];
        let current = null;
        parsed.forEach(slot => {
            const relStart = rel(slot.start);
            const length = slot.end === null ? 60 : (((slot.end - slot.start) % 1440 + 1440) % 1440 || 60);
            const entry = { ...slot, relStart, relEnd: relStart + length, minutes: Number(slot.minutes) || 0 };
            if (!current || (!entry.isOT && current.lastWasOT)) {
                current = { index: shifts.length, normalMinutes: 0, ot: [], slots: [], lastWasOT: false };
                shifts.push(current);
            }
            entry.shift = current.index;
            if (entry.isOT) {
                entry.otIndex = current.ot.length;
                current.ot.push(entry);
            } else {
                current.normalMinutes += entry.minutes;
            }
            current.slots.push(entry);
            current.lastWasOT = entry.isOT;
        });
        const all = shifts.flatMap(shift => shift.slots);
        // A recorded slot such as "10.10 - 11.00" lands in the sheet slot whose
        // range holds its start time.
        const locate = timeSlot => {
            const start = slotStartMinutes(timeSlot);
            if (start === null || !all.length) return null;
            const r = rel(start);
            return all.find(slot => r >= slot.relStart && r < slot.relEnd)
                || all.filter(slot => slot.relStart <= r).pop()
                || all[0];
        };
        return { shifts, locate };
    }

    // Remember which shifts ran that day and the last OT slot used in each.
    // The form's Day/Night choice decides the shift when it is recorded; the
    // time slot only decides how far into OT it went. A Day record in a slot
    // that now belongs to the night shift (older data used 20.00-21.00 as day
    // OT) counts as day OT: all day OT slots plus that slot's own minutes.
    function markShiftTime(entry, slots, row) {
        const slot = slots.locate(row.timeSlot);
        const label = String(row.shift || '').trim().toLowerCase();
        const named = label === 'day' || label.includes('เช้า') ? 0
            : (label === 'night' || label.includes('ดึก')) && slots.shifts.length > 1 ? 1 : null;
        const shiftIndex = named !== null ? named : (slot ? slot.shift : 0);
        const shift = slots.shifts[shiftIndex];
        let lastOt = -1;
        if (slot && slot.shift === shiftIndex) {
            lastOt = slot.isOT ? slot.otIndex : -1;
        } else if (slot && shift && slot.shift > shiftIndex) {
            lastOt = shift.ot.length - 1;
            entry.extra.set(slot.timeSlot, slot.minutes);
        }
        entry.shifts.set(shiftIndex, Math.max(entry.shifts.has(shiftIndex) ? entry.shifts.get(shiftIndex) : -1, lastOt));
    }

    function compute() {
        // Match on the file's part number and on any code the app records for it.
        const capacity = new Map();
        state.config.capacity.forEach(item => {
            [item.partCode].concat(item.appCodes || []).forEach(code => {
                const key = normalizeCode(code);
                if (key && !capacity.has(key)) capacity.set(key, item);
            });
        });
        const slots = buildSlots(state.config.slots);
        const days = new Map();
        const unmatched = new Map();

        state.rows.forEach(row => {
            const day = toDateKey(row.date);
            if (!day || (state.from && day < state.from) || (state.to && day > state.to)) return;
            const qty = Number(row.prodQty) || 0;
            if (qty <= 0) return;
            const code = normalizeCode(row.model);
            const cap = capacity.get(code);
            if (!days.has(day)) days.set(day, { day, earned: 0, earnedGood: 0, earnedRework: 0, qty: 0, reworkQty: 0, defects: 0, shifts: new Map(), extra: new Map(), parts: new Map(), unmatchedQty: 0 });
            const entry = days.get(day);
            markShiftTime(entry, slots, row);

            if (!cap || !(cap.stdSec > 0)) {
                entry.unmatchedQty += qty;
                const miss = unmatched.get(code) || { code, raw: row.model, qty: 0, days: new Set() };
                miss.qty += qty;
                miss.days.add(day);
                unmatched.set(code, miss);
                return;
            }

            const defects = Math.min(qty, Number(row.totalDefect) || 0);
            const earned = qty * cap.stdSec / 60;
            entry.earned += earned;
            entry.earnedGood += (qty - defects) * cap.stdSec / 60;
            if (row.workType === 'REWORK') {
                entry.earnedRework += earned;
                entry.reworkQty += qty;
            }
            entry.qty += qty;
            entry.defects += defects;

            const partKey = code + '|' + row.workType;
            const part = entry.parts.get(partKey) || { code, name: cap.partName, workType: row.workType, qty: 0, defects: 0, stdSec: cap.stdSec, qtyPerJig: cap.qtyPerJig, earned: 0 };
            part.qty += qty;
            part.defects += defects;
            part.earned += earned;
            entry.parts.set(partKey, part);
        });

        days.forEach(entry => {
            let normalMinutes = 0;
            let otMinutes = 0;
            entry.shifts.forEach((lastOt, index) => {
                const shift = slots.shifts[index];
                if (!shift) return;
                normalMinutes += shift.normalMinutes;
                otMinutes += shift.ot.slice(0, lastOt + 1).reduce((sum, slot) => sum + slot.minutes, 0);
            });
            entry.extra.forEach(minutes => { otMinutes += minutes; });
            entry.available = normalMinutes + otMinutes;
            entry.otMinutes = otMinutes;
            entry.shiftCount = entry.shifts.size;
            entry.eff = entry.available ? entry.earned / entry.available * 100 : NaN;
            entry.effGood = entry.available ? entry.earnedGood / entry.available * 100 : NaN;
            entry.lost = Math.max(0, entry.available - entry.earned);
        });

        return { days: Array.from(days.values()).sort((a, b) => a.day.localeCompare(b.day)), unmatched: Array.from(unmatched.values()).sort((a, b) => b.qty - a.qty) };
    }

    function renderKpis(days) {
        const sum = key => days.reduce((total, day) => total + day[key], 0);
        const available = sum('available');
        const earned = sum('earned');
        const earnedGood = sum('earnedGood');
        const rework = sum('earnedRework');
        const eff = available ? earned / available * 100 : NaN;
        const effGood = available ? earnedGood / available * 100 : NaN;
        const set = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        set('lineEffAvg', `<span class="${effClass(eff)}">${fmtPct(eff)}</span>`);
        set('lineEffAvgSub', `เป้าหมาย ${TARGET}% · ${days.length} วันทำงาน`);
        set('lineEffGood', `<span class="${effClass(effGood)}">${fmtPct(effGood)}</span>`);
        set('lineEffGoodSub', 'หักของเสียออกแล้ว');
        set('lineEffEarned', fmtMin(earned));
        set('lineEffEarnedSub', `จากเวลาที่มี ${fmtMin(available)}`);
        set('lineEffLost', fmtMin(Math.max(0, available - earned)));
        set('lineEffLostSub', rework > 0 ? `ใช้ไปกับ REWORK ${fmtMin(rework)}` : 'ไลน์หยุด / ราวว่าง / แขวนไม่เต็ม');

        // Output counts every recorded piece, including parts without a
        // standard time yet (they are left out of %Eff only).
        const unmatched = sum('unmatchedQty');
        const total = sum('qty') + unmatched;
        const defects = sum('defects');
        const reworkQty = sum('reworkQty');
        const dayCount = days.length;
        const perDay = dayCount ? total / dayCount : NaN;
        const goodPerDay = dayCount ? (total - defects) / dayCount : NaN;
        const fmtQty = value => Number.isFinite(value) ? Math.round(value).toLocaleString() : '-';
        set('lineEffTotal', `${fmtQty(total)} <small>ชิ้น</small>`);
        set('lineEffTotalSub', `งานดี ${fmtQty(total - defects)} · NG ${fmtQty(defects)}`
            + (reworkQty ? ` · รวม REWORK ${fmtQty(reworkQty)}` : '')
            + (unmatched ? ` · ไม่มีค่ามาตรฐาน ${fmtQty(unmatched)}` : ''));
        set('lineEffPerDay', `${fmtQty(perDay)} <small>ชิ้น/วัน</small>`);
        set('lineEffPerDaySub', dayCount ? `งานดีเฉลี่ย ${fmtQty(goodPerDay)} ชิ้น/วัน · ${dayCount} วันทำงาน` : '');
    }

    const LEFT_AXIS = 72;
    const RIGHT_AXIS = 56;

    // NG segments: the part's color faded, with red diagonal stripes, so they
    // never read as good parts even when the colors are close.
    function ngPattern(color) {
        const size = 8;
        const tile = document.createElement('canvas');
        tile.width = tile.height = size;
        const ctx = tile.getContext('2d');
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.35;
        ctx.fillRect(0, 0, size, size);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#a4505a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-1, size + 1); ctx.lineTo(size + 1, -1);
        ctx.moveTo(-1, 1); ctx.lineTo(1, -1);
        ctx.moveTo(size - 1, size + 1); ctx.lineTo(size + 1, size - 1);
        ctx.stroke();
        return tile.getContext('2d').createPattern(tile, 'repeat');
    }

    // Every part gets its own color. Hues step by the golden angle and the
    // lightness alternates, so parts next to each other in the ranking (and so
    // usually in the same bar) never look alike.
    function partColor(i) {
        const hue = Math.round((i * 137.508 + 220) % 360);
        const lightness = [50, 36, 64][i % 3];
        return `hsl(${hue}, 24%, ${lightness}%)`;
    }

    function partSeries(days) {
        const totals = new Map();
        days.forEach(day => day.parts.forEach(part => {
            const item = totals.get(part.code) || { code: part.code, name: part.name, qty: 0 };
            item.qty += part.qty;
            totals.set(part.code, item);
        }));
        const series = Array.from(totals.values())
            .sort((a, b) => b.qty - a.qty)
            .map((part, i) => ({ ...part, key: part.code, color: partColor(i) }));
        return { series, keyOf: code => code };
    }

    // Shared hover position so both panes show the same day, like a stock chart.
    let hoverIndex = null;
    const crosshair = {
        id: 'lineEffCrosshair',
        afterDatasetsDraw(chart) {
            if (hoverIndex === null) return;
            const x = chart.scales.x;
            if (!x || hoverIndex >= chart.data.labels.length) return;
            const center = x.getPixelForValue(hoverIndex);
            const half = (x.width / Math.max(1, chart.data.labels.length)) / 2;
            const { ctx, chartArea } = chart;
            ctx.save();
            ctx.fillStyle = 'rgba(142, 108, 255, 0.10)';
            ctx.fillRect(center - half, chartArea.top, half * 2, chartArea.bottom - chartArea.top);
            ctx.restore();
        },
        afterEvent(chart, args) {
            const event = args.event;
            let next = hoverIndex;
            if (event.type === 'mouseout') next = null;
            else if (event.type === 'mousemove') {
                const hits = chart.getElementsAtEventForMode(event, 'index', { intersect: false }, false);
                next = hits.length ? hits[0].index : null;
            }
            if (next !== hoverIndex) {
                hoverIndex = next;
                [state.chart, state.prodChart].forEach(other => { if (other && other !== chart) other.draw(); });
                args.changed = true;
            }
        }
    };

    function fixedAxisWidth(width) {
        return scale => { scale.width = width; };
    }

    function renderProductionChart(days, labels) {
        const canvas = document.getElementById('lineEffProdChart');
        if (!canvas) return;
        const { series, keyOf } = partSeries(days);
        const good = series.map(() => days.map(() => 0));
        const ng = series.map(() => days.map(() => 0));
        const index = new Map(series.map((item, i) => [item.key, i]));
        days.forEach((day, d) => day.parts.forEach(part => {
            const i = index.get(keyOf(part.code));
            good[i][d] += part.qty - part.defects;
            ng[i][d] += part.defects;
        }));
        const ngRate = days.map(day => day.qty ? Number((day.defects / day.qty * 100).toFixed(2)) : 0);
        const label = item => item.code;

        const datasets = [];
        series.forEach((item, i) => datasets.push({
            type: 'bar', stack: 'output', order: 2, label: `FG · ${label(item)}`, data: good[i],
            backgroundColor: item.color, kzGroup: 'FG', partName: item.name, kzKeepColors: true
        }));
        // NG is pushed after every FG dataset so it always sits on top of the stack.
        series.forEach((item, i) => {
            if (!ng[i].some(v => v > 0)) return;
            datasets.push({
                type: 'bar', stack: 'output', order: 2, label: `NG · ${label(item)}`, data: ng[i],
                backgroundColor: ngPattern(item.color), kzGroup: 'NG', partName: item.name,
                kzKeepBorder: true, kzKeepColors: true, borderColor: '#a4505a', borderWidth: 1
            });
        });
        datasets.push({
            type: 'line', order: 1, label: 'NG rate (%)', data: ngRate, yAxisID: 'y1',
            borderColor: '#a4505a', backgroundColor: '#a4505a', borderWidth: 2, pointRadius: 3, tension: 0
        });

        if (state.prodChart) state.prodChart.destroy();
        state.prodChart = new Chart(canvas, {
            data: { labels, datasets },
            plugins: [crosshair],
            options: {
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        filter: item => item.raw > 0 || item.dataset.yAxisID === 'y1',
                        itemSort: (a, b) => (a.dataset.yAxisID === 'y1') - (b.dataset.yAxisID === 'y1') || b.datasetIndex - a.datasetIndex,
                        callbacks: {
                            label: item => item.dataset.yAxisID === 'y1'
                                ? ` NG rate: ${item.raw.toFixed(2)}%`
                                : ` ${item.dataset.label}: ${Number(item.raw).toLocaleString()} ชิ้น`,
                            footer: items => {
                                const day = days[items[0].dataIndex];
                                return day ? [`FG ${(day.qty - day.defects).toLocaleString()} · NG ${day.defects.toLocaleString()} · รวม ${day.qty.toLocaleString()} ชิ้น`] : [];
                            }
                        }
                    }
                },
                scales: {
                    x: { stacked: true, ticks: { display: false }, grid: { display: false } },
                    y: { stacked: true, beginAtZero: true, afterFit: fixedAxisWidth(LEFT_AXIS), ticks: { color: '#94a3b8', callback: v => Number(v).toLocaleString() }, title: { display: true, text: 'ชิ้น', color: '#94a3b8' } },
                    y1: { position: 'right', beginAtZero: true, afterFit: fixedAxisWidth(RIGHT_AXIS), grid: { display: false }, ticks: { color: '#a4505a', callback: v => v + '%' }, title: { display: true, text: 'NG %', color: '#a4505a' } }
                }
            }
        });

        renderLegend(series, ng.some(row => row.some(v => v > 0)));
    }

    function renderLegend(series, hasNg) {
        const box = document.getElementById('lineEffLegend');
        if (!box) return;
        const parts = series.map(item => `<span class="line-eff-legend-item" title="${escapeHtml(item.name || '')} · ${item.qty.toLocaleString()} ชิ้น"><i style="background:${item.color}"></i>${escapeHtml(item.code)}</span>`).join('');
        box.innerHTML = `<div class="line-eff-legend-keys"><span class="line-eff-legend-key"><i class="is-fg"></i>FG งานดี (ทึบ)</span>`
            + (hasNg ? `<span class="line-eff-legend-key"><i class="is-ng"></i>NG (ลายเฉียงแดง ด้านบน)</span>` : '')
            + `<span class="line-eff-legend-key"><i class="is-rate"></i>NG rate (%)</span>`
            + `<span class="line-eff-legend-count">${series.length} พาร์ท · เรียงตามยอดผลิต</span></div>`
            + `<div class="line-eff-legend-parts">${parts}</div>`;
    }

    function renderChart(days) {
        const canvas = document.getElementById('lineEffChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const labels = days.map(day => formatDateKey(day.day));
        renderProductionChart(days, labels);
        const values = days.map(day => Number(day.eff.toFixed(1)));
        const colors = days.map(day => day.eff >= TARGET ? '#10b981' : day.eff >= 60 ? '#f59e0b' : '#ef4444');
        if (state.chart) state.chart.destroy();
        state.chart = new Chart(canvas, {
            data: {
                labels,
                datasets: [
                    { type: 'bar', label: '%Eff', data: values, backgroundColor: colors, order: 2 },
                    { type: 'line', label: `เป้าหมาย ${TARGET}%`, data: days.map(() => TARGET), borderColor: '#8b5cf6', borderDash: [6, 6], pointRadius: 0, borderWidth: 2, order: 1 }
                ]
            },
            plugins: [crosshair],
            options: {
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                // Same right-hand gutter as the NG % axis above, so the days line up.
                layout: { padding: { right: RIGHT_AXIS } },
                plugins: {
                    // Bars are colored per day by status, so the card title
                    // carries the color key instead of a legend.
                    legend: { display: false },
                    tooltip: {
                        filter: item => item.datasetIndex === 0,
                        callbacks: {
                            afterBody: items => {
                                const day = days[items[0].dataIndex];
                                return day ? [`ทำได้ ${fmtMin(day.earned)} / มี ${fmtMin(day.available)}`, `ผลิต ${day.qty.toLocaleString()} ชิ้น`] : [];
                            }
                        }
                    }
                },
                scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { display: false } },
                    y: { beginAtZero: true, suggestedMax: 100, afterFit: fixedAxisWidth(LEFT_AXIS), ticks: { color: '#94a3b8', callback: value => value + '%' }, grid: { color: 'rgba(148,163,184,.12)' }, title: { display: true, text: '%Eff', color: '#94a3b8' } }
                }
            }
        });
    }

    function renderTable(days) {
        const body = document.getElementById('lineEffTableBody');
        if (!body) return;
        if (!days.length) {
            body.innerHTML = '<tr><td colspan="7" class="line-eff-empty">ไม่มีข้อมูลการผลิตในช่วงวันที่เลือก</td></tr>';
            return;
        }
        body.innerHTML = days.slice().reverse().map(day => {
            const open = state.expanded.has(day.day);
            const parts = Array.from(day.parts.values()).sort((a, b) => b.earned - a.earned);
            const detail = open ? `<tr class="line-eff-detail"><td colspan="7">
                <table class="line-eff-parts"><thead><tr><th>ชิ้นงาน</th><th>ประเภท</th><th>ยอดผลิต</th><th>ชิ้น/ราว</th><th>เวลามาตรฐาน</th><th>เวลาที่ทำได้</th></tr></thead><tbody>
                ${parts.map(part => `<tr><td><strong>${escapeHtml(part.code)}</strong><br><small>${escapeHtml(part.name)}</small></td><td>${part.workType === 'REWORK' ? 'REWORK' : 'งานใหม่'}</td><td>${part.qty.toLocaleString()}${part.defects ? ` <small>(เสีย ${part.defects})</small>` : ''}</td><td>${part.qtyPerJig}</td><td>${part.stdSec.toFixed(2)} วินาที</td><td>${fmtMin(part.earned)}</td></tr>`).join('')}
                ${day.unmatchedQty ? `<tr><td colspan="6" class="line-eff-note">⚠ มีงาน ${day.unmatchedQty.toLocaleString()} ชิ้นที่ยังไม่มีค่ามาตรฐาน จึงยังไม่ถูกนับ</td></tr>` : ''}
                </tbody></table></td></tr>` : '';
            return `<tr class="line-eff-row" data-day="${day.day}" tabindex="0" aria-expanded="${open}">
                <td><span class="line-eff-caret">${open ? '▾' : '▸'}</span> ${formatDateKey(day.day)}</td>
                <td>${fmtMin(day.available)}${day.shiftCount > 1 ? ` <small>(${day.shiftCount} กะ)</small>` : ''}${day.otMinutes ? ` <small>(OT ${day.otMinutes} น.)</small>` : ''}</td>
                <td>${fmtMin(day.earned)}</td>
                <td><span class="line-eff-pill ${effClass(day.eff)}">${fmtPct(day.eff)}</span></td>
                <td>${fmtPct(day.effGood)}</td>
                <td>${fmtMin(day.lost)}</td>
                <td>${day.qty.toLocaleString()}</td>
            </tr>${detail}`;
        }).join('');
    }

    function renderUnmatched(unmatched) {
        const box = document.getElementById('lineEffUnmatched');
        if (!box) return;
        if (!unmatched.length) {
            box.hidden = true;
            return;
        }
        box.hidden = false;
        box.innerHTML = `<strong>⚠ ชิ้นงานที่ยังไม่มีค่ามาตรฐาน (${unmatched.length} รายการ)</strong>
            <p>งานเหล่านี้ยังไม่ถูกนับใน %Eff — เพิ่มรหัสลงชีต <b>Capacity</b> ใน Google Sheet แล้วกดรีเฟรช</p>
            <div class="line-eff-chips">${unmatched.map(item => `<span class="line-eff-chip">${escapeHtml(item.raw || item.code || '(ว่าง)')} · ${item.qty.toLocaleString()} ชิ้น</span>`).join('')}</div>`;
    }

    function render() {
        if (!state.config) return;
        const { days, unmatched } = compute();
        renderKpis(days);
        renderChart(days);
        renderTable(days);
        renderUnmatched(unmatched);
        const source = document.getElementById('lineEffSource');
        if (source) {
            source.textContent = state.config.source === 'sheet'
                ? `ค่ามาตรฐานจากชีต Capacity (${state.config.capacity.length} ชิ้นงาน)`
                : 'ใช้ค่ามาตรฐานสำรองในระบบ (ยังเชื่อมชีต Capacity ไม่ได้)';
        }
    }

    function dateKey(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    // Range presets; an empty from/to means no limit on that side.
    function rangeFor(preset) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const back = days => { const d = new Date(today); d.setDate(d.getDate() - days + 1); return dateKey(d); };
        if (preset === '7d') return { from: back(7), to: dateKey(today) };
        if (preset === '30d') return { from: back(30), to: dateKey(today) };
        if (preset === 'month') return { from: dateKey(new Date(today.getFullYear(), today.getMonth(), 1)), to: dateKey(today) };
        if (preset === 'lastMonth') {
            return { from: dateKey(new Date(today.getFullYear(), today.getMonth() - 1, 1)), to: dateKey(new Date(today.getFullYear(), today.getMonth(), 0)) };
        }
        return { from: '', to: '' };
    }

    function syncRangeControls() {
        const fromInput = document.getElementById('lineEffFrom');
        const toInput = document.getElementById('lineEffTo');
        if (fromInput) fromInput.value = state.from;
        if (toInput) toInput.value = state.to;
        document.querySelectorAll('[data-eff-preset]').forEach(button => {
            const active = button.dataset.effPreset === state.preset;
            button.classList.toggle('is-active', active);
            button.setAttribute('aria-pressed', active ? 'true' : 'false');
        });
    }

    function applyPreset(preset) {
        state.preset = preset;
        if (preset !== 'custom') Object.assign(state, rangeFor(preset));
        syncRangeControls();
        render();
    }

    let rangeChosen = false;
    // First visit: last 30 days, or everything when the last 30 days are empty.
    function chooseInitialRange() {
        if (rangeChosen || !state.rows.length) return;
        rangeChosen = true;
        const recent = rangeFor('30d');
        const hasRecent = state.rows.some(row => {
            const day = toDateKey(row.date);
            return day && day >= recent.from && day <= recent.to;
        });
        state.preset = hasRecent ? '30d' : 'all';
        Object.assign(state, rangeFor(state.preset));
        syncRangeControls();
    }

    let loading = null;
    async function load(force) {
        if (loading && !force) return loading;
        const status = document.getElementById('lineEffStatus');
        loading = (async () => {
            try {
                if (!state.config) state.config = await loadBundledConfig();
                const cached = readCachedRows();
                if (cached.length && !state.rows.length) {
                    state.rows = cached;
                    chooseInitialRange();
                    render();
                }
                if (status) status.textContent = state.rows.length ? 'กำลังอัปเดตข้อมูลล่าสุด...' : 'กำลังโหลดข้อมูล...';

                const [sheetConfig, rows] = await Promise.all([loadSheetConfig(), loadRows()]);
                if (sheetConfig) state.config = sheetConfig;
                if (rows.length) state.rows = rows;
                chooseInitialRange();
                render();
                if (status) status.textContent = state.rows.length ? '' : 'ยังไม่มีข้อมูลการผลิต';
            } catch (error) {
                console.error(error);
                if (status) status.textContent = 'โหลดข้อมูลไม่สำเร็จ กรุณากดรีเฟรช';
            } finally {
                loading = null;
            }
        })();
        return loading;
    }

    function bind() {
        const page = document.getElementById('line-eff-tab');
        if (!page || page.dataset.bound) return;
        page.dataset.bound = 'true';
        ['lineEffFrom', 'lineEffTo'].forEach(id => {
            const input = document.getElementById(id);
            if (input) input.addEventListener('change', () => {
                state.from = document.getElementById('lineEffFrom').value;
                state.to = document.getElementById('lineEffTo').value;
                applyPreset('custom');
            });
        });
        document.querySelectorAll('[data-eff-preset]').forEach(button => {
            button.addEventListener('click', () => applyPreset(button.dataset.effPreset));
        });
        const refresh = document.getElementById('lineEffRefresh');
        if (refresh) refresh.addEventListener('click', () => load(true));
        const body = document.getElementById('lineEffTableBody');
        if (body) {
            const toggle = row => {
                const day = row.dataset.day;
                if (state.expanded.has(day)) state.expanded.delete(day); else state.expanded.add(day);
                renderTable(compute().days);
            };
            body.addEventListener('click', event => {
                const row = event.target.closest('.line-eff-row');
                if (row) toggle(row);
            });
            body.addEventListener('keydown', event => {
                const row = event.target.closest('.line-eff-row');
                if (row && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    toggle(row);
                }
            });
        }
    }

    window.openLineEfficiency = function (event, element) {
        if (event) event.preventDefault();
        switchTab('line-eff-tab', element);
        bind();
        load(false);
    };
}());
