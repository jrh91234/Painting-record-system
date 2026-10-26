/* Line %Eff (ประสิทธิภาพไลน์พ่นสี).
   Every painted piece is converted to the line time it needs (standard time =
   3600 / (line speed × 60 / hanger pitch × pieces per hanger)), summed over all
   parts painted that day, and compared with the shift time available:
       %Eff = earned minutes ÷ available minutes
   Available time comes from the shift's time slots (LineTimeSlots sheet): the
   normal shift always counts, and OT slots count up to the last OT slot that
   has a production record that day. No one has to log stop times. */
(function () {
    const TARGET = 80;
    const FALLBACK_URL = 'data/line-capacity.json';
    const state = { config: null, rows: [], chart: null, from: '', to: '', preset: '30d', expanded: new Set() };
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

    function buildSlots(slots) {
        const list = slots
            .map(slot => ({ ...slot, start: slotStartMinutes(slot.timeSlot), isOT: String(slot.type).toUpperCase() === 'OT' }))
            .filter(slot => slot.start !== null && slot.minutes > 0)
            .sort((a, b) => a.start - b.start);
        return {
            list,
            normalMinutes: list.filter(slot => !slot.isOT).reduce((sum, slot) => sum + slot.minutes, 0),
            ot: list.filter(slot => slot.isOT)
        };
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
            if (!days.has(day)) days.set(day, { day, earned: 0, earnedGood: 0, earnedRework: 0, qty: 0, defects: 0, lastStart: null, parts: new Map(), unmatchedQty: 0 });
            const entry = days.get(day);
            const start = slotStartMinutes(row.timeSlot);
            if (start !== null) entry.lastStart = entry.lastStart === null ? start : Math.max(entry.lastStart, start);

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
            if (row.workType === 'REWORK') entry.earnedRework += earned;
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
            const otMinutes = entry.lastStart === null ? 0 : slots.ot
                .filter(slot => slot.start <= entry.lastStart + 5)
                .reduce((sum, slot) => sum + slot.minutes, 0);
            entry.available = slots.normalMinutes + otMinutes;
            entry.otMinutes = otMinutes;
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
    }

    function renderChart(days) {
        const canvas = document.getElementById('lineEffChart');
        if (!canvas || typeof Chart === 'undefined') return;
        const labels = days.map(day => formatDateKey(day.day));
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
            options: {
                maintainAspectRatio: false,
                plugins: {
                    // Bars are colored per day by status, so the card title
                    // carries the color key instead of a legend.
                    legend: { display: false },
                    tooltip: {
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
                    y: { beginAtZero: true, suggestedMax: 100, ticks: { color: '#94a3b8', callback: value => value + '%' }, grid: { color: 'rgba(148,163,184,.12)' } }
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
                <td>${fmtMin(day.available)}${day.otMinutes ? ` <small>(OT ${day.otMinutes} น.)</small>` : ''}</td>
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
