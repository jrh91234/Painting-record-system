// PRE-ASSY production form. Lists only the Capacity rows whose ProductGroup
// names Pre-assy (split out of the shared catalog in daily-report.js, so the
// other production forms never show them) and writes to the PRE_ASSY sheet.

let preAssyDraftRecords = [];
let preAssyHistoryRecords = [];
let preAssyFormInitialized = false;

const PREASSY_DRAFT_KEY = "PAINTING_PREASSY_DRAFT";

function preAssyToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function preAssyEsc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function preAssyNum(id) {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function preAssyCatalog() {
    const groups = (typeof PAINTING_PREASSY_GROUPS !== "undefined" && PAINTING_PREASSY_GROUPS) || {};
    const order = (typeof PAINTING_PREASSY_GROUP_ORDER !== "undefined" && PAINTING_PREASSY_GROUP_ORDER) || Object.keys(groups);
    return { groups, order: order.filter(name => groups[name]) };
}

function preAssyGroupParts(group) {
    return Object.values(preAssyCatalog().groups[group]?.categories || {}).flat();
}

function preAssyOptions(selectId, options, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    select.innerHTML = `<option value="">${preAssyEsc(placeholder)}</option>` + options.map(option => {
        const value = typeof option === "string" ? option : (option.value ?? "");
        const label = typeof option === "string" ? option : (option.label ?? option.value ?? "");
        return `<option value="${preAssyEsc(value)}">${preAssyEsc(label)}</option>`;
    }).join("");
    if (options.some(option => String(typeof option === "string" ? option : option.value) === String(current))) {
        select.value = current;
    }
}

function renderPreAssyProductGroups() {
    if (!document.getElementById("paProductGroup")) return;
    const { order } = preAssyCatalog();
    preAssyOptions("paProductGroup", order, order.length ? "-- เลือกกลุ่มผลิตภัณฑ์ --" : "-- ยังไม่มีรายการ Pre-assy ในชีต Capacity --");
    // A single group is selected for the user.
    const groupSelect = document.getElementById("paProductGroup");
    if (groupSelect && !groupSelect.value && order.length === 1) groupSelect.value = order[0];
    renderPreAssyModels();
}

function renderPreAssyModels() {
    const group = document.getElementById("paProductGroup")?.value || "";
    const parts = preAssyGroupParts(group);
    preAssyOptions("paModel", parts, group ? "-- เลือกชิ้นงาน (PartCode) PartName --" : "-- เลือกกลุ่มผลิตภัณฑ์ก่อน --");
    const modelSelect = document.getElementById("paModel");
    if (modelSelect && !modelSelect.value && parts.length === 1) modelSelect.value = parts[0].value;
}

// The parts a Pre-assy is built from: the Capacity group it is named after
// ("NLC 600 Pre-assy" -> "NLC 600", "PRE ASSY BOX LC600" -> "LC600", not
// "LC600 Visi-smart"), or every other group when no name matches.
function preAssyComponentParts(group) {
    const base = String(group || "").replace(/PRE[\s_-]*ASS\w*/ig, "").replace(/\bBOX\b/ig, "").replace(/\s+/g, " ").trim().toUpperCase();
    const groups = (typeof PAINTING_MODEL_GROUPS !== "undefined" && PAINTING_MODEL_GROUPS) || {};
    const names = Object.keys(groups);
    const matched = base ? names.filter(name => name.toUpperCase() === base) : [];
    const parts = [];
    (matched.length ? matched : names).forEach(name => {
        Object.values(groups[name]?.categories || {}).flat().forEach(item => {
            if (item && item.value && !parts.some(part => part.value === item.value)) parts.push(item);
        });
    });
    return parts;
}

function preAssyDefectRowMarkup() {
    const group = document.getElementById("paProductGroup")?.value || "";
    const options = preAssyComponentParts(group).map(item => `<option value="${preAssyEsc(item.value)}">${preAssyEsc(item.label || item.value)}</option>`).join("");
    return `<div class="pa-defect-row" style="display:grid; grid-template-columns:minmax(0,3fr) minmax(0,1fr) auto; gap:1rem; align-items:end;">
        <div class="form-group"><label>พาร์ทที่เสีย</label><select class="form-control pa-defect-part"><option value="">-- เลือกพาร์ทที่เสีย --</option>${options}</select></div>
        <div class="form-group"><label>จำนวนเสีย (ชิ้น)</label><input class="form-control pa-defect-qty" type="number" min="0" placeholder="0"></div>
        <div class="form-group"><button type="button" class="btn-danger" onclick="removePreAssyDefectRow(this)">ลบ</button></div>
    </div>`;
}

function addPreAssyDefectRow() {
    const list = document.getElementById("paDefectList");
    if (!list) return;
    list.insertAdjacentHTML("beforeend", preAssyDefectRowMarkup());
    updatePreAssyDefectTotal();
}

function removePreAssyDefectRow(button) {
    button?.closest(".pa-defect-row")?.remove();
    updatePreAssyDefectTotal();
}

function preAssyDefectBreakdown() {
    return Array.from(document.querySelectorAll("#paDefectList .pa-defect-row")).map(row => ({
        part: row.querySelector(".pa-defect-part")?.value || "",
        qty: Math.max(0, Number(row.querySelector(".pa-defect-qty")?.value) || 0)
    }));
}

// A record is either good output or rejects: while any reject is entered the
// good-output box is cleared and locked.
function updatePreAssyDefectTotal() {
    const total = preAssyDefectBreakdown().reduce((sum, item) => sum + item.qty, 0);
    const totalInput = document.getElementById("paDefect");
    if (totalInput) totalInput.value = total ? String(total) : "";
    const prodQty = document.getElementById("paProdQty");
    if (prodQty) {
        if (total > 0) prodQty.value = "";
        prodQty.disabled = total > 0;
        prodQty.placeholder = total > 0 ? "ล็อก: มีการลงของเสีย" : "0";
    }
}

function resetPreAssyDefects() {
    const list = document.getElementById("paDefectList");
    if (list) list.innerHTML = "";
    updatePreAssyDefectTotal();
}

function preAssyFormMarkup() {
    const sharedSlots = (typeof PAINTING_TIMESLOTS !== "undefined" && PAINTING_TIMESLOTS) || window.PAINTING_TIMESLOTS;
    const slots = Array.isArray(sharedSlots) && sharedSlots.length
        ? sharedSlots
        : ["08.00 - 09.00", "09.00 - 10.00", "10.10 - 11.00", "11.00 - 12.00", "13.00 - 14.00", "14.00 - 15.00", "15.10 - 16.00", "16.00 - 17.00"];
    return `
        <div class="section-title-bar">
            <div>
                <h1 class="page-title">Pre-assy</h1>
                <p class="page-subtitle">แบบฟอร์มลงยอดงาน Pre-assy แยกเก็บในชีต PRE_ASSY</p>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 1: ข้อมูลการบันทึก Pre-assy</h2>
            <div class="dr-grid-3">
                <div class="form-group"><label for="paDate">วันที่</label><input id="paDate" type="date" class="form-control"></div>
                <div class="form-group"><label>กะทำงาน (Shift)</label><div class="dr-radio-pills"><label><input type="radio" name="preAssyShift" value="Day" checked> ☀️ Day</label><label><input type="radio" name="preAssyShift" value="Night"> 🌙 Night</label></div></div>
                <div class="form-group"><label for="paRecorder">ผู้บันทึก</label><input id="paRecorder" class="form-control" type="text" placeholder="ระบุชื่อผู้บันทึก"></div>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 2: รายการผลิต</h2>
            <div class="dr-grid-2">
                <div class="form-group"><label for="paProductGroup">กลุ่มผลิตภัณฑ์ (ProductGroup)</label><select id="paProductGroup" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ --</option></select></div>
                <div class="form-group"><label for="paModel">ชิ้นงาน (PartCode) PartName</label><select id="paModel" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ก่อน --</option></select></div>
            </div>
            <div class="dr-grid-3">
                <div class="form-group"><label for="paTime">ช่วงเวลา</label><select id="paTime" class="form-control">${slots.map(slot => `<option value="${preAssyEsc(slot)}">${preAssyEsc(slot)}</option>`).join("")}</select></div>
                <div class="form-group"><label for="paProdQty">ยอดผลิต (ชิ้น)</label><input id="paProdQty" class="form-control" type="number" min="0" placeholder="0"></div>
                <div class="form-group"><label for="paDefect">ของเสีย (ชิ้น)</label><input id="paDefect" class="form-control" type="number" placeholder="0" readonly title="รวมจากพาร์ทที่เสียด้านล่าง"></div>
            </div>
            <h3 class="dr-subtitle">ของเสีย แยกตามพาร์ท (ลงของเสียแล้วจะลงยอดผลิตในรายการเดียวกันไม่ได้)</h3>
            <div id="paDefectList"></div>
            <div class="rework-form-actions" style="justify-content:flex-start;"><button type="button" class="btn-secondary" onclick="addPreAssyDefectRow()">➕ เพิ่มพาร์ทที่เสีย</button></div>
            <div class="rework-form-actions">
                <button type="button" class="btn-secondary" onclick="addPreAssyRecord()">➕ เพิ่มรายการ</button>
                <button id="preAssySubmitButton" type="button" class="btn-primary" onclick="submitPreAssyReport()">💾 บันทึกข้อมูล Pre-assy</button>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <div class="rework-list-heading">
                <h2 class="dr-section-title">รายการ Pre-assy ที่เพิ่ม</h2>
                <div class="rework-list-toolbar">
                    <strong id="preAssyTotalSummary">0 รายการ</strong>
                    <button type="button" class="rework-refresh-btn" onclick="refreshPreAssyHistory()">
                        <span class="rework-refresh-icon" aria-hidden="true">↻</span>
                        <span>รีเฟรชประวัติ</span>
                    </button>
                </div>
            </div>
            <div class="table-responsive rework-table-wrap"><table class="data-table rework-history-table"><colgroup><col class="rw-col-date"><col class="rw-col-model"><col class="rw-col-time"><col class="rw-col-group"><col class="rw-col-partname"><col class="rw-col-output"><col class="rw-col-defect"><col class="rw-col-action"></colgroup><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>ช่วงเวลา</th><th>ProductGroup</th><th>PartName</th><th>ยอดผลิต</th><th>ยอดเสีย</th><th>จัดการ</th></tr></thead><tbody id="preAssyListBody"><tr><td colspan="8" class="empty-state">ยังไม่มีรายการ</td></tr></tbody></table></div>
        </div>`;
}

function initPreAssyForm() {
    const root = document.getElementById("preAssyFormRoot");
    if (!root) return;
    if (!preAssyFormInitialized) {
        root.innerHTML = preAssyFormMarkup();
        const date = document.getElementById("paDate");
        if (date) date.value = preAssyToday();
        preAssyFormInitialized = true;
        try {
            const saved = JSON.parse(localStorage.getItem(PREASSY_DRAFT_KEY) || "[]");
            if (Array.isArray(saved)) preAssyDraftRecords = saved;
        } catch (_) { preAssyDraftRecords = []; }
        document.getElementById("paProductGroup")?.addEventListener("change", () => {
            renderPreAssyModels();
            resetPreAssyDefects();
        });
        document.getElementById("paDefectList")?.addEventListener("input", updatePreAssyDefectTotal);
        document.getElementById("paDefectList")?.addEventListener("change", updatePreAssyDefectTotal);
        root.querySelectorAll('input[type="number"]').forEach(input => {
            input.addEventListener("focus", () => { if (input.value === "0") input.value = ""; });
        });
    }
    renderPreAssyProductGroups();
    renderPreAssyList();
    // The catalog is normally loaded by the daily production form; load it
    // here too when this menu is opened first.
    if (!preAssyCatalog().order.length && typeof loadPartModelsList === "function") loadPartModelsList();
}

function addPreAssyRecord() {
    const model = document.getElementById("paModel")?.value || "";
    if (!model) {
        showToast?.("กรุณาเลือกชิ้นงานก่อนเพิ่มรายการ", "error");
        return false;
    }
    const productGroup = document.getElementById("paProductGroup")?.value || "";
    // Kept in the record for the sheet's PartCategory column.
    const partCategory = Object.entries(preAssyCatalog().groups[productGroup]?.categories || {})
        .find(([, models]) => (models || []).some(item => String(item.value ?? item) === model))?.[0] || "";
    const breakdown = preAssyDefectBreakdown().filter(item => item.part || item.qty > 0);
    if (breakdown.some(item => !item.part || item.qty <= 0)) {
        showToast?.("กรุณาเลือกพาร์ทที่เสียและระบุจำนวนให้ครบทุกแถว", "error");
        return false;
    }
    // The same part entered on two rows is counted once with both quantities.
    const merged = [];
    breakdown.forEach(item => {
        const existing = merged.find(entry => entry.part === item.part);
        if (existing) existing.qty += item.qty;
        else merged.push({ ...item });
    });
    const totalDefect = merged.reduce((sum, item) => sum + item.qty, 0);
    const record = {
        productGroup, partCategory, model, color: "", colorCode: "",
        timeSlot: document.getElementById("paTime")?.value || "",
        prodQty: totalDefect > 0 ? 0 : preAssyNum("paProdQty"),
        otherDefect: totalDefect,
        totalDefect,
        defectParts: merged.map(item => `${item.part} x${item.qty}`).join(", ")
    };
    if (record.prodQty <= 0 && record.totalDefect <= 0) {
        showToast?.("กรุณาระบุยอดผลิตหรือยอดเสียอย่างน้อยหนึ่งรายการ", "error");
        return false;
    }
    record.date = document.getElementById("paDate")?.value || preAssyToday();
    preAssyDraftRecords.push(record);
    localStorage.setItem(PREASSY_DRAFT_KEY, JSON.stringify(preAssyDraftRecords));
    renderPreAssyList();
    const prodQty = document.getElementById("paProdQty");
    if (prodQty) prodQty.value = "";
    resetPreAssyDefects();
    showToast?.("เพิ่มรายการ Pre-assy แล้ว", "success");
    return true;
}

function removePreAssyRecord(index) {
    preAssyDraftRecords.splice(index, 1);
    localStorage.setItem(PREASSY_DRAFT_KEY, JSON.stringify(preAssyDraftRecords));
    renderPreAssyList();
}

function renderPreAssyList() {
    const body = document.getElementById("preAssyListBody");
    if (!body) return;
    const drafts = preAssyDraftRecords.length > 0;
    const rows = drafts ? preAssyDraftRecords : preAssyHistoryRecords.slice(-5).reverse();
    const summary = document.getElementById("preAssyTotalSummary");
    if (summary) summary.textContent = `${rows.length} รายการ`;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="empty-state">ยังไม่มีรายการ</td></tr>`; return; }
    body.innerHTML = rows.map((row, index) => `<tr><td>${preAssyEsc(row.date || "-")}</td><td>${preAssyEsc(row.model || "-")}</td><td>${preAssyEsc(row.timeSlot || "-")}</td><td>${preAssyEsc(getDailyReportProductGroup(row))}</td><td title="${preAssyEsc(getDailyReportPartName(row))}">${preAssyEsc(getDailyReportPartName(row))}</td><td>${Number(row.prodQty) || 0}</td><td title="${preAssyEsc(row.defectParts || "")}">${Number(row.totalDefect) || 0}${row.defectParts ? `<div style="font-size:.75rem;opacity:.75;white-space:normal;">${preAssyEsc(row.defectParts)}</div>` : ""}</td><td>${drafts ? `<button type="button" class="btn-danger" onclick="removePreAssyRecord(${index})">ลบ</button>` : "บันทึกแล้ว"}</td></tr>`).join("");
}

async function refreshPreAssyHistory() {
    const body = document.getElementById("preAssyListBody");
    if (body && !preAssyDraftRecords.length) body.innerHTML = `<tr><td colspan="8" class="empty-state">กำลังโหลดประวัติ Pre-assy...</td></tr>`;
    try {
        preAssyHistoryRecords = await fetchPreAssyReportDataFromAPI();
        renderPreAssyList();
    } catch (error) {
        console.error("Pre-assy history load failed", error);
        if (body && !preAssyDraftRecords.length) body.innerHTML = `<tr><td colspan="8" class="empty-state error-text">โหลดประวัติ Pre-assy ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง</td></tr>`;
    }
}

async function submitPreAssyReport() {
    // A filled-in row that was not added yet is saved with the others.
    const pendingQty = preAssyNum("paProdQty") > 0 || preAssyDefectBreakdown().some(item => item.part || item.qty > 0);
    if ((!preAssyDraftRecords.length || pendingQty) && !addPreAssyRecord()) return;
    const payload = {
        action: "submitPreAssyReport", submissionId: `pa-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: document.getElementById("paDate")?.value || preAssyToday(),
        shift: document.querySelector('input[name="preAssyShift"]:checked')?.value || "Day",
        recorder: document.getElementById("paRecorder")?.value?.trim() || "",
        checker: "", records: preAssyDraftRecords.map(record => ({ ...record }))
    };
    if (!payload.recorder) return showToast?.("กรุณาระบุชื่อผู้บันทึก", "error");
    const button = document.getElementById("preAssySubmitButton");
    if (button) { button.disabled = true; button.textContent = "กำลังบันทึก..."; }
    try {
        await sendPreAssyReportToAPI(payload);
        preAssyDraftRecords = [];
        localStorage.removeItem(PREASSY_DRAFT_KEY);
        await refreshPreAssyHistory();
        showToast?.("บันทึกข้อมูล Pre-assy สำเร็จ", "success");
    } catch (error) {
        console.error("Pre-assy submit failed", error);
        showToast?.("บันทึกข้อมูล Pre-assy ไม่สำเร็จ", "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "💾 บันทึกข้อมูล Pre-assy"; }
    }
}

window.initPreAssyForm = initPreAssyForm;
window.renderPreAssyProductGroups = renderPreAssyProductGroups;
window.addPreAssyRecord = addPreAssyRecord;
window.removePreAssyRecord = removePreAssyRecord;
window.addPreAssyDefectRow = addPreAssyDefectRow;
window.removePreAssyDefectRow = removePreAssyDefectRow;
window.refreshPreAssyHistory = refreshPreAssyHistory;
window.submitPreAssyReport = submitPreAssyReport;
