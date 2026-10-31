// Canonical production catalog used by the daily production form.
// Each selection is intentionally hierarchical: product group -> part category -> model/code -> color.
// Built-in list for a browser that has never reached the server; replaced by
// the Capacity sheet's groups, in sheet order, once the catalog loads.
let PAINTING_PRODUCT_GROUP_ORDER = ["LC600 Classic", "LC600 Visi-smart", "PDB", "CU (resi thai)", "NLC", "NMS"];
const PAINTING_PRODUCT_GROUPS_DEFAULT = {
    "LC600 Classic": {
        colors: [{ value: "GREY BUTTER", label: "GREY BUTTER (1025216PX20)", code: "1025216PX20" }],
        categories: {
            "Flat Door": [{ value: "7517016200", label: "Flat Door (7517016200)" }],
            "Gland Plate": [{ value: "7517014800", label: "Gland Plate (7517014800)" }],
            "Cover (Four types)": [
                { value: "75170152", label: "Cover (Four types) (75170152)" },
                { value: "75170153", label: "Cover (Four types) (75170153)" },
                { value: "75170154", label: "Cover (Four types) (75170154)" },
                { value: "75170155", label: "Cover (Four types) (75170155)" }
            ],
            "Box": [{ value: "7517014500", label: "Box (7517014500)" }]
        }
    },
    "LC600 Visi-smart": {
        colors: [{ value: "WHITE", label: "WHITE (1003532PX20)", code: "1003532PX20" }],
        categories: {
            "Curve Door": [{ value: "7517016600", label: "Curve Door (7517016600)" }],
            "Gland Plate": [{ value: "7517014000", label: "Gland Plate (7517014000)" }],
            "Cover (Four types)": [
                { value: "75170152", label: "Cover (Four types) (75170152)" },
                { value: "75170153", label: "Cover (Four types) (75170153)" },
                { value: "75170154", label: "Cover (Four types) (75170154)" },
                { value: "75170155", label: "Cover (Four types) (75170155)" }
            ],
            "Box": [{ value: "7517014500", label: "Box (7517014500)" }]
        }
    },
    "PDB": {
        colors: [{ value: "WHITE N-47", label: "WHITE N-47 (1214891PX20)", code: "1214891PX20" }],
        categories: {
            "PDB": [
                { value: "827111-S", label: "DBS30 (827111-S)" },
                { value: "827198-S", label: "DBS45 (827198-S)" },
                { value: "827285-S", label: "DBS60 (827285-S)" }
            ]
        }
    },
    "CU (resi thai)": {
        colors: [{ value: "White 2910", label: "White 2910 (1223326PX20)", code: "1223326PX20" }],
        categories: {
            "Metal Box": [
                { value: "BRU30887", label: "METAL BOX 4/6 WAY (BRU30887)" },
                { value: "BRU30888", label: "METAL BOX 8/10 WAY (BRU30888)" },
                { value: "BRU30889", label: "METAL BOX 14 WAY (BRU30889)" }
            ],
            "Metal Cover": [
                { value: "BRU30890", label: "METAL COVER 4 WAY (BRU30890)" },
                { value: "BRU30891", label: "METAL COVER 6 WAY (BRU30891)" },
                { value: "BRU30892", label: "METAL COVER 8 WAY (BRU30892)" },
                { value: "BRU30893", label: "METAL COVER 10 WAY (BRU30893)" },
                { value: "BRU30894", label: "METAL COVER 14 WAY (BRU30894)" }
            ]
        }
    },
    "NLC": {
        colors: [
            { value: "GREY", label: "GREY (1259025)", code: "1259025" },
            { value: "WHITE SE3", label: "WHITE SE3 (1259107)", code: "1259107" }
        ],
        categories: {
            "U BOX": [
                { value: "BRU53714", label: "U BOX 450mm (BRU53714)" },
                { value: "BRU53715", label: "U BOX 600mm (BRU53715)" },
                { value: "BRU53716", label: "U BOX 750mm (BRU53716)" },
                { value: "BRU53771", label: "U BOX 900mm (BRU53771)" }
            ],
            "Door": [
                { value: "BRU53743", label: "Door 450mm (BRU53743)" },
                { value: "BRU53744", label: "Door 600mm (BRU53744)" },
                { value: "BRU53747", label: "Door 750mm (BRU53747)" },
                { value: "BRU53749", label: "Door 900mm (BRU53749)" }
            ],
            "Gland Plate": [{ value: "BRU53717", label: "Gland Plate (BRU53717)" }],
            "Cover 100EZ": [
                { value: "BRU53718", label: "Cover EZ100 450mm 12 way (BRU53718)" },
                { value: "BRU53719", label: "Cover EZ100 600mm 18 way (BRU53719)" },
                { value: "BRU53720", label: "Cover EZ100 600mm 24 way (BRU53720)" },
                { value: "BRU53721", label: "Cover EZ100 600mm 30 way (BRU53721)" },
                { value: "BRU53722", label: "Cover EZ100 750mm 36 way (BRU53722)" },
                { value: "BRU53723", label: "Cover EZ100 750mm 42 way (BRU53723)" }
            ],
            "Cover 100LUG": [
                { value: "BRU53724", label: "Cover LUG100 450mm 12 way (BRU53724)" },
                { value: "BRU53725", label: "Cover LUG100 450mm 18 way (BRU53725)" },
                { value: "BRU53726", label: "Cover LUG100 600mm 24 way (BRU53726)" },
                { value: "BRU53727", label: "Cover LUG100 600mm 30 way (BRU53727)" },
                { value: "BRU53728", label: "Cover LUG100 600mm 36 way (BRU53728)" },
                { value: "BRU53729", label: "Cover LUG100 750mm 42 way (BRU53729)" }
            ],
            "Cover 250EZ": [
                { value: "BRU53730", label: "Cover EZ250 600mm 12 way (BRU53730)" },
                { value: "BRU53731", label: "Cover EZ250 600mm 18 way (BRU53731)" },
                { value: "BRU53732", label: "Cover EZ250 750mm 24 way (BRU53732)" },
                { value: "BRU53734", label: "Cover EZ250 750mm 30 way (BRU53734)" },
                { value: "BRU53735", label: "Cover EZ250 900mm 36 way (BRU53735)" },
                { value: "BRU53736", label: "Cover EZ250 900mm 42 way (BRU53736)" },
                { value: "BRU53737", label: "Cover EZ250 900mm 48 way (BRU53737)" }
            ],
            "Cover 250LUG": [
                { value: "BRU53738", label: "Cover LUG250 450mm 12 way (BRU53738)" },
                { value: "BRU53739", label: "Cover LUG250 600mm 18 way (BRU53739)" },
                { value: "BRU53740", label: "Cover LUG250 600mm 24 way (BRU53740)" },
                { value: "BRU53741", label: "Cover LUG250 600mm 30 way (BRU53741)" },
                { value: "BRU53742", label: "Cover LUG250 750mm 36 way (BRU53742)" },
                { value: "BRU53745", label: "Cover LUG250 750mm 42 way (BRU53745)" },
                { value: "BRU53746", label: "Cover LUG250 900mm 48 way (BRU53746)" }
            ]
        }
    },
    // NMS is available as a product group now; its part/model catalog can be
    // filled in later without hiding the group from the selector.
    "NMS": {
        colors: [],
        categories: {
            "Box": [],
            "Cover": []
        }
    }
};

let PAINTING_MODEL_GROUPS = JSON.parse(JSON.stringify(PAINTING_PRODUCT_GROUPS_DEFAULT));
const PAINTING_PRODUCT_CATALOG_CACHE = "PAINTING_PRODUCT_CATALOG_CACHE_V2";
const PAINTING_ADD_MODEL_VALUE = "__ADD_MODEL__";

function escapeDailyReportHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function normalizeProductCatalog(source) {
    if (!source || typeof source !== "object") return JSON.parse(JSON.stringify(PAINTING_PRODUCT_GROUPS_DEFAULT));
    const candidate = {};
    const groupNames = PAINTING_PRODUCT_GROUP_ORDER.concat(Object.keys(source).filter(name => !PAINTING_PRODUCT_GROUP_ORDER.includes(name)));
    for (const groupName of groupNames) {
        const raw = source[groupName];
        if (!raw || typeof raw !== "object" || !raw.categories) continue;
        const categories = {};
        Object.entries(raw.categories).forEach(([category, models]) => {
            if (!Array.isArray(models)) return;
            const list = models.map(item => typeof item === "string" ? { value: item, label: item } : item)
                .filter(item => item && item.value).map(item => ({ value: String(item.value), label: String(item.label || item.value) }));
            if (Array.isArray(models)) categories[String(category)] = list;
        });
        const colors = Array.isArray(raw.colors) ? raw.colors.map(item => typeof item === "string" ? { value: item, label: item } : item)
            .filter(item => item && item.value).map(item => ({ value: String(item.value), label: String(item.label || item.value), code: String(item.code || "") })) : [];
        // Keep an empty group as a valid selection. This lets NMS appear in
        // the product-group selector before its model catalog is populated.
        if (Object.keys(categories).length || Array.isArray(raw.colors)) candidate[groupName] = { categories, colors };
    }
    return Object.keys(candidate).length ? candidate : JSON.parse(JSON.stringify(PAINTING_PRODUCT_GROUPS_DEFAULT));
}

// Remove a known mistyped locally-added catalog entry. User-added models are
// kept in browser storage, so clean this exact label once while preserving the
// canonical BRU30890 model and every other catalog item.
function removeMistypedCatalogEntries(catalog) {
    const targetLabel = "BRU30890 (BRU30892)";
    const normalizeLabel = value => String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
    Object.values(catalog || {}).forEach(group => {
        Object.values(group?.categories || {}).forEach(models => {
            if (!Array.isArray(models)) return;
            for (let i = models.length - 1; i >= 0; i -= 1) {
                const item = models[i] || {};
                const label = normalizeLabel(item.label);
                // Match the exact typo, including older cached labels that may
                // contain an accidental leading marker or extra whitespace.
                if (label === normalizeLabel(targetLabel)
                    || (label.includes("BRU30890") && label.includes("BRU30892") && !label.includes("METAL COVER"))) {
                    models.splice(i, 1);
                }
            }
        });
    });
    return catalog;
}

// Pre-assy parts (Capacity ProductGroup "NLC 450 Pre-assy", "PRE ASSY BOX
// LC600"...) are recorded only in the Pre-assy menu, so they are kept out of
// the catalog every other form reads.
const PAINTING_PREASSY_CATALOG_CACHE = "PAINTING_PREASSY_CATALOG_CACHE";
let PAINTING_PREASSY_GROUPS = {};
let PAINTING_PREASSY_GROUP_ORDER = [];

function isPreAssyProductGroup(name) {
    return /PRE[\s_-]*ASS/i.test(String(name || ""));
}

try {
    const cachedPreAssy = JSON.parse(localStorage.getItem(PAINTING_PREASSY_CATALOG_CACHE) || "null");
    if (cachedPreAssy && cachedPreAssy.groups && Array.isArray(cachedPreAssy.order)) {
        PAINTING_PREASSY_GROUPS = cachedPreAssy.groups;
        PAINTING_PREASSY_GROUP_ORDER = cachedPreAssy.order;
    }
} catch (_) {}

// The catalog and its group order always change together; REWORK and SCREEN
// read both.
function setProductCatalog(groups, order) {
    const allOrder = Array.isArray(order) && order.length
        ? order.filter(name => groups[name]).concat(Object.keys(groups).filter(name => !order.includes(name)))
        : Object.keys(groups);
    const preAssyOrder = allOrder.filter(isPreAssyProductGroup);
    if (preAssyOrder.length) {
        PAINTING_PREASSY_GROUPS = {};
        preAssyOrder.forEach(name => { PAINTING_PREASSY_GROUPS[name] = groups[name]; });
        PAINTING_PREASSY_GROUP_ORDER = preAssyOrder;
        try {
            localStorage.setItem(PAINTING_PREASSY_CATALOG_CACHE, JSON.stringify({ groups: PAINTING_PREASSY_GROUPS, order: preAssyOrder }));
        } catch (_) {}
    }
    PAINTING_MODEL_GROUPS = {};
    allOrder.filter(name => !isPreAssyProductGroup(name)).forEach(name => { PAINTING_MODEL_GROUPS[name] = groups[name]; });
    PAINTING_PRODUCT_GROUP_ORDER = allOrder.filter(name => !isPreAssyProductGroup(name));
    if (typeof window.renderPreAssyProductGroups === "function") window.renderPreAssyProductGroups();
}

// Screen can be opened without mounting the daily-report form. Load the
// shared browser catalog immediately so every form sees the same list.
try {
    const cachedCatalog = localStorage.getItem(PAINTING_PRODUCT_CATALOG_CACHE);
    if (cachedCatalog) {
        setProductCatalog(removeMistypedCatalogEntries(normalizeProductCatalog(JSON.parse(cachedCatalog))));
    }
} catch (_) {}

function selectedProductGroup() {
    return document.getElementById('drProductGroup')?.value || "";
}

function renderProductGroupDropdownUI() {
    const select = document.getElementById('drProductGroup');
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">-- เลือกกลุ่มผลิตภัณฑ์ --</option>' + PAINTING_PRODUCT_GROUP_ORDER
        .filter(name => PAINTING_MODEL_GROUPS[name])
        .map(name => `<option value="${escapeDailyReportHtml(name)}">${escapeDailyReportHtml(name)}</option>`).join('');
    if (previous && PAINTING_MODEL_GROUPS[previous]) select.value = previous;
}

// New parts are added to the Capacity sheet so every
// device gets them; the local copy above keeps the form usable meanwhile.
function saveCatalogEntryToSheet(entry) {
    if (typeof addCatalogEntryToAPI !== 'function') return;
    addCatalogEntryToAPI(entry).then(ok => {
        if (!ok && typeof showToast === 'function') showToast('บันทึกรายการใหม่ลง Google Sheet ไม่สำเร็จ (ใช้ได้เฉพาะเครื่องนี้)', 'error');
    });
}

// The form asks only for the product group and the part (Capacity's
// ProductGroup, PartCode and PartName), so list every part of the group.
function productGroupParts(productGroup) {
    return Object.values(PAINTING_MODEL_GROUPS[productGroup]?.categories || {}).flat();
}

function renderModelDropdownOptions(productGroup = selectedProductGroup()) {
    const models = productGroupParts(productGroup);
    const html = productGroup ? '<option value="">-- เลือกชิ้นงาน (PartCode) PartName --</option>' : '<option value="">-- เลือกกลุ่มผลิตภัณฑ์ก่อน --</option>';
    const addOption = productGroup
        ? '<option value="' + PAINTING_ADD_MODEL_VALUE + '">➕ เพิ่มรายการ</option>'
        : '';
    document.querySelectorAll('.model-select').forEach(select => {
        const previous = select.value;
        select.innerHTML = html + models.map(item => `<option value="${escapeDailyReportHtml(item.value)}">${escapeDailyReportHtml(item.label)}</option>`).join('') + addOption;
        select.disabled = !productGroup;
        if (previous && models.some(item => item.value === previous)) select.value = previous;
    });
}

function handleModelSelect(select) {
    if (!select || select.value !== PAINTING_ADD_MODEL_VALUE) return;

    const productGroup = selectedProductGroup();
    const categories = PAINTING_MODEL_GROUPS[productGroup]?.categories;
    if (!categories) {
        select.value = '';
        return;
    }

    const code = String(window.prompt('PartCode ของชิ้นงานใหม่') || '').trim();
    if (!code) {
        select.value = '';
        return;
    }
    if (productGroupParts(productGroup).some(item => String(item.value).trim().toLowerCase() === code.toLowerCase())) {
        showToast('มีชิ้นงานนี้อยู่แล้ว', 'error');
        renderModelDropdownOptions(productGroup);
        select.value = code;
        return;
    }
    const name = String(window.prompt('PartName ของชิ้นงานใหม่') || '').trim();

    // Capacity lists a part without a PartCategory under its PartName.
    const category = name || code;
    if (!categories[category]) categories[category] = [];
    categories[category].push({ value: code, label: name ? `(${code}) ${name}` : code });
    localStorage.setItem(PAINTING_PRODUCT_CATALOG_CACHE, JSON.stringify(PAINTING_MODEL_GROUPS));
    saveCatalogEntryToSheet({ group: productGroup, category, code, name });
    renderModelDropdownOptions(productGroup);
    select.value = code;
    showToast('เพิ่มชิ้นงานแล้ว', 'success');
}

function filterProductGroupDropdown() {
    const modelSelect = document.getElementById('drModel');
    if (modelSelect) modelSelect.value = "";
    renderModelDropdownOptions();
}

async function loadPartModelsList() {
    const cached = localStorage.getItem(PAINTING_PRODUCT_CATALOG_CACHE);
    if (cached) {
        try {
            setProductCatalog(removeMistypedCatalogEntries(normalizeProductCatalog(JSON.parse(cached))));
        } catch (e) {}
    }
    renderProductGroupDropdownUI();
    filterProductGroupDropdown();
    if (typeof fetchPartModelsFromAPI === 'function') {
        const cloudGroups = await fetchPartModelsFromAPI();
        const meta = window.PAINTING_PART_CATALOG_META || {};
        if (cloudGroups && typeof cloudGroups === 'object' && meta.source) {
            // The Capacity sheet is the source of truth: show exactly its
            // groups, categories, models and colors, in sheet order.
            setProductCatalog(normalizeProductCatalog(cloudGroups), meta.order);
            localStorage.setItem(PAINTING_PRODUCT_CATALOG_CACHE, JSON.stringify(PAINTING_MODEL_GROUPS));
            renderProductGroupDropdownUI();
            filterProductGroupDropdown();
        } else if (cloudGroups && typeof cloudGroups === 'object') {
            // The server could not be reached: the last catalog it sent.
            setProductCatalog(removeMistypedCatalogEntries(normalizeProductCatalog(cloudGroups)));
            localStorage.setItem(PAINTING_PRODUCT_CATALOG_CACHE, JSON.stringify(PAINTING_MODEL_GROUPS));
            renderProductGroupDropdownUI();
            filterProductGroupDropdown();
        }
    }
}

const PAINTING_TIMESLOTS = [
    "08.00 - 09.00",
    "09.00 - 10.00",
    "10.10 - 11.00",
    "11.00 - 12.00",
    "13.00 - 14.00",
    "14.00 - 15.00",
    "15.10 - 16.00",
    "16.00 - 17.00",
    "17.30 - 18.00",
    "18.00 - 19.00",
    "19.00 - 20.00",
    "20.00 - 21.00"
];

function renderTimeSlotDropdowns() {
    const timeSelects = document.querySelectorAll('.time-select');
    let timeHtml = '<option value="">-- เลือกช่วงเวลา --</option>';
    PAINTING_TIMESLOTS.forEach(t => {
        timeHtml += `<option value="${t}">${t}</option>`;
    });
    const currentSlot = getCurrentTimeSlot();
    timeSelects.forEach(sel => {
        const previous = sel.value;
        sel.innerHTML = timeHtml;
        if (previous && PAINTING_TIMESLOTS.includes(previous)) sel.value = previous;
        else if (currentSlot) sel.value = currentSlot;
    });
}

// The time slots live in the LineTimeSlots sheet (day and night shifts).
// Break rows are not recordable. The built-in list above stays as the
// offline fallback; the array is updated in place so the REWORK and SCREEN
// forms, which read it when they open, see the same slots.
async function loadTimeSlotsFromSheet() {
    const baseUrl = typeof getApiUrl === 'function' ? getApiUrl() : '';
    if (!baseUrl || typeof fetchAppsScriptJsonWithRetry !== 'function') return;
    try {
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getLineCapacity';
        const json = await fetchAppsScriptJsonWithRetry(url, 'Load time slots', { attempts: 1, timeoutMs: 15000 });
        const slots = (json && Array.isArray(json.slots) ? json.slots : [])
            .filter(slot => String(slot.type || '').toUpperCase() !== 'BREAK')
            .map(slot => String(slot.timeSlot || '').trim())
            .filter(label => /\d{1,2}[.:]\d{2}\s*-\s*\d{1,2}[.:]\d{2}/.test(label));
        if (!slots.length) return;
        PAINTING_TIMESLOTS.splice(0, PAINTING_TIMESLOTS.length, ...slots);
        renderTimeSlotDropdowns();
    } catch (error) {
        console.warn('Time slots from sheet unavailable, using built-in list:', error);
    }
}

function getCurrentTimeSlot() {
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    let closestSlot = "";
    let minDiff = Infinity;

    for (let slot of PAINTING_TIMESLOTS) {
        const parts = slot.split("-");
        if (parts.length === 2) {
            const startStr = parts[0].trim();
            const endStr = parts[1].trim();
            
            const startParts = startStr.split(".");
            const startMins = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
            
            const endParts = endStr.split(".");
            let endMins = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);
            if (endMins <= startMins) endMins += 24 * 60; // e.g. "23.00 - 00.00"
            
            // If strictly inside the slot, return it immediately
            if (currentMins >= startMins && currentMins <= endMins) {
                return slot;
            }

            // Otherwise find distance to the closest edge (start or end)
            const diffStart = Math.abs(currentMins - startMins);
            const diffEnd = Math.abs(currentMins - endMins);
            const minEdgeDiff = Math.min(diffStart, diffEnd);

            if (minEdgeDiff < minDiff) {
                minDiff = minEdgeDiff;
                closestSlot = slot;
            }
        }
    }
    return closestSlot;
}

let currentTargetStaffType = "recorder";

// The cloud Recorders sheet is the source of truth. Do not seed this with mock names.
let PAINTING_RECORDERS_LIST = [];

async function loadStaffList() {
    // Invalidate caches created by older builds that contained mock names.
    const staffCacheVersion = "2.1.0";
    if (localStorage.getItem("PAINTING_RECORDERS_CACHE_VER") !== staffCacheVersion) {
        localStorage.removeItem("PAINTING_RECORDERS_CACHE");
        localStorage.setItem("PAINTING_RECORDERS_CACHE_VER", staffCacheVersion);
    }

    // 1. Load from local cache for instant UI rendering
    const cachedRecorders = localStorage.getItem("PAINTING_RECORDERS_CACHE");
    if (cachedRecorders) {
        try {
            const list = JSON.parse(cachedRecorders);
            if (Array.isArray(list)) {
                PAINTING_RECORDERS_LIST = list;
            }
        } catch (e) {}
    }

    // 2. Fetch fresh list from Cloud (Google Sheet Recorders tab)
    if (typeof fetchRecordersFromAPI === 'function') {
        const cloudRecorders = await fetchRecordersFromAPI();
        if (Array.isArray(cloudRecorders)) {
            PAINTING_RECORDERS_LIST = cloudRecorders;
            saveStaffList();
            renderStaffDropdownsUI();
        }
    }
}

function saveStaffList() {
    localStorage.setItem("PAINTING_RECORDERS_CACHE", JSON.stringify(PAINTING_RECORDERS_LIST));
}

function renderStaffDropdownsUI() {
    const recorderSelect = document.getElementById('recorderName');
    const currentRecorder = recorderSelect ? recorderSelect.value : "";

    if (recorderSelect) {
        let recorderHtml = '<option value="">-- เลือกผู้บันทึก --</option>';
        PAINTING_RECORDERS_LIST.forEach(name => {
            recorderHtml += `<option value="${name}">${name}</option>`;
        });
        recorderHtml += `<option value="__ADD_NEW__">➕ + เพิ่มรายชื่อผู้บันทึกใหม่...</option>`;
        recorderSelect.innerHTML = recorderHtml;
        if (currentRecorder && PAINTING_RECORDERS_LIST.includes(currentRecorder)) {
            recorderSelect.value = currentRecorder;
        }
    }

    // Keep the 5M1E recorder select synchronized with the same list.
    if (typeof populateEventRecorderDropdown === 'function') {
        populateEventRecorderDropdown();
    }
    if (typeof renderReworkRecorderDropdownUI === 'function') {
        renderReworkRecorderDropdownUI();
    }
}

function renderStaffDropdowns() {
    loadStaffList().then(() => {
        renderStaffDropdownsUI();
    });
    renderStaffDropdownsUI();
}

function handleStaffSelectChange(selectEl, targetType = "recorder") {
    if (selectEl && selectEl.value === "__ADD_NEW__") {
        selectEl.value = "";
        openAddStaffModal(targetType);
    }
}

function openAddStaffModal(targetType = "recorder") {
    currentTargetStaffType = "recorder";
    const modal = document.getElementById('addStaffModal');
    const modalTitle = document.getElementById('addStaffModalTitle');

    if (modalTitle) {
        modalTitle.innerText = "👥 จัดการรายชื่อ \"ผู้บันทึก\"";
    }

    if (modal) {
        modal.style.display = "flex";
        modal.classList.add('active');
        const input = document.getElementById('newStaffInput');
        if (input) {
            input.value = "";
            input.placeholder = "ระบุ ชื่อผู้บันทึก";
            setTimeout(() => input.focus(), 200);
        }
        renderStaffListInModal();
    } else {
        const newName = prompt("กรอกชื่อ - นามสกุล (ผู้บันทึก):");
        if (newName && newName.trim()) {
            if (!PAINTING_RECORDERS_LIST.includes(newName.trim())) {
                PAINTING_RECORDERS_LIST.push(newName.trim());
                saveStaffList();
                renderStaffDropdownsUI();
                if (typeof addRecorderToAPI === 'function') {
                    addRecorderToAPI(newName.trim());
                }
            }
            const sel = document.getElementById('recorderName');
            if (sel) sel.value = newName.trim();
            const eventSel = document.getElementById('eventRecorderSelect');
            if (eventSel) eventSel.value = newName.trim();
        }
    }
}

function closeAddStaffModal() {
    const modal = document.getElementById('addStaffModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

function renderStaffListInModal() {
    const container = document.getElementById('staffListContainer');
    if (!container) return;

    if (PAINTING_RECORDERS_LIST.length === 0) {
        container.innerHTML = `<div style="text-align: center; color: #94a3b8; padding: 1rem; font-size: 0.85rem;">ยังไม่มีรายชื่อ</div>`;
        return;
    }

    container.innerHTML = PAINTING_RECORDERS_LIST.map((name, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(255, 255, 255, 0.1); font-size: 0.9rem;">
            <span style="font-weight: 600; color: #f8fafc;">👤 ${name}</span>
            <button type="button" onclick="deleteStaffName(${index})" style="background: none; border: none; color: #f87171; font-size: 0.8rem; font-weight: 700; cursor: pointer;">🗑️ ลบ</button>
        </div>
    `).join('');
}

async function saveNewStaff() {
    const input = document.getElementById('newStaffInput');
    if (!input) return;

    const newName = input.value.trim();
    if (!newName) {
        showToast("กรุณาระบุชื่อผู้บันทึก", "error");
        return;
    }

    if (PAINTING_RECORDERS_LIST.includes(newName)) {
        showToast("รายชื่อนี้มีอยู่ในรายการแล้ว", "warning");
        return;
    }

    PAINTING_RECORDERS_LIST.push(newName);
    saveStaffList();
    renderStaffDropdownsUI();
    renderStaffListInModal();

    // Sync new recorder to Cloud Google Sheet
    if (typeof addRecorderToAPI === 'function') {
        await addRecorderToAPI(newName);
        // Read back from the sheet so every open form uses the same list.
        await loadStaffList();
    }

    const recorderSelect = document.getElementById('recorderName');
    if (recorderSelect) recorderSelect.value = newName;
    const eventRecorderSelect = document.getElementById('eventRecorderSelect');
    if (eventRecorderSelect) eventRecorderSelect.value = newName;
    const reworkRecorderSelect = document.getElementById('rwRecorder');
    if (reworkRecorderSelect) reworkRecorderSelect.value = newName;

    input.value = "";
    showToast(`เพิ่มรายชื่อ "${newName}" เรียบร้อยแล้ว`, "success");
}

async function deleteStaffName(index) {
    if (index >= 0 && index < PAINTING_RECORDERS_LIST.length) {
        const removedName = PAINTING_RECORDERS_LIST[index];
        PAINTING_RECORDERS_LIST.splice(index, 1);
        saveStaffList();
        renderStaffDropdownsUI();
        renderStaffListInModal();

        // Sync deletion to Cloud Google Sheet
        if (typeof deleteRecorderFromAPI === 'function') {
            await deleteRecorderFromAPI(removedName);
            await loadStaffList();
        }

        showToast(`ลบรายชื่อ "${removedName}" แล้ว`, "info");
    }
}

let dailyReportRecords = [];
let dailyReportHistoryRecords = [];
let dailyReportHistoryLoaded = false;
let pendingDailyReportSubmissionId = null;

function createDailyReportSubmissionId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return window.crypto.randomUUID();
    }
    return `daily-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function initDailyReportForm() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportDate').value = today;

    // Populate Recorder & Checker Staff Dropdowns
    renderStaffDropdowns();

    // Populate Part Category & Model Dropdowns from Cloud (PartModel sheet tab)
    loadPartModelsList();

    // Populate Time Dropdowns, then refresh them from the LineTimeSlots sheet.
    renderTimeSlotDropdowns();
    loadTimeSlotsFromSheet();

    // Load any draft records from localStorage if present
    const draft = localStorage.getItem("PAINTING_DAILY_REPORT_DRAFT");
    if (draft) {
        try {
            dailyReportRecords = JSON.parse(draft) || [];
        } catch (e) {
            dailyReportRecords = [];
        }
    }

    renderDailyReportList();
    // A previous save can finish on Google Sheets even when the browser loses
    // the response. Reconcile that stale local draft silently on page load.
    reconcileDailyReportDraft();
    refreshDailyReportHistory();
}

function addDailyReportRecord({ silent = false } = {}) {
    const productGroup = document.getElementById('drProductGroup')?.value || "";
    const model = document.getElementById('drModel').value;
    // Kept in the record for the sheet's PartCategory column.
    const partCategory = Object.entries(PAINTING_MODEL_GROUPS[productGroup]?.categories || {})
        .find(([, models]) => (models || []).some(item => item.value === model))?.[0] || "";
    const color = "";
    const colorCode = "";
    const timeSlot = document.getElementById('drTime').value;
    const prodQty = Number(document.getElementById('drProdQty').value) || 0;
    
    // Defects
    const rust = Number(document.getElementById('drRust').value) || 0;
    const dent = Number(document.getElementById('drDent').value) || 0;
    const colorDrop = Number(document.getElementById('drColorDrop').value) || 0;
    const thinPaint = Number(document.getElementById('drThinPaint').value) || 0;
    const thickPaint = Number(document.getElementById('drThickPaint').value) || 0;
    const waterStain = Number(document.getElementById('drWaterStain').value) || 0;
    const oil = Number(document.getElementById('drOil').value) || 0;
    const dust = Number(document.getElementById('drDust').value) || 0;
    const otherDefect = Number(document.getElementById('drOtherDefect').value) || 0;

    if (!productGroup || !model || model === PAINTING_ADD_MODEL_VALUE || !timeSlot) {
        showToast("กรุณาเลือกกลุ่มผลิตภัณฑ์ ชิ้นงาน และช่วงเวลาให้ครบถ้วน", "error");
        return false;
    }

    if (prodQty === 0 && (rust+dent+colorDrop+thinPaint+thickPaint+waterStain+oil+dust+otherDefect) === 0) {
        showToast("กรุณากรอกยอดผลิตหรือยอดของเสียอย่างน้อย 1 ชิ้น", "error");
        return false;
    }

    const totalDefect = rust + dent + colorDrop + thinPaint + thickPaint + waterStain + oil + dust + otherDefect;

    dailyReportRecords.push({
        id: Date.now().toString(),
        productGroup,
        partCategory,
        model,
        color,
        colorCode,
        timeSlot,
        prodQty,
        rust,
        dent,
        colorDrop,
        thinPaint,
        thickPaint,
        waterStain,
        oil,
        dust,
        otherDefect,
        totalDefect
    });

    // Save draft to localStorage so refresh doesn't lose items
    localStorage.setItem("PAINTING_DAILY_REPORT_DRAFT", JSON.stringify(dailyReportRecords));

    renderDailyReportList();
    
    // Clear inputs for next entry, but keep current time slot auto-selected
    const currentSlot = getCurrentTimeSlot();
    document.getElementById('drTime').value = currentSlot || "";
    if (document.getElementById('drProductGroup')) document.getElementById('drProductGroup').value = "";
    renderModelDropdownOptions("");
    document.getElementById('drProdQty').value = "";
    document.getElementById('drRust').value = "";
    document.getElementById('drDent').value = "";
    document.getElementById('drColorDrop').value = "";
    document.getElementById('drThinPaint').value = "";
    document.getElementById('drThickPaint').value = "";
    document.getElementById('drWaterStain').value = "";
    document.getElementById('drOil').value = "";
    document.getElementById('drDust').value = "";
    document.getElementById('drOtherDefect').value = "";
    
    if (!silent) {
        showToast("เพิ่มรายการสำเร็จ", "success");
    }
    return true;
}

function removeDailyReportRecord(index) {
    dailyReportRecords.splice(index, 1);
    localStorage.setItem("PAINTING_DAILY_REPORT_DRAFT", JSON.stringify(dailyReportRecords));
    renderDailyReportList();
}

async function reconcileDailyReportDraft() {
    if (!Array.isArray(dailyReportRecords) || dailyReportRecords.length === 0) return;
    if (typeof fetchDailyReportDataFromAPI !== 'function') return;

    const date = String(document.getElementById('reportDate')?.value || '').trim();
    if (!date) return;

    try {
        const saved = await fetchDailyReportDataFromAPI(date);
        if (!Array.isArray(saved) || saved.length === 0) return;

        const candidates = saved.filter(record => String(record.date || record.Date || '').trim().slice(0, 10) === date);
        const used = new Set();
        const same = (a, b) => String(a ?? '').trim() === String(b ?? '').trim();
        const matched = dailyReportRecords.every(item => {
            const index = candidates.findIndex((record, candidateIndex) => {
                if (used.has(candidateIndex)) return false;
                return same(record.model || record.Model, item.model) &&
                    same(record.timeSlot || record.TimeSlot, item.timeSlot) &&
                    Number(record.prodQty || record.ProdQty || 0) === Number(item.prodQty || 0) &&
                    Number(record.totalDefect || record.TotalDefect || 0) === Number(item.totalDefect || 0);
            });
            if (index < 0) return false;
            used.add(index);
            return true;
        });

        if (matched) {
            dailyReportRecords = [];
            pendingDailyReportSubmissionId = null;
            localStorage.removeItem('PAINTING_DAILY_REPORT_DRAFT');
            renderDailyReportList();
        }
    } catch (error) {
        console.warn('Unable to reconcile saved daily report draft:', error);
    }
}

function renderDailyReportList(targetBodyId = 'dailyReportListBody') {
    const tbody = document.getElementById(targetBodyId);
    if (!tbody) return;

    // 1. If draft session items exist before submission, display them with delete action
    if (targetBodyId === 'dailyReportListBody' && Array.isArray(dailyReportRecords) && dailyReportRecords.length > 0) {
        const draftDate = document.getElementById('reportDate')?.value || '';
        const draftDateLabel = draftDate ? `${formatDailyReportDate(draftDate)} (ร่าง)` : 'วันนี้ (ร่าง)';
        tbody.innerHTML = dailyReportRecords.map((r, i) => `
            <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); transition: background 0.2s ease;" onmouseover="this.style.background='rgba(30, 41, 59, 0.7)'" onmouseout="this.style.background='transparent'">
                <td style="padding: 0.95rem 1.1rem; font-size: 0.85rem; font-weight: 700; color: #38bdf8; white-space: nowrap;">${escapeDailyReportHtml(draftDateLabel)}</td>
                <td style="padding: 0.95rem 1.1rem; font-size: 0.92rem; font-weight: 700; color: #f8fafc;">${escapeDailyReportHtml(r.model || '-')}</td>
                <td style="padding: 0.95rem 1.1rem;"><span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.82rem;">${escapeDailyReportHtml(r.timeSlot || '-')}</span></td>
                <td style="padding: 0.95rem 1.1rem; text-align: center;">${escapeDailyReportHtml(r.color || 'ไม่ระบุ')}</td>
                <td style="padding: 0.95rem 1.1rem; font-weight: 800; color: #34d399; text-align: center; font-size: 1.05rem; text-shadow: 0 0 10px rgba(52, 211, 153, 0.25);">${Number(r.prodQty) || 0}</td>
                <td style="padding: 0.95rem 1.1rem; text-align: center;"><span style="${r.totalDefect > 0 ? 'background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);' : 'background: rgba(148, 163, 184, 0.12); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2);'} padding: 0.2rem 0.65rem; border-radius: 12px; font-weight: 800; font-size: 0.85rem;">${r.totalDefect}</span></td>
                <td style="padding: 0.95rem 1.1rem; text-align: center;"><button type="button" onclick="removeDailyReportRecord(${i})" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; padding: 0.35rem 0.85rem; border-radius: 14px; font-weight: 700; cursor: pointer; font-size: 0.8rem; transition: all 0.2s ease; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);">🗑️ ลบ</button></td>
            </tr>
        `).join('');
        return;
    }

    // 2. Otherwise display every saved record from the Google Sheets backend.
    const savedRecords = getSavedDailyReportRecords();
    if (savedRecords.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #94a3b8; padding: 2rem;">ยังไม่มีประวัติการบันทึก</td></tr>`;
        return;
    }

    // This is the five-row preview on the daily-production page. Keep the
    // complete history in the separate history modal; QC tables have their
    // own renderers and are not affected by this limit.
    const recentRecords = savedRecords.slice(0, 5);
    tbody.innerHTML = recentRecords.map(r => `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); transition: background 0.2s ease;" onmouseover="this.style.background='rgba(30, 41, 59, 0.7)'" onmouseout="this.style.background='transparent'">
            <td style="padding: 0.95rem 1.1rem; font-size: 0.85rem; font-weight: 700; color: #94a3b8; white-space: nowrap;">${formatDailyReportDate(r.date, r.timestamp)}</td>
            <td style="padding: 0.95rem 1.1rem; font-size: 0.92rem; font-weight: 700; color: #f8fafc;">${escapeDailyReportHtml(r.model || r.Model || '-')}</td>
            <td style="padding: 0.95rem 1.1rem;"><span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 0.25rem 0.75rem; border-radius: 20px; font-weight: 700; font-size: 0.82rem;">${escapeDailyReportHtml(r.timeSlot || r.TimeSlot || '-')}</span></td>
                <td style="padding: 0.95rem 1.1rem; text-align: center;">${escapeDailyReportHtml(r.color || r.Color || 'ไม่ระบุ')}</td>
                <td style="padding: 0.95rem 1.1rem; font-weight: 800; color: #34d399; text-align: center; font-size: 1.05rem; text-shadow: 0 0 10px rgba(52, 211, 153, 0.25);">${Number(r.prodQty || r.ProdQty || r.prod_qty || r.qty) || 0}</td>
            <td style="padding: 0.95rem 1.1rem; text-align: center;"><span style="${getDailyReportDefectTotal(r) > 0 ? 'background: rgba(244, 63, 94, 0.2); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.4);' : 'background: rgba(148, 163, 184, 0.12); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.2);'} padding: 0.2rem 0.65rem; border-radius: 12px; font-weight: 800; font-size: 0.85rem;">${getDailyReportDefectTotal(r)}</span></td>
            <td style="padding: 0.95rem 1.1rem; text-align: center; font-size: 0.78rem; color: #38bdf8; font-weight: 700;"><span style="background: rgba(56, 189, 248, 0.1); padding: 0.25rem 0.6rem; border-radius: 12px; border: 1px solid rgba(56, 189, 248, 0.2);">✓ บันทึกแล้ว</span></td>
        </tr>
    `).join('');
}

function getSavedDailyReportRecords() {
    let records = dailyReportHistoryLoaded ? dailyReportHistoryRecords : [];

    if (!dailyReportHistoryLoaded && (!Array.isArray(records) || records.length === 0)) {
        try {
            records = JSON.parse(localStorage.getItem("PAINTING_OUTPUTDIARY_CACHE") || "[]");
        } catch (e) {
            records = [];
        }
    }

    return (Array.isArray(records) ? records : [])
        .map((record, index) => ({ record, index }))
        .sort((a, b) => {
            const timeDiff = getDailyReportSortValue(b.record) - getDailyReportSortValue(a.record);
            return timeDiff || b.index - a.index;
        })
        .map(item => item.record);
}

function getDailyReportSortValue(record) {
    const raw = record.timestamp || record.Timestamp || record.date || record.Date || "";
    const value = new Date(raw).getTime();
    return Number.isFinite(value) ? value : 0;
}

function getDailyReportDefectTotal(record) {
    const explicit = Number(record.totalDefect || record.TotalDefect || record.total_defect);
    if (Number.isFinite(explicit)) return explicit;

    return ["rust", "dent", "colorDrop", "thinPaint", "thickPaint", "waterStain", "oil", "dust", "otherDefect"]
        .reduce((total, key) => total + (Number(record[key]) || 0), 0);
}

function formatDailyReportDate(date, timestamp) {
    const src = date || timestamp || "";
    if (!src) return "-";
    const str = String(src).trim();
    const match = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
        return `${match[3]}/${match[2]}/${match[1]}`;
    }
    return str;
}

function escapeDailyReportHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

async function refreshDailyReportHistory(options = {}) {
    try {
        if (typeof fetchDailyReportDataFromAPI === "function") {
            const records = await fetchDailyReportDataFromAPI("", options);
            if (typeof lastDailyReportFetchSucceeded === "undefined" || lastDailyReportFetchSucceeded) {
                dailyReportHistoryRecords = Array.isArray(records) ? records : [];
                dailyReportHistoryLoaded = true;
            } else if (!dailyReportHistoryLoaded) {
                dailyReportHistoryRecords = Array.isArray(records) ? records : [];
            }
        }
    } catch (error) {
        console.warn("Unable to refresh daily report history:", error);
    }

    renderDailyReportList();
}

async function openDailyReportHistory() {
    const modal = document.getElementById("dailyReportHistoryModal");
    const tbody = document.getElementById("dailyReportHistoryBody");
    if (!modal || !tbody) return;

    modal.classList.add("active");
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">กำลังโหลดข้อมูล...</td></tr>`;

    // Use the records already loaded for the five-row preview immediately.
    // A fresh Apps Script request can occasionally take several seconds, so it
    // should not block the history modal when cached/current records exist.
    const hasLoadedHistory = getSavedDailyReportRecords().length > 0;
    const refreshPromise = refreshDailyReportHistory();
    if (!hasLoadedHistory) {
        await Promise.race([
            refreshPromise,
            new Promise(resolve => setTimeout(resolve, 8000))
        ]);
    }
    const records = getSavedDailyReportRecords();

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: #64748b; padding: 2rem;">ยังไม่มีประวัติการบันทึก</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => `
        <tr>
            <td style="font-weight: 700; white-space: nowrap;">${formatDailyReportDate(r.date || r.Date, r.timestamp || r.Timestamp)}</td>
            <td style="font-weight: 600;">${escapeDailyReportHtml(r.model || r.Model || '-')}</td>
            <td><span class="badge" style="background:#e2e8f0; color:#475569;">${escapeDailyReportHtml(r.timeSlot || r.TimeSlot || '-')}</span></td>
            <td>${escapeDailyReportHtml(r.color || r.Color || 'ไม่ระบุ')}</td>
            <td>${escapeDailyReportHtml(r.shift || r.Shift || '-')}</td>
            <td style="font-weight: 700; color: #10b981;">${Number(r.prodQty || r.ProdQty || r.prod_qty || r.qty) || 0}</td>
            <td><span class="badge-defect ${getDailyReportDefectTotal(r) > 0 ? 'badge-has-defect' : 'badge-zero'}">${getDailyReportDefectTotal(r)}</span></td>
            <td>${escapeDailyReportHtml(r.recorder || r.Recorder || '-')}</td>
        </tr>
    `).join('');
}

function closeDailyReportHistory() {
    const modal = document.getElementById("dailyReportHistoryModal");
    if (modal) modal.classList.remove("active");
}

async function submitDailyReport() {
    // If table is empty, check if form fields are filled and auto-add to table first
    if (dailyReportRecords.length === 0) {
        const model = document.getElementById('drModel') ? document.getElementById('drModel').value : "";
        const prodQty = Number(document.getElementById('drProdQty').value) || 0;
        const rust = Number(document.getElementById('drRust').value) || 0;
        const dent = Number(document.getElementById('drDent').value) || 0;
        const colorDrop = Number(document.getElementById('drColorDrop').value) || 0;
        const thinPaint = Number(document.getElementById('drThinPaint').value) || 0;
        const thickPaint = Number(document.getElementById('drThickPaint').value) || 0;
        const waterStain = Number(document.getElementById('drWaterStain').value) || 0;
        const oil = Number(document.getElementById('drOil').value) || 0;
        const dust = Number(document.getElementById('drDust').value) || 0;
        const otherDefect = Number(document.getElementById('drOtherDefect').value) || 0;
        const totalDefect = rust + dent + colorDrop + thinPaint + thickPaint + waterStain + oil + dust + otherDefect;

        if (model && (prodQty > 0 || totalDefect > 0)) {
            addDailyReportRecord({ silent: true });
        }
    }

    if (dailyReportRecords.length === 0) {
        showToast("กรุณาเลือกรุ่นงาน ช่วงเวลา และกรอกยอดผลิตหรือของเสียก่อนบันทึก", "error");
        return;
    }

    const date = document.getElementById('reportDate').value;
    const shiftEl = document.querySelector('input[name="shift"]:checked');
    const shift = shiftEl ? shiftEl.value : "Day";
    const recorder = document.getElementById('recorderName') ? document.getElementById('recorderName').value : "";
    const checker = "";

    if (!date || !recorder) {
        showToast("กรุณากรอกวันที่และเลือกชื่อผู้บันทึกในส่วนที่ 1 ให้ครบถ้วน", "error");
        return;
    }

    const payload = {
        action: "submitDailyReport",
        submissionId: pendingDailyReportSubmissionId || (pendingDailyReportSubmissionId = createDailyReportSubmissionId()),
        date: date,
        shift: shift,
        recorder: recorder,
        checker: checker,
        records: dailyReportRecords
    };

    const submitBtn = document.getElementById('submitDailyBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `กำลังส่งข้อมูลไปยัง Google Sheets...`;

    try {
        // Send to Cloud API
        await sendDailyReportToAPI(payload);
        
        // Update local cache so Dashboard updates immediately
        const cached = localStorage.getItem("PAINTING_OUTPUTDIARY_CACHE");
        let list = [];
        if (cached) {
            try { list = JSON.parse(cached) || []; } catch(e){}
        }
        
        dailyReportRecords.forEach(r => {
            list.push({
                timestamp: `${date} 09:00`,
                date: date,
                shift: shift,
                recorder: recorder,
                checker: checker,
                productGroup: r.productGroup || "",
                partCategory: r.partCategory || "",
                model: r.model,
                color: r.color || "",
                colorCode: r.colorCode || "",
                timeSlot: r.timeSlot,
                prodQty: r.prodQty,
                rust: r.rust,
                dent: r.dent,
                colorDrop: r.colorDrop,
                thinPaint: r.thinPaint,
                thickPaint: r.thickPaint,
                waterStain: r.waterStain,
                oil: r.oil,
                dust: r.dust,
                otherDefect: r.otherDefect,
                totalDefect: r.totalDefect
            });
        });
        localStorage.setItem("PAINTING_OUTPUTDIARY_CACHE", JSON.stringify(list));
        localStorage.setItem("PAINTING_OUTPUTDIARY_INIT", "true");
        dailyReportHistoryRecords = list;

        showToast("บันทึกข้อมูลลง Google Sheets เรียบร้อยแล้ว!", "success");
        
        // Reset Form & Clear Draft
        dailyReportRecords = [];
        pendingDailyReportSubmissionId = null;
        localStorage.removeItem("PAINTING_DAILY_REPORT_DRAFT");
        renderDailyReportList();
        document.getElementById('drProdQty').value = "";
        
        if (typeof renderDailyReportCharts === 'function') {
            renderDailyReportCharts();
        }
    } catch(err) {
        showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `💾 บันทึกข้อมูลทันที`;
    }
}

async function generate1MonthMockData() {
    showToast("ระบบดึงข้อมูลจาก Google Sheets เท่านั้น", "info");
    return;
}

function renderQCDailyReportHistory() {
    const container = document.querySelector('.qc-daily-report-history-card');
    if (!container) return;

    const existingTitle = container.querySelector('.dr-section-title')?.textContent?.trim() || 'รายการพ่นสีรายวัน';
    const records = getSavedDailyReportRecords();

    const grouped = new Map();
    records.forEach(record => {
        const group = getDailyReportProductGroup(record);
        if (!grouped.has(group)) grouped.set(group, []);
        grouped.get(group).push(record);
    });

    const groupNames = [
        ...PAINTING_PRODUCT_GROUP_ORDER,
        ...Array.from(grouped.keys()).filter(group => !PAINTING_PRODUCT_GROUP_ORDER.includes(group))
    ];

    let detailIndex = 0;
    const renderRows = rows => rows.map(record => {
        const detailId = `qc-daily-detail-${detailIndex++}`;
        const qcRecordRef = encodeURIComponent(JSON.stringify({
            timestamp: record.timestamp || record.Timestamp || '',
            date: record.date || record.Date || '',
            model: record.model || record.Model || '',
            timeSlot: record.timeSlot || record.TimeSlot || '',
            color: record.color || record.Color || '',
            prodQty: Number(record.prodQty || record.ProdQty || record.prod_qty || record.qty) || 0,
            totalDefect: getDailyReportDefectTotal(record),
            submissionId: record.submissionId || record.SubmissionId || '',
            productGroup: getDailyReportProductGroup(record)
        }));
        return `
        <tr data-qc-record-ref="${qcRecordRef}">
            <td style="font-weight:700; white-space:nowrap;">${formatDailyReportDate(record.date || record.Date, record.timestamp || record.Timestamp)}</td>
            <td style="font-weight:700;">${escapeDailyReportHtml(record.model || record.Model || '-')}</td>
            <td><span class="badge" style="background:rgba(56,189,248,.15); color:#38bdf8; border:1px solid rgba(56,189,248,.3);">${escapeDailyReportHtml(record.timeSlot || record.TimeSlot || '-')}</span></td>
            <td style="text-align:center;">${escapeDailyReportHtml(record.color || record.Color || 'ไม่ระบุ')}</td>
            <td style="font-weight:800; color:#34d399; text-align:center;">${Number(record.prodQty || record.ProdQty || record.prod_qty || record.qty) || 0}</td>
            <td style="text-align:center;"><span class="badge-defect ${getDailyReportDefectTotal(record) > 0 ? 'badge-has-defect' : 'badge-zero'}">${getDailyReportDefectTotal(record)}</span></td>
            <td style="text-align:center;"><button type="button" class="qc-history-detail-button" data-qc-daily-detail-id="${detailId}" onclick="toggleQCDailyDetail('${detailId}', this, event)">ดูรายละเอียด</button></td>
            <td style="text-align:center; font-size:.78rem; color:#38bdf8; font-weight:700;">บันทึกแล้ว</td>
        </tr>
        <tr id="${detailId}" class="qc-history-detail-row" style="display:none;"><td colspan="9">${renderQCDailyReportDetail(record)}</td></tr>
    `;
    }).join('');

    const groupTables = groupNames.map(group => {
        const rows = grouped.get(group) || [];
        return `
            <section class="qc-daily-group-card">
                <div class="qc-daily-group-heading">
                    <h4>กลุ่มผลิตภัณฑ์: ${escapeDailyReportHtml(group)}</h4>
                    <span>${rows.length} รายการ</span>
                </div>
                <div class="table-responsive">
                    <table class="data-table qc-daily-group-table" style="width:100%; border-collapse:separate; border-spacing:0;">
                        <thead><tr><th>วันที่</th><th>รุ่นงาน</th><th>เวลา</th><th style="text-align:center;">สี</th><th style="text-align:center;">ยอดผลิต</th><th style="text-align:center;">ยอดเสีย</th><th style="text-align:center;">รายละเอียด</th><th style="text-align:center;">สถานะ</th></tr></thead>
                        <tbody>${rows.length ? renderRows(rows) : '<tr><td colspan="8" class="qc-daily-group-empty">ยังไม่มีรายการ</td></tr>'}</tbody>
                    </table>
                </div>
            </section>
        `;
    }).join('');

    container.innerHTML = `
        <div class="qc-daily-report-heading">
            <h3 class="dr-section-title" style="margin:0;">${escapeDailyReportHtml(existingTitle)}</h3>
            <span>${records.length} รายการทั้งหมด</span>
        </div>
        <div class="qc-daily-report-groups">${groupTables}</div>
    `;
}

function dailyReportDetailValue(record, keys, fallback = '-') {
    for (const key of keys) {
        const value = record && record[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') return value;
    }
    return fallback;
}

function renderQCDailyReportDetail(record) {
    const date = formatDailyReportDate(
        dailyReportDetailValue(record, ['date', 'Date'], ''),
        dailyReportDetailValue(record, ['timestamp', 'Timestamp'], '')
    );
    const productionFields = [
        ['วันที่', date],
        ['Timestamp', dailyReportDetailValue(record, ['timestamp', 'Timestamp'])],
        ['กะ', dailyReportDetailValue(record, ['shift', 'Shift'])],
        ['ผู้บันทึก', dailyReportDetailValue(record, ['recorder', 'Recorder', 'recordedBy', 'RecordedBy'])],
        ['ผู้ตรวจ/หัวหน้า', dailyReportDetailValue(record, ['checker', 'Checker', 'teamLeader', 'TeamLeader'])],
        ['กลุ่มผลิตภัณฑ์', dailyReportDetailValue(record, ['productGroup', 'ProductGroup'])],
        ['ประเภทชิ้นงาน', dailyReportDetailValue(record, ['partCategory', 'PartCategory'])],
        ['รุ่นงาน', dailyReportDetailValue(record, ['model', 'Model'])],
        ['ช่วงเวลา', dailyReportDetailValue(record, ['timeSlot', 'TimeSlot'])],
        ['สี', dailyReportDetailValue(record, ['color', 'Color'])],
        ['รหัสสี', dailyReportDetailValue(record, ['colorCode', 'ColorCode'])],
        ['ยอดผลิต (ชิ้น)', dailyReportDetailValue(record, ['prodQty', 'ProdQty', 'prod_qty', 'qty'], 0)]
    ];
    const defectFields = [
        ['สนิม', dailyReportDetailValue(record, ['rust', 'Rust'], 0)],
        ['รอยบุบ', dailyReportDetailValue(record, ['dent', 'Dent'], 0)],
        ['สะเก็ดรอยเชื่อม', dailyReportDetailValue(record, ['colorDrop', 'ColorDrop'], 0)],
        ['สีหนา/สีปูด', dailyReportDetailValue(record, ['thinPaint', 'ThinPaint'], 0)],
        ['คราบน้ำ/จาระบี', dailyReportDetailValue(record, ['thickPaint', 'ThickPaint'], 0)],
        ['คราบน้ำยา/คราบน้ำ', dailyReportDetailValue(record, ['waterStain', 'WaterStain'], 0)],
        ['คราบน้ำมัน', dailyReportDetailValue(record, ['oil', 'Oil'], 0)],
        ['เศษฝุ่น', dailyReportDetailValue(record, ['dust', 'Dust'], 0)],
        ['อื่น ๆ', dailyReportDetailValue(record, ['otherDefect', 'OtherDefect'], 0)],
        ['ของเสียรวม', getDailyReportDefectTotal(record)]
    ];
    const systemFields = [
        ['Downtime Burner', dailyReportDetailValue(record, ['downtimeBurner', 'Downtime_Burner'], 0)],
        ['Downtime Wash', dailyReportDetailValue(record, ['downtimeWash', 'Downtime_Wash'], 0)],
        ['Downtime Oven', dailyReportDetailValue(record, ['downtimeOven', 'Downtime_Oven_Etc', 'Downtime_Oven'], 0)],
        ['หมายเหตุ Downtime', dailyReportDetailValue(record, ['downtimeNote', 'Downtime_Note'])],
        ['Submission ID', dailyReportDetailValue(record, ['submissionId', 'SubmissionId'])]
    ];

    const renderSection = (title, fields, className = '') => `
        <section class="qc-daily-detail-section ${className}">
            <h5>${escapeDailyReportHtml(title)}</h5>
            <div class="qc-daily-detail-grid">
                ${fields.map(([label, value]) => {
                    const numericValue = Number(value);
                    const isNumericDefect = className.includes('defect') && Number.isFinite(numericValue);
                    const valueClass = isNumericDefect
                        ? (numericValue > 0 ? 'qc-daily-detail-value has-defect' : 'qc-daily-detail-value zero-defect')
                        : 'qc-daily-detail-value';
                    const totalClass = label === 'ของเสียรวม' ? ' qc-daily-detail-field-total' : '';
                    return `<div class="qc-daily-detail-field${totalClass}">
                        <span class="qc-daily-detail-label">${escapeDailyReportHtml(label)}</span>
                        <strong class="${valueClass}">${escapeDailyReportHtml(value)}</strong>
                    </div>`;
                }).join('')}
            </div>
        </section>`;

    return `<div class="qc-history-detail-wrap qc-daily-detail-wrap">
        ${renderSection('ข้อมูลการผลิต', productionFields, 'qc-daily-detail-production')}
        ${renderSection('รายการของเสีย', defectFields, 'qc-daily-detail-defects')}
        ${renderSection('Downtime และข้อมูลระบบ', systemFields, 'qc-daily-detail-system')}
    </div>`;
}

function toggleQCDailyDetail(detailId, button, event) {
    const handledAt = Number(button?.dataset?.qcDetailHandledAt || 0);
    // The document-level handler handles real pointer input first. This
    // inline fallback is for click-only activation and must not toggle twice.
    if (handledAt && Date.now() - handledAt < 500) {
        event?.preventDefault();
        event?.stopPropagation();
        return;
    }
    event?.preventDefault();
    event?.stopPropagation();
    const detailRow = document.getElementById(detailId || '');
    if (!detailRow) return;
    const isOpen = detailRow.style.display === 'table-row';
    detailRow.dataset.qcDetailExpanded = isOpen ? 'false' : 'true';
    detailRow.style.display = isOpen ? 'none' : 'table-row';
    if (button) {
        button.textContent = isOpen ? 'ดูรายละเอียด' : 'ซ่อนรายละเอียด';
        button.dataset.qcDetailHandledAt = String(Date.now());
    }
}

function getDailyReportProductGroup(record) {
    const explicit = record?.productGroup || record?.ProductGroup || record?.product_group;
    if (String(explicit || '').trim()) return String(explicit).trim();

    const model = String(record?.model || record?.Model || '').trim();
    if (model) {
        for (const group of PAINTING_PRODUCT_GROUP_ORDER) {
            const categories = PAINTING_MODEL_GROUPS[group]?.categories || {};
            const matched = Object.values(categories).some(models => (models || []).some(item => String(item.value || item).trim() === model));
            if (matched) return group;
        }
    }
    return 'ไม่ระบุ';
}
