/* Admin "Cycle time" page.
   Lists every part in the Capacity sheet with the values %Eff uses and saves
   edits back to the sheet one row at a time. StdSecPerPcs is usually a formula
   of QtyPerJig, Pitch_m and LineSpeed_m_min; such cells are shown read-only
   and are recalculated by the sheet when their inputs are saved. */
(function () {
    const FIELDS = [
        { key: 'qtyPerJig', label: 'ชิ้น/ราว', header: 'QtyPerJig', step: '1' },
        { key: 'pitch', label: 'ระยะราว (m)', header: 'Pitch_m', step: '0.01' },
        { key: 'lineSpeed', label: 'ความเร็วไลน์ (m/min)', header: 'LineSpeed_m_min', step: '0.1' },
        { key: 'stdSec', label: 'Cycle time พ่นสี / Pre-assy (วินาที/ชิ้น)', header: 'StdSecPerPcs', step: '0.01' },
        { key: 'screenStdSec', label: 'Cycle time SCREEN (วินาที/ชิ้น)', header: 'ScreenStdSecPerPcs', step: '0.01' }
    ];
    const state = { rows: [], loaded: false, loading: null, filter: '', group: '' };

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function apiUrl(params) {
        const baseUrl = typeof getApiUrl === 'function' ? getApiUrl() : '';
        if (!baseUrl) return '';
        return baseUrl + (baseUrl.includes('?') ? '&' : '?') + new URLSearchParams(params).toString();
    }

    function setStatus(text, isError) {
        const el = document.getElementById('cycleTimeStatus');
        if (!el) return;
        el.textContent = text || '';
        el.style.color = isError ? '#e11d48' : '';
    }

    function markup() {
        return `
            <div class="section-title-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.75rem;">
                <div>
                    <h1 class="page-title" style="margin:0;">Cycle time</h1>
                    <p class="page-subtitle">ค่ามาตรฐานของทุกพาร์ทจากชีต Capacity ที่ใช้คำนวณ %Eff · แก้แล้วกด "บันทึก" ของแถวนั้น</p>
                </div>
                <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
                    <button type="button" class="btn-primary-custom" id="cycleTimeAddToggle" style="padding:0.6rem 1.2rem !important;">➕ เพิ่มพาร์ทใหม่</button>
                    <button type="button" class="btn-secondary-custom" onclick="loadCycleTimes(true)" style="padding:0.6rem 1.2rem !important; border-radius:12px !important;">🔄 รีเฟรช</button>
                </div>
            </div>
            <form id="cycleTimeAddForm" class="dr-card" style="padding:1rem 1.25rem; margin-bottom:1rem;" hidden>
                <h2 class="dr-section-title" style="margin-top:0;">เพิ่มพาร์ทใหม่ลงชีต Capacity</h2>
                <div class="dr-grid-3">
                    <div class="form-group"><label for="ctNewCode">PartCode *</label><input id="ctNewCode" class="form-control" required></div>
                    <div class="form-group"><label for="ctNewName">PartName</label><input id="ctNewName" class="form-control"></div>
                    <div class="form-group"><label for="ctNewGroup">ProductGroup *</label><input id="ctNewGroup" class="form-control" list="ctGroupList" required placeholder="เลือกหรือพิมพ์กลุ่มใหม่"><datalist id="ctGroupList"></datalist></div>
                </div>
                <div class="dr-grid-3">
                    ${FIELDS.map(f => `<div class="form-group"><label for="ctNew_${f.key}">${esc(f.label)}</label><input id="ctNew_${f.key}" data-field="${f.key}" class="form-control" type="number" min="0" step="${f.step}"></div>`).join('')}
                </div>
                <p style="margin:0 0 0.75rem; font-size:0.8rem; opacity:0.75;">เว้นช่อง cycle time พ่นสีว่างไว้ได้ ถ้าชีตคำนวณจาก ชิ้น/ราว · ระยะราว · ความเร็วไลน์ — แถวใหม่จะใช้สูตรเดียวกับแถวอื่น</p>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end;">
                    <button type="button" class="btn-secondary-custom" id="cycleTimeAddCancel">ยกเลิก</button>
                    <button type="submit" class="btn-primary" id="cycleTimeAddSubmit">💾 เพิ่มพาร์ท</button>
                </div>
            </form>
            <div class="dr-card" style="padding:1rem 1.25rem; margin-bottom:1rem;">
                <div class="dr-grid-2">
                    <div class="form-group"><label for="cycleTimeSearch">ค้นหา PartCode / PartName</label><input id="cycleTimeSearch" class="form-control" type="search" placeholder="เช่น BRU30890 หรือ Cover"></div>
                    <div class="form-group"><label for="cycleTimeGroup">ProductGroup</label><select id="cycleTimeGroup" class="form-control"><option value="">ทั้งหมด</option></select></div>
                </div>
                <p style="margin:0.25rem 0 0; font-size:0.8rem; opacity:0.75;">ช่องที่เป็นสูตรในชีต (🔒) แก้ไม่ได้โดยตรง — แก้ ชิ้น/ราว, ระยะราว หรือความเร็วไลน์ แล้วชีตจะคำนวณใหม่ให้</p>
            </div>
            <p id="cycleTimeStatus" class="line-eff-status" role="status"></p>
            <div class="dr-card" style="padding:0; overflow:hidden;">
                <div class="table-responsive">
                    <table class="data-table cycle-time-table" style="width:100%; min-width:1100px;">
                        <thead><tr><th>PartCode</th><th>PartName</th><th>ProductGroup</th>${FIELDS.map(f => `<th title="${esc(f.header)}">${esc(f.label)}</th>`).join('')}<th style="width:110px;"></th></tr></thead>
                        <tbody id="cycleTimeBody"><tr><td colspan="${FIELDS.length + 4}" style="text-align:center; padding:1.5rem;">กำลังโหลด...</td></tr></tbody>
                    </table>
                </div>
            </div>`;
    }

    function visibleRows() {
        const q = state.filter.trim().toUpperCase();
        return state.rows.filter(row => (!state.group || row.productGroup === state.group)
            && (!q || row.partCode.toUpperCase().includes(q) || row.partName.toUpperCase().includes(q)));
    }

    function cellInput(row, field) {
        const locked = row.formulas && row.formulas[field.key];
        const value = row[field.key] === '' || row[field.key] == null ? '' : row[field.key];
        if (locked) {
            const shown = value === '' ? '-' : (Math.round(Number(value) * 100) / 100).toString();
            return `<td title="สูตรในชีต"><span style="white-space:nowrap;">🔒 ${esc(shown)}</span></td>`;
        }
        return `<td><input type="number" min="0" step="${field.step}" class="form-control cycle-time-input" data-field="${field.key}" value="${esc(value)}" style="min-width:90px;"></td>`;
    }

    function render() {
        const body = document.getElementById('cycleTimeBody');
        if (!body) return;
        const rows = visibleRows();
        if (!rows.length) {
            body.innerHTML = `<tr><td colspan="${FIELDS.length + 4}" style="text-align:center; padding:1.5rem;">${state.loaded ? 'ไม่พบพาร์ท' : 'กำลังโหลด...'}</td></tr>`;
            return;
        }
        body.innerHTML = rows.map(row => `<tr data-row="${row.row}" data-code="${esc(row.partCode)}">
            <td><strong>${esc(row.partCode)}</strong></td>
            <td style="white-space:normal;">${esc(row.partName)}</td>
            <td>${esc(row.productGroup)}</td>
            ${FIELDS.map(field => cellInput(row, field)).join('')}
            <td><button type="button" class="btn-primary cycle-time-save" disabled style="white-space:nowrap;">บันทึก</button></td>
        </tr>`).join('');
    }

    function renderGroups() {
        const select = document.getElementById('cycleTimeGroup');
        if (!select) return;
        const groups = [];
        state.rows.forEach(row => { if (row.productGroup && !groups.includes(row.productGroup)) groups.push(row.productGroup); });
        select.innerHTML = '<option value="">ทั้งหมด</option>' + groups.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join('');
        select.value = groups.includes(state.group) ? state.group : '';
        const list = document.getElementById('ctGroupList');
        if (list) list.innerHTML = groups.map(g => `<option value="${esc(g)}"></option>`).join('');
    }

    async function addPart(event) {
        event.preventDefault();
        const form = document.getElementById('cycleTimeAddForm');
        const params = {
            action: 'addCycleTimePart',
            partCode: document.getElementById('ctNewCode').value.trim(),
            partName: document.getElementById('ctNewName').value.trim(),
            productGroup: document.getElementById('ctNewGroup').value.trim()
        };
        if (!params.partCode || !params.productGroup) {
            if (typeof showToast === 'function') showToast('กรุณาระบุ PartCode และ ProductGroup', 'error');
            return;
        }
        if (state.rows.some(row => row.partCode.toUpperCase() === params.partCode.toUpperCase())) {
            if (typeof showToast === 'function') showToast(`มี PartCode ${params.partCode} อยู่แล้ว`, 'error');
            return;
        }
        form.querySelectorAll('[data-field]').forEach(input => { params[input.dataset.field] = input.value; });
        const button = document.getElementById('cycleTimeAddSubmit');
        button.disabled = true;
        button.textContent = 'กำลังเพิ่ม...';
        try {
            const json = await fetchAppsScriptJsonp(apiUrl(params), 'Add cycle time part', 20000);
            if (!json || json.status !== 'success') throw new Error((json && json.message) || 'เพิ่มไม่สำเร็จ');
            if (json.row) state.rows.push(json.row);
            form.reset();
            form.hidden = true;
            state.filter = params.partCode;
            document.getElementById('cycleTimeSearch').value = params.partCode;
            renderGroups();
            render();
            setStatus(`${state.rows.length} พาร์ท`);
            if (typeof showToast === 'function') showToast(`เพิ่ม ${params.partCode} ลงชีต Capacity แล้ว`, 'success');
        } catch (error) {
            console.error('Add cycle time part failed', error);
            if (typeof showToast === 'function') showToast(`เพิ่ม ${params.partCode} ไม่สำเร็จ: ${error.message || error}`, 'error');
        } finally {
            button.disabled = false;
            button.textContent = '💾 เพิ่มพาร์ท';
        }
    }

    async function load(force) {
        if (state.loading && !force) return state.loading;
        const url = apiUrl({ action: 'getCycleTimes' });
        if (!url) {
            setStatus('ยังไม่ได้ตั้งค่า Google Sheet API', true);
            return null;
        }
        setStatus('กำลังโหลดข้อมูลจากชีต Capacity...');
        state.loading = (async () => {
            try {
                const json = await fetchAppsScriptJsonWithRetry(url, 'Load cycle times', { attempts: 2, timeoutMs: 20000 });
                if (!json || json.status !== 'success' || !Array.isArray(json.rows)) throw new Error((json && json.message) || 'โหลดไม่สำเร็จ');
                state.rows = json.rows;
                state.loaded = true;
                renderGroups();
                render();
                setStatus(`${state.rows.length} พาร์ท`);
            } catch (error) {
                console.error('Cycle time load failed', error);
                setStatus('โหลดข้อมูลไม่สำเร็จ กรุณากดรีเฟรช', true);
            } finally {
                state.loading = null;
            }
        })();
        return state.loading;
    }

    async function save(tr) {
        const rowNumber = Number(tr.dataset.row);
        const row = state.rows.find(r => r.row === rowNumber);
        if (!row) return;
        const params = { action: 'updateCycleTime', row: String(rowNumber), partCode: row.partCode };
        tr.querySelectorAll('.cycle-time-input').forEach(input => { params[input.dataset.field] = input.value; });
        const button = tr.querySelector('.cycle-time-save');
        if (button) { button.disabled = true; button.textContent = 'กำลังบันทึก...'; }
        try {
            const json = await fetchAppsScriptJsonp(apiUrl(params), 'Save cycle time', 20000);
            if (!json || json.status !== 'success') throw new Error((json && json.message) || 'บันทึกไม่สำเร็จ');
            if (json.row) Object.assign(row, json.row);
            render();
            if (typeof showToast === 'function') showToast(`บันทึก ${row.partCode} แล้ว`, 'success');
        } catch (error) {
            console.error('Cycle time save failed', error);
            if (typeof showToast === 'function') showToast(`บันทึก ${row.partCode} ไม่สำเร็จ: ${error.message || error}`, 'error');
            if (button) { button.disabled = false; button.textContent = 'บันทึก'; }
        }
    }

    function init() {
        const root = document.getElementById('cycleTimeRoot');
        if (!root || root.dataset.ready) return;
        root.dataset.ready = 'true';
        root.innerHTML = markup();
        document.getElementById('cycleTimeSearch').addEventListener('input', event => { state.filter = event.target.value; render(); });
        const addForm = document.getElementById('cycleTimeAddForm');
        document.getElementById('cycleTimeAddToggle').addEventListener('click', () => {
            addForm.hidden = !addForm.hidden;
            if (!addForm.hidden) document.getElementById('ctNewCode').focus();
        });
        document.getElementById('cycleTimeAddCancel').addEventListener('click', () => { addForm.reset(); addForm.hidden = true; });
        addForm.addEventListener('submit', addPart);
        document.getElementById('cycleTimeGroup').addEventListener('change', event => { state.group = event.target.value; render(); });
        const body = document.getElementById('cycleTimeBody');
        body.addEventListener('input', event => {
            const tr = event.target.closest('tr');
            const button = tr && tr.querySelector('.cycle-time-save');
            if (button) button.disabled = false;
        });
        body.addEventListener('click', event => {
            const button = event.target.closest('.cycle-time-save');
            if (button && !button.disabled) save(button.closest('tr'));
        });
    }

    window.loadCycleTimes = load;
    window.openCycleTime = function (event, element) {
        if (event) event.preventDefault();
        switchTab('cycle-time-tab', element);
        init();
        load(false);
    };
}());
