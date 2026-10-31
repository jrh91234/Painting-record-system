/* Edit / delete saved production records (งานใหม่, REWORK, SCREEN, Pre-assy).
   Same rule as Mat receipts: a record still waiting for QC can be edited or
   deleted during the production day it was entered in (08:00 - 08:00); admins
   may delete any record. Apps Script decides (records carry row and editable
   from the sheet read) and re-checks before it changes anything. */
(function () {
    const DEFECTS = {
        NEW: [['rust', 'สนิม'], ['dent', 'บุบ/เสียรูป'], ['colorDrop', 'เม็ดสี'], ['thinPaint', 'สีบาง'], ['thickPaint', 'สีหนา/สีปูด'], ['waterStain', 'คราบน้ำ/จาระบี'], ['oil', 'คราบน้ำมัน'], ['dust', 'เศษฝุ่น'], ['otherDefect', 'อื่นๆ']],
        REWORK: [['rust', 'สนิม'], ['dent', 'รอยบุบ'], ['colorDrop', 'สะเก็ดรอยเชื่อม'], ['thinPaint', 'สีหนา/สีปูด'], ['thickPaint', 'คราบน้ำ/จาระบี'], ['waterStain', 'คราบน้ำยา'], ['oil', 'คราบน้ำมัน'], ['dust', 'เศษฝุ่น'], ['otherDefect', 'อื่นๆ']]
    };
    DEFECTS.SCREEN = DEFECTS.REWORK;
    const REFRESH = {
        NEW: () => typeof refreshDailyReportHistory === 'function' && refreshDailyReportHistory(),
        REWORK: () => typeof refreshReworkHistory === 'function' && refreshReworkHistory(),
        SCREEN: () => typeof refreshScreenHistory === 'function' && refreshScreenHistory(),
        PREASSY: () => typeof refreshPreAssyHistory === 'function' && refreshPreAssyHistory()
    };
    const registry = new Map();
    let editing = null;

    const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    function isAdmin() {
        const auth = window.PaintingAuth;
        return !!(auth && typeof auth.hasPermission === 'function' && auth.hasPermission('users.manage'));
    }

    function employeeId() {
        const user = window.PaintingAuth && window.PaintingAuth.currentUser;
        return user ? String(user.employeeId || '').trim() : '';
    }

    function toast(message, type) {
        if (typeof showToast === 'function') showToast(message, type);
    }

    async function call(params, operation) {
        const base = typeof getApiUrl === 'function' ? getApiUrl() : '';
        if (!base) throw new Error('ยังไม่ได้ตั้งค่า Google Sheet');
        return callUsersApi(base, params, operation);
    }

    // Buttons for one saved record, or `fallback` when it can no longer be changed.
    function actionsHtml(kind, record, fallback) {
        if (!record || !record.row) return fallback;
        const canDelete = record.editable || isAdmin();
        if (!record.editable && !canDelete) return fallback;
        const key = `${kind}:${record.row}:${record.submissionId || ''}`;
        registry.set(key, { kind, record });
        return `<span style="display:inline-flex; gap:0.35rem; justify-content:center;">`
            + (record.editable ? `<button type="button" class="btn-secondary-custom" data-pr-edit="${esc(key)}" title="แก้ไข">✏️</button>` : '')
            + `<button type="button" class="btn-secondary-custom" data-pr-delete="${esc(key)}" title="${record.editable ? 'ลบ' : 'ลบ (Admin)'}">🗑</button>`
            + '</span>';
    }

    function baseParams(kind, record) {
        return { kind, row: String(record.row), submissionId: record.submissionId || '', model: record.model || '', scope: 'pending' };
    }

    async function remove(key) {
        const entry = registry.get(key);
        if (!entry) return;
        const { kind, record } = entry;
        if (!confirm(`ลบรายการ ${record.model || ''} ช่วง ${record.timeSlot || '-'} (ผลิต ${Number(record.prodQty) || 0} / เสีย ${Number(record.totalDefect) || 0})?`)) return;
        try {
            const result = await call({ action: 'deleteProductionRecord', ...baseParams(kind, record), actorEmployeeId: employeeId() }, 'Delete production record');
            if (!result || result.status !== 'success') throw new Error((result && result.message) || 'ลบไม่สำเร็จ');
            toast(`ลบ ${record.model || 'รายการ'} แล้ว`, 'success');
            REFRESH[kind]();
        } catch (error) {
            toast('ลบไม่สำเร็จ: ' + error.message, 'error');
        }
    }

    function parseParts(text) {
        return String(text || '').split(',').map(item => item.trim()).filter(Boolean).map(item => {
            const m = item.match(/^(.*?)\s*x\s*(\d+(?:\.\d+)?)$/i);
            return m ? { part: m[1].trim(), qty: Number(m[2]) } : null;
        }).filter(Boolean);
    }

    function modal() {
        let el = document.getElementById('recordEditModal');
        if (el) return el;
        el = document.createElement('div');
        el.id = 'recordEditModal';
        el.className = 'modal-overlay';
        el.innerHTML = `<div class="modal-box" style="max-width:640px;">
            <div class="modal-header"><h3 class="modal-title" id="recordEditTitle">แก้ไขรายการ</h3><button class="modal-close" type="button" data-pr-close>&times;</button></div>
            <div class="modal-body" style="overflow:auto;"><div id="recordEditBody"></div>
                <div style="display:flex; gap:0.5rem; justify-content:flex-end; margin-top:1rem;">
                    <button type="button" class="btn-secondary-custom" data-pr-close>ยกเลิก</button>
                    <button type="button" class="btn-primary" id="recordEditSave">💾 บันทึกการแก้ไข</button>
                </div>
            </div></div>`;
        document.body.appendChild(el);
        el.addEventListener('click', event => {
            if (event.target === el || event.target.closest('[data-pr-close]')) close();
        });
        el.querySelector('#recordEditSave').addEventListener('click', save);
        return el;
    }

    function close() {
        const el = document.getElementById('recordEditModal');
        if (el) el.classList.remove('active');
        editing = null;
    }

    function numberField(id, label, value, disabled) {
        return `<div class="form-group"><label for="${id}">${esc(label)}</label><input id="${id}" class="form-control" type="number" min="0" value="${esc(Number(value) || 0)}"${disabled ? ' disabled' : ''}></div>`;
    }

    function open(key) {
        const entry = registry.get(key);
        if (!entry) return;
        editing = entry;
        const { kind, record } = entry;
        const el = modal();
        const slots = (typeof PAINTING_TIMESLOTS !== 'undefined' && Array.isArray(PAINTING_TIMESLOTS)) ? PAINTING_TIMESLOTS.slice() : [];
        if (record.timeSlot && !slots.includes(record.timeSlot)) slots.unshift(record.timeSlot);
        const parts = kind === 'PREASSY' ? parseParts(record.defectParts) : [];
        let html = `<p style="margin:0 0 0.75rem; opacity:0.8;">${esc(record.date || '')} · <b>${esc(record.model || '')}</b>${record.productGroup ? ' · ' + esc(record.productGroup) : ''}</p>
            <div class="dr-grid-2">
                <div class="form-group"><label for="prEditTime">ช่วงเวลา</label><select id="prEditTime" class="form-control">${slots.map(slot => `<option value="${esc(slot)}"${slot === record.timeSlot ? ' selected' : ''}>${esc(slot)}</option>`).join('')}</select></div>
                ${numberField('prEditProdQty', 'ยอดผลิต (ชิ้น)', record.prodQty, parts.length > 0)}
            </div>`;
        if (kind === 'PREASSY') {
            html += parts.length
                ? `<h4 style="margin:0.5rem 0;">ของเสียแยกตามพาร์ท</h4><div class="dr-grid-3">${parts.map((item, i) => `<div class="form-group"><label for="prEditPart${i}">${esc(item.part)}</label><input id="prEditPart${i}" data-part="${esc(item.part)}" class="form-control pr-edit-part" type="number" min="0" value="${esc(item.qty)}"></div>`).join('')}</div>`
                : '';
        } else {
            html += `<h4 style="margin:0.5rem 0;">ของเสีย (Defects)</h4><div class="dr-grid-3">${DEFECTS[kind].map(([field, label]) => numberField(`prEdit_${field}`, label, record[field])).join('')}</div>`;
        }
        el.querySelector('#recordEditTitle').textContent = `แก้ไขรายการ ${({ NEW: 'งานใหม่', REWORK: 'REWORK', SCREEN: 'SCREEN', PREASSY: 'Pre-assy' })[kind]}`;
        el.querySelector('#recordEditBody').innerHTML = html;
        el.classList.add('active');
    }

    async function save() {
        if (!editing) return;
        const { kind, record } = editing;
        const value = id => document.getElementById(id) ? document.getElementById(id).value : '';
        const params = { action: 'updateProductionRecord', ...baseParams(kind, record), timeSlot: value('prEditTime') };
        if (!document.getElementById('prEditProdQty').disabled) params.prodQty = value('prEditProdQty');
        if (kind === 'PREASSY') {
            const parts = Array.from(document.querySelectorAll('.pr-edit-part'));
            if (parts.length) params.defectParts = parts.map(input => ({ part: input.dataset.part, qty: Number(input.value) || 0 }))
                .filter(item => item.qty > 0).map(item => `${item.part} x${item.qty}`).join(', ');
        } else {
            DEFECTS[kind].forEach(([field]) => { params[field] = value(`prEdit_${field}`); });
        }
        const button = document.getElementById('recordEditSave');
        button.disabled = true;
        button.textContent = 'กำลังบันทึก...';
        try {
            const result = await call(params, 'Update production record');
            if (!result || result.status !== 'success') throw new Error((result && result.message) || 'แก้ไขไม่สำเร็จ');
            toast(`แก้ไข ${record.model || 'รายการ'} แล้ว`, 'success');
            close();
            REFRESH[kind]();
        } catch (error) {
            toast('แก้ไขไม่สำเร็จ: ' + error.message, 'error');
        } finally {
            button.disabled = false;
            button.textContent = '💾 บันทึกการแก้ไข';
        }
    }

    document.addEventListener('click', event => {
        const edit = event.target.closest('[data-pr-edit]');
        const del = event.target.closest('[data-pr-delete]');
        if (edit) open(edit.dataset.prEdit);
        if (del) remove(del.dataset.prDelete);
    });

    window.productionRecordActions = actionsHtml;
}());
