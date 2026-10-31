let inspectionRecords = [];
let dailyChartInstance = null;
let dailyByDayChartInstance = null;
let donutChartInstance = null;
let inspectionVsOutputChartInstance = null;
let outputDailyChartInstance = null;
let topModelsChartInstance = null;
let qualityYieldChartInstance = null;
let currentQualityViewMode = 'ng';
let globalQualityChartCache = { datesList: [], pctOkList: [], pctNgList: [] };
let inspectionDataScope = "today";
let dashboardDateChangeTimer = null;
let paintingAppInitUserKey = "";
let paintingAppInitPromise = null;
let paintingAppPollingStarted = false;

function hasAppPermission(permission) {
    return !!(
        typeof PaintingAuth !== 'undefined' &&
        PaintingAuth.currentUser &&
        typeof PaintingAuth.hasPermission === 'function' &&
        PaintingAuth.hasPermission(permission)
    );
}

function canLoadInspectionData() {
    return ['dashboard.read', 'qc7.read'].some(hasAppPermission);
}

function formatDateForDisplay(dateVal, timestampVal) {
    let source = timestampVal || dateVal;
    if (!source) return '-';

    let str = String(source).trim();
    if (!str) return '-';

    // If it's already "YYYY-MM-DD HH:mm" or "YYYY-MM-DD HH:mm:ss"
    if (/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(str)) {
        return str.substring(0, 16);
    }

    try {
        let d = new Date(str);
        if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        }
    } catch (e) {}

    // Fallback: If string contains T (ISO format)
    if (str.includes('T')) {
        const parts = str.split('T');
        const dPart = parts[0];
        const tPart = parts[1] ? parts[1].substring(0, 5) : '00:00';
        return `${dPart} ${tPart}`;
    }

    return str;
}

function setCurrentDateTimeDefaults() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');

    const dateStr = `${yyyy}-${mm}-${dd}`;
    const timeStr = `${hh}:${min}`;

    const dateInput = document.getElementById("date");
    if (dateInput) {
        dateInput.value = dateStr;
        dateInput.setAttribute("value", dateStr);
    }
    const timeInput = document.getElementById("time");
    if (timeInput) {
        timeInput.value = timeStr;
        timeInput.setAttribute("value", timeStr);
        try {
            timeInput.dispatchEvent(new Event('input', { bubbles: true }));
            timeInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch (e) {}
    }
}

async function initializePaintingApp() {
    // Do not start data requests before authentication (and the live permission
    // refresh) has completed. This is important for users who only have the
    // inspection-create permission.
    if (typeof PaintingAuth === 'undefined' || !PaintingAuth.currentUser || PaintingAuth.ready === false) {
        return;
    }

    const userKey = String(PaintingAuth.currentUser.employeeId || PaintingAuth.currentUser.displayName || '');
    if (paintingAppInitPromise && paintingAppInitUserKey === userKey) {
        return paintingAppInitPromise;
    }

    paintingAppInitUserKey = userKey;
    paintingAppInitPromise = (async () => {
        // Keep the authentication layer from blocking the app after a restored
        // session (for example when the site is opened from a fresh cache-busted URL).
        if (typeof PaintingAuth.hideAuthModal === 'function') {
            PaintingAuth.hideAuthModal();
        }

        setCurrentDateTimeDefaults();

        const dashboardDateInput = document.getElementById("dashboardDateFilter");
        const dashboardDateEndInput = document.getElementById("dashboardDateFilterEnd");
        const todayDate = getStandardISODate(new Date().toISOString());
        if (dashboardDateInput) dashboardDateInput.value = todayDate;
        if (dashboardDateEndInput) dashboardDateEndInput.value = todayDate;

        const cacheVer = localStorage.getItem("PAINTING_INSPECTION_CACHE_VER");
        if (cacheVer !== "2.0.0") {
            localStorage.removeItem("PAINTING_INSPECTION_CACHE");
            localStorage.removeItem("PAINTING_OUTPUTDIARY_CACHE");
            localStorage.removeItem("PAINTING_EVENTS_CACHE");
            localStorage.setItem("PAINTING_INSPECTION_CACHE_VER", "2.0.0");
        }

        // Only initialize data-heavy sections when the user can actually read
        // them. A user who can only create inspections should get a fast form
        // without downloading reports, charts, histories, or checklist data.
        if (hasAppPermission('daily_report.read') && typeof initDailyReportForm === 'function') {
            initDailyReportForm();
        }
        if (hasAppPermission('rework.read') && typeof initReworkForm === 'function') {
            initReworkForm();
        }
        if (hasAppPermission('screen.read') && typeof initScreenForm === 'function') {
            initScreenForm();
        }
        if (hasAppPermission('checklist.read') && typeof initParameterChecklist === 'function') {
            initParameterChecklist();
        }

        // Preload data for the two administrative/reporting pages that users
        // previously had to refresh manually. These calls run in the
        // background and are still permission-gated.
        if (hasAppPermission('users.manage') && typeof PaintingAuth.loadUsers === 'function') {
            Promise.resolve(PaintingAuth.loadUsers()).catch(error => {
                console.warn('Unable to preload user list:', error);
            });
        }

        const settingInput = document.getElementById("settingApiUrl");
        if (settingInput && typeof getApiUrl === 'function') {
            settingInput.value = getApiUrl();
        }

        if (canLoadInspectionData()) {
            await loadDataFromAPI(false, todayDate);
        } else {
            // Do not leave stale records in memory when this user is not
            // permitted to read inspection data.
            inspectionRecords = [];
            inspectionDataScope = "today";
        }

        // Allow a shared URL to open a permitted menu directly. The normal
        // dashboard remains the default when no tab is present in the hash.
        const requestedTab = window.location.hash.replace(/^#/, '');
        if (requestedTab && requestedTab !== 'dashboard-tab' && document.getElementById(requestedTab)) {
            switchTab(requestedTab);
        }

        // Poll data every 15 seconds only if there are no pending sync requests.
        // Each request is permission-gated so changing permissions takes effect
        // without forcing a full page reload.
        if (!paintingAppPollingStarted) {
            paintingAppPollingStarted = true;
            setInterval(() => {
                if (typeof activeSyncRequests !== 'undefined' && activeSyncRequests !== 0) {
                    return;
                }

                if (canLoadInspectionData()) {
                    loadDataFromAPI(true); // silent reload
                }
                if ((hasAppPermission('daily_report.read') || hasAppPermission('events.read')) && typeof renderStaffDropdowns === 'function') {
                    renderStaffDropdowns();
                }
                if (hasAppPermission('events.read') && typeof loadEventsData === 'function') {
                    loadEventsData();
                }
                if (hasAppPermission('daily_report.read') && typeof refreshDailyReportHistory === 'function') {
                    refreshDailyReportHistory();
                }
                // QC history is refreshed when its menu opens or when the
                // user presses its refresh button. Do not poll all three
                // checklist sheets every 15 seconds while the page is open.
            }, 15000);
        }
    })();

    try {
        await paintingAppInitPromise;
    } catch (error) {
        console.error('Painting app initialization failed:', error);
        paintingAppInitPromise = null;
    }
    return paintingAppInitPromise;
}

window.initializePaintingApp = initializePaintingApp;
window.onload = () => initializePaintingApp();

async function loadDataFromAPI(silent = false, requestedDate = null) {
    if (!canLoadInspectionData()) {
        return;
    }
    if (!silent) showToast("กำลังโหลดข้อมูล...", "info");
    
    // Only fetch if not currently syncing to avoid race conditions overriding local cache
    if (typeof activeSyncRequests !== 'undefined' && activeSyncRequests > 0) {
        return;
    }

    const dashboardInput = document.getElementById("dashboardDateFilter");
    const selectedDate = requestedDate === null
        ? (inspectionDataScope === "all" ? "" : (dashboardInput ? dashboardInput.value : getStandardISODate(new Date().toISOString())))
        : String(requestedDate || "").trim();

    inspectionRecords = await fetchInspectionDataFromAPI(selectedDate);
    inspectionDataScope = selectedDate ? selectedDate : "all";
    
    // Sort records by date descending
    inspectionRecords.sort((a, b) => new Date(b.timestamp || b.date) - new Date(a.timestamp || a.date));

    renderDashboard();
    renderTables();

    if (!silent) showToast("โหลดข้อมูลสำเร็จ (" + inspectionRecords.length + " รายการ)", "success");
}

function toggleChecklistMenu(event, element) {
    if (event) event.preventDefault();
    const submenu = document.getElementById('checklist-submenu');
    if (!submenu) return;
    const isOpen = !submenu.hidden;
    submenu.hidden = isOpen;
    if (element) element.setAttribute('aria-expanded', String(!isOpen));
}

function toggleProductionMenu(event, element) {
    if (event) event.preventDefault();
    const submenu = document.getElementById('production-submenu');
    if (!submenu) return;
    const isOpen = !submenu.hidden;
    submenu.hidden = isOpen;
    if (element) element.setAttribute('aria-expanded', String(!isOpen));
}

function toggleMobileChecklistMenu(event, element) {
    if (event) {
        event.stopPropagation();
        // Keep the mobile trigger's click activation intact. Cancelling the
        // click before the toggle runs can make a partially visible item
        // appear unresponsive on iOS.
        if (event.cancelable && event.type !== 'click') event.preventDefault();
    }
    const menu = document.getElementById('mobile-checklist-menu');
    if (!menu) return;
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    menu.classList.toggle('is-open', willOpen);
    if (element) element.setAttribute('aria-expanded', String(willOpen));
}

function closeMobileChecklistMenu() {
    const menu = document.getElementById('mobile-checklist-menu');
    const trigger = document.querySelector('[data-mobile-checklist="true"]');
    if (menu) {
        menu.hidden = true;
        menu.classList.remove('is-open');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function toggleMobileProductionMenu(event, element) {
    if (event) {
        event.stopPropagation();
        if (event.cancelable && event.type !== 'click') event.preventDefault();
    }
    const menu = document.getElementById('mobile-production-menu');
    if (!menu) return;
    closeMobileChecklistMenu();
    const willOpen = menu.hidden;
    menu.hidden = !willOpen;
    menu.classList.toggle('is-open', willOpen);
    if (element) element.setAttribute('aria-expanded', String(willOpen));
}

function closeMobileProductionMenu() {
    const menu = document.getElementById('mobile-production-menu');
    const trigger = document.querySelector('.mobile-production-trigger');
    if (menu) {
        menu.hidden = true;
        menu.classList.remove('is-open');
    }
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
}

function openProductionTab(tabId, event, element) {
    if (event) event.preventDefault();
    closeMobileProductionMenu();
    switchTab(tabId, element);
}

function openParameterChecklistMode(mode, event, element) {
    if (event) event.preventDefault();
    closeMobileChecklistMenu();
    if (typeof setParameterChecklistMode === 'function') setParameterChecklistMode(mode);
    switchTab('parameter-checklist-tab', element);
}

function openEquipmentChecklist(event, element) {
    if (event) event.preventDefault();
    closeMobileChecklistMenu();
    switchTab('equipment-checklist-tab', element);
}

function switchTab(tabId, element) {
    const targetForPermission = document.getElementById(tabId);
    const requiredPermission = targetForPermission ? targetForPermission.dataset.permission : "";
    if (requiredPermission && window.PaintingAuth && typeof PaintingAuth.hasPermission === 'function' && !PaintingAuth.hasPermission(requiredPermission)) {
        if (typeof showToast === 'function') showToast("คุณไม่มีสิทธิ์เข้าถึงส่วนนี้", "error");
        return;
    }

    if (typeof closeMobileChecklistMenu === 'function') closeMobileChecklistMenu();
    if (typeof closeMobileProductionMenu === 'function') closeMobileProductionMenu();

    const targetTab = document.getElementById(tabId);

    // Hide all tab pages & remove active class
    // The inspection form lives with the legacy modal markup at the end of
    // the document. Move it into the regular content area before displaying
    // it so it receives the same header/sidebar layout as every other page.
    if (tabId === "inspection-tab" && targetTab) {
        const contentBody = document.querySelector(".content-body");
        if (contentBody && !contentBody.contains(targetTab)) {
            contentBody.appendChild(targetTab);
        }

        // The latest-records table belongs with the inspection entry workflow,
        // so move the existing rendered table alongside the form once the page
        // is opened. Its original id stays unchanged for table rendering.
        const recentInspectionCard = document.getElementById("dashboardRecentInspectionCard");
        if (recentInspectionCard && !targetTab.contains(recentInspectionCard)) {
            targetTab.appendChild(recentInspectionCard);
        }
    }

    document.querySelectorAll(".tab-page").forEach(page => {
        page.classList.remove("active");
        page.style.display = "none";
    });
    
    // Remove active class from all nav items (sidebar links & mobile bottom nav items)
    document.querySelectorAll(".nav-link, .mobile-nav-item").forEach(link => link.classList.remove("active"));

    // Show target tab page
    if (targetTab) {
        targetTab.classList.add("active");
        targetTab.style.display = "block";
        // Keep the URL hash on the page actually shown. A stale hash (e.g.
        // #inspection-tab from the menu link) made the periodic permission
        // refresh switch back to that page.
        if (window.location.hash !== "#" + tabId && window.history && history.replaceState) {
            history.replaceState(null, "", "#" + tabId);
        }
    }

    // Highlight all matching navigation items (both desktop & mobile)
    document.querySelectorAll(`[onclick*="${tabId}"]`).forEach(el => el.classList.add("active"));
    if (tabId === "inspection-tab") {
        document.querySelectorAll('[onclick*="openInspectionModal"]').forEach(el => el.classList.add("active"));
    }
    if (tabId === "qc7-tools-tab") {
        document.querySelectorAll('[onclick*="openQC7Tools"]').forEach(el => el.classList.add("active"));
    }
    if (tabId === "parameter-checklist-tab" || tabId === "equipment-checklist-tab") {
        document.querySelectorAll('[data-mobile-checklist="true"]').forEach(el => el.classList.add("active"));
    }
    if (tabId === "daily-report-tab" || tabId === "rework-tab" || tabId === "screen-tab" || tabId === "pre-assy-tab") {
        document.querySelectorAll('.production-menu-parent, .mobile-production-trigger').forEach(el => el.classList.add("active"));
    }

    // Scroll window to top smoothly
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabId === "dashboard-tab") {
        renderDashboard();
    } else if (tabId === "qc7-tools-tab") {
        initQC7Tools();
    } else if (tabId === "daily-report-tab") {
        if (typeof renderStaffDropdowns === 'function') {
            renderStaffDropdowns();
        }
        if (typeof renderDailyReportList === 'function') {
            renderDailyReportList();
        }
    } else if (tabId === "rework-tab") {
        if (typeof initReworkForm === 'function') initReworkForm();
        if (typeof selectCurrentTimeSlot === 'function') selectCurrentTimeSlot('rwTime');
        if (typeof refreshReworkHistory === 'function') refreshReworkHistory();
    } else if (tabId === "screen-tab") {
        if (typeof initScreenForm === 'function') initScreenForm();
        if (typeof selectCurrentTimeSlot === 'function') selectCurrentTimeSlot('scTime');
        if (typeof refreshScreenHistory === 'function') refreshScreenHistory();
    } else if (tabId === "pre-assy-tab") {
        if (typeof initPreAssyForm === 'function') initPreAssyForm();
        if (typeof selectCurrentTimeSlot === 'function') selectCurrentTimeSlot('paTime');
        if (typeof refreshPreAssyHistory === 'function') refreshPreAssyHistory();
    } else if (tabId === "parameter-checklist-tab") {
        if (typeof initParameterChecklist === 'function') {
            initParameterChecklist();
        }
    } else if (tabId === "equipment-checklist-tab") {
        if (typeof initEquipmentChecklist === 'function') {
            initEquipmentChecklist();
        }
    } else if (tabId === "qc-history-tab") {
        if (typeof refreshQCChecklistHistory === 'function') {
            refreshQCChecklistHistory();
        }
    } else if (tabId === "event-tab") {
        if (typeof loadEventsData === 'function') {
            loadEventsData();
        }
        if (typeof renderEventsTab === 'function') {
            renderEventsTab();
        }
    } else if (tabId === "spare-parts-tab") {
        if (typeof initSparePartsModule === 'function') {
            initSparePartsModule();
        }
    } else if (tabId === "history-tab") {
        if (inspectionDataScope !== "all") {
            loadDataFromAPI(true, "").then(() => {
                if (typeof renderTables === 'function') renderTables();
            });
        } else if (typeof renderTables === 'function') {
            renderTables();
        }
    } else if (tabId === "settings-tab") {
        // Load the live user list whenever the management page is opened.
        // The page starts with a loading placeholder, so without this call
        // it stayed there until the manual refresh button was pressed.
        if (window.PaintingAuth && typeof PaintingAuth.loadUsers === 'function') {
            PaintingAuth.loadUsers();
        }
    }
}

function openInspectionModal() {
    if (window.PaintingAuth && PaintingAuth.currentUser && typeof PaintingAuth.hideAuthModal === 'function') {
        PaintingAuth.hideAuthModal();
    }

    if (window.PaintingAuth && typeof PaintingAuth.hasPermission === 'function' && !PaintingAuth.hasPermission('inspection.create')) {
        if (typeof showToast === 'function') showToast("คุณไม่มีสิทธิ์บันทึกงานตรวจ", "error");
        return;
    }
    const page = document.getElementById("inspection-tab");
    if (page) {
        // Clear Edit Mode Flags
        document.getElementById("editRowIndex").value = "";
        document.getElementById("editOriginalDate").value = "";
        document.getElementById("editIndexInArray").value = "";
        const titleEl = document.getElementById("modalTitleText");
        if (titleEl) titleEl.innerText = "📝 บันทึกข้อมูลการตรวจเช็ค (Painting Inspection)";

        document.getElementById("inspectionForm").reset();
        const workTypeInput = document.getElementById("workType");
        if (workTypeInput) workTypeInput.value = "NEW";
        setCurrentDateTimeDefaults();

        switchTab("inspection-tab");
        calculateTotalDefects();

        setTimeout(setCurrentDateTimeDefaults, 50);
        setTimeout(setCurrentDateTimeDefaults, 250);
    }
}

function closeInspectionModal() {
    const page = document.getElementById("inspection-tab");
    if (page) {
        document.getElementById("editRowIndex").value = "";
        document.getElementById("editOriginalDate").value = "";
        document.getElementById("editIndexInArray").value = "";
        switchTab("dashboard-tab");
    }
}

// Universal Date & Time Picker Auto-Open Listener
document.addEventListener("click", (e) => {
    const el = e.target;
    if (el && el.tagName === "INPUT" && (el.type === "date" || el.type === "time" || el.type === "datetime-local")) {
        if (typeof el.showPicker === "function") {
            try {
                el.showPicker();
            } catch (err) {}
        }
    }
});

// Edit Inspection Record: Pre-fills PREVIOUSLY SAVED Date & Time so user can modify or preserve it
function editInspectionRecord(index) {
    const record = inspectionRecords[index];
    if (!record) return;

    const page = document.getElementById("inspection-tab");
    if (!page) return;

    switchTab("inspection-tab");

    // Set Edit Mode Title
    const titleEl = document.getElementById("modalTitleText");
    if (titleEl) titleEl.innerText = "✏️ แก้ไขข้อมูลการตรวจเช็ค (Painting Inspection)";

    // Set Hidden Inputs for exact in-place overwrite
    document.getElementById("editRowIndex").value = record.rowIndex || (index + 2);
    document.getElementById("editOriginalDate").value = record.date || record.timestamp || "";
    document.getElementById("editIndexInArray").value = index;

    // Extract PREVIOUSLY SAVED Date & Time
    const rawDateStr = String(record.date || record.timestamp || "").trim();
    let datePart = "";
    let timePart = "12:00";

    if (rawDateStr.includes(" ")) {
        const parts = rawDateStr.split(" ");
        datePart = parts[0];
        timePart = parts[1] ? parts[1].substring(0, 5) : "12:00";
    } else if (rawDateStr.includes("T")) {
        const parts = rawDateStr.split("T");
        datePart = parts[0];
        timePart = parts[1] ? parts[1].substring(0, 5) : "12:00";
    } else {
        datePart = rawDateStr.substring(0, 10);
    }

    // Set Date & Time to PREVIOUSLY SAVED values
    const dateInput = document.getElementById("date");
    if (dateInput && datePart) dateInput.value = datePart;

    const timeInput = document.getElementById("time");
    if (timeInput && timePart) {
        timeInput.value = timePart;
        timeInput.setAttribute("value", timePart);
        try {
            timeInput.dispatchEvent(new Event('input', { bubbles: true }));
            timeInput.dispatchEvent(new Event('change', { bubbles: true }));
        } catch(e){}
    }

    const workTypeInput = document.getElementById("workType");
    if (workTypeInput) workTypeInput.value = normalizeInspectionWorkType(record.workType) || "";

    document.getElementById("rust").value = Number(record.rust) || 0;
    document.getElementById("dent").value = Number(record.dent) || 0;
    document.getElementById("weld").value = Number(record.weld) || 0;
    document.getElementById("chemical").value = Number(record.chemical) || 0;
    document.getElementById("oil").value = Number(record.oil) || 0;
    document.getElementById("note").value = record.note || "";

    calculateTotalDefects();
}

async function deleteInspectionRecord(index) {
    const record = inspectionRecords[index];
    if (!record) return;

    if (typeof activeSyncRequests !== 'undefined' && activeSyncRequests > 0) {
        showToast("กำลังซิงค์ข้อมูล กรุณารอสักครู่แล้วลองใหม่", "info");
        return;
    }

    const confirmMsg = `คุณต้องการลบรายการตรวจเช็คของวันที่ "${formatDateForDisplay(record.date, '')}" ใช่หรือไม่?`;
    if (!confirm(confirmMsg)) return;

    // Remove locally from memory and re-render immediately
    inspectionRecords.splice(index, 1);
    renderDashboard();
    renderTables();
    showToast("กำลังลบข้อมูลออกจากระบบ...", "info");

    try {
        await deleteDataFromAPI(record);
        showToast("ลบข้อมูลเรียบร้อยแล้ว!", "success");
    } catch (err) {
        showToast("เกิดข้อผิดพลาดในการลบ: " + err.message, "error");
    }
}

function calculateTotalDefects() {
    const rust = Number(document.getElementById("rust").value) || 0;
    const dent = Number(document.getElementById("dent").value) || 0;
    const weld = Number(document.getElementById("weld").value) || 0;
    const chemical = Number(document.getElementById("chemical").value) || 0;
    const oil = Number(document.getElementById("oil").value) || 0;

    const total = rust + dent + weld + chemical + oil;
    const previewEl = document.getElementById("modalTotalPreview");
    if (previewEl) {
        previewEl.innerText = `${total} ชิ้น`;
    }
    return total;
}

async function handleFormSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById("submitBtn");
    const editRowIndex = document.getElementById("editRowIndex").value;
    const editOriginalDate = document.getElementById("editOriginalDate").value;
    const editIndexInArray = document.getElementById("editIndexInArray").value;
    const isEditMode = Boolean(editRowIndex || editOriginalDate || editIndexInArray !== "");

    submitBtn.disabled = true;
    submitBtn.innerHTML = isEditMode ? `กำลังบันทึกทับข้อมูลเดิม...` : `กำลังบันทึก...`;

    const now = new Date();
    const inputDate = document.getElementById("date").value;
    const inputTime = document.getElementById("time").value;

    const defaultTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const selectedTime = inputTime || defaultTime;
    const formattedDateTime = inputDate ? `${inputDate} ${selectedTime}` : `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${selectedTime}`;

    const data = {
        rowIndex: editRowIndex,
        originalDate: editOriginalDate,
        date: formattedDateTime,
        workType: normalizeInspectionWorkType(document.getElementById("workType").value),
        rust: Number(document.getElementById("rust").value) || 0,
        dent: Number(document.getElementById("dent").value) || 0,
        weld: Number(document.getElementById("weld").value) || 0,
        chemical: Number(document.getElementById("chemical").value) || 0,
        oil: Number(document.getElementById("oil").value) || 0,
        note: document.getElementById("note").value.trim(),
        timestamp: formattedDateTime
    };

    try {
        if (isEditMode) {
            // Overwrite in-place in local array to prevent duplicate rows
            const arrIndex = Number(editIndexInArray);
            if (!isNaN(arrIndex) && arrIndex >= 0 && arrIndex < inspectionRecords.length) {
                inspectionRecords[arrIndex] = {
                    ...data,
                    rowIndex: editRowIndex || inspectionRecords[arrIndex].rowIndex
                };
            }
            renderDashboard();
            renderTables();

            await updateDataToAPI(data);
            showToast("แก้ไขบันทึกทับข้อมูลเดิมเรียบร้อยแล้ว!", "success");
        } else {
            await sendDataToAPI(data);
            inspectionRecords = [{ ...data, rowIndex: null }, ...(Array.isArray(inspectionRecords) ? inspectionRecords : [])];
            renderDashboard();
            renderTables();
            showToast("บันทึกข้อมูลเรียบร้อยแล้ว!", "success");
        }
        
        closeInspectionModal();
        document.getElementById("inspectionForm").reset();
        setCurrentDateTimeDefaults();
    } catch (err) {
        showToast("เกิดข้อผิดพลาดในการบันทึก: " + err.message, "error");
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `💾 บันทึกข้อมูล`;
    }
}

function getStandardISODate(raw) {
    if (!raw) return '';
    let s = String(raw).trim();
    if (s.includes('T')) s = s.split('T')[0];
    if (s.includes(' ')) s = s.split(' ')[0];
    if (s.includes('/')) {
        const p = s.split('/');
        if (p.length === 3) {
            if (p[0].length === 4) return `${p[0]}-${p[1].padStart(2, '0')}-${p[2].padStart(2, '0')}`;
            return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
        }
    }
    return s.substring(0, 10);
}

function queueDashboardDateChange(dateValue) {
    clearTimeout(dashboardDateChangeTimer);
    dashboardDateChangeTimer = setTimeout(() => changeDashboardDate(dateValue), 80);
}

function getDashboardDateRange() {
    const startInput = document.getElementById("dashboardDateFilter");
    const endInput = document.getElementById("dashboardDateFilterEnd");
    let start = getStandardISODate(startInput ? startInput.value : "");
    let end = getStandardISODate(endInput ? endInput.value : "");
    // Keep the legacy single-date control usable when the end-date field is not
    // present on an older cached page.
    if (start && !end && !endInput) end = start;
    if (start && end && start > end) [start, end] = [end, start];
    return { start, end };
}

function dashboardRecordInDateRange(record, range = getDashboardDateRange()) {
    const recordDate = getStandardISODate(record && (record.date || record.Date));
    if (!recordDate) return false;
    if (range.start && recordDate < range.start) return false;
    if (range.end && recordDate > range.end) return false;
    return true;
}

function queueDashboardDateRangeChange() {
    clearTimeout(dashboardDateChangeTimer);
    dashboardDateChangeTimer = setTimeout(() => changeDashboardDateRange(), 80);
}

async function changeDashboardDateRange() {
    const range = getDashboardDateRange();
    const startInput = document.getElementById("dashboardDateFilter");
    const endInput = document.getElementById("dashboardDateFilterEnd");
    if (startInput && endInput && startInput.value && endInput.value && startInput.value > endInput.value) {
        showToast("วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด", "error");
        return;
    }

    // A single day can use the server-side date filter. A range needs the full
    // history once, then all dashboard sections share the same client filter.
    const requestedDate = range.start && range.end && range.start === range.end
        ? range.start
        : "";
    await loadDataFromAPI(false, requestedDate);
}

async function changeDashboardDate(dateValue) {
    const selectedDate = String(dateValue || "").trim();
    await loadDataFromAPI(false, selectedDate || getStandardISODate(new Date().toISOString()));
}

async function showAllDashboardData() {
    const filterInput = document.getElementById("dashboardDateFilter");
    const endInput = document.getElementById("dashboardDateFilterEnd");
    if (filterInput) filterInput.value = "";
    if (endInput) endInput.value = "";
    await loadDataFromAPI(false, "");
}

function resetDashboardDateFilter() {
    return showAllDashboardData();
}

function resetInspectionDashboard() {
    const zeroIds = [
        "kpiTotalInspections",
        "kpiTotalDefects",
        "kpiTodayDefects",
        "kpiTopDefectCount"
    ];
    zeroIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = id === "kpiTopDefectCount" ? "0 ชิ้น" : "0";
    });

    const topDefect = document.getElementById("kpiTopDefect");
    if (topDefect) topDefect.innerText = "-";
    const avgDefect = document.getElementById("kpiAvgDefectPerJob");
    if (avgDefect) avgDefect.innerText = "เฉลี่ย 0 ชิ้น/ครั้ง";

    if (dailyChartInstance) { dailyChartInstance.destroy(); dailyChartInstance = null; }
    if (dailyByDayChartInstance) { dailyByDayChartInstance.destroy(); dailyByDayChartInstance = null; }
    if (donutChartInstance) { donutChartInstance.destroy(); donutChartInstance = null; }
    if (inspectionVsOutputChartInstance) { inspectionVsOutputChartInstance.destroy(); inspectionVsOutputChartInstance = null; }
    const severityList = document.getElementById("defectProgressList");
    if (severityList) severityList.innerHTML = "";
    renderRecentTable([]);
    renderDailyReportCharts();
}

function renderDashboard() {
    if (typeof window.loadScreenDashboardChart === "function") {
        window.loadScreenDashboardChart();
    }

    const hasInspectionRows = Array.isArray(inspectionRecords) && inspectionRecords.length > 0;
    if (!hasInspectionRows) {
        resetInspectionDashboard();
        return;
    }

    // Apply Date Filter
    const range = getDashboardDateRange();
    const hasDateFilter = Boolean(range.start || range.end);

    let filteredRecords = inspectionRecords;
    if (hasDateFilter) {
        filteredRecords = inspectionRecords.filter(r => dashboardRecordInDateRange(r, range));
    }

    // 1. Calculate KPI Metrics using Filtered Data
    let totalInspections = filteredRecords.length;
    let totalRust = 0, totalDent = 0, totalWeld = 0, totalChemical = 0, totalOil = 0;

    const todayStr = getStandardISODate(new Date().toISOString());
    let todayDefects = 0;

    filteredRecords.forEach(r => {
        const rust = Number(r.rust) || 0;
        const dent = Number(r.dent) || 0;
        const weld = Number(r.weld) || 0;
        const chemical = Number(r.chemical) || 0;
        const oil = Number(r.oil) || 0;
        const rowTotal = rust + dent + weld + chemical + oil;

        totalRust += rust;
        totalDent += dent;
        totalWeld += weld;
        totalChemical += chemical;
        totalOil += oil;

        const recordDateStr = getStandardISODate(r.date || r.Date);
        if (recordDateStr === todayStr) {
            todayDefects += rowTotal;
        }
    });

    const grandTotalDefects = totalRust + totalDent + totalWeld + totalChemical + totalOil;
    const avgDefects = totalInspections > 0 ? (grandTotalDefects / totalInspections).toFixed(1) : 0;

    // Determine Top Defect Category
    const defectsCategory = [
        { name: "งานเป็นสนิม", val: totalRust, color: "#f59e0b" },
        { name: "รอยบุบ", val: totalDent, color: "#3b82f6" },
        { name: "สะเก็ดรอยเชื่อม", val: totalWeld, color: "#ef4444" },
        { name: "คราบน้ำยา", val: totalChemical, color: "#06b6d4" },
        { name: "คราบน้ำมัน", val: totalOil, color: "#8b5cf6" }
    ];
    defectsCategory.sort((a, b) => b.val - a.val);

    document.getElementById("kpiTotalInspections").innerText = totalInspections;
    document.getElementById("kpiTotalDefects").innerText = grandTotalDefects;
    document.getElementById("kpiAvgDefectPerJob").innerText = `เฉลี่ย ${avgDefects} ชิ้น/ครั้ง`;

    // Update KPI 1 subtext
    const kpi1Subtext = document.querySelector('.kpi-card.blue .kpi-subtext');
    if (kpi1Subtext) {
        kpi1Subtext.innerText = hasDateFilter ? `↑ รายการในช่วงวันที่เลือก` : `↑ รายการทั้งหมด`;
    }

    const topCategory = defectsCategory[0];
    document.getElementById("kpiTopDefect").innerText = topCategory.val > 0 ? topCategory.name : "-";
    document.getElementById("kpiTopDefectCount").innerText = topCategory.val > 0 ? `${topCategory.val} ชิ้น` : "0 ชิ้น";

    // Update KPI 4
    document.getElementById("kpiTodayDefects").innerText = hasDateFilter ? grandTotalDefects : todayDefects;
    const kpi4Title = document.querySelector('.kpi-card.yellow .kpi-label');
    const kpi4Subtext = document.querySelector('.kpi-card.yellow .kpi-subtext');
    if (kpi4Title) kpi4Title.innerText = hasDateFilter ? 'อัตราของเสียที่เลือก' : 'อัตราของเสียวันนี้';
    if (kpi4Subtext) kpi4Subtext.innerText = hasDateFilter ? 'ช่วงวันที่เลือก' : 'วันนี้';

    // 2. Dashboard overview is sourced from Inspection only. QC 7 TOOL has
    // its own combined Inspection + outputdiary data source.
    const chartSource = inspectionRecords;
    const chartRecords = hasDateFilter
        ? chartSource.filter(record => dashboardRecordInDateRange(record, range))
        : chartSource;
    const chartMode = hasDateFilter ? 'range' : (inspectionDataScope === 'all' ? 'all' : '');
    const inspectionTypes = getInspectionDefectTypes();
    renderDailyChart(chartRecords, chartMode, inspectionTypes);
    renderDailyByDayChart(chartRecords, inspectionTypes);

    // 3. Render Defect Donut Chart
    const chartDefectsCategory = defectsCategory;
    const chartGrandTotalDefects = chartDefectsCategory.reduce((sum, item) => sum + item.val, 0);
    renderDonutChart(chartDefectsCategory, chartGrandTotalDefects);

    // 4. Render Defect Progress Bars
    renderSeverityBars(chartDefectsCategory, chartGrandTotalDefects);

    // 5. Update Recent Table to reflect filtered date
    renderRecentTable(hasDateFilter ? filteredRecords : inspectionRecords);

    // 6. Render Output Diary Charts (from Google Sheets outputdiary)
    renderDailyReportCharts();

}

function getInspectionDefectTypes() {
    const inspectionKeys = new Set(['rust', 'dent', 'weld', 'chemical', 'oil']);
    return (typeof qc7DefectTypes !== 'undefined' ? qc7DefectTypes : [])
        .filter(type => inspectionKeys.has(type.key));
}

function getInspectionTimeKey(record) {
    // Inspection column A contains the work/check date and time.  Do not use
    // column H (upload timestamp), because it describes when the row reached
    // Sheets rather than when the inspection happened.
    const raw = String(record && (record.date || record.Date) || '').trim();
    const match = raw.match(/(?:[T ]|^)(\d{1,2}):(\d{2})(?::\d{2})?/);
    if (!match) return '';
    return `${String(match[1]).padStart(2, '0')}:${match[2]}`;
}

function renderDailyChart(recordsData = inspectionRecords, filterDate = "", defectTypes = getInspectionDefectTypes()) {
    const ctx = document.getElementById("dailyChart");
    if (!ctx) return;

    if (typeof Chart === 'undefined') {
        console.warn("Chart.js not loaded");
        return;
    }

    // Group Inspection rows by the same inspection time across the selected
    // dates.  The date range is already applied by renderDashboard; this
    // function only aggregates the rows it receives and never reads
    // outputdiary or the upload timestamp.
    const groupedByTime = new Map();
    (Array.isArray(recordsData) ? recordsData : []).forEach(record => {
        const timeKey = getInspectionTimeKey(record) || 'ไม่ระบุเวลา';
        if (!groupedByTime.has(timeKey)) {
            groupedByTime.set(timeKey, defectTypes.reduce((group, type) => {
                group[type.key] = 0;
                return group;
            }, { timeKey }));
        }
        const group = groupedByTime.get(timeKey);
        defectTypes.forEach(type => {
            group[type.key] += Number(record && record[type.key]) || 0;
        });
    });

    const groupedRows = [...groupedByTime.values()].sort((a, b) => {
        if (a.timeKey === 'ไม่ระบุเวลา') return 1;
        if (b.timeKey === 'ไม่ระบุเวลา') return -1;
        return a.timeKey.localeCompare(b.timeKey);
    });
    const labels = groupedRows.map(row => row.timeKey);
    const totalsData = groupedRows.map(row => defectTypes.reduce((sum, type) => sum + (Number(row[type.key]) || 0), 0));
    const categoryDatasets = defectTypes.map(type => ({
        type: 'bar',
        label: type.label,
        data: groupedRows.map(row => Number(row[type.key]) || 0),
        backgroundColor: type.color,
        borderRadius: 4,
        stack: 'defects'
    }));

    if (dailyChartInstance) {
        dailyChartInstance.destroy();
    }

    dailyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    type: 'line',
                    label: 'รวมของเสียทั้งหมด',
                    data: totalsData,
                    borderColor: '#00b4d8',
                    backgroundColor: 'rgba(0, 180, 216, 0.2)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                ...categoryDatasets
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    left: 0,
                    right: window.innerWidth < 640 ? 25 : 15,
                    top: 5,
                    bottom: 5
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: { 
                        color: '#e2e8f0', 
                        font: { family: 'Sarabun', size: window.innerWidth < 640 ? 10 : 12 },
                        boxWidth: window.innerWidth < 640 ? 10 : 20,
                        padding: window.innerWidth < 640 ? 4 : 10
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' }
                }
            },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' }
                }
            }
        }
    });
}

function renderDonutChart(defectsCategory, grandTotal) {
    const ctx = document.getElementById("donutChart");
    if (!ctx) return;

    if (typeof Chart === 'undefined') return;

    if (donutChartInstance) {
        donutChartInstance.destroy();
    }

    donutChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: defectsCategory.map(c => c.name),
            datasets: [{
                data: defectsCategory.map(c => c.val),
                backgroundColor: defectsCategory.map(c => c.color),
                borderWidth: 2,
                borderColor: '#0f172a',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const val = context.raw || 0;
                            const pct = grandTotal > 0 ? Math.round((val / grandTotal) * 100) : 0;
                            return ` ${context.label}: ${val} ชิ้น (${pct}%)`;
                        }
                    }
                }
            },
            cutout: '68%'
        }
    });
}

function renderSeverityBars(defectsCategory, grandTotal) {
    const container = document.getElementById("defectProgressList");
    if (!container) return;

    container.innerHTML = defectsCategory.map(item => {
        const pct = grandTotal > 0 ? Math.round((item.val / grandTotal) * 100) : 0;
        return `
            <div class="severity-item" style="margin-bottom: 0.65rem;">
                <div class="severity-info" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.88rem; font-weight: 700; color: #f8fafc; margin-bottom: 0.35rem;">
                    <span style="display: flex; align-items: center; gap: 0.45rem;">
                        <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${item.color}; display: inline-block; box-shadow: 0 0 8px ${item.color};"></span>
                        ${item.name}
                    </span>
                    <span style="color: #38bdf8; font-weight: 800;">${item.val} <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 600;">ชิ้น (${pct}%)</span></span>
                </div>
                <div class="progress-track" style="height: 10px; background: rgba(255, 255, 255, 0.08); border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05);">
                    <div class="progress-fill" style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, ${item.color}, ${item.color}dd); border-radius: 8px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); box-shadow: 0 0 10px ${item.color}88;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Compare the two separate waste stages by work date.  Inspection records
// are rejects removed from the rack before painting is complete, while
// outputdiary records are defects found during/after the painting process.
// The stacked bars split total production into good pieces and combined waste,
// while the smooth percentage lines show where each waste stage was found.
function renderInspectionVsOutputChart(outputRows = [], inspectionRows = inspectionRecords, range = getDashboardDateRange()) {
    const canvas = document.getElementById('inspectionVsOutputChart');
    if (!canvas || typeof Chart === 'undefined') return;

    const hasDateFilter = Boolean(range && (range.start || range.end));
    const outputData = Array.isArray(outputRows) ? outputRows : [];
    const inspectionData = Array.isArray(inspectionRows) ? inspectionRows : [];
    const filteredOutput = hasDateFilter
        ? outputData.filter(record => dashboardRecordInDateRange(record, range))
        : outputData;
    const filteredInspection = hasDateFilter
        ? inspectionData.filter(record => dashboardRecordInDateRange(record, range))
        : inspectionData;

    const daily = new Map();
    const ensureDay = date => {
        if (!date) return null;
        if (!daily.has(date)) daily.set(date, { prodQty: 0, outputDefects: 0, rackRejects: 0 });
        return daily.get(date);
    };

    filteredOutput.forEach(record => {
        const day = ensureDay(qc7RecordDate(record));
        if (day) {
            day.prodQty += qc7Number(record, ['prodQty', 'ProdQty', 'prod_qty', 'qty']);
            day.outputDefects += qc7OutputDefectTotal(record);
        }
    });
    filteredInspection.forEach(record => {
        const day = ensureDay(qc7RecordDate(record));
        if (day) day.rackRejects += qc7InspectionRejectTotal(record);
    });

    const labels = Array.from(daily.keys()).sort();
    if (labels.length === 0) {
        if (inspectionVsOutputChartInstance) {
            inspectionVsOutputChartInstance.destroy();
            inspectionVsOutputChartInstance = null;
        }
        return;
    }

    const rackRejects = labels.map(date => daily.get(date).rackRejects);
    const outputDefects = labels.map(date => daily.get(date).outputDefects);
    const totalProduction = labels.map((date, index) => daily.get(date).prodQty + rackRejects[index]);
    const totalWaste = labels.map((date, index) => rackRejects[index] + outputDefects[index]);
    const goodProduction = labels.map((date, index) => Math.max(0, totalProduction[index] - totalWaste[index]));
    const rackRejectPercent = labels.map((date, index) => totalProduction[index] > 0
        ? Number(((rackRejects[index] / totalProduction[index]) * 100).toFixed(2))
        : 0);
    const outputDefectPercent = labels.map((date, index) => totalProduction[index] > 0
        ? Number(((outputDefects[index] / totalProduction[index]) * 100).toFixed(2))
        : 0);

    if (inspectionVsOutputChartInstance) inspectionVsOutputChartInstance.destroy();
    inspectionVsOutputChartInstance = new Chart(canvas, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'งานดี',
                    data: goodProduction,
                    backgroundColor: 'rgba(34, 197, 94, 0.84)',
                    borderColor: '#22c55e',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    stack: 'production',
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'คัดลงราว',
                    data: rackRejects,
                    backgroundColor: 'rgba(249, 115, 22, 0.88)',
                    borderColor: '#f97316',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    stack: 'production',
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'ของเสียหลังพ่นสี',
                    data: outputDefects,
                    backgroundColor: 'rgba(239, 68, 68, 0.88)',
                    borderColor: '#ef4444',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    stack: 'production',
                    order: 2
                },
                {
                    type: 'line',
                    label: '% คัดลงราว',
                    data: rackRejectPercent,
                    borderColor: '#38bdf8',
                    backgroundColor: '#38bdf8',
                    pointBackgroundColor: '#38bdf8',
                    pointBorderColor: '#38bdf8',
                    pointRadius: 3,
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false,
                    yAxisID: 'y1',
                    order: 0
                },
                {
                    type: 'line',
                    label: '% NG',
                    data: outputDefectPercent,
                    borderColor: '#a78bfa',
                    backgroundColor: '#a78bfa',
                    pointBackgroundColor: '#a78bfa',
                    pointBorderColor: '#a78bfa',
                    pointRadius: 3,
                    borderWidth: 2,
                    tension: 0.35,
                    fill: false,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: '#e2e8f0',
                        font: { family: 'Sarabun', size: window.innerWidth < 640 ? 10 : 12 },
                        boxWidth: window.innerWidth < 640 ? 10 : 18,
                        padding: window.innerWidth < 640 ? 5 : 10
                    }
                },
                tooltip: {
                    callbacks: {
                        footer: items => {
                            const index = items && items[0] ? items[0].dataIndex : -1;
                            return index >= 0
                                ? [
                                    `ยอดผลิตทั้งหมด: ${totalProduction[index].toLocaleString()} ชิ้น`,
                                    `ของดี: ${goodProduction[index].toLocaleString()} ชิ้น`,
                                    `ของเสียรวม: ${totalWaste[index].toLocaleString()} ชิ้น`
                                ]
                                : '';
                        }
                    }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' }
                }
            },
            scales: {
                x: {
                    stacked: true,
                    ticks: { color: '#94a3b8', font: { family: 'Sarabun', size: 10 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    stacked: true,
                    beginAtZero: true,
                    title: { display: true, text: 'จำนวนชิ้น', color: '#94a3b8' },
                    ticks: { color: '#94a3b8' },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' }
                },
                y1: {
                    beginAtZero: true,
                    min: 0,
                    max: 100,
                    position: 'right',
                    title: { display: true, text: 'เปอร์เซ็นต์ของเสีย', color: '#facc15' },
                    ticks: { color: '#facc15', callback: value => `${value}%` },
                    grid: { drawOnChartArea: false }
                }
            }
        }
    });
}

function renderTables() {
    renderRecentTable(inspectionRecords);
    renderFullHistoryTable(inspectionRecords);
}

function renderRecentTable(recordsData = inspectionRecords) {
    const tbody = document.getElementById("recentTableBody");
    if (!tbody) return;

    const recent = recordsData.slice(0, 5);
    if (recent.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">ไม่พบข้อมูลการตรวจเช็ค</td></tr>`;
        return;
    }

    tbody.innerHTML = recent.map((r, i) => {
        const rust = Number(r.rust) || 0;
        const dent = Number(r.dent) || 0;
        const weld = Number(r.weld) || 0;
        const chemical = Number(r.chemical) || 0;
        const oil = Number(r.oil) || 0;
        const total = rust + dent + weld + chemical + oil;
        // Inspection column A (`date`) is the work/check date and time.
        // `timestamp` is only the upload time from column H and must not be
        // shown as the inspection time in this table.
        const dateFormatted = formatDateForDisplay(r.date, '');

        return `
            <tr>
                <td style="font-weight: 700; white-space: nowrap;">${dateFormatted}</td>
                <td><span class="badge-defect badge-total">${inspectionWorkTypeLabel(r.workType)}</span></td>
                <td><span class="badge-defect ${rust > 0 ? 'badge-has-defect' : 'badge-zero'}">${rust}</span></td>
                <td><span class="badge-defect ${dent > 0 ? 'badge-has-defect' : 'badge-zero'}">${dent}</span></td>
                <td><span class="badge-defect ${weld > 0 ? 'badge-has-defect' : 'badge-zero'}">${weld}</span></td>
                <td><span class="badge-defect ${chemical > 0 ? 'badge-has-defect' : 'badge-zero'}">${chemical}</span></td>
                <td><span class="badge-defect ${oil > 0 ? 'badge-has-defect' : 'badge-zero'}">${oil}</span></td>
                <td><span class="badge-defect badge-total">${total}</span></td>
                <td style="color: #64748b; font-size: 0.85rem;">${r.note || '-'}</td>
                <td style="text-align: center;">
                    <div class="action-btn-group" style="display: flex; gap: 0.4rem; justify-content: center; align-items: center;">
                        <button class="btn-action-edit" onclick="editInspectionRecord(${i})" title="แก้ไข" style="background: rgba(56, 189, 248, 0.14) !important; color: #38bdf8 !important; border: 1px solid rgba(56, 189, 248, 0.35) !important; padding: 0.4rem 0.75rem !important; border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 0.35rem !important; white-space: nowrap !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;">✏️ แก้ไข</button>
                        <button class="btn-action-delete" onclick="deleteInspectionRecord(${i})" title="ลบ" style="background: rgba(239, 68, 68, 0.14) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; padding: 0.4rem 0.75rem !important; border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 0.35rem !important; white-space: nowrap !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;">🗑️ ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderFullHistoryTable(records) {
    const tbody = document.getElementById("fullHistoryTableBody");
    if (!tbody) return;

    if (records.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b; padding: 2rem;">ไม่พบข้อมูลการตรวจเช็ค</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map((r, i) => {
        const rust = Number(r.rust) || 0;
        const dent = Number(r.dent) || 0;
        const weld = Number(r.weld) || 0;
        const chemical = Number(r.chemical) || 0;
        const oil = Number(r.oil) || 0;
        const total = rust + dent + weld + chemical + oil;
        // Use the actual inspection date/time from column A, not the upload
        // timestamp stored in column H.
        const dateFormatted = formatDateForDisplay(r.date, '');

        return `
            <tr>
                <td style="font-weight: 800; color: #38bdf8; white-space: nowrap;">${dateFormatted}</td>
                <td><span class="badge-defect badge-total">${inspectionWorkTypeLabel(r.workType)}</span></td>
                <td><span class="badge-defect ${rust > 0 ? 'badge-has-defect' : 'badge-zero'}">${rust}</span></td>
                <td><span class="badge-defect ${dent > 0 ? 'badge-has-defect' : 'badge-zero'}">${dent}</span></td>
                <td><span class="badge-defect ${weld > 0 ? 'badge-has-defect' : 'badge-zero'}">${weld}</span></td>
                <td><span class="badge-defect ${chemical > 0 ? 'badge-has-defect' : 'badge-zero'}">${chemical}</span></td>
                <td><span class="badge-defect ${oil > 0 ? 'badge-has-defect' : 'badge-zero'}">${oil}</span></td>
                <td><span class="badge-defect badge-total">${total} ชิ้น</span></td>
                <td>${r.note || '-'}</td>
                <td style="text-align: center;">
                    <div class="action-btn-group" style="display: flex; gap: 0.4rem; justify-content: center; align-items: center;">
                        <button class="btn-action-edit" onclick="editInspectionRecord(${i})" title="แก้ไข" style="background: rgba(56, 189, 248, 0.14) !important; color: #38bdf8 !important; border: 1px solid rgba(56, 189, 248, 0.35) !important; padding: 0.4rem 0.75rem !important; border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 0.35rem !important; white-space: nowrap !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;">✏️ แก้ไข</button>
                        <button class="btn-action-delete" onclick="deleteInspectionRecord(${i})" title="ลบ" style="background: rgba(239, 68, 68, 0.14) !important; color: #f87171 !important; border: 1px solid rgba(239, 68, 68, 0.35) !important; padding: 0.4rem 0.75rem !important; border-radius: 10px !important; font-size: 0.82rem !important; font-weight: 700 !important; cursor: pointer !important; display: inline-flex !important; align-items: center !important; gap: 0.35rem !important; white-space: nowrap !important; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25) !important;">🗑️ ลบ</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function filterHistoryTable() {
    const query = document.getElementById("globalSearch").value.toLowerCase();
    const filtered = inspectionRecords.filter(r => {
        const dStr = formatDateForDisplay(r.date, '').toLowerCase();
        return dStr.includes(query) || (r.note && r.note.toLowerCase().includes(query));
    });
    renderFullHistoryTable(filtered);
}

function saveSettings() {
    const url = document.getElementById("settingApiUrl").value.trim();
    if (url) {
        setApiUrl(url);
        showToast("บันทึก URL API เรียบร้อยแล้ว", "success");
        loadDataFromAPI();
    }
}

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast-msg ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `
        <span>${type === 'error' ? '❌' : '✅'}</span>
        <span>${message}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(30px)';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function getModelWithGroupLabel(rawModel) {
    if (!rawModel) return 'รุ่นอื่นๆ (Other)';
    let raw = String(rawModel).trim();
    if (!raw) return 'รุ่นอื่นๆ (Other)';

    // Avoid duplicating if already wrapped in parentheses
    if (raw.includes('(') && raw.includes(')')) {
        return raw;
    }

    const groups = (typeof PAINTING_MODEL_GROUPS !== 'undefined') ? PAINTING_MODEL_GROUPS : {};
    let foundGroup = "";

    for (const grpName in groups) {
        const group = groups[grpName];
        const items = Array.isArray(group)
            ? group
            : Object.values(group?.categories || {}).flat();
        const hasMatch = items.some(item => {
            const candidate = typeof item === 'object' ? (item.value || item.label) : item;
            const cleanItem = String(candidate || '').trim();
            return cleanItem.toLowerCase() === raw.toLowerCase() ||
                   raw.toLowerCase().includes(cleanItem.toLowerCase()) ||
                   cleanItem.toLowerCase().includes(raw.toLowerCase());
        });
        if (hasMatch) {
            foundGroup = grpName;
            break;
        }
    }

    if (foundGroup) {
        return `${raw} (${foundGroup})`;
    }
    return raw;
}

function renderOutputDailyLegend(datasets = []) {
    const container = document.getElementById('outputDailyLegend');
    if (!container) return;

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

    if (!datasets.length) {
        container.innerHTML = '<div class="chart-legend-dropdown-item">ยังไม่มีข้อมูลกราฟ</div>';
        return;
    }

    container.innerHTML = datasets.map(dataset => {
        const color = dataset.borderColor || dataset.backgroundColor || '#94a3b8';
        const axis = dataset.yAxisID === 'y1' ? '% ของเสีย' : dataset.type === 'bar' ? 'ยอดผลิต (ชิ้น)' : 'ของเสีย (ชิ้น)';
        return `<div class="chart-legend-dropdown-item">
            <span class="chart-legend-dropdown-swatch" style="background:${escapeHtml(color)}"></span>
            <span>${escapeHtml(dataset.label || '-')}</span>
            <span class="chart-legend-dropdown-axis">${escapeHtml(axis)}</span>
        </div>`;
    }).join('');
}

function renderReworkStackedModelChart(records = [], inspectionRecords = []) {
    const canvas = document.getElementById("topModelsChart");
    if (!canvas || typeof Chart === "undefined") return;

    const range = getDashboardDateRange();
    const dateKey = value => {
        const raw = String(value == null ? "" : value).trim();
        const iso = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
        if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
        const thai = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        return thai ? `${thai[3]}-${thai[2].padStart(2, "0")}-${thai[1].padStart(2, "0")}` : "";
    };
    const defectTotal = row => {
        if (typeof reworkDashboardDefectTotal === "function") return reworkDashboardDefectTotal(row);
        return Number(row && row.totalDefect) || 0;
    };
    const adjustedRecords = typeof applyRTVAdjustments === "function" ? applyRTVAdjustments(records, "REWORK") : (Array.isArray(records) ? records : []);
    const filtered = adjustedRecords.filter(row => {
        const date = dateKey(row && (row.date || row.Date));
        return date && (!range.start || date >= range.start) && (!range.end || date <= range.end);
    });
    const modelTotals = new Map();
    const daily = new Map();
    filtered.forEach(row => {
        const date = dateKey(row && (row.date || row.Date));
        if (!daily.has(date)) daily.set(date, { models: new Map(), defects: 0, inspectionRejects: 0, output: 0 });
        const day = daily.get(date);
        const model = String(row && (row.model || row.Model) || "รุ่นอื่นๆ (Other)").trim() || "รุ่นอื่นๆ (Other)";
        const qty = Number(row && (row.prodQty || row.ProdQty || row.qty)) || 0;
        const defects = Math.min(defectTotal(row), qty);
        const current = day.models.get(model) || { qty: 0, defects: 0 };
        current.qty += qty;
        current.defects += defects;
        day.models.set(model, current);
        day.defects += defects;
        day.output += qty;
        modelTotals.set(model, (modelTotals.get(model) || 0) + qty);
    });

    (Array.isArray(inspectionRecords) ? inspectionRecords : []).forEach(row => {
        const date = dateKey(row && (row.date || row.Date));
        if (!date || (range.start && date < range.start) || (range.end && date > range.end)) return;
        const rejectQty = typeof qc7InspectionRejectTotal === "function"
            ? qc7InspectionRejectTotal(row)
            : ["rust", "dent", "weld", "chemical", "oil"].reduce((sum, key) => sum + (Number(row && row[key]) || 0), 0);
        if (rejectQty <= 0) return;
        if (!daily.has(date)) daily.set(date, { models: new Map(), defects: 0, inspectionRejects: 0, output: 0 });
        const day = daily.get(date);
        day.inspectionRejects += rejectQty;
        day.defects += rejectQty;
        day.output += rejectQty;
    });

    const dates = [...daily.keys()].sort();
    if (!dates.length) {
        if (topModelsChartInstance) topModelsChartInstance.destroy();
        topModelsChartInstance = null;
        return;
    }
    const sortedModels = [...modelTotals.entries()].sort((a, b) => b[1] - a[1]);
    const topModels = sortedModels.slice(0, 8).map(([model]) => model);
    const hasOther = sortedModels.length > topModels.length;
    const otherLabel = "รุ่นอื่นๆ (Other)";
    const activeModels = hasOther ? [...topModels, otherLabel] : topModels;
    const colors = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#14b8a6", "#f97316", "#64748b"];
    const modelColor = Object.fromEntries(activeModels.map((model, index) => [model, colors[index % colors.length]]));
    const modelData = model => dates.map(date => {
        const day = daily.get(date);
        if (model === otherLabel) {
            return [...day.models.entries()]
                .filter(([name]) => !topModels.includes(name))
                .reduce((sum, [, value]) => sum + Math.max(0, value.qty - value.defects), 0);
        }
        const value = day.models.get(model) || { qty: 0, defects: 0 };
        return Math.max(0, value.qty - value.defects);
    });
    const outputDefects = dates.map(date => daily.get(date).defects - daily.get(date).inspectionRejects);
    const inspectionRejects = dates.map(date => daily.get(date).inspectionRejects);
    const totalOutput = dates.map(date => daily.get(date).output);
    const totalDefects = dates.map((date, index) => outputDefects[index] + inspectionRejects[index]);
    const defectRate = dates.map((date, index) => totalOutput[index] > 0
        ? Number(((totalDefects[index] / totalOutput[index]) * 100).toFixed(2)) : 0);

    if (topModelsChartInstance) topModelsChartInstance.destroy();
    topModelsChartInstance = new Chart(canvas, {
        type: "bar",
        data: {
            labels: dates,
            datasets: [
                ...activeModels.map(model => ({
                    type: "bar",
                    label: model,
                    data: modelData(model),
                    backgroundColor: modelColor[model],
                    borderRadius: 2,
                    stack: "reworkStack",
                    order: 2
                })),
                {
                    type: "bar",
                    label: "ของเสียจาก REWORK_Reviewed",
                    data: outputDefects,
                    backgroundColor: "#ef4444",
                    borderColor: "#ef4444",
                    borderRadius: 2,
                    stack: "reworkStack",
                    order: 1
                },
                ...(inspectionRejects.some(value => value > 0) ? [{
                    type: "bar",
                    label: "ยอดคัดออกจากราว (REWORK)",
                    data: inspectionRejects,
                    backgroundColor: "#f97316",
                    borderColor: "#f97316",
                    borderRadius: 2,
                    stack: "reworkStack",
                    order: 1
                }] : []),
                {
                    type: "line",
                    label: "% ของเสีย REWORK",
                    data: defectRate,
                    yAxisID: "y1",
                    borderColor: "#facc15",
                    backgroundColor: "rgba(250, 204, 21, .15)",
                    pointBackgroundColor: "#facc15",
                    borderWidth: 3,
                    pointRadius: 3,
                    tension: .3,
                    fill: false,
                    order: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: "index", intersect: true },
            plugins: {
                legend: { display: false },
                tooltip: {
                    filter(item) {
                        const value = Number(item && item.parsed && item.parsed.y) || 0;
                        return item && item.dataset && item.dataset.type === "bar" && value > 0;
                    },
                    callbacks: {
                        label(context) {
                            const value = Number(context && context.parsed && context.parsed.y) || 0;
                            return `${context.dataset.label}: ${value.toLocaleString("th-TH")} ชิ้น`;
                        },
                        footer(items) {
                            const index = items && items[0] ? items[0].dataIndex : -1;
                            return index >= 0 ? `ยอด REWORK รวม: ${totalOutput[index].toLocaleString()} ชิ้น` : "";
                        }
                    }
                }
            },
            scales: {
                x: { stacked: true, ticks: { color: "#94a3b8" }, grid: { color: "rgba(255,255,255,.05)" } },
                y: { stacked: true, beginAtZero: true, ticks: { color: "#94a3b8", precision: 0 }, grid: { color: "rgba(255,255,255,.08)" } },
                y1: { position: "right", beginAtZero: true, max: Math.max(5, Math.ceil(Math.max(...defectRate, 0) * 1.25 / 5) * 5), ticks: { color: "#facc15", callback: value => `${value}%` }, grid: { drawOnChartArea: false } }
            }
        }
    });
}

function normalizeInspectionWorkType(value) {
    const raw = String(value == null ? "" : value).trim().toUpperCase();
    if (raw === "REWORK" || raw.includes("REWORK") || raw.includes("รีเวิร์ค")) return "REWORK";
    if (raw === "NEW" || raw.includes("งานใหม่")) return "NEW";
    return "";
}

function inspectionWorkTypeLabel(value) {
    const type = normalizeInspectionWorkType(value);
    if (type === "REWORK") return "งาน REWORK";
    if (type === "NEW") return "งานใหม่";
    return "ยังไม่ระบุ";
}

async function renderDailyReportCharts() {
    if (typeof fetchDailyReportDataFromAPI !== 'function') return;

    const range = getDashboardDateRange();
    if (typeof loadRTVRecords === "function") await loadRTVRecords();
    const hasDateFilter = Boolean(range.start || range.end);
    // The dashboard must use QC-approved production rows.  Pending rows are
    // intentionally excluded from production KPIs and the main stacked chart.
    // Fetch the full reviewed history and apply the dashboard date range here
    // so Inspection-only dates are not lost when outputdiary has no row for a
    // selected day.
    const data = await fetchDailyReportDataFromAPI("", { scope: "reviewed" });
    const reworkData = typeof fetchReworkReportDataFromAPI === "function"
        ? await fetchReworkReportDataFromAPI("", { scope: "reviewed" })
        : [];
    const reworkForRange = Array.isArray(reworkData) ? reworkData : [];
    const outputDataForDashboard = typeof applyRTVAdjustments === "function"
        ? applyRTVAdjustments(Array.isArray(data) ? data : [], "NEW")
        : (Array.isArray(data) ? data : []);
    const inspectionAllForRange = Array.isArray(inspectionRecords)
        ? inspectionRecords.filter(record => dashboardRecordInDateRange(record, range))
        : [];
    const inspectionNewForRange = inspectionAllForRange.filter(record => normalizeInspectionWorkType(record.workType) === "NEW");
    const inspectionReworkForRange = inspectionAllForRange.filter(record => normalizeInspectionWorkType(record.workType) === "REWORK");

    // The production comparison uses only Inspection rows explicitly marked as
    // NEW. REWORK Inspection rows are rendered in the dedicated REWORK chart.
    renderInspectionVsOutputChart(outputDataForDashboard, inspectionNewForRange, range);
    
    if ((!outputDataForDashboard || outputDataForDashboard.length === 0) && inspectionNewForRange.length === 0 && inspectionReworkForRange.length === 0 && reworkForRange.length === 0) {
        // Reset KPI Elements to 0
        const kpiProdTotalQty = document.getElementById('kpiProdTotalQty');
        const kpiProdTotalDefects = document.getElementById('kpiProdTotalDefects');
        const kpiProdDefectRate = document.getElementById('kpiProdDefectRate');
        const kpiProdTopModel = document.getElementById('kpiProdTopModel');
        const kpiProdTopModelQty = document.getElementById('kpiProdTopModelQty');
        const kpiProdReportCount = document.getElementById('kpiProdReportCount');

        if (kpiProdTotalQty) kpiProdTotalQty.innerText = "0";
        if (kpiProdTotalDefects) kpiProdTotalDefects.innerText = "0";
        if (kpiProdDefectRate) kpiProdDefectRate.innerText = "อัตราของเสีย 0%";
        if (kpiProdTopModel) kpiProdTopModel.innerText = "-";
        if (kpiProdTopModelQty) kpiProdTopModelQty.innerText = "0 ชิ้น";
        if (kpiProdReportCount) kpiProdReportCount.innerText = "0";

        // Destroy Chart.js instances if empty
        if (outputDailyChartInstance) { outputDailyChartInstance.destroy(); outputDailyChartInstance = null; }
        renderReworkStackedModelChart(reworkForRange, inspectionReworkForRange);
        if (qualityYieldChartInstance) { qualityYieldChartInstance.destroy(); qualityYieldChartInstance = null; }
        globalQualityChartCache = { datesList: [], pctOkList: [], pctNgList: [] };
        return;
    }

    let filteredData = outputDataForDashboard;
    if (hasDateFilter) {
        filteredData = filteredData.filter(r => dashboardRecordInDateRange(r, range));
    }

    const inspectionRejectTotal = inspectionNewForRange.reduce((sum, record) =>
        sum + qc7InspectionRejectTotal(record), 0);

    // 1. Calculate KPIs
    let totalProdQty = 0;
    let totalDefects = 0;
    const modelMap = {};

    filteredData.forEach(r => {
        const pQty = Number(r.prodQty || r.ProdQty || r.prod_qty || r.qty) || 0;
        const dQty = Number(r.totalDefect || r.TotalDefect || r.total_defect) || 0;
        let mName = String(r.model || r.Model || '').trim();

        totalProdQty += pQty;
        totalDefects += dQty;

        if (mName) {
            modelMap[mName] = (modelMap[mName] || 0) + pQty;
        }
    });

    // Inspection records represent pieces rejected before the painting
    // output stage. Count them as both production throughput and waste when
    // presenting the combined dashboard totals.
    totalProdQty += inspectionRejectTotal;
    totalDefects += inspectionRejectTotal;

    const reportCount = filteredData.length;
    const defectRate = totalProdQty > 0 ? ((totalDefects / totalProdQty) * 100).toFixed(1) : 0;

    // Top Model
    let topModelName = "-";
    let topModelQty = 0;
    Object.keys(modelMap).forEach(m => {
        if (modelMap[m] > topModelQty) {
            topModelQty = modelMap[m];
            topModelName = m;
        }
    });

    // Update KPI Elements
    const kpiProdTotalQty = document.getElementById('kpiProdTotalQty');
    const kpiProdTotalDefects = document.getElementById('kpiProdTotalDefects');
    const kpiProdDefectRate = document.getElementById('kpiProdDefectRate');
    const kpiProdTopModel = document.getElementById('kpiProdTopModel');
    const kpiProdTopModelQty = document.getElementById('kpiProdTopModelQty');
    const kpiProdReportCount = document.getElementById('kpiProdReportCount');

    if (kpiProdTotalQty) kpiProdTotalQty.innerText = totalProdQty.toLocaleString();
    if (kpiProdTotalDefects) kpiProdTotalDefects.innerText = totalDefects.toLocaleString();
    if (kpiProdDefectRate) kpiProdDefectRate.innerText = `อัตราของเสีย ${defectRate}%`;
    if (kpiProdTopModel) kpiProdTopModel.innerText = getModelWithGroupLabel(topModelName);
    if (kpiProdTopModelQty) kpiProdTopModelQty.innerText = `${topModelQty.toLocaleString()} ชิ้น`;
    if (kpiProdReportCount) kpiProdReportCount.innerText = reportCount.toLocaleString();

    // 2. Render Output Daily Stacked Bar Chart (Grouped by Model Names - ชื่อรุ่นของงาน + กลุ่มงาน)
    const modelTotalsMap = {};
    filteredData.forEach(r => {
        let mName = String(r.model || r.Model || '').trim();
        if (mName) {
            mName = getModelWithGroupLabel(mName);
        } else {
            mName = 'รุ่นอื่นๆ (Other)';
        }
        const pQty = Number(r.prodQty || r.ProdQty || r.prod_qty || r.qty) || 0;
        if (pQty > 0) {
            modelTotalsMap[mName] = (modelTotalsMap[mName] || 0) + pQty;
        }
    });

    // Sort models by volume descending and select top models for clean legend display
    const sortedModelNames = Object.keys(modelTotalsMap).sort((a, b) => modelTotalsMap[b] - modelTotalsMap[a]);
    const topModelNames = sortedModelNames.slice(0, 8);
    const hasMoreModels = sortedModelNames.length > 8;

    const inspectionStackLabel = 'Inspection — คัดออกจากราว';
    const activeModels = [...topModelNames];
    if (hasMoreModels && !activeModels.includes('รุ่นอื่นๆ (Other)')) {
        activeModels.push('รุ่นอื่นๆ (Other)');
    }
    if (inspectionNewForRange.some(record => qc7InspectionRejectTotal(record) > 0)) {
        activeModels.push(inspectionStackLabel);
    }

    const paletteColors = [
        "#00b4d8", // Cyan Blue
        "#10b981", // Emerald Green
        "#f59e0b", // Amber Gold
        "#8b5cf6", // Purple
        "#ec4899", // Pink
        "#3b82f6", // Royal Blue
        "#14b8a6", // Teal
        "#f97316", // Bright Orange
        "#a855f7", // Deep Violet
        "#64748b"  // Slate Gray
    ];

    const modelColorMap = {};
    activeModels.forEach((m, idx) => {
        modelColorMap[m] = paletteColors[idx % paletteColors.length];
    });

    const dateGroupMap = {};
    const dateModelDefectMap = {};
    const dateOutputDefectsMap = {};
    const dateInspectionRejectMap = {};
    const dateDefectsMap = {};
    const dateTotalProdMap = {};

    filteredData.forEach(r => {
        const dStr = String(r.date || r.Date || r.timestamp || '').substring(0, 10);
        if (!dStr) return;

        let mName = String(r.model || r.Model || '').trim();
        if (mName) {
            mName = getModelWithGroupLabel(mName);
        }
        if (!mName || !topModelNames.includes(mName)) {
            mName = 'รุ่นอื่นๆ (Other)';
        }

        if (!dateGroupMap[dStr]) {
            dateGroupMap[dStr] = {};
            dateModelDefectMap[dStr] = {};
            activeModels.forEach(m => dateGroupMap[dStr][m] = 0);
            activeModels.forEach(m => dateModelDefectMap[dStr][m] = 0);
            dateOutputDefectsMap[dStr] = 0;
            dateInspectionRejectMap[dStr] = 0;
            dateDefectsMap[dStr] = 0;
            dateTotalProdMap[dStr] = 0;
        }

        const pQty = Number(r.prodQty || r.ProdQty || r.prod_qty || r.qty) || 0;
        const dQty = Number(r.totalDefect || r.TotalDefect || r.total_defect) || 0;

        dateGroupMap[dStr][mName] = (dateGroupMap[dStr][mName] || 0) + pQty;
        dateModelDefectMap[dStr][mName] = (dateModelDefectMap[dStr][mName] || 0) + Math.min(dQty, pQty);
        dateOutputDefectsMap[dStr] += dQty;
        dateDefectsMap[dStr] += dQty;
        dateTotalProdMap[dStr] += pQty;
    });

    // Inspection rows do not contain a production model. They are added as a
    // separate stack segment so the chart keeps the outputdiary model split
    // while still including rack rejects in total production and waste.
    inspectionNewForRange.forEach(record => {
        const dStr = qc7RecordDate(record);
        const rejectQty = qc7InspectionRejectTotal(record);
        if (!dStr || rejectQty <= 0) return;
        if (!dateGroupMap[dStr]) {
            dateGroupMap[dStr] = {};
            dateModelDefectMap[dStr] = {};
            activeModels.forEach(m => dateGroupMap[dStr][m] = 0);
            activeModels.forEach(m => dateModelDefectMap[dStr][m] = 0);
            dateOutputDefectsMap[dStr] = 0;
            dateInspectionRejectMap[dStr] = 0;
            dateDefectsMap[dStr] = 0;
            dateTotalProdMap[dStr] = 0;
        }
        dateGroupMap[dStr][inspectionStackLabel] = (dateGroupMap[dStr][inspectionStackLabel] || 0) + rejectQty;
        dateInspectionRejectMap[dStr] += rejectQty;
        dateDefectsMap[dStr] += rejectQty;
        dateTotalProdMap[dStr] += rejectQty;
    });

    const datesList = Object.keys(dateGroupMap).sort();
    const outputDefectsList = datesList.map(d => dateOutputDefectsMap[d] || 0);
    const inspectionRejectList = datesList.map(d => dateInspectionRejectMap[d] || 0);
    const defectsList = datesList.map(d => dateDefectsMap[d] || 0);
    const defectRateList = datesList.map(d => {
        const production = dateTotalProdMap[d] || 0;
        return production > 0 ? Number(((dateDefectsMap[d] || 0) / production * 100).toFixed(2)) : 0;
    });
    const maxDefectCount = Math.max(...defectsList, 0);
    const defectAxisMax = Math.max(5, Math.ceil((maxDefectCount * 1.25) / 5) * 5);
    const maxDefectRate = Math.max(...defectRateList, 0);
    const defectRateAxisMax = Math.min(100, Math.max(5, Math.ceil((maxDefectRate * 1.25) / 5) * 5));

    // Build stacked datasets from approved outputdiary rows plus Inspection
    // rejects. The two waste sources remain visibly distinguishable.
    const stackedDatasets = [
        {
            type: 'line',
            label: '% ของเสียรวม (NG Rate)',
            data: defectRateList,
            yAxisID: 'y1',
            borderColor: '#facc15',
            backgroundColor: 'rgba(250, 204, 21, 0.18)',
            borderWidth: 3,
            pointRadius: 4,
            pointBackgroundColor: '#facc15',
            fill: false,
            tension: 0.3,
            order: 0
        }
    ];
    activeModels.forEach(mName => {
        if (mName === inspectionStackLabel) return;
        const qtyData = datesList.map(d => Math.max(0,
            (dateGroupMap[d][mName] || 0) - (dateModelDefectMap[d][mName] || 0)
        ));
        const sum = qtyData.reduce((a, b) => a + b, 0);
        if (sum > 0) {
            stackedDatasets.push({
                type: 'bar',
                label: mName,
                data: qtyData,
                backgroundColor: modelColorMap[mName],
                stack: 'prodStack',
                borderRadius: 2,
                order: 2
            });
        }
    });

    if (outputDefectsList.some(value => value > 0)) {
        stackedDatasets.push({
            type: 'bar',
            label: 'ของเสียจาก outputdiary_Reviewed',
            data: outputDefectsList,
            backgroundColor: '#ef4444',
            borderColor: '#ef4444',
            stack: 'prodStack',
            borderRadius: 2,
            order: 1
        });
    }
    if (inspectionRejectList.some(value => value > 0)) {
        stackedDatasets.push({
            type: 'bar',
            label: inspectionStackLabel,
            data: inspectionRejectList,
            backgroundColor: '#f97316',
            borderColor: '#f97316',
            stack: 'prodStack',
            borderRadius: 2,
            order: 1
        });
    }

    renderOutputDailyLegend(stackedDatasets);

    const ctxDaily = document.getElementById("outputDailyChart");
    if (ctxDaily && typeof Chart !== 'undefined') {
        if (outputDailyChartInstance) {
            outputDailyChartInstance.destroy();
        }

        outputDailyChartInstance = new Chart(ctxDaily, {
            type: 'bar',
            data: {
                labels: datesList,
                datasets: stackedDatasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                        labels: { color: '#e2e8f0', font: { family: 'Sarabun', size: 11 } }
                    },
                    zoom: {
                        pan: { enabled: true, mode: 'x' },
                        zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' }
                    },
                    tooltip: {
                        callbacks: {
                            footer: function(tooltipItems) {
                                if (!tooltipItems || tooltipItems.length === 0) return '';
                                const dateLabel = tooltipItems[0].label;
                                const totalPcs = dateTotalProdMap[dateLabel] || 0;
                                return `ยอดผลิตรวมทั้งวัน: ${totalPcs.toLocaleString()} ชิ้น`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        ticks: { color: '#94a3b8', font: { family: 'Sarabun', size: 10 } },
                        grid: { color: 'rgba(255, 255, 255, 0.05)' }
                    },
                    y: {
                        stacked: true,
                        ticks: { color: '#94a3b8' },
                        grid: { color: 'rgba(255, 255, 255, 0.08)' }
                    },
                    y1: {
                        position: 'right',
                        beginAtZero: true,
                        max: defectRateAxisMax,
                        ticks: {
                            color: '#facc15',
                            callback: value => `${value}%`
                        },
                        grid: { drawOnChartArea: false }
                    },
                    yDefect: {
                        display: false,
                        position: 'left',
                        beginAtZero: true,
                        max: defectAxisMax,
                        grid: { drawOnChartArea: false }
                    }
                }
            }
        });
    }

    // 3. Render REWORK_Reviewed as the second stacked model chart.
    renderReworkStackedModelChart(reworkForRange, inspectionReworkForRange);

    // 4. Cache Quality Data & Render Quality Yield / NG Chart
    const pctOkList = datesList.map(d => {
        const total = dateTotalProdMap[d] || 0;
        const defects = dateDefectsMap[d] || 0;
        const good = Math.max(0, total - defects);
        return total > 0 ? Number(((good / total) * 100).toFixed(1)) : 100;
    });

    const pctNgList = datesList.map(d => {
        const total = dateTotalProdMap[d] || 0;
        const defects = dateDefectsMap[d] || 0;
        return total > 0 ? Number(((defects / total) * 100).toFixed(1)) : 0;
    });

    globalQualityChartCache = { datesList, pctOkList, pctNgList };
    renderQualityYieldChart();
}

async function updateQualityChartMode() {
    const select = document.getElementById("qualityViewMode");
    if (select) {
        currentQualityViewMode = select.value;
    }
    if (!globalQualityChartCache.datesList || globalQualityChartCache.datesList.length === 0) {
        await renderDailyReportCharts();
    } else {
        renderQualityYieldChart();
    }
}

function renderQualityYieldChart() {
    const select = document.getElementById("qualityViewMode");
    if (select) {
        currentQualityViewMode = select.value;
    }

    const { datesList, pctOkList, pctNgList } = globalQualityChartCache;
    const ctxQuality = document.getElementById("qualityYieldChart");
    if (!ctxQuality || typeof Chart === 'undefined' || !datesList || datesList.length === 0) return;

    if (qualityYieldChartInstance) {
        qualityYieldChartInstance.destroy();
        qualityYieldChartInstance = null;
    }

    let datasets = [];
    let yMin = 0;
    let yMax = 100;

    const maxNg = pctNgList.length > 0 ? Math.max(...pctNgList) : 0;
    const minOk = pctOkList.length > 0 ? Math.min(...pctOkList) : 100;

    const mode = String(currentQualityViewMode || 'ng').toLowerCase();

    if (mode === 'ng') {
        // STRICT % NG MODE: ONLY 1 dataset (% NG Rate) with zoomed Y-axis
        yMin = 0;
        yMax = Math.min(100, Math.max(5, Math.ceil(maxNg + 2)));
        datasets = [
            {
                label: '% งานเสีย (% NG Rate)',
                data: pctNgList,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.25)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#ef4444',
                fill: true,
                tension: 0.3
            }
        ];
    } else if (mode === 'yield') {
        // Zoom mode for % Yield Rate (e.g. 85% to 100%)
        yMin = Math.max(0, Math.floor(minOk - 3));
        yMax = 100;
        datasets = [
            {
                label: '% งานดี (% OK Yield Rate)',
                data: pctOkList,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.25)',
                borderWidth: 3,
                pointRadius: 5,
                pointBackgroundColor: '#10b981',
                fill: true,
                tension: 0.3
            }
        ];
    } else {
        // Both % OK & % NG (0 - 100%)
        yMin = 0;
        yMax = 100;
        datasets = [
            {
                label: '% งานดี (% OK Rate)',
                data: pctOkList,
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                borderWidth: 3,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            },
            {
                label: '% งานเสีย (% NG Rate)',
                data: pctNgList,
                borderColor: '#ef4444',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                borderWidth: 3,
                pointRadius: 4,
                fill: true,
                tension: 0.3
            }
        ];
    }

    qualityYieldChartInstance = new Chart(ctxQuality, {
        type: 'line',
        data: {
            labels: datesList,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#e2e8f0', font: { family: 'Sarabun', size: 11 } }
                },
                zoom: {
                    pan: { enabled: true, mode: 'x' },
                    zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${context.raw}%`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: '#94a3b8', font: { family: 'Sarabun', size: 10 } },
                    grid: { color: 'rgba(255, 255, 255, 0.05)' }
                },
                y: {
                    min: yMin,
                    max: yMax,
                    ticks: {
                        color: '#94a3b8',
                        callback: function(value) { return value + '%'; }
                    },
                    grid: { color: 'rgba(255, 255, 255, 0.08)' }
                }
            }
        }
    });
}

// --- FULLSCREEN CHART & WHEEL ZOOM MANAGEMENT ---
let fullscreenChartInstance = null;

function openChartFullscreen(chartId, title) {
    const sourceCanvas = document.getElementById(chartId);
    if (!sourceCanvas) return;

    const sourceChart = Chart.getChart(sourceCanvas);
    if (!sourceChart) return;

    const modal = document.getElementById("chartFullscreenModal");
    const modalTitle = document.getElementById("fullscreenChartTitle");
    const fullscreenCanvas = document.getElementById("fullscreenCanvas");

    if (!modal || !fullscreenCanvas) return;

    if (modalTitle) {
        modalTitle.innerHTML = `📊 ${title || 'ขยายกราฟแสดงผลเต็มหน้าจอ'}`;
    }

    modal.classList.add("active");

    if (fullscreenChartInstance) {
        fullscreenChartInstance.destroy();
        fullscreenChartInstance = null;
    }

    // Clone datasets and config
    const rawData = JSON.parse(JSON.stringify({
        labels: sourceChart.config.data.labels || [],
        datasets: sourceChart.config.data.datasets || []
    }));

    const sourceOptions = sourceChart.config.options || {};
    const isHorizontal = sourceOptions.indexAxis === 'y';

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: sourceOptions.indexAxis || 'x',
        plugins: {
            legend: sourceOptions.plugins && sourceOptions.plugins.legend && sourceOptions.plugins.legend.display === false ? {
                display: true,
                labels: { color: '#e2e8f0', font: { family: 'Sarabun', size: 12 } }
            } : sourceOptions.plugins && sourceOptions.plugins.legend !== undefined ? sourceOptions.plugins.legend : {
                labels: { color: '#e2e8f0', font: { family: 'Sarabun', size: 12 } }
            },
            zoom: {
                pan: { enabled: true, mode: isHorizontal ? 'y' : 'x' },
                zoom: {
                    wheel: { enabled: true, speed: 0.1 },
                    pinch: { enabled: true },
                    mode: isHorizontal ? 'y' : 'x'
                }
            },
            tooltip: sourceOptions.plugins && sourceOptions.plugins.tooltip ? sourceOptions.plugins.tooltip : {}
        },
        scales: sourceOptions.scales ? JSON.parse(JSON.stringify(sourceOptions.scales)) : {}
    };

    fullscreenChartInstance = new Chart(fullscreenCanvas, {
        type: sourceChart.config.type || 'bar',
        data: rawData,
        options: options
    });
}

function closeChartFullscreen() {
    const modal = document.getElementById("chartFullscreenModal");
    if (modal) {
        modal.classList.remove("active");
    }
    if (fullscreenChartInstance) {
        fullscreenChartInstance.destroy();
        fullscreenChartInstance = null;
    }
}

// Handle Mobile Screen Rotation & Resize Responsively
let resizeTimer;
window.addEventListener("resize", function() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        if (typeof renderDashboard === "function" && document.getElementById("dashboard-tab") && document.getElementById("dashboard-tab").classList.contains("active")) {
            renderDashboard();
        }
    }, 250);
});

window.addEventListener("orientationchange", function() {
    setTimeout(() => {
        if (typeof renderDashboard === "function" && document.getElementById("dashboard-tab") && document.getElementById("dashboard-tab").classList.contains("active")) {
            renderDashboard();
        }
    }, 300);
});

function resetChartZoomInFullscreen() {
    if (fullscreenChartInstance && typeof fullscreenChartInstance.resetZoom === 'function') {
        fullscreenChartInstance.resetZoom();
    }
}

// Expose dashboard controls explicitly for inline handlers and older cached pages.
window.queueDashboardDateChange = queueDashboardDateChange;
window.queueDashboardDateRangeChange = queueDashboardDateRangeChange;
window.changeDashboardDate = changeDashboardDate;
window.changeDashboardDateRange = changeDashboardDateRange;
window.showAllDashboardData = showAllDashboardData;
window.resetDashboardDateFilter = resetDashboardDateFilter;
window.loadDataFromAPI = loadDataFromAPI;
// Keep the mobile checklist handlers available to inline touch/click
// attributes even when the page is served through a cached script scope.
window.toggleChecklistMenu = toggleChecklistMenu;
window.toggleMobileChecklistMenu = toggleMobileChecklistMenu;
window.openParameterChecklistMode = openParameterChecklistMode;
window.openEquipmentChecklist = openEquipmentChecklist;
window.switchTab = switchTab;

// ---------------------------------------------------------------------------
// QC 7 TOOLS
// ---------------------------------------------------------------------------
let qc7HistogramChartInstance = null;
let qc7ParetoChartInstance = null;
let qc7ScatterChartInstance = null;
let qc7ControlChartInstance = null;
let qc7CombinedRecords = [];
let qc7DataLoaded = false;
let qc7DataLoading = false;
let qc7LoadPromise = null;
let qc7SelectedSource = 'all';
let qc7RawData = { inspection: [], new: [], rework: [], screen: [] };

const qc7SourceOptions = [
    { key: 'all', label: 'รวมทุกแหล่งข้อมูล' },
    { key: 'new', label: 'งานใหม่' },
    { key: 'rework', label: 'REWORK' },
    { key: 'screen', label: 'SCREEN' },
    { key: 'unassigned', label: 'คัดออกจากราว · ยังไม่ระบุประเภท' }
];

const qc7DefectTypes = [
    { key: 'rust', label: 'สนิม', color: '#f59e0b' },
    { key: 'dent', label: 'รอยบุบ', color: '#3b82f6' },
    { key: 'weld', label: 'สะเก็ดเชื่อม', color: '#ef4444' },
    { key: 'chemical', label: 'คราบน้ำยา', color: '#06b6d4' },
    { key: 'oil', label: 'คราบน้ำมัน', color: '#8b5cf6' },
    { key: 'colorDrop', label: 'เม็ดสี', color: '#ec4899' },
    { key: 'thinPaint', label: 'สีบาง', color: '#14b8a6' },
    { key: 'thickPaint', label: 'สีหนา/สีปูด', color: '#f97316' },
    { key: 'waterStain', label: 'คราบน้ำ/จาระบี', color: '#22d3ee' },
    { key: 'dust', label: 'เศษฝุ่น', color: '#a3e635' },
    { key: 'otherDefect', label: 'อื่นๆ', color: '#a78bfa' }
];

function qc7Number(record, keys) {
    const source = record || {};
    for (const key of keys) {
        const value = source[key];
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            const number = Number(value);
            if (Number.isFinite(number)) return number;
        }
    }
    return 0;
}

function qc7OutputDefectTotal(record) {
    if (typeof getDailyReportDefectTotal === 'function') {
        return getDailyReportDefectTotal(record);
    }
    return qc7Number(record, ['totalDefect', 'TotalDefect', 'total_defect']) ||
        ['dent', 'colorDrop', 'thinPaint', 'thickPaint', 'waterStain', 'oil', 'dust', 'otherDefect']
            .reduce((sum, key) => sum + qc7Number(record, [key]), 0);
}

function qc7InspectionRejectTotal(record) {
    return ['rust', 'dent', 'weld', 'chemical', 'oil']
        .reduce((sum, key) => sum + qc7Number(record, [key]), 0);
}

function qc7InspectionSource(record) {
    const raw = String(record && (record.workType || record.WorkType || '')).trim().toUpperCase();
    if (raw.includes('SCREEN')) return 'screen';
    if (raw.includes('REWORK') || raw.includes('รีเวิร์ค')) return 'rework';
    if (raw === 'NEW' || raw.includes('งานใหม่')) return 'new';
    // Existing Inspection rows without WorkType cannot be assigned to a
    // production sheet safely. Keep them visible in "all" and expose them in
    // a separate option instead of silently counting them as งานใหม่.
    return 'unassigned';
}

function buildQC7CombinedRecords(inspectionRows = [], sourceRows = {}, sourceFilter = qc7SelectedSource) {
    const byDate = new Map();
    const ensureDay = date => {
        if (!date) return null;
        if (!byDate.has(date)) {
            byDate.set(date, {
                date,
                prodQty: 0,
                outputDiaryDefects: 0,
                rackRejects: 0,
                outputRecordCount: 0,
                inspectionRecordCount: 0,
                rust: 0,
                dent: 0,
                weld: 0,
                chemical: 0,
                oil: 0,
                colorDrop: 0,
                thinPaint: 0,
                thickPaint: 0,
                waterStain: 0,
                dust: 0,
                otherDefect: 0
            });
        }
        return byDate.get(date);
    };

    const selectedSources = sourceFilter === 'all'
        ? ['new', 'rework', 'screen', 'unassigned']
        : [sourceFilter];
    const selectedSourceSet = new Set(selectedSources);

    (Array.isArray(inspectionRows) ? inspectionRows : []).forEach(record => {
        if (!selectedSourceSet.has(qc7InspectionSource(record))) return;
        const day = ensureDay(qc7RecordDate(record));
        if (!day) return;
        day.inspectionRecordCount += 1;
        day.rust += qc7Number(record, ['rust']);
        day.dent += qc7Number(record, ['dent']);
        day.weld += qc7Number(record, ['weld']);
        day.chemical += qc7Number(record, ['chemical']);
        day.oil += qc7Number(record, ['oil']);
        day.rackRejects += qc7InspectionRejectTotal(record);
    });

    const rowsBySource = [
        ['new', sourceRows.new],
        ['rework', sourceRows.rework],
        ['screen', sourceRows.screen]
    ];
    rowsBySource.forEach(([source, rows]) => {
        if (!selectedSourceSet.has(source)) return;
        (Array.isArray(rows) ? rows : []).forEach(record => {
            const day = ensureDay(qc7RecordDate(record));
            if (!day) return;
            day.outputRecordCount += 1;
            day.prodQty += qc7Number(record, ['prodQty', 'ProdQty', 'prod_qty', 'qty']);

            const outputDefects = qc7OutputDefectTotal(record);
            day.outputDiaryDefects += outputDefects;
            day.dent += qc7Number(record, ['dent']);
            day.colorDrop += qc7Number(record, ['colorDrop']);
            day.thinPaint += qc7Number(record, ['thinPaint']);
            day.thickPaint += qc7Number(record, ['thickPaint']);
            day.waterStain += qc7Number(record, ['waterStain']);
            day.oil += qc7Number(record, ['oil']);
            day.rust += qc7Number(record, ['rust']);
            day.dust += qc7Number(record, ['dust']);
            day.otherDefect += qc7Number(record, ['otherDefect']);

            // Keep the displayed defect categories consistent with the sheet's
            // explicit total, even when a legacy row omitted one category field.
            const listedDefects = ['rust', 'dent', 'colorDrop', 'thinPaint', 'thickPaint', 'waterStain', 'oil', 'dust', 'otherDefect']
                .reduce((sum, key) => sum + qc7Number(record, [key]), 0);
            day.otherDefect += Math.max(0, outputDefects - listedDefects);
        });
    });

    return Array.from(byDate.values()).map(day => {
        // ProdQty already includes defects recorded in outputdiary. Rack
        // rejects are a separate stage, so they are added to both the total
        // production and total-defect figures exactly once.
        day.totalProduction = day.prodQty + day.rackRejects;
        day.totalDefect = day.outputDiaryDefects + day.rackRejects;
        day.goodQty = Math.max(0, day.totalProduction - day.totalDefect);
        day.recordCount = day.outputRecordCount + day.inspectionRecordCount;
        return day;
    }).sort((a, b) => b.date.localeCompare(a.date));
}

async function loadQC7Data(force = false) {
    if (qc7LoadPromise && !force) return qc7LoadPromise;
    if (!force && qc7DataLoaded) {
        renderQC7Tools();
        return qc7CombinedRecords;
    }

    qc7DataLoading = true;
    renderQC7Tools();
    const load = (async () => {
        try {
            // QC 7 reads four independent sources. Use the normal JSON fetch
            // with a bounded timeout for this screen so a slow JSONP redirect
            // or one unavailable sheet cannot leave the whole page spinning.
            const qc7RetryOptions = {
                preferJsonp: false,
                allowJsonp: false,
                attempts: 1,
                timeoutMs: 12000,
                skipQueue: true
            };
            const [inspectionRows, outputRows, reworkRows, screenRows] = await Promise.all([
                typeof fetchInspectionDataFromAPI === 'function'
                    ? fetchInspectionDataFromAPI('', { retryOptions: qc7RetryOptions })
                    : Promise.resolve(Array.isArray(inspectionRecords) ? inspectionRecords : []),
                typeof fetchDailyReportDataFromAPI === 'function'
                    ? fetchDailyReportDataFromAPI('', { scope: 'reviewed', retryOptions: qc7RetryOptions })
                    : Promise.resolve(typeof getSavedDailyReportRecords === 'function' ? getSavedDailyReportRecords() : []),
                typeof fetchReworkReportDataFromAPI === 'function'
                    ? fetchReworkReportDataFromAPI('', { scope: 'reviewed', retryOptions: qc7RetryOptions })
                    : Promise.resolve([]),
                typeof fetchScreenReportDataFromAPI === 'function'
                    ? fetchScreenReportDataFromAPI('', { scope: 'reviewed', retryOptions: qc7RetryOptions })
                    : Promise.resolve([])
            ]);
            qc7RawData = {
                inspection: Array.isArray(inspectionRows) ? inspectionRows : [],
                new: Array.isArray(outputRows) ? outputRows : [],
                rework: Array.isArray(reworkRows) ? reworkRows : [],
                screen: Array.isArray(screenRows) ? screenRows : []
            };
            qc7CombinedRecords = buildQC7CombinedRecords(qc7RawData.inspection, qc7RawData, qc7SelectedSource);
            qc7DataLoaded = true;
            return qc7CombinedRecords;
        } catch (error) {
            console.warn('Unable to load QC 7 TOOL data:', error);
            qc7CombinedRecords = [];
            qc7RawData = { inspection: [], new: [], rework: [], screen: [] };
            qc7DataLoaded = false;
            return [];
        } finally {
            qc7DataLoading = false;
            renderQC7Tools();
        }
    })();
    qc7LoadPromise = load;
    try {
        return await load;
    } finally {
        if (qc7LoadPromise === load) qc7LoadPromise = null;
    }
}

function openQC7Tools(event, element) {
    if (event) event.preventDefault();
    switchTab('qc7-tools-tab', element);
}

function qc7RecordDate(record) {
    // QC 7 uses the work date from each sheet, never the upload timestamp:
    // Inspection column A (วันที่) and outputdiary column B (Date) are mapped
    // to the API field `date`.
    return getStandardISODate(record && (record.date || record.Date));
}

function qc7RecordDefects(record) {
    const explicit = Number(record && record.totalDefect);
    if (Number.isFinite(explicit)) return explicit;
    return qc7DefectTypes.reduce((sum, type) => sum + (Number(record && record[type.key]) || 0), 0);
}

// Keep Dashboard defect totals identical to QC 7 TOOL. The returned shape
// matches the Dashboard donut/progress-bar renderers (`name`, `val`, `color`).
function qc7DefectTotals(records = []) {
    return qc7DefectTypes.map(type => ({
        name: type.label,
        key: type.key,
        val: (Array.isArray(records) ? records : []).reduce(
            (sum, record) => sum + (Number(record && record[type.key]) || 0),
            0
        ),
        color: type.color
    }));
}

function getQC7DateRange() {
    const startInput = document.getElementById('qc7DateFilter');
    const endInput = document.getElementById('qc7DateFilterEnd');
    let start = getStandardISODate(startInput ? startInput.value : '');
    let end = getStandardISODate(endInput ? endInput.value : '');

    // Keep the legacy single-date control usable when the range end field is
    // absent on an older cached page.
    if (start && !end && !endInput) end = start;
    if (start && end && start > end) [start, end] = [end, start];
    return { start, end };
}

function qc7RecordInDateRange(record, range = getQC7DateRange()) {
    const recordDate = qc7RecordDate(record);
    if (!recordDate) return false;
    if (range.start && recordDate < range.start) return false;
    if (range.end && recordDate > range.end) return false;
    return true;
}

function queueQC7DateRangeChange() {
    clearTimeout(window.qc7DateRangeTimer);
    window.qc7DateRangeTimer = setTimeout(() => renderQC7Tools(), 80);
}

function qc7FilteredRecords() {
    const rows = Array.isArray(qc7CombinedRecords) ? qc7CombinedRecords : [];
    const range = getQC7DateRange();
    return range.start || range.end ? rows.filter(record => qc7RecordInDateRange(record, range)) : rows;
}

function qc7SourceLabel(sourceKey = qc7SelectedSource) {
    const option = qc7SourceOptions.find(item => item.key === sourceKey);
    return option ? option.label : qc7SourceOptions[0].label;
}

function changeQC7Source(sourceKey) {
    const valid = qc7SourceOptions.some(item => item.key === sourceKey) ? sourceKey : 'all';
    qc7SelectedSource = valid;
    const select = document.getElementById('qc7SourceFilter');
    if (select && select.value !== valid) select.value = valid;
    if (qc7DataLoaded) {
        qc7CombinedRecords = buildQC7CombinedRecords(qc7RawData.inspection, qc7RawData, qc7SelectedSource);
        renderQC7Tools();
    } else {
        loadQC7Data();
    }
}

function showAllQC7Data() {
    const startInput = document.getElementById('qc7DateFilter');
    const endInput = document.getElementById('qc7DateFilterEnd');
    if (startInput) startInput.value = '';
    if (endInput) endInput.value = '';
    loadQC7Data(true);
}

function initQC7Tools() {
    const startInput = document.getElementById('qc7DateFilter');
    const endInput = document.getElementById('qc7DateFilterEnd');
    // Leave the range empty on first open so QC 7 shows the available
    // Reviewed history immediately. Users can still enter a date range to
    // narrow the analysis, and existing selections are preserved on revisit.
    const sourceSelect = document.getElementById('qc7SourceFilter');
    if (sourceSelect) sourceSelect.value = qc7SelectedSource;
    renderQC7Tools();
    loadQC7Data();
}

function qc7DestroyCharts() {
    [qc7HistogramChartInstance, qc7ParetoChartInstance, qc7ScatterChartInstance, qc7ControlChartInstance].forEach(chart => {
        if (chart && typeof chart.destroy === 'function') chart.destroy();
    });
    qc7HistogramChartInstance = null;
    qc7ParetoChartInstance = null;
    qc7ScatterChartInstance = null;
    qc7ControlChartInstance = null;
}

function qc7ChartOptions(scales = {}) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 350 },
        plugins: {
            legend: { labels: { color: '#cbd5e1', font: { family: 'Sarabun', weight: '600' } } },
            tooltip: { mode: 'index', intersect: false }
        },
        scales: Object.assign({
            x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } }
        }, scales)
    };
}

function renderQC7Tools() {
    const records = qc7FilteredRecords();
    const checkSheet = document.getElementById('qc7CheckSheet');
    if (qc7DataLoading && !qc7DataLoaded) {
        if (checkSheet) checkSheet.innerHTML = '<div class="qc7-empty-state">กำลังโหลดข้อมูลจาก outputdiary_Reviewed, REWORK_Reviewed, SCREEN_Reviewed และ Inspection...</div>';
        qc7DestroyCharts();
        const stratificationBody = document.getElementById('qc7StratificationBody');
        if (stratificationBody) stratificationBody.innerHTML = '<tr><td colspan="5" class="qc7-empty-state">กำลังโหลดข้อมูล...</td></tr>';
        ['qc7SummaryInspections', 'qc7SummaryDefects', 'qc7SummaryProduction', 'qc7SummaryGood', 'qc7SummaryNgRate', 'qc7SummaryAverage'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerText = id === 'qc7SummaryNgRate' ? '0%' : '0';
        });
        return;
    }
    const totals = qc7DefectTypes.map(type => ({ ...type, value: records.reduce((sum, record) => sum + (Number(record[type.key]) || 0), 0) }));
    const totalDefects = totals.reduce((sum, item) => sum + item.value, 0);
    const totalProduction = records.reduce((sum, record) => sum + (Number(record.totalProduction) || 0), 0);
    const totalGood = records.reduce((sum, record) => sum + (Number(record.goodQty) || 0), 0);
    const ngRate = totalProduction > 0 ? ((totalDefects / totalProduction) * 100).toFixed(1) : '0.0';
    const average = records.length ? (totalDefects / records.length).toFixed(1) : '0';
    const top = [...totals].sort((a, b) => b.value - a.value)[0];

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerText = value;
    };
    setText('qc7SummaryInspections', records.length);
    setText('qc7SummaryDefects', totalDefects);
    setText('qc7SummaryProduction', totalProduction);
    setText('qc7SummaryGood', totalGood);
    setText('qc7SummaryNgRate', `${ngRate}%`);
    setText('qc7SummaryTopDefect', top && top.value > 0 ? top.label : '-');
    setText('qc7SummaryTopDefectCount', `${top && top.value ? top.value : 0} ชิ้น`);
    setText('qc7SummaryAverage', average);

    if (checkSheet) {
        if (!records.length) {
            checkSheet.innerHTML = '<div class="qc7-empty-state">ไม่พบข้อมูลสำหรับช่วงที่เลือก</div>';
        } else {
            const maxValue = Math.max(...totals.map(item => item.value), 1);
            checkSheet.innerHTML = totals.map(item => `
                <div class="qc7-check-row">
                    <div class="qc7-check-label"><span class="qc7-dot" style="background:${item.color}"></span><span>${item.label}</span><strong>${item.value}</strong></div>
                    <div class="qc7-check-track"><span style="width:${Math.round(item.value / maxValue * 100)}%; background:${item.color}"></span></div>
                </div>
            `).join('');
        }
    }

    qc7DestroyCharts();
    if (typeof Chart === 'undefined') return;
    renderQC7Histogram(records);
    renderQC7Pareto(totals);
    renderQC7Scatter(records);
    renderQC7Control(records);
    renderQC7Stratification(records);
}

function renderQC7Histogram(records) {
    const canvas = document.getElementById('qc7HistogramChart');
    if (!canvas) return;
    const bins = [0, 0, 0, 0, 0];
    records.forEach(record => {
        const total = qc7RecordDefects(record);
        if (total === 0) bins[0]++;
        else if (total <= 2) bins[1]++;
        else if (total <= 5) bins[2]++;
        else if (total <= 10) bins[3]++;
        else bins[4]++;
    });
    qc7HistogramChartInstance = new Chart(canvas, {
        type: 'bar',
        data: { labels: ['0', '1–2', '3–5', '6–10', '11+'], datasets: [{ label: 'รายการตรวจ', data: bins, backgroundColor: '#38bdf8', borderRadius: 6 }] },
        options: qc7ChartOptions()
    });
}

function renderDailyByDayChart(recordsData = inspectionRecords, defectTypes = getInspectionDefectTypes()) {
    const ctx = document.getElementById("dailyByDayChart");
    if (!ctx || typeof Chart === 'undefined') return;

    const dailyTotals = {};
    (Array.isArray(recordsData) ? recordsData : []).forEach(record => {
        const day = getStandardISODate(record && (record.date || record.Date));
        if (!day) return;
        if (!dailyTotals[day]) dailyTotals[day] = {};
        defectTypes.forEach(type => {
            dailyTotals[day][type.key] = (dailyTotals[day][type.key] || 0) + (Number(record[type.key]) || 0);
        });
    });

    const days = Object.keys(dailyTotals).sort();
    const rows = days.map(day => dailyTotals[day]);
    const totalByDay = rows.map(row => defectTypes
        .reduce((sum, type) => sum + (Number(row[type.key]) || 0), 0));

    if (dailyByDayChartInstance) dailyByDayChartInstance.destroy();
    dailyByDayChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: days,
            datasets: [
                { type: 'line', label: 'รวมของเสียต่อวัน', data: totalByDay, borderColor: '#00b4d8', backgroundColor: 'rgba(0,180,216,0.16)', borderWidth: 3, fill: true, tension: 0.35 },
                ...defectTypes.map(type => ({
                    type: 'bar',
                    label: type.label,
                    data: rows.map(row => row[type.key] || 0),
                    backgroundColor: type.color,
                    borderRadius: 4,
                    stack: 'defects'
                }))
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top', labels: { color: '#e2e8f0', font: { family: 'Sarabun', size: window.innerWidth < 640 ? 10 : 12 }, boxWidth: window.innerWidth < 640 ? 10 : 20, padding: window.innerWidth < 640 ? 4 : 10 } },
                zoom: { pan: { enabled: true, mode: 'x' }, zoom: { wheel: { enabled: true, speed: 0.1 }, pinch: { enabled: true }, mode: 'x' } }
            },
            scales: {
                x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { stacked: true, beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.08)' } }
            }
        }
    });
}

function renderQC7Pareto(totals) {
    const canvas = document.getElementById('qc7ParetoChart');
    if (!canvas) return;
    const sorted = [...totals].sort((a, b) => b.value - a.value);
    const total = sorted.reduce((sum, item) => sum + item.value, 0);
    let running = 0;
    const cumulative = sorted.map(item => {
        running += item.value;
        return total ? Math.round(running / total * 100) : 0;
    });
    qc7ParetoChartInstance = new Chart(canvas, {
        data: {
            labels: sorted.map(item => item.label),
            datasets: [
                { type: 'bar', label: 'จำนวนของเสีย', data: sorted.map(item => item.value), backgroundColor: sorted.map(item => item.color), borderRadius: 6, yAxisID: 'y' },
                { type: 'line', label: 'สะสม %', data: cumulative, borderColor: '#f8fafc', backgroundColor: '#f8fafc', pointBackgroundColor: '#f8fafc', tension: 0.25, yAxisID: 'y1' }
            ]
        },
        options: qc7ChartOptions({
            y: { beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } },
            y1: { beginAtZero: true, max: 100, position: 'right', ticks: { color: '#f8fafc', callback: value => `${value}%` }, grid: { drawOnChartArea: false } }
        })
    });
}

function renderQC7Scatter(records) {
    const canvas = document.getElementById('qc7ScatterChart');
    if (!canvas) return;
    const points = records.map((record, index) => ({ x: index + 1, y: qc7RecordDefects(record) }));
    qc7ScatterChartInstance = new Chart(canvas, {
        type: 'scatter',
        data: { datasets: [{ label: 'ของเสียต่อรายการตรวจ', data: points, backgroundColor: '#10b981', borderColor: '#34d399', pointRadius: 5 }] },
        options: qc7ChartOptions({ x: { title: { display: true, text: 'ลำดับการตรวจ', color: '#cbd5e1' }, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } }, y: { title: { display: true, text: 'ของเสีย (ชิ้น)', color: '#cbd5e1' }, beginAtZero: true, ticks: { color: '#94a3b8' }, grid: { color: 'rgba(148,163,184,0.12)' } } })
    });
}

function renderQC7Control(records) {
    const canvas = document.getElementById('qc7ControlChart');
    if (!canvas) return;
    const values = records.slice().reverse().map(record => qc7RecordDefects(record));
    const labels = records.slice().reverse().map(record => formatDateForDisplay(record.date, record.timestamp).slice(0, 10));
    const mean = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const variance = values.length ? values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length : 0;
    const sigma = Math.sqrt(variance);
    const upper = mean + (3 * sigma);
    const lower = Math.max(0, mean - (3 * sigma));
    qc7ControlChartInstance = new Chart(canvas, {
        type: 'line',
        data: { labels, datasets: [
            { label: 'ของเสีย', data: values, borderColor: '#38bdf8', backgroundColor: 'rgba(56,189,248,0.12)', fill: true, tension: 0.25, pointRadius: 4 },
            { label: 'ค่าเฉลี่ย', data: values.map(() => mean), borderColor: '#f59e0b', borderDash: [6, 4], pointRadius: 0 },
            { label: 'UCL +3σ', data: values.map(() => upper), borderColor: '#ef4444', borderDash: [3, 3], pointRadius: 0 },
            { label: 'LCL -3σ', data: values.map(() => lower), borderColor: '#10b981', borderDash: [3, 3], pointRadius: 0 }
        ] },
        options: qc7ChartOptions()
    });
}

function renderQC7Stratification(records) {
    const body = document.getElementById('qc7StratificationBody');
    if (!body) return;
    const groups = {};
    records.forEach(record => {
        const date = qc7RecordDate(record) || '-';
        if (!groups[date]) groups[date] = { count: 0, defects: 0, types: qc7DefectTypes.map(type => ({ ...type, value: 0 })) };
        groups[date].count += Number(record.recordCount) || 1;
        groups[date].defects += qc7RecordDefects(record);
        qc7DefectTypes.forEach((type, index) => { groups[date].types[index].value += Number(record[type.key]) || 0; });
    });
    const dates = Object.keys(groups).sort().reverse();
    body.innerHTML = dates.length ? dates.map(date => {
        const group = groups[date];
        const top = [...group.types].sort((a, b) => b.value - a.value)[0];
        return `<tr><td>${date}</td><td>${group.count}</td><td>${group.defects}</td><td>${(group.defects / group.count).toFixed(1)}</td><td>${top.value ? `${top.label} (${top.value})` : '-'}</td></tr>`;
    }).join('') : '<tr><td colspan="5" class="qc7-empty-state">ไม่พบข้อมูลสำหรับช่วงที่เลือก</td></tr>';
}

window.openQC7Tools = openQC7Tools;
window.initQC7Tools = initQC7Tools;
window.renderQC7Tools = renderQC7Tools;
window.showAllQC7Data = showAllQC7Data;
window.changeQC7Source = changeQC7Source;
