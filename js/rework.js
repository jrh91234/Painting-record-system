// REWORK production form. It intentionally mirrors the daily production
// form while writing to and reading from the dedicated REWORK sheet.

let reworkDraftRecords = [];
let reworkHistoryRecords = [];
let reworkFormInitialized = false;
let reworkCatalogListenersBound = false;
let reworkDashboardChartInstance = null;
let reworkDashboardRecordsCache = null;
let reworkDashboardLoadPromise = null;
let reworkDashboardLoadToken = 0;

const REWORK_DRAFT_KEY = "PAINTING_REWORK_DRAFT";

function reworkToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function reworkEsc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function reworkNum(id) {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function reworkCatalog() {
    const groups = (typeof PAINTING_MODEL_GROUPS !== "undefined" && PAINTING_MODEL_GROUPS) || window.PAINTING_MODEL_GROUPS || {};
    const sharedOrder = (typeof PAINTING_PRODUCT_GROUP_ORDER !== "undefined" && PAINTING_PRODUCT_GROUP_ORDER) || window.PAINTING_PRODUCT_GROUP_ORDER;
    const order = Array.isArray(sharedOrder)
        ? sharedOrder
        : Object.keys(groups);
    return { groups, order };
}

function reworkOptions(selectId, options, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    const includeAddOption = selectId === "rwModel";
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    select.innerHTML = `<option value="">${reworkEsc(placeholder)}</option>` + options.map(option => {
        const value = typeof option === "string" ? option : (option.value ?? option.code ?? "");
        const label = typeof option === "string" ? option : (option.label ?? option.value ?? option.code ?? "");
        return `<option value="${reworkEsc(value)}">${reworkEsc(label)}</option>`;
    }).join("") + (includeAddOption ? `<option value="${reworkEsc(addValue)}">➕ เพิ่มรายการ</option>` : "");
    if (options.some(option => String(typeof option === "string" ? option : (option.value ?? option.code ?? "")) === String(current))) {
        select.value = current;
    }
}

// Like the daily production form, REWORK asks only for the product group
// and the part (Capacity's ProductGroup, PartCode and PartName).
function reworkGroupParts(group) {
    return Object.values(reworkCatalog().groups[group]?.categories || {}).flat();
}

function handleReworkModelSelect(select) {
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    if (!select || select.value !== addValue) return;
    const { groups } = reworkCatalog();
    const group = document.getElementById("rwProductGroup")?.value || "";
    const categories = groups[group]?.categories;
    if (!categories) {
        select.value = "";
        return;
    }

    const code = String(window.prompt("PartCode ของชิ้นงานใหม่") || "").trim();
    if (!code) {
        select.value = "";
        return;
    }
    if (reworkGroupParts(group).some(item => String(item.value ?? item).trim().toLowerCase() === code.toLowerCase())) {
        showToast?.("มีชิ้นงานนี้อยู่แล้ว", "error");
        renderReworkModels();
        select.value = code;
        return;
    }
    const name = String(window.prompt("PartName ของชิ้นงานใหม่") || "").trim();

    // Capacity lists a part without a PartCategory under its PartName.
    const category = name || code;
    if (!categories[category]) categories[category] = [];
    categories[category].push({ value: code, label: name ? `(${code}) ${name}` : code });
    try {
        if (typeof PAINTING_PRODUCT_CATALOG_CACHE !== "undefined") {
            localStorage.setItem(PAINTING_PRODUCT_CATALOG_CACHE, JSON.stringify(groups));
        }
    } catch (_) {}
    if (typeof saveCatalogEntryToSheet === "function") saveCatalogEntryToSheet({ group, category, code, name });
    renderReworkModels();
    select.value = code;
    showToast?.("เพิ่มชิ้นงานแล้ว", "success");
}

function renderReworkProductGroups() {
    const { groups, order } = reworkCatalog();
    reworkOptions("rwProductGroup", order.filter(key => groups[key]), "-- เลือกกลุ่มผลิตภัณฑ์ --");
    renderReworkModels();
}

function renderReworkModels() {
    document.getElementById("rwModel")?.setAttribute("onchange", "handleReworkModelSelect(this)");
    const group = document.getElementById("rwProductGroup")?.value || "";
    reworkOptions("rwModel", reworkGroupParts(group), group ? "-- เลือกชิ้นงาน (PartCode) PartName --" : "-- เลือกกลุ่มผลิตภัณฑ์ก่อน --");
}

// REWORK uses the same recorder source and add-name flow as the daily
// production form. The form markup starts with a fallback input for older
// cached builds; convert it to the shared dropdown when the form is mounted.
function ensureReworkRecorderSelect() {
    const current = document.getElementById("rwRecorder");
    if (!current) return null;
    if (current.tagName !== "SELECT") {
        const select = document.createElement("select");
        select.id = "rwRecorder";
        select.className = current.className || "form-control";
        select.required = true;
        select.setAttribute("onchange", "handleStaffSelectChange(this, 'recorder')");
        current.replaceWith(select);
        return select;
    }
    current.required = true;
    current.setAttribute("onchange", "handleStaffSelectChange(this, 'recorder')");
    return current;
}

function renderReworkRecorderDropdownUI() {
    const select = ensureReworkRecorderSelect();
    if (!select) return;
    const current = select.value;
    const recorders = typeof PAINTING_RECORDERS_LIST !== "undefined"
        ? PAINTING_RECORDERS_LIST
        : (Array.isArray(window.PAINTING_RECORDERS_LIST) ? window.PAINTING_RECORDERS_LIST : []);
    let html = '<option value="">-- เลือกผู้บันทึก --</option>';
    recorders.forEach(name => {
        html += `<option value="${reworkEsc(name)}">${reworkEsc(name)}</option>`;
    });
    html += '<option value="__ADD_NEW__">➕ + เพิ่มรายชื่อผู้บันทึกใหม่...</option>';
    select.innerHTML = html;
    if (current && recorders.includes(current)) select.value = current;
}

// Match the daily production form: numeric boxes start empty and show 0 as a
// placeholder. If a browser restores a literal 0, clear it when the user
// focuses the box so the first keystroke does not get appended to zero.
function normalizeReworkNumericInputs() {
    const root = document.getElementById("reworkFormRoot");
    if (!root) return;
    root.querySelectorAll('input[type="number"]').forEach(input => {
        if (!input.dataset.reworkZeroClearBound) {
            input.dataset.reworkZeroClearBound = "1";
            if (!input.getAttribute("placeholder")) input.setAttribute("placeholder", "0");
            input.addEventListener("focus", () => {
                if (input.value === "0") input.value = "";
            });
        }
        if (input.value === "0") input.value = "";
    });
}

function reworkFormMarkup() {
    const sharedSlots = (typeof PAINTING_TIMESLOTS !== "undefined" && PAINTING_TIMESLOTS) || window.PAINTING_TIMESLOTS;
    const slots = Array.isArray(sharedSlots) && sharedSlots.length
        ? sharedSlots
        : ["08.00 - 09.00", "09.00 - 10.00", "10.00 - 11.00", "11.00 - 12.00", "12.00 - 13.00", "13.00 - 14.00", "14.00 - 15.00", "15.00 - 16.00", "16.00 - 17.00", "17.00 - 18.00", "18.00 - 19.00", "20.00 - 21.00"];
    return `
        <div class="section-title-bar">
            <div>
                <h1 class="page-title">REWORK</h1>
                <p class="page-subtitle">แบบฟอร์มบันทึกงานแก้ไข/ทำซ้ำ แยกจากแบบฟอร์มผลิตรายวัน</p>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 1: ข้อมูลการบันทึก REWORK</h2>
            <div class="dr-grid-3">
                <div class="form-group"><label for="rwDate">วันที่</label><input id="rwDate" type="date" class="form-control"></div>
                <div class="form-group"><label>กะทำงาน (Shift)</label><div class="dr-radio-pills"><label><input type="radio" name="reworkShift" value="Day" checked> ☀️ Day</label><label><input type="radio" name="reworkShift" value="Night"> 🌙 Night</label></div></div>
                <div class="form-group"><label for="rwRecorder">ผู้บันทึก</label><input id="rwRecorder" class="form-control" type="text" placeholder="ระบุชื่อผู้บันทึก"></div>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 2: รายการผลิตและของเสีย</h2>
            <div class="dr-grid-2">
                <div class="form-group"><label for="rwProductGroup">กลุ่มผลิตภัณฑ์ (ProductGroup)</label><select id="rwProductGroup" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ --</option></select></div>
                <div class="form-group"><label for="rwModel">ชิ้นงาน (PartCode) PartName</label><select id="rwModel" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ก่อน --</option></select></div>
            </div>
            <div class="dr-grid-2">
                <div class="form-group"><label for="rwTime">ช่วงเวลา</label><select id="rwTime" class="form-control">${slots.map(slot => `<option value="${reworkEsc(slot)}">${reworkEsc(slot)}</option>`).join("")}</select></div>
                <div class="form-group"><label for="rwProdQty">ยอดผลิต (ชิ้น)</label><input id="rwProdQty" class="form-control" type="number" min="0" value="0"></div>
            </div>
            <h3 class="dr-subtitle">ของเสีย (Defects)</h3>
            <div class="dr-grid-9 rework-defects-grid">
                ${[["rwRust", "สนิม"], ["rwDent", "รอยบุบ"], ["rwColorDrop", "สะเก็ดรอยเชื่อม"], ["rwThinPaint", "สีหนา/สีปูด"], ["rwThickPaint", "คราบน้ำ/จาระบี"], ["rwWaterStain", "คราบน้ำยา"], ["rwOil", "คราบน้ำมัน"], ["rwDust", "เศษฝุ่น"], ["rwOtherDefect", "อื่นๆ"]].map(([id, label]) => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="number" min="0" value="0"></div>`).join("")}
            </div>
            <div class="rework-form-actions"><button id="reworkSubmitButton" type="button" class="btn-primary" onclick="submitReworkReport()">💾 บันทึกข้อมูล REWORK</button></div>
        </div>

        <div class="dr-card rework-form-card">
            <div class="rework-list-heading">
                <h2 class="dr-section-title">รายการ REWORK ที่เพิ่ม</h2>
                <div class="rework-list-toolbar">
                    <strong id="reworkTotalSummary">0 รายการ</strong>
                    <button type="button" class="rework-refresh-btn" onclick="refreshReworkHistory()">
                        <span class="rework-refresh-icon" aria-hidden="true">↻</span>
                        <span>รีเฟรชประวัติ</span>
                    </button>
                </div>
            </div>
            <div class="table-responsive rework-table-wrap"><table class="data-table rework-history-table"><colgroup><col class="rw-col-date"><col class="rw-col-model"><col class="rw-col-time"><col class="rw-col-group"><col class="rw-col-partname"><col class="rw-col-output"><col class="rw-col-defect"><col class="rw-col-action"></colgroup><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>ช่วงเวลา</th><th>ProductGroup</th><th>PartName</th><th>ยอดผลิต</th><th>ยอดเสีย</th><th>จัดการ</th></tr></thead><tbody id="reworkListBody"><tr><td colspan="8" class="empty-state">ยังไม่มีรายการ</td></tr></tbody></table></div>
        </div>`;
}

function initReworkForm() {
    const root = document.getElementById("reworkFormRoot");
    if (!root) return;
    if (!reworkFormInitialized) {
        root.innerHTML = reworkFormMarkup();
        ensureReworkRecorderSelect();
        const date = document.getElementById("rwDate");
        if (date) date.value = reworkToday();
        reworkFormInitialized = true;
        try {
            const saved = JSON.parse(localStorage.getItem(REWORK_DRAFT_KEY) || "[]");
            if (Array.isArray(saved)) reworkDraftRecords = saved;
        } catch (_) { reworkDraftRecords = []; }
        document.getElementById("rwProductGroup")?.addEventListener("change", renderReworkModels);
        renderReworkProductGroups();
        renderReworkRecorderDropdownUI();
        normalizeReworkNumericInputs();
        if (typeof renderStaffDropdowns === "function") renderStaffDropdowns();
    } else if (typeof window.renderReworkList === "function") {
        renderReworkList();
    }
}

function addReworkRecord() {
    const model = document.getElementById("rwModel")?.value || "";
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    if (!model || model === addValue) return showToast?.("กรุณาเลือกชิ้นงานก่อนเพิ่มรายการ", "error");
    const productGroup = document.getElementById("rwProductGroup")?.value || "";
    // Kept in the record for the sheet's PartCategory column.
    const partCategory = Object.entries(reworkCatalog().groups[productGroup]?.categories || {})
        .find(([, models]) => (models || []).some(item => String(item.value ?? item) === model))?.[0] || "";
    const record = {
        productGroup, partCategory,
        model, color: "", colorCode: "",
        timeSlot: document.getElementById("rwTime")?.value || "", prodQty: reworkNum("rwProdQty"),
        rust: reworkNum("rwRust"), dent: reworkNum("rwDent"), colorDrop: reworkNum("rwColorDrop"),
        thinPaint: reworkNum("rwThinPaint"), thickPaint: reworkNum("rwThickPaint"), waterStain: reworkNum("rwWaterStain"),
        oil: reworkNum("rwOil"), dust: reworkNum("rwDust"), otherDefect: reworkNum("rwOtherDefect")
    };
    record.totalDefect = record.rust + record.dent + record.colorDrop + record.thinPaint + record.thickPaint + record.waterStain + record.oil + record.dust + record.otherDefect;
    if (record.prodQty <= 0 && record.totalDefect <= 0) return showToast?.("กรุณาระบุยอดผลิตหรือยอดเสียอย่างน้อยหนึ่งรายการ", "error");
    record.date = document.getElementById("rwDate")?.value || reworkToday();
    reworkDraftRecords.push(record);
    localStorage.setItem(REWORK_DRAFT_KEY, JSON.stringify(reworkDraftRecords));
    renderReworkList();
    ["rwProdQty", "rwRust", "rwDent", "rwColorDrop", "rwThinPaint", "rwThickPaint", "rwWaterStain", "rwOil", "rwDust", "rwOtherDefect"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    showToast?.("เพิ่มรายการ REWORK แล้ว", "success");
}

function removeReworkRecord(index) {
    reworkDraftRecords.splice(index, 1);
    localStorage.setItem(REWORK_DRAFT_KEY, JSON.stringify(reworkDraftRecords));
    renderReworkList();
}

// Put the newest saved REWORK row at the top of the history table. Use the
// sheet timestamp when available, with date and the first time in the slot as
// a fallback for older records.
function reworkHistorySortValue(row) {
    const timestamp = String(row?.timestamp ?? row?.createdAt ?? row?.created ?? "").trim();
    const direct = Date.parse(timestamp.replace(/\//g, "-"));
    if (Number.isFinite(direct)) return direct;

    const rawDate = String(row?.date ?? row?.Date ?? "").trim();
    let year;
    let month;
    let day;
    let dateMatch = rawDate.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (dateMatch) {
        year = Number(dateMatch[1]);
        month = Number(dateMatch[2]);
        day = Number(dateMatch[3]);
    } else {
        dateMatch = rawDate.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
        if (!dateMatch) return 0;
        day = Number(dateMatch[1]);
        month = Number(dateMatch[2]);
        year = Number(dateMatch[3]);
    }

    const slotMatch = String(row?.timeSlot ?? row?.time ?? "").match(/(\d{1,2})[.:](\d{2})/);
    const hour = slotMatch ? Number(slotMatch[1]) : 0;
    const minute = slotMatch ? Number(slotMatch[2]) : 0;
    return Date.UTC(year, month - 1, day, hour, minute);
}

function sortReworkHistoryLatestFirst(records) {
    return (Array.isArray(records) ? records : [])
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const byDate = reworkHistorySortValue(b.row) - reworkHistorySortValue(a.row);
            return byDate || (b.index - a.index);
        })
        .map(item => item.row);
}

function renderReworkList() {
    const body = document.getElementById("reworkListBody");
    if (!body) return;
    const rows = reworkDraftRecords.length
        ? reworkDraftRecords
        : sortReworkHistoryLatestFirst(reworkHistoryRecords).slice(0, 20);
    const summary = document.getElementById("reworkTotalSummary");
    if (summary) summary.textContent = `${rows.length} รายการ`;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="8" class="empty-state">ยังไม่มีรายการ</td></tr>`; return; }
    body.innerHTML = rows.map((row, index) => `<tr><td>${reworkEsc(row.date || "-")}</td><td>${reworkEsc(row.model || "-")}</td><td>${reworkEsc(row.timeSlot || "-")}</td><td>${reworkEsc(getDailyReportProductGroup(row))}</td><td title="${reworkEsc(getDailyReportPartName(row))}">${reworkEsc(getDailyReportPartName(row))}</td><td>${Number(row.prodQty) || 0}</td><td>${Number(row.totalDefect) || 0}</td><td>${reworkDraftRecords.length ? `<button type="button" class="btn-danger" onclick="removeReworkRecord(${index})">ลบ</button>` : savedRecordActions("REWORK", row, "บันทึกแล้ว")}</td></tr>`).join("");
}

async function refreshReworkHistory() {
    const body = document.getElementById("reworkListBody");
    if (body && !reworkDraftRecords.length) body.innerHTML = `<tr><td colspan="8" class="empty-state">กำลังโหลดประวัติ REWORK...</td></tr>`;
    try {
        reworkHistoryRecords = sortReworkHistoryLatestFirst(await fetchReworkReportDataFromAPI());
        reworkDashboardRecordsCache = reworkHistoryRecords.slice();
        renderReworkList();
    } catch (error) {
        console.error("REWORK history load failed", error);
        if (body && !reworkDraftRecords.length) body.innerHTML = `<tr><td colspan="8" class="empty-state error-text">โหลดประวัติ REWORK ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง</td></tr>`;
    }
}

function reworkDashboardDateKey(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const thai = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (thai) return `${thai[3]}-${thai[2].padStart(2, "0")}-${thai[1].padStart(2, "0")}`;
    return "";
}

function reworkDashboardDateLabel(dateKey) {
    const parts = String(dateKey || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
}

function reworkDashboardDefectTotal(row) {
    const fields = ["rust", "dent", "colorDrop", "thinPaint", "thickPaint", "waterStain", "oil", "dust", "otherDefect"];
    const calculated = fields.reduce((sum, field) => sum + (Number(row && row[field]) || 0), 0);
    return Math.max(Number(row && row.totalDefect) || 0, calculated);
}

function renderReworkDashboardChart(records) {
    const canvas = document.getElementById("reworkDailyChart");
    if (!canvas || typeof Chart === "undefined") return;

    const range = typeof getDashboardDateRange === "function"
        ? getDashboardDateRange()
        : { start: "", end: "" };
    const adjustedRecords = typeof applyRTVAdjustments === "function" ? applyRTVAdjustments(records, "REWORK") : (Array.isArray(records) ? records : []);
    const grouped = new Map();

    adjustedRecords.forEach(row => {
        const dateKey = reworkDashboardDateKey(row && (row.date || row.Date));
        if (!dateKey) return;
        if (range.start && dateKey < range.start) return;
        if (range.end && dateKey > range.end) return;
        if (!grouped.has(dateKey)) grouped.set(dateKey, { output: 0, defects: 0, reports: 0 });
        const daily = grouped.get(dateKey);
        daily.output += Number(row && row.prodQty) || 0;
        daily.defects += reworkDashboardDefectTotal(row);
        daily.reports += 1;
    });

    const dates = [...grouped.keys()].sort();
    const output = dates.map(date => grouped.get(date).output);
    const defects = dates.map(date => grouped.get(date).defects);
    const outputTotal = output.reduce((sum, value) => sum + value, 0);
    const defectTotal = defects.reduce((sum, value) => sum + value, 0);
    const outputSummary = document.getElementById("dashboardReworkTotal");
    const defectSummary = document.getElementById("dashboardReworkDefectTotal");
    const empty = document.getElementById("reworkDailyChartEmpty");
    if (outputSummary) outputSummary.textContent = outputTotal.toLocaleString("th-TH");
    if (defectSummary) defectSummary.textContent = defectTotal.toLocaleString("th-TH");
    if (empty) {
        // The empty-state element has a grid display rule, so setting only
        // the hidden attribute can leave it painted over a valid chart in
        // some browsers. Keep the two states explicit and mutually exclusive.
        const hasData = dates.length > 0;
        empty.hidden = hasData;
        empty.style.display = hasData ? "none" : "grid";
        empty.textContent = "ยังไม่มีข้อมูล REWORK ในช่วงวันที่ที่เลือก";
    }
    canvas.style.visibility = dates.length ? "visible" : "hidden";

    if (reworkDashboardChartInstance) reworkDashboardChartInstance.destroy();
    reworkDashboardChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: dates.map(reworkDashboardDateLabel),
            datasets: [
                {
                    type: "bar",
                    label: "ยอด REWORK (ชิ้น)",
                    data: output,
                    backgroundColor: "rgba(56, 189, 248, 0.72)",
                    borderColor: "#38bdf8",
                    borderWidth: 1.5,
                    borderRadius: 7,
                    maxBarThickness: 54,
                    order: 2
                },
                {
                    type: "line",
                    label: "ของเสียจากงาน REWORK (ชิ้น)",
                    data: defects,
                    borderColor: "#fb7185",
                    backgroundColor: "rgba(251, 113, 133, 0.14)",
                    pointBackgroundColor: "#fb7185",
                    pointBorderColor: "#fecdd3",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    borderWidth: 3,
                    tension: 0.32,
                    fill: false,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: false },
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        color: "#e2e8f0",
                        usePointStyle: true,
                        padding: 16,
                        font: { family: "Sarabun", size: window.innerWidth < 640 ? 10 : 12, weight: "700" }
                    }
                },
                tooltip: {
                    callbacks: {
                        afterBody(items) {
                            const index = items && items[0] ? items[0].dataIndex : -1;
                            const date = dates[index];
                            return date && grouped.has(date) ? `จำนวนรายงาน: ${grouped.get(date).reports} รายการ` : "";
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: "#94a3b8", maxRotation: window.innerWidth < 640 ? 45 : 0, minRotation: 0 },
                    grid: { color: "rgba(255,255,255,0.05)" }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "จำนวน (ชิ้น)", color: "#94a3b8" },
                    ticks: { color: "#94a3b8", precision: 0 },
                    grid: { color: "rgba(255,255,255,0.08)" }
                }
            }
        }
    });
}

async function loadReworkDashboardChart(forceRefresh = false) {
    if (!document.getElementById("reworkDailyChart")) return;
    const token = ++reworkDashboardLoadToken;
    if (forceRefresh) reworkDashboardRecordsCache = null;
    try {
        if (!reworkDashboardRecordsCache) {
            if (!reworkDashboardLoadPromise) {
                reworkDashboardLoadPromise = fetchReworkReportDataFromAPI("", { scope: "reviewed" })
                    .then(rows => Array.isArray(rows) ? rows : [])
                    .finally(() => { reworkDashboardLoadPromise = null; });
            }
            reworkDashboardRecordsCache = await reworkDashboardLoadPromise;
        }
        if (token !== reworkDashboardLoadToken) return;
        renderReworkDashboardChart(reworkDashboardRecordsCache);
    } catch (error) {
        console.error("REWORK dashboard chart load failed", error);
        const empty = document.getElementById("reworkDailyChartEmpty");
        if (empty) {
            empty.hidden = false;
            empty.style.display = "grid";
            empty.textContent = "โหลดข้อมูล REWORK ไม่สำเร็จ กรุณากดปุ่มรีเฟรช";
        }
    }
}

async function submitReworkReport() {
    if (!reworkDraftRecords.length) addReworkRecord();
    if (!reworkDraftRecords.length) return;
    const records = reworkDraftRecords.map(record => ({ ...record }));
    const payload = {
        action: "submitReworkReport", submissionId: `rw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: document.getElementById("rwDate")?.value || reworkToday(),
        shift: document.querySelector('input[name="reworkShift"]:checked')?.value || "Day",
        recorder: document.getElementById("rwRecorder")?.value?.trim() || "",
        checker: "", records
    };
    if (!payload.recorder) return showToast?.("กรุณาระบุชื่อผู้บันทึก", "error");
    const button = document.getElementById("reworkSubmitButton");
    if (button) { button.disabled = true; button.textContent = "กำลังบันทึก..."; }
    try {
        await sendReworkReportToAPI(payload);
        reworkDraftRecords = [];
        localStorage.removeItem(REWORK_DRAFT_KEY);
        await refreshReworkHistory();
        showToast?.("บันทึกข้อมูล REWORK สำเร็จ", "success");
    } catch (error) {
        console.error("REWORK submit failed", error);
        showToast?.("บันทึกข้อมูล REWORK ไม่สำเร็จ", "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "💾 บันทึกข้อมูล REWORK"; }
    }
}

window.initReworkForm = initReworkForm;
window.addReworkRecord = addReworkRecord;
window.removeReworkRecord = removeReworkRecord;
window.renderReworkList = renderReworkList;
window.refreshReworkHistory = refreshReworkHistory;
window.submitReworkReport = submitReworkReport;
window.loadReworkDashboardChart = loadReworkDashboardChart;

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const dashboard = document.getElementById("dashboard-tab");
        if (dashboard && dashboard.classList.contains("active")) loadReworkDashboardChart();
    }, 0);
});
