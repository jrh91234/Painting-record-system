/* รับ Mat (material receiving).
   Staff photograph a paint box label, check or correct the fields, and save
   one row per box to the MaterialReceipts sheet. Reading the label from the
   photo is optional: the server reports whether it is enabled
   (materialConfig.ocrEnabled), and the form works by hand until it is.

   Labels seen so far:
     JOTUN  - SKU, Batch No, Net weight (kg), Manufacturing date, Best before
     NUO QI - 型号/รหัสสี, 产品批号/รุ่นล็อต, 净重/น้ำหนัก, 生产日期/วันที่ผลิต,
              保质期/เก็บรักษา (shelf life in months, no expiry date printed) */
(function () {
    const SHELF_LIFE_MONTHS = { 'NUO QI': 6 };
    const NEAR_EXPIRY_DAYS = 30;
    const MAX_PHOTO_SIDE = 1600;
    const state = { bound: false, config: { ocrEnabled: false, photoStorage: false }, photo: null, known: new Map(), recent: [] };

    const $ = id => document.getElementById(id);
    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function toast(message, type) {
        if (typeof showToast === 'function') showToast(message, type || 'info');
    }

    function apiBase() {
        return typeof getApiUrl === 'function' ? getApiUrl() : '';
    }

    function currentUserName() {
        const user = window.PaintingAuth && window.PaintingAuth.currentUser;
        return user ? String(user.displayName || user.employeeId || '').trim() : '';
    }

    // ---------- dates ----------
    function parseDate(value) {
        const text = String(value || '').trim();
        let m = text.match(/^(\d{4})[-./](\d{1,2})[-./](\d{1,2})/);
        if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
        m = text.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})/);
        if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
        return null;
    }

    function isoDate(date) {
        if (!date || isNaN(date)) return '';
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function addMonths(date, months) {
        const result = new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
        // 31 Aug + 6 months must not roll into March.
        if (result.getDate() !== date.getDate()) result.setDate(0);
        return result;
    }

    function expiryStatus(expiry) {
        const date = parseDate(expiry);
        if (!date) return null;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const days = Math.round((date - today) / 86400000);
        if (days < 0) return { level: 'bad', text: `หมดอายุแล้ว ${-days} วัน` };
        if (days <= NEAR_EXPIRY_DAYS) return { level: 'warn', text: `ใกล้หมดอายุ (เหลือ ${days} วัน)` };
        return { level: 'good', text: `ใช้ได้อีก ${days} วัน` };
    }

    // ---------- form ----------
    const FIELDS = ['mrSupplier', 'mrColorCode', 'mrColorName', 'mrLot', 'mrBoxNo', 'mrWeight', 'mrMfgDate', 'mrExpiryDate', 'mrNote'];

    function readForm() {
        return {
            supplier: $('mrSupplier').value.trim(),
            colorCode: $('mrColorCode').value.trim(),
            colorName: $('mrColorName').value.trim(),
            lot: $('mrLot').value.trim(),
            boxNo: $('mrBoxNo').value.trim(),
            weight: $('mrWeight').value.trim(),
            mfgDate: $('mrMfgDate').value,
            expiryDate: $('mrExpiryDate').value,
            note: $('mrNote').value.trim()
        };
    }

    function setField(id, value, auto) {
        const el = $(id);
        if (!el || value === undefined || value === null || value === '') return;
        el.value = value;
        el.classList.toggle('is-auto', !!auto);
    }

    function resetForm() {
        const supplier = $('mrSupplier').value;
        FIELDS.forEach(id => {
            const el = $(id);
            el.value = '';
            el.classList.remove('is-auto', 'is-missing');
        });
        $('mrSupplier').value = supplier;
        $('mrWeight').value = '20';
        clearPhoto();
        updateExpiryBadge();
    }

    function fillDefaultExpiry() {
        const supplier = $('mrSupplier').value;
        const months = SHELF_LIFE_MONTHS[supplier];
        const mfg = parseDate($('mrMfgDate').value);
        if (months && mfg && !$('mrExpiryDate').value) {
            setField('mrExpiryDate', isoDate(addMonths(mfg, months)), true);
        }
        updateExpiryBadge();
    }

    function updateExpiryBadge() {
        const badge = $('mrExpiryBadge');
        const status = expiryStatus($('mrExpiryDate').value);
        badge.hidden = !status;
        if (status) {
            badge.textContent = status.text;
            badge.className = `mr-expiry-badge is-${status.level}`;
        }
    }

    // A color code saved before fills its name, supplier and weight.
    function applyKnownColor() {
        const known = state.known.get($('mrColorCode').value.trim().toUpperCase());
        if (!known) return;
        if (!$('mrColorName').value) setField('mrColorName', known.colorName, true);
        if (!$('mrSupplier').value) setField('mrSupplier', known.supplier, true);
        if (!$('mrWeight').value || $('mrWeight').value === '20') setField('mrWeight', known.weight, true);
        fillDefaultExpiry();
    }

    // ---------- photo ----------
    function clearPhoto() {
        state.photo = null;
        state.photoUrl = null;
        $('mrPhotoPreview').hidden = true;
        $('mrPhotoPreview').removeAttribute('src');
        $('mrPhotoInput').value = '';
        $('mrReadBtn').hidden = true;
        setReadStatus('');
    }

    function setReadStatus(text, level) {
        const el = $('mrReadStatus');
        el.textContent = text;
        el.className = 'mr-read-status' + (level ? ` is-${level}` : '');
        el.hidden = !text;
    }

    // Phones take 4000 px photos; a 1600 px JPEG is plenty to read a label
    // and small enough to upload over a weak factory connection.
    function loadPhoto(file) {
        return new Promise((resolve, reject) => {
            const url = URL.createObjectURL(file);
            const img = new Image();
            img.onload = () => {
                const scale = Math.min(1, MAX_PHOTO_SIDE / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);
                resolve(canvas.toDataURL('image/jpeg', 0.85));
            };
            img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('อ่านไฟล์รูปไม่ได้')); };
            img.src = url;
        });
    }

    async function onPhotoChosen(event) {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        try {
            state.photo = await loadPhoto(file);
            $('mrPhotoPreview').src = state.photo;
            $('mrPhotoPreview').hidden = false;
            $('mrReadBtn').hidden = !state.config.ocrEnabled;
            if (state.config.ocrEnabled) readLabel();
            else setReadStatus('');
        } catch (error) {
            toast(error.message, 'error');
        }
    }

    // ---------- server ----------
    async function call(params, operation) {
        const base = apiBase();
        if (!base) throw new Error('ยังไม่ได้ตั้งค่า Google Sheet');
        if (typeof callUsersApi === 'function') return callUsersApi(base, params, operation);
        const url = base + (base.includes('?') ? '&' : '?') + new URLSearchParams(params).toString();
        return fetchAppsScriptJsonWithRetry(url, operation, { attempts: 1, timeoutMs: 20000 });
    }

    async function loadConfig() {
        try {
            const result = await call({ action: 'materialConfig' }, 'Material config');
            state.config = { ocrEnabled: !!(result && result.ocrEnabled), photoStorage: !!(result && result.photoStorage) };
        } catch (error) {
            state.config = { ocrEnabled: false, photoStorage: false };
        }
        $('mrOcrNote').hidden = state.config.ocrEnabled;
    }

    // Photos are too large for a GET/JSONP request, so these two go by POST.
    async function postPhoto(action, extra) {
        const base = apiBase();
        const url = base + (base.includes('?') ? '&' : '?') + 'action=' + action;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(Object.assign({ image: state.photo.split(',')[1], mimeType: 'image/jpeg' }, extra || {}))
        });
        if (!response.ok) throw new Error('HTTP ' + response.status);
        return response.json();
    }

    async function readLabel() {
        if (!state.photo) return;
        setReadStatus('⏳ กำลังอ่านฉลาก...', 'info');
        $('mrReadBtn').disabled = true;
        try {
            const result = await postPhoto('readMaterialLabel');
            if (!result || result.status !== 'success' || !result.fields) throw new Error((result && result.message) || 'อ่านฉลากไม่สำเร็จ');
            applyReadFields(result.fields);
        } catch (error) {
            setReadStatus('อ่านอัตโนมัติไม่สำเร็จ: ' + error.message + ' — กรอกเองได้เลย', 'warn');
        } finally {
            $('mrReadBtn').disabled = false;
        }
    }

    function applyReadFields(fields) {
        const missing = [];
        const put = (id, value) => {
            if (value === undefined || value === null || String(value).trim() === '') { missing.push(id); return; }
            setField(id, String(value).trim(), true);
        };
        put('mrSupplier', normalizeSupplier(fields.supplier));
        put('mrColorCode', fields.colorCode);
        put('mrColorName', fields.colorName);
        put('mrLot', fields.lot);
        put('mrBoxNo', fields.boxNo);
        put('mrWeight', fields.netWeightKg);
        put('mrMfgDate', isoDate(parseDate(fields.mfgDate)));
        put('mrExpiryDate', isoDate(parseDate(fields.expiryDate)));
        fillDefaultExpiry();
        // Only the required fields count; e.g. NUO QI labels have no box number.
        const required = ['mrColorCode', 'mrLot', 'mrWeight'];
        required.forEach(id => $(id).classList.toggle('is-missing', !$(id).value));
        const unread = required.filter(id => missing.includes(id));
        setReadStatus(unread.length ? '⚠️ อ่านแล้ว แต่บางช่องอ่านไม่ได้ (สีเหลือง) กรุณากรอก' : '✅ อ่านแล้ว — ตรวจความถูกต้องก่อนบันทึก', unread.length ? 'warn' : 'good');
    }

    function normalizeSupplier(value) {
        const text = String(value || '').toUpperCase();
        if (text.includes('JOTUN')) return 'JOTUN';
        if (text.includes('NUO') || text.includes('诺奇')) return 'NUO QI';
        return value ? 'อื่นๆ' : '';
    }

    async function save(force) {
        const data = readForm();
        const missing = [['mrColorCode', data.colorCode], ['mrLot', data.lot], ['mrWeight', data.weight]].filter(([, v]) => !v).map(([id]) => id);
        FIELDS.forEach(id => $(id).classList.toggle('is-missing', missing.includes(id)));
        if (missing.length) {
            toast('กรุณากรอก รหัสสี, Lot และน้ำหนัก', 'error');
            return;
        }
        const status = expiryStatus(data.expiryDate);
        if (status && status.level === 'bad' && !force && !confirm(`สีล็อตนี้${status.text} ต้องการบันทึกรับต่อหรือไม่?`)) return;

        const btn = $('mrSaveBtn');
        const label = btn.innerHTML;
        btn.disabled = true;
        btn.textContent = '⏳ กำลังบันทึก...';
        try {
            // Keep the label photo with the record when Drive storage is on.
            // A failed upload must not block receiving the box.
            if (state.photo && state.config.photoStorage && !state.photoUrl) {
                try {
                    const uploaded = await postPhoto('saveMaterialPhoto', { colorCode: data.colorCode, lot: data.lot });
                    if (uploaded && uploaded.status === 'success') state.photoUrl = uploaded.url;
                } catch (error) {
                    console.warn('Material photo upload failed:', error);
                }
            }
            const result = await call({
                action: 'saveMaterialReceipt',
                receiptId: state.pendingId || (state.pendingId = 'MR-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7)),
                receivedBy: currentUserName(),
                supplier: data.supplier, colorCode: data.colorCode, colorName: data.colorName,
                lot: data.lot, boxNo: data.boxNo, netWeightKg: data.weight,
                mfgDate: data.mfgDate, expiryDate: data.expiryDate, note: data.note,
                photoUrl: state.photoUrl || '',
                force: force ? '1' : ''
            }, 'Save material receipt');
            if (result && result.status === 'success' && result.duplicate && !result.saved) {
                const when = result.existing ? ` (รับไปแล้วเมื่อ ${result.existing.timestamp} โดย ${result.existing.receivedBy || '-'})` : '';
                if (confirm(`กล่องนี้ (Lot ${data.lot}${data.boxNo ? ', Box ' + data.boxNo : ''}) เคยรับแล้ว${when}\nต้องการบันทึกซ้ำหรือไม่?`)) {
                    btn.disabled = false; btn.innerHTML = label;
                    return await save(true);
                }
                return;
            }
            if (!result || result.status !== 'success' || !result.saved) throw new Error((result && result.message) || 'บันทึกไม่สำเร็จ');
            state.pendingId = null;
            toast(`รับ ${data.colorCode} Lot ${data.lot} แล้ว`, 'success');
            resetForm();
            loadRecent();
        } catch (error) {
            toast('บันทึกลง Google Sheet ไม่สำเร็จ: ' + error.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = label;
        }
    }

    async function loadRecent() {
        const body = $('mrRecentBody');
        try {
            const result = await call({ action: 'getMaterialReceipts', limit: '200' }, 'Material receipts');
            state.recent = (result && Array.isArray(result.rows)) ? result.rows : [];
        } catch (error) {
            body.innerHTML = '<tr><td colspan="7" class="mr-empty">โหลดรายการไม่ได้</td></tr>';
            return;
        }
        state.known.clear();
        // Rows come newest first, so the first one per code is the latest.
        state.recent.forEach(row => {
            const key = String(row.colorCode || '').toUpperCase();
            if (key && !state.known.has(key)) state.known.set(key, { colorName: row.colorName, supplier: row.supplier, weight: row.netWeightKg });
        });
        $('mrColorCodeList').innerHTML = Array.from(state.known.entries()).map(([code, info]) => `<option value="${esc(code)}">${esc(info.colorName || '')}</option>`).join('');
        const rows = state.recent.slice(0, 30);
        body.innerHTML = rows.length ? rows.map(row => {
            const status = expiryStatus(row.expiryDate);
            return `<tr>
                <td>${esc(row.timestamp)}${row.photoUrl ? `<br><a href="${esc(row.photoUrl)}" target="_blank" rel="noopener">📷 รูป</a>` : ''}</td>
                <td><b>${esc(row.colorCode)}</b><br><small>${esc(row.colorName)}</small></td>
                <td>${esc(row.lot)}${row.boxNo ? `<br><small>Box ${esc(row.boxNo)}</small>` : ''}</td>
                <td>${esc(row.netWeightKg)}</td>
                <td>${esc(row.expiryDate || '-')}${status ? `<br><small class="is-${status.level}">${esc(status.text)}</small>` : ''}</td>
                <td>${esc(row.supplier)}</td>
                <td>${esc(row.receivedBy)}</td>
            </tr>`;
        }).join('') : '<tr><td colspan="7" class="mr-empty">ยังไม่มีการรับ Mat</td></tr>';
        $('mrTodayCount').textContent = state.recent.filter(row => String(row.timestamp || '').startsWith(isoDate(new Date()))).length;
    }

    function bind() {
        if (state.bound) return;
        state.bound = true;
        $('mrPhotoInput').addEventListener('change', onPhotoChosen);
        $('mrReadBtn').addEventListener('click', readLabel);
        $('mrClearPhotoBtn').addEventListener('click', clearPhoto);
        $('mrColorCode').addEventListener('change', applyKnownColor);
        $('mrSupplier').addEventListener('change', fillDefaultExpiry);
        $('mrMfgDate').addEventListener('change', fillDefaultExpiry);
        $('mrExpiryDate').addEventListener('change', updateExpiryBadge);
        $('mrSaveBtn').addEventListener('click', () => save(false));
        $('mrResetBtn').addEventListener('click', resetForm);
        $('mrRefreshBtn').addEventListener('click', loadRecent);
        FIELDS.forEach(id => $(id).addEventListener('input', () => $(id).classList.remove('is-auto', 'is-missing')));
        if (!$('mrWeight').value) $('mrWeight').value = '20';
    }

    window.openMaterialReceipt = function (event, element) {
        if (event) event.preventDefault();
        switchTab('material-receipt-tab', element);
        bind();
        loadConfig();
        loadRecent();
    };
}());
