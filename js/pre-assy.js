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
                <div class="form-group"><label for="paDefect">ของเสีย (ชิ้น)</label><input id="paDefect" class="form-control" type="number" min="0" placeholder="0"></div>
            </div>
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
            <div class="table-responsive rework-table-wrap"><table class="data-table rework-history-table"><colgroup><col class="rw-col-date"><col class="rw-col-model"><col class="rw-col-time"><col class="rw-col-color"><col class="rw-col-output"><col class="rw-col-defect"><col class="rw-col-action"></colgroup><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>ช่วงเวลา</th><th>กลุ่ม</th><th>ยอดผลิต</th><th>ยอดเสีย</th><th>จัดการ</th></tr></thead><tbody id="preAssyListBody"><tr><td colspan="7" class="empty-state">ยังไม่มีรายการ</td></tr></tbody></table></div>
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
        document.getElementById("paProductGroup")?.addEventListener("change", renderPreAssyModels);
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
    const record = {
        productGroup, partCategory, model, color: "", colorCode: "",
        timeSlot: document.getElementById("paTime")?.value || "",
        prodQty: preAssyNum("paProdQty"),
        otherDefect: preAssyNum("paDefect")
    };
    record.totalDefect = record.otherDefect;
    if (record.prodQty <= 0 && record.totalDefect <= 0) {
        showToast?.("กรุณาระบุยอดผลิตหรือยอดเสียอย่างน้อยหนึ่งรายการ", "error");
        return false;
    }
    record.date = document.getElementById("paDate")?.value || preAssyToday();
    preAssyDraftRecords.push(record);
    localStorage.setItem(PREASSY_DRAFT_KEY, JSON.stringify(preAssyDraftRecords));
    renderPreAssyList();
    ["paProdQty", "paDefect"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
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
    if (!rows.length) { body.innerHTML = `<tr><td colspan="7" class="empty-state">ยังไม่มีรายการ</td></tr>`; return; }
    body.innerHTML = rows.map((row, index) => `<tr><td>${preAssyEsc(row.date || "-")}</td><td>${preAssyEsc(row.model || "-")}</td><td>${preAssyEsc(row.timeSlot || "-")}</td><td>${preAssyEsc(row.productGroup || "-")}</td><td>${Number(row.prodQty) || 0}</td><td>${Number(row.totalDefect) || 0}</td><td>${drafts ? `<button type="button" class="btn-danger" onclick="removePreAssyRecord(${index})">ลบ</button>` : "บันทึกแล้ว"}</td></tr>`).join("");
}

async function refreshPreAssyHistory() {
    const body = document.getElementById("preAssyListBody");
    if (body && !preAssyDraftRecords.length) body.innerHTML = `<tr><td colspan="7" class="empty-state">กำลังโหลดประวัติ Pre-assy...</td></tr>`;
    try {
        preAssyHistoryRecords = await fetchPreAssyReportDataFromAPI();
        renderPreAssyList();
    } catch (error) {
        console.error("Pre-assy history load failed", error);
        if (body && !preAssyDraftRecords.length) body.innerHTML = `<tr><td colspan="7" class="empty-state error-text">โหลดประวัติ Pre-assy ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง</td></tr>`;
    }
}

async function submitPreAssyReport() {
    // A filled-in row that was not added yet is saved with the others.
    const pendingQty = preAssyNum("paProdQty") > 0 || preAssyNum("paDefect") > 0;
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
window.refreshPreAssyHistory = refreshPreAssyHistory;
window.submitPreAssyReport = submitPreAssyReport;
