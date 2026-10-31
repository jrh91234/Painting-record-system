const PARAMETER_CHECKLIST_SOURCE_ITEMS = [
    { itemNo: 1, process: "แขวนชิ้นงาน", checkItem: "ความเร็วโซ่ลำเลียง", standard: "2-4 m/min" },
    { itemNo: 2, process: "แขวนชิ้นงาน", checkItem: "ตรวจสอบอุปกรณ์แขวน", standard: "อุปกรณ์ถูกต้อง" },
    { itemNo: 3, process: "แขวนชิ้นงาน", checkItem: "จุดแขวนไม่มีสี และตะขอไม่เสียรูป", standard: "ไม่มีสี / ไม่เสียรูป" },
    { itemNo: 4, process: "แขวนชิ้นงาน", checkItem: "โซ่ลำเลียงไม่ผุกร่อนและไม่มีน้ำมันหยด", standard: "ปกติ" },
    { itemNo: 5, process: "ล้างไขมันเบื้องต้น", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 6, process: "ล้างไขมันเบื้องต้น", checkItem: "ค่าความเป็นด่างอิสระ", standard: "15-25" },
    { itemNo: 7, process: "ล้างไขมัน", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 8, process: "ล้างไขมัน", checkItem: "ค่าความเป็นด่างอิสระ", standard: "15-25" },
    { itemNo: 9, process: "ล้างน้ำ 1", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 10, process: "ล้างน้ำ 1", checkItem: "ค่า pH", standard: "7-9" },
    { itemNo: 11, process: "ล้างน้ำ 2", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 12, process: "ล้างน้ำ 2", checkItem: "ค่า pH", standard: "6.5-7.5" },
    { itemNo: 13, process: "เคลือบเซรามิก", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 14, process: "เคลือบเซรามิก", checkItem: "ค่าความเป็นด่างอิสระ", standard: "0.6-1.2" },
    { itemNo: 15, process: "เคลือบเซรามิก", checkItem: "ความเข้มข้นของน้ำยา", standard: "4.8-5.2" },
    { itemNo: 16, process: "ล้างน้ำ 3", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 17, process: "ล้างน้ำ 3", checkItem: "ค่า pH", standard: "7-9" },
    { itemNo: 19, process: "ล้างน้ำ 4", checkItem: "แรงดันทางออกปั๊มหมุนเวียน", standard: "0.05-0.1" },
    { itemNo: 20, process: "ล้างน้ำ 4", checkItem: "ค่า pH", standard: "6-7.5" },
    { itemNo: 21, process: "ล้างน้ำ 4", checkItem: "ค่าการนำไฟฟ้า", standard: "< 150 us/cm" },
    { itemNo: 22, process: "อบแห้ง", checkItem: "อุณหภูมิ", standard: "120-140 °C" },
    { itemNo: 24, process: "อบแห้ง", checkItem: "ตรวจสอบการรั่วของแก๊ส", standard: "ไม่มีการรั่ว" },
    { itemNo: 25, process: "พ่นสีอัตโนมัติ", checkItem: "แรงดันไฟฟ้า", standard: "40-80 KV" },
    { itemNo: 26, process: "พ่นสีอัตโนมัติ", checkItem: "กระแสไฟฟ้า", standard: "40-60 mA" },
    { itemNo: 28, process: "พ่นสีอัตโนมัติ", checkItem: "แรงดันลม", standard: "2-6 M3/H" },
    { itemNo: 29, process: "พ่นสีอัตโนมัติ", checkItem: "ปริมาณการจ่ายผงสี", standard: "40-70" },
    { itemNo: 30, process: "พ่นสีอัตโนมัติ", checkItem: "ระยะห่างปืนพ่นกับชิ้นงาน", standard: "100-300 mm" },
    { itemNo: 31, process: "พ่นสีอัตโนมัติ", checkItem: "มุมระหว่างปืนพ่นกับชิ้นงาน", standard: "90°" },
    { itemNo: 32, process: "อบคิวริ่ง", checkItem: "อุณหภูมิ", standard: "185-210 °C" },
    { itemNo: 34, process: "อบคิวริ่ง", checkItem: "ตรวจสอบการรั่วของแก๊ส", standard: "ไม่มีการรั่ว" },
    { itemNo: 35, process: "อบคิวริ่ง", checkItem: "ตรวจวัดความหนาฟิล์มโดยหน่วยงานภายนอก", standard: "ทุก 2 สัปดาห์" }
];

// แยกรายการข้อ 5-21 ไปอยู่ในเมนู "วัดค่าน้ำ" และเริ่มเลขใหม่ที่ 1
// เพิ่มรายการข้อ 9 โดยใช้รายละเอียดเดียวกับรายการเดิมข้อ 16 แต่ให้กระบวนการเป็น "ล้างน้ำ 2"
// ส่วนเมนูเช็กพารามิเตอร์จะเหลือรายการก่อนข้อ 5 และหลังข้อ 21 แล้วเรียงเลขใหม่เช่นกัน
const WATER_PARAMETER_SOURCE_ITEMS = PARAMETER_CHECKLIST_SOURCE_ITEMS
    .filter(item => item.itemNo >= 5 && item.itemNo <= 21);
const WATER_PARAMETER_INSERT_ITEM = PARAMETER_CHECKLIST_SOURCE_ITEMS.find(item => item.itemNo === 21);
const WATER_PARAMETER_CHECKLIST_ITEMS = [
    ...WATER_PARAMETER_SOURCE_ITEMS.slice(0, 8),
    ...(WATER_PARAMETER_INSERT_ITEM ? [{ ...WATER_PARAMETER_INSERT_ITEM, process: "ล้างน้ำ 2" }] : []),
    ...WATER_PARAMETER_SOURCE_ITEMS.slice(8)
].map((item, index) => ({ ...item, itemNo: index + 1 }));
const PARAMETER_CHECKLIST_ITEMS = PARAMETER_CHECKLIST_SOURCE_ITEMS
    .filter(item => item.itemNo < 5 || item.itemNo > 21)
    .map((item, index) => ({ ...item, itemNo: index + 1 }));
let parameterChecklistMode = "full";

// These full parameter checks are visual/condition checks rather than
// measurements, so the "actual value" field is represented by pass/fail
// buttons. The numbers refer to the displayed numbers in the parameter menu.
const PARAMETER_BOOLEAN_ITEM_NUMBERS = new Set([2, 3, 4, 6, 14, 15]);

function isParameterBooleanItem(displayItemNo) {
    return parameterChecklistMode === "full" && PARAMETER_BOOLEAN_ITEM_NUMBERS.has(displayItemNo);
}

function setParameterActualChoice(itemNo, value, button) {
    const actualInput = document.getElementById(`parameterActual_${itemNo}`);
    const statusInput = document.getElementById(`parameterStatus_${itemNo}`);
    if (actualInput) actualInput.value = value;
    if (statusInput) statusInput.value = value === "ผ่าน" ? "OK" : "NG";

    const group = button?.closest(".parameter-choice-group") || document.querySelector(`[data-parameter-choice-group="${itemNo}"]`);
    group?.querySelectorAll(".parameter-choice-btn").forEach(choice => {
        choice.classList.toggle("is-selected", choice === button || choice.dataset.value === value);
    });
}

function renderParameterActualControl(displayItemNo) {
    if (!isParameterBooleanItem(displayItemNo)) {
        return `<input class="form-control parameter-actual-input" id="parameterActual_${displayItemNo}" placeholder="ค่าที่ตรวจได้">`;
    }

    return `<div class="parameter-choice-group" data-parameter-choice-group="${displayItemNo}" role="group" aria-label="ผลการตรวจข้อ ${displayItemNo}">
        <input type="hidden" class="parameter-actual-input" id="parameterActual_${displayItemNo}" value="ผ่าน">
        <button type="button" class="parameter-choice-btn parameter-choice-pass is-selected" data-value="ผ่าน" onclick="setParameterActualChoice(${displayItemNo}, 'ผ่าน', this)">ผ่าน</button>
        <button type="button" class="parameter-choice-btn parameter-choice-fail" data-value="ไม่ผ่าน" onclick="setParameterActualChoice(${displayItemNo}, 'ไม่ผ่าน', this)">ไม่ผ่าน</button>
    </div>`;
}

function getActiveParameterChecklistItems() {
    return parameterChecklistMode === "water" ? WATER_PARAMETER_CHECKLIST_ITEMS : PARAMETER_CHECKLIST_ITEMS;
}

function setParameterChecklistMode(mode) {
    parameterChecklistMode = mode === "water" ? "water" : "full";
    const page = document.getElementById("parameter-checklist-tab");
    if (page) page.classList.toggle("water-mode", parameterChecklistMode === "water");
    const timeGroup = document.getElementById("parameterChecklistTimeGroup");
    const timeInput = document.getElementById("parameterChecklistTime");
    const isWater = parameterChecklistMode === "water";
    if (timeGroup) timeGroup.style.display = isWater ? "" : "none";
    if (timeInput) timeInput.required = isWater;
}

function parameterChecklistTitle() {
    return parameterChecklistMode === "water" ? "วัดค่าน้ำ" : "รายการตรวจเช็กพารามิเตอร์";
}

let parameterChecklistHistory = [];
let waterParameterChecklistHistory = [];
let parameterChecklistRefreshInFlight = null;
let qcChecklistRefreshInFlight = null;

function parameterChecklistEscape(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
}

function formatParameterChecklistTime(timeValue, timestampValue) {
    const raw = String(timeValue || timestampValue || "").trim();
    if (!raw) return "-";

    const match = raw.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (match) return `${String(match[1]).padStart(2, "0")}:${match[2]}`;

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        return `${String(parsed.getHours()).padStart(2, "0")}:${String(parsed.getMinutes()).padStart(2, "0")}`;
    }
    return "-";
}

function initParameterChecklist() {
    const page = document.getElementById("parameter-checklist-tab");
    if (page) page.classList.toggle("water-mode", parameterChecklistMode === "water");
    const dateInput = document.getElementById("parameterChecklistDate");
    if (dateInput && !dateInput.value) dateInput.value = new Date().toISOString().split("T")[0];
    const timeGroup = document.getElementById("parameterChecklistTimeGroup");
    const timeInput = document.getElementById("parameterChecklistTime");
    const isWater = parameterChecklistMode === "water";
    if (timeGroup) timeGroup.style.display = isWater ? "" : "none";
    if (timeInput) {
        timeInput.required = isWater;
        if (!timeInput.value) {
            const now = new Date();
            timeInput.value = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
        }
    }
    const title = parameterChecklistTitle();
    const pageTitle = document.querySelector("#parameter-checklist-tab .page-title");
    const listTitle = document.querySelector("#parameterChecklistItemsBody")?.closest(".dr-card")?.querySelector("h3");
    const saveButton = document.getElementById("submitParameterChecklistBtn");
    if (pageTitle) pageTitle.textContent = title;
    if (listTitle) listTitle.textContent = parameterChecklistMode === "water" ? "รายการวัดค่าน้ำ" : "รายการตรวจเช็กพารามิเตอร์";
    if (saveButton) saveButton.textContent = `บันทึก${title}`;
    renderParameterChecklistItems();
}

function renderParameterChecklistItems() {
    const body = document.getElementById("parameterChecklistItemsBody");
    if (!body) return;
    body.innerHTML = getActiveParameterChecklistItems().map((item, index) => {
        const displayItemNo = index + 1;
        return `
        <tr>
            <td style="text-align:center; font-weight:800; color:#38bdf8;">${displayItemNo}</td>
            <td>${parameterChecklistEscape(item.process)}</td>
            <td>${parameterChecklistEscape(item.checkItem)}</td>
            <td style="color:#a5f3fc; white-space:nowrap;">${parameterChecklistEscape(item.standard)}</td>
            <td>${renderParameterActualControl(displayItemNo)}</td>
            <td><select class="form-control parameter-status-input" id="parameterStatus_${displayItemNo}">
                <option value="OK" selected>ปกติ (OK)</option>
                <option value="NG">ผิดปกติ (NG)</option>
                <option value="N/A">ไม่เกี่ยวข้อง (N/A)</option>
            </select></td>
            <td><input class="form-control parameter-note-input" id="parameterNote_${displayItemNo}" placeholder="หมายเหตุ"></td>
        </tr>
    `;
    }).join("");
}

function collectParameterChecklistPayload() {
    const date = document.getElementById("parameterChecklistDate")?.value || "";
    const time = parameterChecklistMode === "water" ? (document.getElementById("parameterChecklistTime")?.value || "") : "";
    const operator = document.getElementById("parameterChecklistOperator")?.value.trim() || "";
    const teamLeader = document.getElementById("parameterChecklistLeader")?.value.trim() || "";
    return {
        action: "submitParameterChecklist",
        submissionId: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `parameter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        time,
        operator,
        teamLeader,
        checklistType: parameterChecklistMode,
        records: getActiveParameterChecklistItems().map((item, index) => ({
            itemNo: index + 1,
            process: item.process,
            checkItem: item.checkItem,
            standard: item.standard,
            actualValue: document.getElementById(`parameterActual_${index + 1}`)?.value.trim() || "",
            status: document.getElementById(`parameterStatus_${index + 1}`)?.value || "OK",
            note: document.getElementById(`parameterNote_${index + 1}`)?.value.trim() || ""
        }))
    };
}

async function submitParameterChecklist() {
    const button = document.getElementById("submitParameterChecklistBtn");
    const payload = collectParameterChecklistPayload();
    const title = parameterChecklistTitle();
    if (!payload.date || !payload.operator) {
        showToast("กรุณาระบุวันที่และชื่อผู้ตรวจให้ครบถ้วน", "error");
        return;
    }
    if (button) {
        button.disabled = true;
        button.textContent = `กำลังบันทึก${title}...`;
    }
    try {
        await sendParameterChecklistToAPI(payload);
        showToast(`บันทึก${title}ลง Google Sheets เรียบร้อยแล้ว`, "success");
    } catch (error) {
        showToast(`บันทึก${title}ไม่สำเร็จ: ${error.message}`, "error");
    } finally {
        if (button) {
            button.disabled = false;
            button.textContent = `บันทึก${title}`;
        }
    }
}

function groupParameterChecklistRows(rows) {
    const groups = new Map();
    rows.forEach(row => {
        const key = row.submissionId || `${row.date}|${row.operator}|${row.timestamp}`;
        if (!groups.has(key)) groups.set(key, { ...row, rows: [] });
        groups.get(key).rows.push(row);
    });
    return Array.from(groups.values()).sort((a, b) => String(b.timestamp || b.date).localeCompare(String(a.timestamp || a.date)));
}

function toggleQCChecklistDetail(detailId, button) {
    const row = document.getElementById(detailId);
    if (!row) return;
    const isOpen = row.style.display === "table-row";
    row.dataset.qcDetailExpanded = isOpen ? "false" : "true";
    row.style.display = isOpen ? "none" : "table-row";
    if (button) button.textContent = isOpen ? "ดูรายละเอียด" : "ซ่อนรายละเอียด";
}

function renderQCChecklistDetailRows(rows) {
    return rows.map(row => {
        const item = [row.process, row.checkItem].filter(Boolean).join(" — ") || "-";
        const value = row.actualValue || row.status || "-";
        const status = String(row.status || "-").toUpperCase();
        const statusColor = status === "NG" ? "#e11d48" : status === "OK" ? "#059669" : "#d97706";
        return `<tr>
            <td>${parameterChecklistEscape(row.itemNo || "-")}</td>
            <td>${parameterChecklistEscape(item)}</td>
            <td>${parameterChecklistEscape(row.standard || "-")}</td>
            <td>${parameterChecklistEscape(value)}</td>
            <td style="color:${statusColor}; font-weight:800;">${parameterChecklistEscape(status)}</td>
            <td>${parameterChecklistEscape(row.note || "-")}</td>
        </tr>`;
    }).join("");
}

function renderParameterChecklistHistory(bodyId = "parameterChecklistHistoryBody", rows = parameterChecklistHistory, emptyText = "ยังไม่มีประวัติการตรวจพารามิเตอร์") {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const groups = groupParameterChecklistRows(rows).slice(0, 10);
    const includeDetails = bodyId === "qcParameterChecklistHistoryBody" || bodyId === "qcWaterChecklistHistoryBody";
    const columnCount = includeDetails ? 8 : 7;
    if (!groups.length) {
        body.innerHTML = `<tr><td colspan="${columnCount}" style="text-align:center; color:#94a3b8; padding:1.5rem;">${parameterChecklistEscape(emptyText)}</td></tr>`;
        return;
    }
    body.innerHTML = groups.map((group, index) => {
        const ng = group.rows.filter(row => String(row.status).toUpperCase() === "NG").length;
        const ok = group.rows.filter(row => String(row.status).toUpperCase() === "OK").length;
        const detailPrefix = bodyId === "qcWaterChecklistHistoryBody" ? "water" : "parameter";
        const detailId = `qc-${detailPrefix}-detail-${index}`;
        return `<tr>
            <td class="parameter-history-date">${parameterChecklistEscape(formatDailyReportDate(group.date, group.timestamp))}</td>
            <td class="parameter-history-time">${parameterChecklistEscape(formatParameterChecklistTime(group.time, group.timestamp))}</td>
            <td>${parameterChecklistEscape(group.operator || "-")}</td>
            <td>${parameterChecklistEscape(group.teamLeader || "-")}</td>
            <td style="text-align:center;">${group.rows.length}</td>
            <td style="color:#34d399; text-align:center;">${ok}</td>
            <td style="color:${ng ? "#fb7185" : "#94a3b8"}; text-align:center; font-weight:800;">${ng}</td>
            ${includeDetails ? `<td style="text-align:center;"><button type="button" class="qc-history-detail-button" onclick="toggleQCChecklistDetail('${detailId}', this)">ดูรายละเอียด</button></td>` : ""}
        </tr>${includeDetails ? `<tr id="${detailId}" class="qc-history-detail-row" style="display:none;"><td colspan="8"><div class="qc-history-detail-wrap"><table class="qc-history-detail-table"><thead><tr><th>ข้อ</th><th>รายการตรวจ</th><th>มาตรฐาน</th><th>ค่าที่บันทึก</th><th>ผลตรวจ</th><th>หมายเหตุ</th></tr></thead><tbody>${renderQCChecklistDetailRows(group.rows)}</tbody></table></div></td></tr>` : ""}`;
    }).join("");
    let renderedRowIndex = 0;
    groups.forEach(group => {
        const row = body.rows && body.rows[renderedRowIndex];
        if (row) row.setAttribute("data-qc-record-ref", encodeURIComponent(JSON.stringify({
            timestamp: group.timestamp || "",
            date: group.date || "",
            operator: group.operator || "",
            teamLeader: group.teamLeader || "",
            submissionId: group.submissionId || "",
            checklistType: bodyId === "qcWaterChecklistHistoryBody" ? "water" : "parameter"
        })));
        renderedRowIndex += includeDetails ? 2 : 1;
    });
}

function renderQCChecklistHistories() {
    renderParameterChecklistHistory("qcParameterChecklistHistoryBody", parameterChecklistHistory, "ยังไม่มีประวัติการตรวจพารามิเตอร์");
    renderParameterChecklistHistory("qcWaterChecklistHistoryBody", waterParameterChecklistHistory, "ยังไม่มีประวัติการตรวจน้ำ");
}

function renderQCChecklistHistoryMessage(bodyId, message, isError = false) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const columnCount = bodyId === "qcParameterChecklistHistoryBody" || bodyId === "qcWaterChecklistHistoryBody" || bodyId === "qcEquipmentChecklistHistoryBody" ? 8 : 7;
    body.innerHTML = `<tr><td colspan="${columnCount}" style="text-align:center; color:${isError ? "#fb7185" : "#94a3b8"}; padding:1.5rem;">${parameterChecklistEscape(message)}</td></tr>`;
}

function screenHistoryValue(row, keys, fallback = "") {
    for (const key of keys) {
        if (row && row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") return row[key];
    }
    return fallback;
}

function screenHistoryNumber(row, keys) {
    const value = screenHistoryValue(row, keys, 0);
    const number = Number(String(value).replace(/,/g, ""));
    return Number.isFinite(number) ? number : 0;
}

function screenHistoryDefectTotal(row) {
    const explicit = screenHistoryValue(row, ["totalDefect", "TotalDefect", "totalNG", "ngTotal"], null);
    if (explicit !== null && explicit !== "") return screenHistoryNumber({ value: explicit }, ["value"]);
    return ["rust", "dent", "colorDrop", "thinPaint", "thickPaint", "waterStain", "chemical", "oil", "dust", "otherDefect", "ng", "defects"]
        .reduce((total, key) => total + screenHistoryNumber(row, [key, key.charAt(0).toUpperCase() + key.slice(1)]), 0);
}

function screenHistorySortKey(row) {
    const date = screenHistoryValue(row, ["timestamp", "Timestamp", "date", "Date", "inspectionDate", "recordDate"], "");
    const time = screenHistoryValue(row, ["time", "Time", "timeSlot", "TimeSlot"], "");
    const parsed = Date.parse(`${date} ${time}`);
    return Number.isFinite(parsed) ? parsed : 0;
}

function buildQCHistoryRecordRef(row, kind) {
    return encodeURIComponent(JSON.stringify({
        timestamp: row && (row.timestamp || row.Timestamp) || "",
        date: row && (row.date || row.Date || row.inspectionDate || row.reworkDate || row.recordDate) || "",
        model: screenHistoryValue(row, ["model", "Model", "partNo", "PartNo"], ""),
        timeSlot: screenHistoryValue(row, ["timeSlot", "TimeSlot", "time", "Time"], ""),
        color: screenHistoryValue(row, ["color", "Color", "colour"], ""),
        prodQty: screenHistoryNumber(row, ["prodQty", "ProdQty", "prod_qty", "qty", "quantity"]),
        totalDefect: screenHistoryDefectTotal(row),
        submissionId: row && (row.submissionId || row.SubmissionId) || "",
        productGroup: screenHistoryValue(row, ["productGroup", "ProductGroup", "group"], ""),
        sourceType: kind || ""
    }));
}

function attachQCRecordRefsToHistoryTables(root, tableClass, groups, order) {
    if (!root) return;
    order.forEach(group => {
        const table = Array.from(root.querySelectorAll(`table.${tableClass}`)).find(item => item.dataset.qcGroup === group);
        if (!table) return;
        const detailRows = groups.get(group).slice().sort((a, b) => screenHistorySortKey(b) - screenHistorySortKey(a));
        detailRows.forEach((row, index) => {
            const tableRow = table.tBodies && table.tBodies[0] && table.tBodies[0].rows[index];
            if (tableRow) tableRow.setAttribute("data-qc-record-ref", buildQCHistoryRecordRef(row, tableClass));
        });
    });
}

function renderQCScreenHistoryMessage(message, isError = false) {
    const root = document.getElementById("qcScreenHistoryGroups");
    if (!root) return;
    root.innerHTML = `<div style="text-align:center; color:${isError ? "#fb7185" : "#94a3b8"}; padding:1.5rem;">${parameterChecklistEscape(message)}</div>`;
}

function renderQCScreenHistory(records = []) {
    const root = document.getElementById("qcScreenHistoryGroups");
    if (!root) return;
    const rows = Array.isArray(records) ? records : (Array.isArray(records && records.data) ? records.data : []);
    if (!rows.length) {
        renderQCScreenHistoryMessage("ยังไม่มีรายการ SCREEN ที่รอตรวจ");
        return;
    }
    const groups = new Map();
    rows.forEach(row => {
        const group = String(screenHistoryValue(row, ["productGroup", "ProductGroup", "group"], "ไม่ระบุกลุ่ม")).trim() || "ไม่ระบุกลุ่ม";
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(row);
    });
    const preferred = Array.isArray(window.PAINTING_PRODUCT_GROUP_ORDER) && window.PAINTING_PRODUCT_GROUP_ORDER.length
        ? window.PAINTING_PRODUCT_GROUP_ORDER
        : ["LC600 Classic", "LC600 Visi-smart", "PDB", "CU (resi thai)", "NLC", "NMS"];
    const order = [...groups.keys()].sort((a, b) => {
        const ai = preferred.indexOf(a), bi = preferred.indexOf(b);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "th");
    });
    root.innerHTML = order.map(group => {
        const detailRows = groups.get(group).slice().sort((a, b) => screenHistorySortKey(b) - screenHistorySortKey(a));
        const body = detailRows.map(row => {
            const date = screenHistoryValue(row, ["date", "Date", "inspectionDate", "recordDate", "timestamp", "Timestamp"], "-");
            const time = screenHistoryValue(row, ["timeSlot", "TimeSlot", "time", "Time"], "-");
            const model = screenHistoryValue(row, ["model", "Model", "partNo", "PartNo"], "-");
            const color = screenHistoryValue(row, ["color", "Color", "colour"], "ไม่ระบุ");
            const qty = screenHistoryNumber(row, ["prodQty", "ProdQty", "prod_qty", "qty", "quantity"]);
            const defect = screenHistoryDefectTotal(row);
            const recorder = screenHistoryValue(row, ["recorder", "RecordedBy", "recordedBy", "operator", "Operator"], "-");
            const shownDate = typeof formatDailyReportDate === "function" ? formatDailyReportDate(date) : date;
            const shownTime = typeof formatParameterChecklistTime === "function" ? formatParameterChecklistTime(time) : time;
            return `<tr><td>${parameterChecklistEscape(shownDate)}</td><td>${parameterChecklistEscape(model)}</td><td>${parameterChecklistEscape(shownTime)}</td><td>${parameterChecklistEscape(color)}</td><td style="text-align:center;">${qty}</td><td style="text-align:center; color:${defect ? "#fb7185" : "#94a3b8"}; font-weight:800;">${defect}</td><td>${parameterChecklistEscape(recorder)}</td><td style="text-align:center; color:#94a3b8;">รอตรวจ</td></tr>`;
        }).join("");
        return `<div class="dr-card qc-daily-group-card" style="padding:1rem; margin:0 0 1rem; overflow:hidden;"><h4 class="qc-daily-group-heading" style="margin:0 0 .75rem;">${parameterChecklistEscape(group)}</h4><div class="table-responsive"><table class="data-table qc-screen-group-table" data-qc-group="${parameterChecklistEscape(group)}" style="width:100%; border-collapse:separate; border-spacing:0;"><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>เวลา</th><th style="text-align:center;">สี</th><th style="text-align:center;">ยอดผลิต</th><th style="text-align:center;">ยอดเสีย</th><th>ผู้บันทึก</th><th style="text-align:center;">สถานะ</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
    }).join("");
    attachQCRecordRefsToHistoryTables(root, "qc-screen-group-table", groups, order);
}

function renderQCReworkHistoryMessage(message, isError = false) {
    const root = document.getElementById("qcReworkHistoryGroups");
    if (!root) return;
    root.innerHTML = `<div style="text-align:center; color:${isError ? "#fb7185" : "#94a3b8"}; padding:1.5rem;">${parameterChecklistEscape(message)}</div>`;
}

function renderQCReworkHistory(records = []) {
    const root = document.getElementById("qcReworkHistoryGroups");
    if (!root) return;
    const rows = Array.isArray(records) ? records : (Array.isArray(records && records.data) ? records.data : []);
    if (!rows.length) {
        renderQCReworkHistoryMessage("ยังไม่มีรายการ REWORK ที่รอตรวจ");
        return;
    }
    const groups = new Map();
    rows.forEach(row => {
        const group = String(screenHistoryValue(row, ["productGroup", "ProductGroup", "group"], "ไม่ระบุกลุ่ม")).trim() || "ไม่ระบุกลุ่ม";
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(row);
    });
    const preferred = Array.isArray(window.PAINTING_PRODUCT_GROUP_ORDER) && window.PAINTING_PRODUCT_GROUP_ORDER.length
        ? window.PAINTING_PRODUCT_GROUP_ORDER
        : ["LC600 Classic", "LC600 Visi-smart", "PDB", "CU (resi thai)", "NLC", "NMS"];
    const order = [...groups.keys()].sort((a, b) => {
        const ai = preferred.indexOf(a), bi = preferred.indexOf(b);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return a.localeCompare(b, "th");
    });
    root.innerHTML = order.map(group => {
        const detailRows = groups.get(group).slice().sort((a, b) => screenHistorySortKey(b) - screenHistorySortKey(a));
        const body = detailRows.map(row => {
            const date = screenHistoryValue(row, ["date", "Date", "reworkDate", "recordDate", "timestamp", "Timestamp"], "-");
            const time = screenHistoryValue(row, ["timeSlot", "TimeSlot", "time", "Time"], "-");
            const model = screenHistoryValue(row, ["model", "Model", "partNo", "PartNo"], "-");
            const color = screenHistoryValue(row, ["color", "Color", "colour"], "ไม่ระบุ");
            const qty = screenHistoryNumber(row, ["prodQty", "ProdQty", "prod_qty", "qty", "quantity"]);
            const defect = screenHistoryDefectTotal(row);
            const recorder = screenHistoryValue(row, ["recorder", "RecordedBy", "recordedBy", "operator", "Operator"], "-");
            const shownDate = typeof formatDailyReportDate === "function" ? formatDailyReportDate(date) : date;
            const shownTime = typeof formatParameterChecklistTime === "function" ? formatParameterChecklistTime(time) : time;
            return `<tr><td>${parameterChecklistEscape(shownDate)}</td><td>${parameterChecklistEscape(model)}</td><td>${parameterChecklistEscape(shownTime)}</td><td style="text-align:center;">${parameterChecklistEscape(color)}</td><td style="text-align:center;">${qty}</td><td style="text-align:center; color:${defect ? "#fb7185" : "#94a3b8"}; font-weight:800;">${defect}</td><td>${parameterChecklistEscape(recorder)}</td><td style="text-align:center; color:#94a3b8;">รอตรวจ</td></tr>`;
        }).join("");
        return `<div class="dr-card qc-daily-group-card" style="padding:1rem; margin:0 0 1rem; overflow:hidden;"><h4 class="qc-daily-group-heading" style="margin:0 0 .75rem;">${parameterChecklistEscape(group)}</h4><div class="table-responsive"><table class="data-table qc-rework-group-table" data-qc-group="${parameterChecklistEscape(group)}" style="width:100%; border-collapse:separate; border-spacing:0;"><thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>เวลา</th><th style="text-align:center;">สี</th><th style="text-align:center;">ยอดผลิต</th><th style="text-align:center;">ยอดเสีย</th><th>ผู้บันทึก</th><th style="text-align:center;">สถานะ</th></tr></thead><tbody>${body}</tbody></table></div></div>`;
    }).join("");
    attachQCRecordRefsToHistoryTables(root, "qc-rework-group-table", groups, order);
}

function setQCChecklistRefreshButtonLoading(isLoading) {
    const button = document.getElementById("qcHistoryRefreshBtn");
    if (!button) return;
    button.disabled = isLoading;
    button.style.opacity = isLoading ? "0.7" : "1";
    button.textContent = isLoading ? "กำลังโหลดข้อมูล..." : "รีเฟรชข้อมูล";
}

async function refreshParameterChecklist() {
    if (parameterChecklistRefreshInFlight) return parameterChecklistRefreshInFlight;
    parameterChecklistRefreshInFlight = (async () => {
        try {
            if (typeof fetchParameterChecklistDataFromAPI === "function") {
                const records = await fetchParameterChecklistDataFromAPI("", parameterChecklistMode === "water" ? "water" : "");
                parameterChecklistHistory = Array.isArray(records)
                    ? records.filter(record => parameterChecklistMode === "water"
                        ? String(record.checklistType || "") === "water"
                        : !record.checklistType || String(record.checklistType) === "full")
                    : [];
                renderParameterChecklistHistory();
            }
        } finally {
            parameterChecklistRefreshInFlight = null;
        }
    })();
    return parameterChecklistRefreshInFlight;
}

async function refreshQCChecklistHistory(showFeedback = false) {
    if (qcChecklistRefreshInFlight) {
        if (showFeedback && typeof showToast === "function") showToast("กำลังโหลดข้อมูลอยู่ กรุณารอสักครู่", "info");
        return qcChecklistRefreshInFlight;
    }
    qcChecklistRefreshInFlight = (async () => {
        const failures = [];
        // QC is a dashboard view: fail fast and let the user retry instead of
        // blocking the whole page behind several long Apps Script retries.
        const retryOptions = { attempts: 2, timeoutMs: 12000, skipQueue: true };
        const historyScope = window.qcReviewDataScope === "reviewed" ? "reviewed" : "pending";
        const historyOptions = { retryOptions, scope: historyScope };
        setQCChecklistRefreshButtonLoading(true);
        renderQCChecklistHistoryMessage("qcParameterChecklistHistoryBody", "กำลังโหลดประวัติการตรวจพารามิเตอร์...");
        renderQCChecklistHistoryMessage("qcWaterChecklistHistoryBody", "กำลังโหลดประวัติการตรวจน้ำ...");
        renderQCChecklistHistoryMessage("qcEquipmentChecklistHistoryBody", "กำลังโหลดประวัติเช็กลิสอุปกรณ์...");
        renderQCScreenHistoryMessage("กำลังโหลดประวัติ SCREEN...");
        renderQCReworkHistoryMessage("กำลังโหลดประวัติ REWORK...");
        if (typeof renderQCDailyReportHistory === "function") renderQCDailyReportHistory();
        try {
            // Each history source is independent. Load them together so a
            // slow Apps Script endpoint cannot keep every QC table blank.
            const loadHistory = async (name, request, render, onError) => {
                try {
                    render(await request());
                } catch (error) {
                    failures.push(name);
                    onError();
                }
            };
            const tasks = [
                loadHistory("SCREEN", () => typeof fetchScreenReportDataFromAPI === "function" ? fetchScreenReportDataFromAPI("", historyOptions) : [], renderQCScreenHistory, () => renderQCScreenHistoryMessage("โหลดประวัติ SCREEN ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง", true)),
                loadHistory("REWORK", () => typeof fetchReworkReportDataFromAPI === "function" ? fetchReworkReportDataFromAPI("", historyOptions) : [], renderQCReworkHistory, () => renderQCReworkHistoryMessage("โหลดประวัติ REWORK ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง", true))
            ];
            if (typeof fetchParameterChecklistDataFromAPI === "function") {
                tasks.push(
                    loadHistory("ตรวจน้ำ", () => fetchParameterChecklistDataFromAPI("", "water", { ...historyOptions, throwOnError: true }), records => {
                        waterParameterChecklistHistory = Array.isArray(records) ? records.filter(record => String(record.checklistType || "water") === "water") : [];
                        renderParameterChecklistHistory("qcWaterChecklistHistoryBody", waterParameterChecklistHistory, "ยังไม่มีประวัติการตรวจน้ำ");
                    }, () => renderQCChecklistHistoryMessage("qcWaterChecklistHistoryBody", "โหลดประวัติการตรวจน้ำไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง", true)),
                    loadHistory("เช็กอุปกรณ์", () => typeof fetchEquipmentChecklistDataFromAPI === "function" ? fetchEquipmentChecklistDataFromAPI("", { ...historyOptions, throwOnError: true }) : [], records => {
                        equipmentChecklistHistory = records;
                        renderEquipmentChecklistHistory();
                    }, () => renderQCChecklistHistoryMessage("qcEquipmentChecklistHistoryBody", "โหลดประวัติเช็กลิสอุปกรณ์ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง", true)),
                    loadHistory("พารามิเตอร์", () => fetchParameterChecklistDataFromAPI("", "full", { ...historyOptions, throwOnError: true }), records => {
                        parameterChecklistHistory = Array.isArray(records) ? records.filter(record => !record.checklistType || String(record.checklistType) === "full") : [];
                        renderParameterChecklistHistory("qcParameterChecklistHistoryBody", parameterChecklistHistory, "ยังไม่มีประวัติการตรวจพารามิเตอร์");
                    }, () => renderQCChecklistHistoryMessage("qcParameterChecklistHistoryBody", "โหลดประวัติการตรวจพารามิเตอร์ไม่สำเร็จ กรุณากดรีเฟรชอีกครั้ง", true))
                );
            }
            await Promise.all(tasks);
            if (typeof refreshDailyReportHistory === "function") {
                await loadHistory("พ่นสีรายวัน", () => refreshDailyReportHistory(historyOptions), () => {
                    if (typeof renderQCDailyReportHistory === "function") renderQCDailyReportHistory();
                }, () => {});
            }

            if (showFeedback && typeof showToast === "function") {
                if (failures.length) {
                    showToast(`โหลดข้อมูลไม่สำเร็จบางส่วน: ${failures.join(", ")}`, "error");
                } else {
                    showToast("รีเฟรชข้อมูล QC เรียบร้อยแล้ว", "success");
                }
            }
        } finally {
            setQCChecklistRefreshButtonLoading(false);
            qcChecklistRefreshInFlight = null;
        }
    })();
    return qcChecklistRefreshInFlight;
}
