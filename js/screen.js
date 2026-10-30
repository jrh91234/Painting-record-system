// SCREEN production form. It intentionally mirrors the daily production
// form while writing to and reading from the dedicated SCREEN sheet.

let screenDraftRecords = [];
let screenHistoryRecords = [];
let screenFormInitialized = false;
let screenCatalogListenersBound = false;
let screenDashboardChartInstance = null;
let screenDashboardRecordsCache = null;
let screenDashboardLoadPromise = null;
let screenDashboardLoadToken = 0;

const SCREEN_DRAFT_KEY = "PAINTING_SCREEN_DRAFT";

function screenToday() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function screenEsc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function screenNum(id) {
    const value = Number(document.getElementById(id)?.value);
    return Number.isFinite(value) && value >= 0 ? value : 0;
}

function screenCatalog() {
    const groups = (typeof PAINTING_MODEL_GROUPS !== "undefined" && PAINTING_MODEL_GROUPS) || window.PAINTING_MODEL_GROUPS || {};
    const sharedOrder = (typeof PAINTING_PRODUCT_GROUP_ORDER !== "undefined" && PAINTING_PRODUCT_GROUP_ORDER) || window.PAINTING_PRODUCT_GROUP_ORDER;
    const order = Array.isArray(sharedOrder)
        ? sharedOrder
        : Object.keys(groups);
    return { groups, order };
}

function screenOptions(selectId, options, placeholder) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const current = select.value;
    const includeAddOption = selectId === "scModel";
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    const visibleOptions = (Array.isArray(options) ? options : []).filter(option => {
        const label = String(typeof option === "string" ? option : (option?.label ?? option?.value ?? option?.code ?? ""))
            .replace(/\s+/g, " ").trim().toUpperCase();
        return !(label === "BRU30890 (BRU30892)"
            || (label.includes("BRU30890") && label.includes("BRU30892") && !label.includes("METAL COVER")));
    });
    select.innerHTML = `<option value="">${screenEsc(placeholder)}</option>` + visibleOptions.map(option => {
        const value = typeof option === "string" ? option : (option.value ?? option.code ?? "");
        const label = typeof option === "string" ? option : (option.label ?? option.value ?? option.code ?? "");
        return `<option value="${screenEsc(value)}">${screenEsc(label)}</option>`;
    }).join("") + (includeAddOption ? `<option value="${screenEsc(addValue)}">➕ เพิ่มรายการ</option>` : "");
    if (visibleOptions.some(option => String(typeof option === "string" ? option : (option.value ?? option.code ?? "")) === String(current))) {
        select.value = current;
    }
}

// Like the daily production form, SCREEN asks only for the product group
// and the part (Capacity's ProductGroup, PartCode and PartName). Only the
// covers of the NMS and CU groups go through the screen line; the Capacity
// sheet spells NMS as "MNS", so both spellings are accepted.
function isScreenProductGroup(name) {
    const key = String(name || "").replace(/\s+/g, "").toUpperCase();
    return key === "NMS" || key === "MNS" || key.startsWith("CU");
}

function screenGroupParts(group) {
    return Object.values(screenCatalog().groups[group]?.categories || {}).flat()
        .filter(item => /COVER/i.test(String(item?.label ?? item ?? "")));
}

function handleScreenModelSelect(select) {
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    if (!select || select.value !== addValue) return;
    const { groups } = screenCatalog();
    const group = document.getElementById("scProductGroup")?.value || "";
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
    if (screenGroupParts(group).some(item => String(item.value ?? item).trim().toLowerCase() === code.toLowerCase())) {
        showToast?.("มีชิ้นงานนี้อยู่แล้ว", "error");
        renderScreenModels();
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
    renderScreenModels();
    select.value = code;
    showToast?.("เพิ่มชิ้นงานแล้ว", "success");
}

function renderScreenProductGroups() {
    const { groups, order } = screenCatalog();
    screenOptions("scProductGroup", order.filter(key => groups[key] && isScreenProductGroup(key)), "-- เลือกกลุ่มผลิตภัณฑ์ --");
    renderScreenModels();
}

function renderScreenModels() {
    document.getElementById("scModel")?.setAttribute("onchange", "handleScreenModelSelect(this)");
    const group = document.getElementById("scProductGroup")?.value || "";
    screenOptions("scModel", screenGroupParts(group), group ? "-- เลือกชิ้นงาน (PartCode) PartName --" : "-- เลือกกลุ่มผลิตภัณฑ์ก่อน --");
}

// SCREEN uses the same recorder source and add-name flow as the daily
// production form. The form markup starts with a fallback input for older
// cached builds; convert it to the shared dropdown when the form is mounted.
function ensureScreenRecorderSelect() {
    const current = document.getElementById("scRecorder");
    if (!current) return null;
    if (current.tagName !== "SELECT") {
        const select = document.createElement("select");
        select.id = "scRecorder";
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

function renderScreenRecorderDropdownUI() {
    const select = ensureScreenRecorderSelect();
    if (!select) return;
    const current = select.value;
    const recorders = typeof PAINTING_RECORDERS_LIST !== "undefined"
        ? PAINTING_RECORDERS_LIST
        : (Array.isArray(window.PAINTING_RECORDERS_LIST) ? window.PAINTING_RECORDERS_LIST : []);
    let html = '<option value="">-- เลือกผู้บันทึก --</option>';
    recorders.forEach(name => {
        html += `<option value="${screenEsc(name)}">${screenEsc(name)}</option>`;
    });
    html += '<option value="__ADD_NEW__">➕ + เพิ่มรายชื่อผู้บันทึกใหม่...</option>';
    select.innerHTML = html;
    if (current && recorders.includes(current)) select.value = current;
}

// Match the daily production form: numeric boxes start empty and show 0 as a
// placeholder. If a browser restores a literal 0, clear it when the user
// focuses the box so the first keystroke does not get appended to zero.
function normalizeScreenNumericInputs() {
    const root = document.getElementById("screenFormRoot");
    if (!root) return;
    root.querySelectorAll('input[type="number"]').forEach(input => {
        if (!input.dataset.screenZeroClearBound) {
            input.dataset.screenZeroClearBound = "1";
            if (!input.getAttribute("placeholder")) input.setAttribute("placeholder", "0");
            input.addEventListener("focus", () => {
                if (input.value === "0") input.value = "";
            });
        }
        if (input.value === "0") input.value = "";
    });
}

function screenFormMarkup() {
    const sharedSlots = (typeof PAINTING_TIMESLOTS !== "undefined" && PAINTING_TIMESLOTS) || window.PAINTING_TIMESLOTS;
    const slots = Array.isArray(sharedSlots) && sharedSlots.length
        ? sharedSlots
        : ["08.00 - 09.00", "09.00 - 10.00", "10.00 - 11.00", "11.00 - 12.00", "12.00 - 13.00", "13.00 - 14.00", "14.00 - 15.00", "15.00 - 16.00", "16.00 - 17.00", "17.00 - 18.00", "18.00 - 19.00", "20.00 - 21.00"];
    return `
        <div class="section-title-bar">
            <div>
                <h1 class="page-title">SCREEN</h1>
                <p class="page-subtitle">แบบฟอร์มบันทึกงานแก้ไข/ทำซ้ำ แยกจากแบบฟอร์มผลิตรายวัน</p>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 1: ข้อมูลการบันทึก SCREEN</h2>
            <div class="dr-grid-3">
                <div class="form-group"><label for="scDate">วันที่</label><input id="scDate" type="date" class="form-control"></div>
                <div class="form-group"><label>กะทำงาน (Shift)</label><div class="dr-radio-pills"><label><input type="radio" name="screenShift" value="Day" checked> ☀️ Day</label><label><input type="radio" name="screenShift" value="Night"> 🌙 Night</label></div></div>
                <div class="form-group"><label for="scRecorder">ผู้บันทึก</label><input id="scRecorder" class="form-control" type="text" placeholder="ระบุชื่อผู้บันทึก"></div>
            </div>
        </div>

        <div class="dr-card rework-form-card">
            <h2 class="dr-section-title">ส่วนที่ 2: รายการผลิตและของเสีย</h2>
            <div class="dr-grid-2">
                <div class="form-group"><label for="scProductGroup">กลุ่มผลิตภัณฑ์ (ProductGroup)</label><select id="scProductGroup" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ --</option></select></div>
                <div class="form-group"><label for="scModel">ชิ้นงาน (PartCode) PartName</label><select id="scModel" class="form-control"><option value="">-- เลือกกลุ่มผลิตภัณฑ์ก่อน --</option></select></div>
            </div>
            <div class="dr-grid-2">
                <div class="form-group"><label for="scTime">ช่วงเวลา</label><select id="scTime" class="form-control">${slots.map(slot => `<option value="${screenEsc(slot)}">${screenEsc(slot)}</option>`).join("")}</select></div>
                <div class="form-group"><label for="scProdQty">ยอดผลิต (ชิ้น)</label><input id="scProdQty" class="form-control" type="number" min="0" value="0"></div>
            </div>
            <h3 class="dr-subtitle">ของเสีย (Defects)</h3>
            <div class="dr-grid-9 screen-defects-grid">
                ${[["scRust", "สนิม"], ["scDent", "รอยบุบ"], ["scColorDrop", "สะเก็ดรอยเชื่อม"], ["scThinPaint", "สีหนา/สีปูด"], ["scThickPaint", "คราบน้ำ/จาระบี"], ["scWaterStain", "คราบน้ำยา"], ["scOil", "คราบน้ำมัน"], ["scDust", "เศษฝุ่น"], ["scOtherDefect", "อื่นๆ"]].map(([id, label]) => `<div class="form-group"><label for="${id}">${label}</label><input id="${id}" class="form-control" type="number" min="0" value="0"></div>`).join("")}
            </div>
            <div class="rework-form-actions"><button id="screenSubmitButton" type="button" class="btn-primary" onclick="submitScreenReport()">💾 บันทึกข้อมูล SCREEN</button></div>
        </div>

        <div class="dr-card rework-form-card">
            <div class="rework-list-heading">
                <h2 class="dr-section-title">รายการ SCREEN ที่เพิ่ม</h2>
                <div class="rework-list-toolbar">
                    <strong id="screenTotalSummary">0 รายการ</strong>
                    <button type="button" class="rework-refresh-btn" onclick="refreshScreenHistory()">
                        <span class="rework-refresh-icon" aria-hidden="true">↻</span>
                        <span>รีเฟรชประวัติ</span>
                    </button>
                </div>
            </div>
            <div class="table-responsive rework-table-wrap"><table class="data-table rework-history-table"><colgroup><col class="rw-col-date"><col class="rw-col-model"><col class="rw-col-time"><col class="rw-col-color"><col class="rw-col-output"><col class="rw-col-defect"><col class="rw-col-action"></colgroup><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>ช่วงเวลา</th><th>สี</th><th>ยอดผลิต</th><th>ยอดเสีย</th><th>จัดการ</th></tr></thead><tbody id="screenListBody"><tr><td colspan="7" class="empty-state">ยังไม่มีรายการ</td></tr></tbody></table></div>
        </div>`;
}

function initScreenForm() {
    const root = document.getElementById("screenFormRoot");
    if (!root) return;
    if (!screenFormInitialized) {
        root.innerHTML = screenFormMarkup();
        ensureScreenRecorderSelect();
        const date = document.getElementById("scDate");
        if (date) date.value = screenToday();
        screenFormInitialized = true;
        try {
            const saved = JSON.parse(localStorage.getItem(SCREEN_DRAFT_KEY) || "[]");
            if (Array.isArray(saved)) screenDraftRecords = saved;
        } catch (_) { screenDraftRecords = []; }
        document.getElementById("scProductGroup")?.addEventListener("change", renderScreenModels);
        renderScreenProductGroups();
        renderScreenRecorderDropdownUI();
        normalizeScreenNumericInputs();
        if (typeof renderStaffDropdowns === "function") renderStaffDropdowns();
    } else if (typeof window.renderScreenList === "function") {
        renderScreenList();
    }
}

function addScreenRecord() {
    const model = document.getElementById("scModel")?.value || "";
    const addValue = typeof PAINTING_ADD_MODEL_VALUE !== "undefined" ? PAINTING_ADD_MODEL_VALUE : "__ADD_MODEL__";
    if (!model || model === addValue) return showToast?.("กรุณาเลือกชิ้นงานก่อนเพิ่มรายการ", "error");
    const productGroup = document.getElementById("scProductGroup")?.value || "";
    // Kept in the record for the sheet's PartCategory column.
    const partCategory = Object.entries(screenCatalog().groups[productGroup]?.categories || {})
        .find(([, models]) => (models || []).some(item => String(item.value ?? item) === model))?.[0] || "";
    const record = {
        productGroup, partCategory,
        model, color: "", colorCode: "",
        timeSlot: document.getElementById("scTime")?.value || "", prodQty: screenNum("scProdQty"),
        rust: screenNum("scRust"), dent: screenNum("scDent"), colorDrop: screenNum("scColorDrop"),
        thinPaint: screenNum("scThinPaint"), thickPaint: screenNum("scThickPaint"), waterStain: screenNum("scWaterStain"),
        oil: screenNum("scOil"), dust: screenNum("scDust"), otherDefect: screenNum("scOtherDefect")
    };
    record.totalDefect = record.rust + record.dent + record.colorDrop + record.thinPaint + record.thickPaint + record.waterStain + record.oil + record.dust + record.otherDefect;
    if (record.prodQty <= 0 && record.totalDefect <= 0) return showToast?.("กรุณาระบุยอดผลิตหรือยอดเสียอย่างน้อยหนึ่งรายการ", "error");
    record.date = document.getElementById("scDate")?.value || screenToday();
    screenDraftRecords.push(record);
    localStorage.setItem(SCREEN_DRAFT_KEY, JSON.stringify(screenDraftRecords));
    renderScreenList();
    ["scProdQty", "scRust", "scDent", "scColorDrop", "scThinPaint", "scThickPaint", "scWaterStain", "scOil", "scDust", "scOtherDefect"].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    showToast?.("เพิ่มรายการ SCREEN แล้ว", "success");
}

function removeScreenRecord(index) {
    screenDraftRecords.splice(index, 1);
    localStorage.setItem(SCREEN_DRAFT_KEY, JSON.stringify(screenDraftRecords));
    renderScreenList();
}

// Show the most recently saved SCREEN row first. Older rows may not have a
// timestamp, so fall back to the date and first time in the selected slot.
function screenHistorySortValue(row) {
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

function sortScreenHistoryLatestFirst(records) {
    return (Array.isArray(records) ? records : [])
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            const byDate = screenHistorySortValue(b.row) - screenHistorySortValue(a.row);
            return byDate || (b.index - a.index);
        })
        .map(item => item.row);
}

function renderScreenList() {
    const body = document.getElementById("screenListBody");
    if (!body) return;
    const rows = screenDraftRecords.length
        ? screenDraftRecords
        : sortScreenHistoryLatestFirst(screenHistoryRecords).slice(0, 5);
    const summary = document.getElementById("screenTotalSummary");
    if (summary) summary.textContent = `${rows.length} รายการ`;
    if (!rows.length) { body.innerHTML = `<tr><td colspan="7" class="empty-state">ยังไม่มีรายการ</td></tr>`; return; }
    body.innerHTML = rows.map((row, index) => `<tr><td>${screenEsc(row.date || "-")}</td><td>${screenEsc(row.model || "-")}</td><td>${screenEsc(row.timeSlot || "-")}</td><td>${screenEsc(row.color || "ไม่ระบุ")}</td><td>${Number(row.prodQty) || 0}</td><td>${Number(row.totalDefect) || 0}</td><td>${screenDraftRecords.length ? `<button type="button" class="btn-danger" onclick="removeScreenRecord(${index})">ลบ</button>` : "บันทึกแล้ว"}</td></tr>`).join("");
}

async function refreshScreenHistory() {
    const body = document.getElementById("screenListBody");
    if (body && !screenDraftRecords.length) body.innerHTML = `<tr><td colspan="7" class="empty-state">กำลังโหลดประวัติ SCREEN...</td></tr>`;
    try {
        screenHistoryRecords = sortScreenHistoryLatestFirst(await fetchScreenReportDataFromAPI());
        screenDashboardRecordsCache = screenHistoryRecords.slice();
        renderScreenList();
    } catch (error) {
        console.error("SCREEN history load failed", error);
        if (body && !screenDraftRecords.length) body.innerHTML = `<tr><td colspan="7" class="empty-state error-text">โหลดประวัติ SCREEN ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง</td></tr>`;
    }
}

function screenDashboardDateKey(value) {
    const raw = String(value == null ? "" : value).trim();
    if (!raw) return "";
    const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
    const thai = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (thai) return `${thai[3]}-${thai[2].padStart(2, "0")}-${thai[1].padStart(2, "0")}`;
    return "";
}

function screenDashboardDateLabel(dateKey) {
    const parts = String(dateKey || "").split("-");
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateKey;
}

function screenDashboardDefectTotal(row) {
    const fields = ["rust", "dent", "colorDrop", "thinPaint", "thickPaint", "waterStain", "oil", "dust", "otherDefect"];
    const calculated = fields.reduce((sum, field) => sum + (Number(row && row[field]) || 0), 0);
    return Math.max(Number(row && row.totalDefect) || 0, calculated);
}

function renderScreenDashboardChart(records) {
    const canvas = document.getElementById("screenDailyChart");
    if (!canvas || typeof Chart === "undefined") return;

    const range = typeof getDashboardDateRange === "function"
        ? getDashboardDateRange()
        : { start: "", end: "" };
    const adjustedRecords = typeof applyRTVAdjustments === "function" ? applyRTVAdjustments(records, "SCREEN") : (Array.isArray(records) ? records : []);
    const grouped = new Map();

    adjustedRecords.forEach(row => {
        const dateKey = screenDashboardDateKey(row && (row.date || row.Date));
        if (!dateKey) return;
        if (range.start && dateKey < range.start) return;
        if (range.end && dateKey > range.end) return;
        if (!grouped.has(dateKey)) grouped.set(dateKey, { output: 0, defects: 0, reports: 0 });
        const daily = grouped.get(dateKey);
        daily.output += Number(row && row.prodQty) || 0;
        daily.defects += screenDashboardDefectTotal(row);
        daily.reports += 1;
    });

    const dates = [...grouped.keys()].sort();
    const output = dates.map(date => grouped.get(date).output);
    const defects = dates.map(date => grouped.get(date).defects);
    const outputTotal = output.reduce((sum, value) => sum + value, 0);
    const defectTotal = defects.reduce((sum, value) => sum + value, 0);
    const outputSummary = document.getElementById("dashboardScreenTotal");
    const defectSummary = document.getElementById("dashboardScreenDefectTotal");
    const empty = document.getElementById("screenDailyChartEmpty");
    if (outputSummary) outputSummary.textContent = outputTotal.toLocaleString("th-TH");
    if (defectSummary) defectSummary.textContent = defectTotal.toLocaleString("th-TH");
    if (empty) {
        // The empty-state element has a grid display rule, so setting only
        // the hidden attribute can leave it painted over a valid chart in
        // some browsers. Keep the two states explicit and mutually exclusive.
        const hasData = dates.length > 0;
        empty.hidden = hasData;
        empty.style.display = hasData ? "none" : "grid";
        empty.textContent = "ยังไม่มีข้อมูล SCREEN ในช่วงวันที่ที่เลือก";
    }
    canvas.style.visibility = dates.length ? "visible" : "hidden";

    if (screenDashboardChartInstance) screenDashboardChartInstance.destroy();
    screenDashboardChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: dates.map(screenDashboardDateLabel),
            datasets: [
                {
                    type: "bar",
                    label: "ยอด SCREEN (ชิ้น)",
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
                    label: "ของเสียจากงาน SCREEN (ชิ้น)",
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

async function loadScreenDashboardChart(forceRefresh = false) {
    if (!document.getElementById("screenDailyChart")) return;
    const token = ++screenDashboardLoadToken;
    if (forceRefresh) screenDashboardRecordsCache = null;
    try {
        if (!screenDashboardRecordsCache) {
            if (!screenDashboardLoadPromise) {
                // Dashboard statistics must use the reviewed history, just like
                // the daily and REWORK dashboard charts. The default API scope
                // is pending, which is empty after SCREEN rows are reviewed.
                screenDashboardLoadPromise = fetchScreenReportDataFromAPI("", { scope: "reviewed" })
                    .then(rows => Array.isArray(rows) ? rows : [])
                    .finally(() => { screenDashboardLoadPromise = null; });
            }
            screenDashboardRecordsCache = await screenDashboardLoadPromise;
        }
        if (token !== screenDashboardLoadToken) return;
        renderScreenDashboardChart(screenDashboardRecordsCache);
    } catch (error) {
        console.error("SCREEN dashboard chart load failed", error);
        const empty = document.getElementById("screenDailyChartEmpty");
        if (empty) {
            empty.hidden = false;
            empty.style.display = "grid";
            empty.textContent = "โหลดข้อมูล SCREEN ไม่สำเร็จ กรุณากดปุ่มรีเฟรช";
        }
    }
}

async function submitScreenReport() {
    if (!screenDraftRecords.length) addScreenRecord();
    if (!screenDraftRecords.length) return;
    const records = screenDraftRecords.map(record => ({ ...record }));
    const payload = {
        action: "submitScreenReport", submissionId: `sc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date: document.getElementById("scDate")?.value || screenToday(),
        shift: document.querySelector('input[name="screenShift"]:checked')?.value || "Day",
        recorder: document.getElementById("scRecorder")?.value?.trim() || "",
        checker: "", records
    };
    if (!payload.recorder) return showToast?.("กรุณาระบุชื่อผู้บันทึก", "error");
    const button = document.getElementById("screenSubmitButton");
    if (button) { button.disabled = true; button.textContent = "กำลังบันทึก..."; }
    try {
        await sendScreenReportToAPI(payload);
        screenDraftRecords = [];
        localStorage.removeItem(SCREEN_DRAFT_KEY);
        await refreshScreenHistory();
        showToast?.("บันทึกข้อมูล SCREEN สำเร็จ", "success");
    } catch (error) {
        console.error("SCREEN submit failed", error);
        showToast?.("บันทึกข้อมูล SCREEN ไม่สำเร็จ", "error");
    } finally {
        if (button) { button.disabled = false; button.textContent = "💾 บันทึกข้อมูล SCREEN"; }
    }
}

window.initScreenForm = initScreenForm;
window.addScreenRecord = addScreenRecord;
window.removeScreenRecord = removeScreenRecord;
window.renderScreenList = renderScreenList;
window.refreshScreenHistory = refreshScreenHistory;
window.submitScreenReport = submitScreenReport;
window.loadScreenDashboardChart = loadScreenDashboardChart;

document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const dashboard = document.getElementById("dashboard-tab");
        if (dashboard && dashboard.classList.contains("active")) loadScreenDashboardChart();
    }, 0);
});
