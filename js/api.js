const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbyn9E5l96L74UA4fs1UTOcqCeyq_Gi4upZhkoFH909y5OyU_BZGk7yMdTjbo5s87gi1pg/exec";

let API_URL = localStorage.getItem("PAINTING_API_URL") || DEFAULT_API_URL;

let activeSyncRequests = 0;
let lastDailyReportFetchSucceeded = false;
let cloudReadQueue = Promise.resolve();

function enqueueCloudRead(task) {
    const run = cloudReadQueue.then(() => task(), () => task());
    cloudReadQueue = run.catch(() => {});
    return run;
}

function updateSyncUI() {
    const statusText = document.getElementById("statusText");
    const statusBadge = document.getElementById("statusBadge");
    if (!statusText || !statusBadge) return;

    if (activeSyncRequests > 0) {
        statusText.innerText = `กำลังซิงค์... (${activeSyncRequests} รายการ)`;
        statusBadge.style.backgroundColor = "rgba(245, 158, 11, 0.1)"; // Warning yellow tint
        statusBadge.style.color = "#f59e0b";
        const dot = statusBadge.querySelector('.status-dot');
        if (dot) dot.style.backgroundColor = "#f59e0b";
    } else {
        statusText.innerText = `ซิงค์ข้อมูลล่าสุดแล้ว`;
        statusBadge.style.backgroundColor = "rgba(16, 185, 129, 0.1)"; // Success green tint
        statusBadge.style.color = "#10b981";
        const dot = statusBadge.querySelector('.status-dot');
        if (dot) dot.style.backgroundColor = "#10b981";
    }
}

// Force reset to active Anyone deployment URL
if (!API_URL.includes("AKfycbyn9E5l96L74UA4fs1UTOcqCeyq_Gi4upZhkoFH909y5OyU_BZGk7yMdTjbo5s87gi1pg")) {
    API_URL = DEFAULT_API_URL;
    localStorage.setItem("PAINTING_API_URL", DEFAULT_API_URL);
}

function setApiUrl(url) {
    if (url) {
        API_URL = url;
        localStorage.setItem("PAINTING_API_URL", url);
    }
}

function getApiUrl() {
    return API_URL;
}

// Apps Script first returns a short-lived redirect to googleusercontent.com.
// Reusing the same URL can make Chrome keep an expired redirect and surface
// an HTML 404 page instead of the JSON response. Every cloud request therefore
// gets a unique query value and bypasses the browser cache.
function withApiRequestNonce(url) {
    const separator = url.includes("?") ? "&" : "?";
    return `${url}${separator}_request=${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// Apps Script may redirect the browser fetch to a short-lived
// googleusercontent.com URL. When that redirect has expired, fetch receives
// an HTML 404 page even though the /exec endpoint is healthy. JSONP lets the
// browser follow the redirect as a script request and avoids the stale CORS
// redirect path. It is used only as a fallback after normal fetch retries.
function fetchAppsScriptJsonp(url, operation, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
        if (typeof document === "undefined" || !document.head) {
            reject(new Error(`${operation}: JSONP ใช้ได้เฉพาะในหน้าเว็บ`));
            return;
        }

        const callbackName = `__paintingJsonp_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        const script = document.createElement("script");
        let timer = null;
        let finished = false;

        const cleanup = () => {
            if (finished) return;
            finished = true;
            if (timer) clearTimeout(timer);
            try { delete window[callbackName]; } catch (error) { window[callbackName] = undefined; }
            script.remove();
        };

        window[callbackName] = payload => {
            cleanup();
            if (payload && payload.status === "error") {
                const error = new Error(payload.message || `${operation}: backend rejected the request`);
                error.backend = true;
                reject(error);
                return;
            }
            resolve(payload);
        };

        script.async = true;
        script.onerror = () => {
            cleanup();
            reject(new Error(`${operation}: JSONP request failed`));
        };

        const separator = url.includes("?") ? "&" : "?";
        // `prefix` is the Apps Script JSONP convention. Keep `callback` too
        // for deployments that expose the more common parameter name.
        const jsonpUrl = `${withApiRequestNonce(url)}${separator}prefix=${encodeURIComponent(callbackName)}&callback=${encodeURIComponent(callbackName)}`;
        script.src = jsonpUrl;
        document.head.appendChild(script);

        timer = setTimeout(() => {
            cleanup();
            reject(new Error(`${operation}: JSONP หมดเวลารอการตอบกลับจาก Apps Script`));
        }, Math.max(5000, Number(timeoutMs) || 15000));
    });
}

async function requireJsonResponse(response, operation) {
    if (!response.ok) {
        throw new Error(`${operation}: HTTP ${response.status}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`${operation}: Apps Script deployment did not return JSON`);
    }

    const result = await response.json();
    if (result && result.status === 'error') {
        throw new Error(result.message || `${operation}: backend rejected the request`);
    }
    return result;
}

function waitBeforeApiRetry(delayMs) {
    return new Promise(resolve => setTimeout(resolve, delayMs));
}

async function fetchAppsScriptJsonWithRetry(url, operation, retryOptions = {}) {
    const requestTask = async () => {
    const attempts = Math.max(1, Number(retryOptions.attempts ?? retryOptions.maxRetries) || 1);
    const timeoutMs = Math.max(5000, Number(retryOptions.timeoutMs) || 12000);
    let lastError = null;

    // Use the tested Apps Script JSONP path first in a browser. It follows
    // the /exec redirect without waiting for the stale redirect that makes a
    // normal fetch hang or return an HTML 404 page.
    if (retryOptions.preferJsonp !== false && typeof document !== "undefined" && document.head) {
        try {
            return await fetchAppsScriptJsonp(url, operation, retryOptions.jsonpTimeoutMs || timeoutMs);
        } catch (jsonpError) {
            lastError = jsonpError || lastError;
        }
    }

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
        const requestUrl = withApiRequestNonce(url);

        try {
            const response = await fetch(requestUrl, {
                cache: "no-store",
                headers: { "Accept": "application/json" },
                signal: controller ? controller.signal : undefined
            });
            return await requireJsonResponse(response, operation);
        } catch (error) {
            lastError = error && error.name === "AbortError"
                ? new Error(`${operation}: หมดเวลารอการตอบกลับจาก Apps Script`)
                : error;
            if (attempt < attempts) {
                await waitBeforeApiRetry(350 * attempt);
            }
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    }

    if (retryOptions.allowJsonp !== false && retryOptions.preferJsonp === false) {
        try {
            return await fetchAppsScriptJsonp(url, operation, retryOptions.jsonpTimeoutMs || timeoutMs);
        } catch (jsonpError) {
            lastError = jsonpError || lastError;
        }
    }

    throw lastError || new Error(`${operation}: ไม่สามารถโหลดข้อมูลได้`);
    };
    return retryOptions && retryOptions.skipQueue ? requestTask() : enqueueCloudRead(requestTask);
}

// Fetch historical inspection records from Google Sheet API
async function fetchInspectionDataFromAPI(dateFilter = "", options = {}) {
    const url = getApiUrl();
    const requestedDate = String(dateFilter || "").trim();
    const cacheKey = requestedDate ? `PAINTING_INSPECTION_CACHE_${requestedDate}` : "PAINTING_INSPECTION_CACHE";
    if (!url) return requestedDate ? [] : getCachedOrSampleData();

    try {
        const requestUrl = url + (url.includes('?') ? '&' : '?') + (requestedDate ? `date=${encodeURIComponent(requestedDate)}` : '');
        const data = await fetchAppsScriptJsonWithRetry(
            requestUrl,
            "Get inspection data",
            options.retryOptions || { attempts: 2, timeoutMs: 15000 }
        );
        let records = [];
        if (Array.isArray(data)) {
            records = data;
        } else if (data && Array.isArray(data.inspectionRecords)) {
            records = data.inspectionRecords;
        } else if (data && Array.isArray(data.data)) {
            records = data.data;
        } else if (data && Array.isArray(data.records)) {
            records = data.records;
        }

        // Clean out any legacy mock data
        records = records.filter(item => {
            const note = String(item.note || '');
            return !note.includes("สุ่มตรวจประจำวัน") &&
                   !note.includes("พบคราบสนิมบางชิ้นงาน") &&
                   !note.includes("มีรอยบุบและสะเก็ดเชื่อม") &&
                   !note.includes("พบคราบน้ำมันบนพื้นผิว") &&
                   !note.includes("ทดสอบความหนาชั้นสี");
        });

        if (Array.isArray(records)) {
            localStorage.setItem(cacheKey, JSON.stringify(records));
            if (!requestedDate && records.length > 0) {
                localStorage.setItem("PAINTING_INSPECTION_CACHE", JSON.stringify(records));
            }
            return records;
        }
        return requestedDate ? [] : getCachedOrSampleData();
    } catch (err) {
        console.warn("Failed to fetch from Google Apps Script API. Using cached data:", err);
        if (requestedDate) {
            try {
                const cachedDay = localStorage.getItem(cacheKey);
                if (cachedDay !== null) return JSON.parse(cachedDay) || [];
            } catch (e) {}
        }
        return requestedDate ? [] : getCachedOrSampleData();
    }
}

// Send new inspection form data to Google Sheet API
async function sendDataToAPI(data) {
    const baseUrl = getApiUrl();
    const queryParams = new URLSearchParams({
        action: 'create',
        date: data.date || data.timestamp || '',
        workType: data.workType || '',
        rust: String(data.rust || 0),
        dent: String(data.dent || 0),
        weld: String(data.weld || 0),
        chemical: String(data.chemical || 0),
        oil: String(data.oil || 0),
        note: data.note || '',
        timestamp: data.timestamp || data.date || ''
    }).toString();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryParams;

    try {
        activeSyncRequests++;
        updateSyncUI();

        const response = await fetch(withApiRequestNonce(url), { method: "GET", cache: "no-store" });
        const result = await requireJsonResponse(response, 'Create inspection');
        if (!result || result.status !== "success" || result.action !== "create") {
            throw new Error("Create inspection: backend did not confirm the save");
        }

        const cache = getCachedOrSampleData();
        cache.unshift({
            ...data,
            timestamp: data.timestamp || data.date || new Date().toISOString()
        });
        localStorage.setItem("PAINTING_INSPECTION_CACHE", JSON.stringify(cache));

        return result || { status: "success" };
    } catch (err) {
        console.error("Post Error:", err);
        throw err;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// Update existing inspection record in Google Sheet API (Overwrites row in-place)
async function updateDataToAPI(data) {
    const baseUrl = getApiUrl();
    const queryParams = new URLSearchParams({
        action: 'update',
        rowIndex: data.rowIndex || '',
        date: data.date || '',
        originalDate: data.originalDate || '',
        workType: data.workType || '',
        rust: String(data.rust || 0),
        dent: String(data.dent || 0),
        weld: String(data.weld || 0),
        chemical: String(data.chemical || 0),
        oil: String(data.oil || 0),
        note: data.note || '',
        timestamp: data.timestamp || data.date || ''
    }).toString();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryParams;

    // 1. Update in localStorage cache immediately
    const cache = getCachedOrSampleData();
    const updatedCache = cache.map(item => {
        if (data.rowIndex && item.rowIndex && Number(item.rowIndex) === Number(data.rowIndex)) {
            return { ...item, ...data };
        }
        const itemDate = String(item.date || item.timestamp || '').trim();
        const targetDate = String(data.originalDate || data.date || '').trim();
        if (itemDate && targetDate && itemDate === targetDate) {
            return { ...item, ...data };
        }
        return item;
    });
    localStorage.setItem("PAINTING_INSPECTION_CACHE", JSON.stringify(updatedCache));

    // 2. Send update request to Google Sheet API
    try {
        activeSyncRequests++;
        updateSyncUI();

        const response = await fetch(withApiRequestNonce(url), { method: "GET", cache: "no-store" });
        return await requireJsonResponse(response, 'Update inspection');
    } catch (err) {
        console.error("Update Error:", err);
        throw err;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// Delete inspection record from Google Sheet API (Deletes row from backend Google Sheet & Cache)
async function deleteDataFromAPI(data) {
    const baseUrl = getApiUrl();
    const queryParams = new URLSearchParams({
        action: 'delete',
        rowIndex: data.rowIndex || '',
        date: data.date || '',
        note: data.note || ''
    }).toString();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryParams;

    // Delete on the Sheet first. Only update the browser cache after the
    // backend confirms success, so a failed request cannot hide the record.
    try {
        activeSyncRequests++;
        updateSyncUI();

        const response = await fetch(withApiRequestNonce(url), { method: "GET", cache: "no-store" });
        const result = await requireJsonResponse(response, 'Delete inspection');
        if (!result || result.status !== "success" || result.action !== "delete") {
            throw new Error("Delete inspection: backend did not confirm the deletion");
        }

        const cache = getCachedOrSampleData();
        const targetRowIndex = Number(data.rowIndex || 0);
        const targetDate = String(data.date || data.originalDate || '').trim();
        const targetNote = String(data.note || '').trim();
        const filteredCache = cache.filter(item => {
            if (targetRowIndex && Number(item.rowIndex || 0) === targetRowIndex) return false;

            // Newly-created records may not have a rowIndex yet. In that case,
            // match the complete record identity instead of deleting every row
            // from the same date.
            const itemDate = String(item.date || item.timestamp || '').trim();
            const itemNote = String(item.note || '').trim();
            const sameValues = ["rust", "dent", "weld", "chemical", "oil"].every(key =>
                Number(item[key] || 0) === Number(data[key] || 0)
            );
            return !(itemDate === targetDate && itemNote === targetNote && sameValues);
        });
        localStorage.setItem("PAINTING_INSPECTION_CACHE", JSON.stringify(filteredCache));
        return result;
    } catch (err) {
        console.error("Delete Error:", err);
        throw err;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// Send the entire Daily Report to Google Sheet API
async function sendDailyReportToAPI(payload) {
    const baseUrl = getApiUrl();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=submitDailyReport';

    try {
        activeSyncRequests++;
        updateSyncUI();

        const response = await fetch(url, {
            method: "POST",
            cache: "no-cache",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });
        const result = await requireJsonResponse(response, 'Submit daily report');
        if (!result || result.status !== "success" || result.action !== "submitDailyReport") {
            throw new Error("Submit daily report: backend did not confirm the save");
        }
        return result;
    } catch (err) {
        console.error("Daily Report Submit Error:", err);

        // Apps Script can finish writing the rows but lose the HTTP response
        // during a cold start/redirect. Confirm the submission by reading the
        // saved rows before telling the user that the save failed.
        try {
            if (await verifyDailyReportSavedOnBackend(payload)) {
                return { status: "success", action: "submitDailyReport", recovered: true };
            }
        } catch (verifyError) {
            console.warn("Unable to confirm daily report after submit error:", verifyError);
        }
        throw err;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// REWORK uses the same record payload as the daily form, but writes to its
// dedicated REWORK sheet through a separate Apps Script action.
async function sendReworkReportToAPI(payload) {
    const baseUrl = getApiUrl();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=submitReworkReport';
    try {
        activeSyncRequests++;
        updateSyncUI();
        const response = await fetch(url, {
            method: "POST",
            cache: "no-cache",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await requireJsonResponse(response, "Submit REWORK report");
        if (!result || result.status !== "success" || result.action !== "submitReworkReport") {
            throw new Error("Submit REWORK report: backend did not confirm the save");
        }
        localStorage.removeItem("PAINTING_REWORK_CACHE");
        return result;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// SCREEN mirrors REWORK but writes to the dedicated SCREEN sheet.
async function sendScreenReportToAPI(payload) {
    const baseUrl = getApiUrl();
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=submitScreenReport';
    try {
        activeSyncRequests++;
        updateSyncUI();
        const response = await fetch(url, {
            method: "POST",
            cache: "no-cache",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(payload)
        });
        const result = await requireJsonResponse(response, "Submit SCREEN report");
        if (!result || result.status !== "success" || result.action !== "submitScreenReport") {
            throw new Error("Submit SCREEN report: backend did not confirm the save");
        }
        localStorage.removeItem("PAINTING_SCREEN_CACHE");
        return result;
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

function getRealSheetData() {
    const realData = [
        { rowIndex: 2, date: "2026-07-25 17:00", rust: 29, dent: 0, weld: 0, chemical: 8, oil: 0, note: "", timestamp: "2026-07-25 17:00" },
        { rowIndex: 3, date: "2026-07-27 11:00", rust: 3, dent: 0, weld: 0, chemical: 4, oil: 0, note: "", timestamp: "2026-07-27 11:00" },
        { rowIndex: 4, date: "2026-07-27 12:00", rust: 1, dent: 0, weld: 0, chemical: 2, oil: 0, note: "", timestamp: "2026-07-27 12:00" },
        { rowIndex: 5, date: "2026-07-27 15:00", rust: 0, dent: 0, weld: 0, chemical: 5, oil: 0, note: "", timestamp: "2026-07-27 15:00" },
        { rowIndex: 6, date: "2026-07-27 16:00", rust: 19, dent: 0, weld: 0, chemical: 4, oil: 0, note: "", timestamp: "2026-07-27 16:00" },
        { rowIndex: 7, date: "2026-07-27 17:00", rust: 10, dent: 1, weld: 0, chemical: 3, oil: 0, note: "", timestamp: "2026-07-27 17:00" },
        { rowIndex: 8, date: "2026-07-29 09:00", rust: 12, dent: 0, weld: 0, chemical: 0, oil: 0, note: "", timestamp: "2026-07-29 09:00" },
        { rowIndex: 9, date: "2026-07-29 10:00", rust: 1, dent: 0, weld: 0, chemical: 4, oil: 0, note: "", timestamp: "2026-07-29 10:00" },
        { rowIndex: 10, date: "2026-07-29 11:00", rust: 3, dent: 0, weld: 0, chemical: 3, oil: 0, note: "", timestamp: "2026-07-29 11:00" },
        { rowIndex: 11, date: "2026-07-29 12:00", rust: 1, dent: 0, weld: 0, chemical: 3, oil: 0, note: "", timestamp: "2026-07-29 12:00" },
        { rowIndex: 12, date: "2026-07-29 14:00", rust: 0, dent: 0, weld: 0, chemical: 1, oil: 0, note: "", timestamp: "2026-07-29 14:00" },
        { rowIndex: 13, date: "2026-07-29 16:00", rust: 0, dent: 0, weld: 0, chemical: 3, oil: 0, note: "", timestamp: "2026-07-29 16:00" }
    ];
    localStorage.setItem("PAINTING_INSPECTION_CACHE", JSON.stringify(realData));
    return realData;
}

function getCachedOrSampleData() {
    const cached = localStorage.getItem("PAINTING_INSPECTION_CACHE");
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
                const clean = parsed.filter(item => {
                    const note = String(item.note || '');
                    return !note.includes("สุ่มตรวจประจำวัน") &&
                           !note.includes("พบคราบสนิมบางชิ้นงาน") &&
                           !note.includes("มีรอยบุบและสะเก็ดเชื่อม") &&
                           !note.includes("พบคราบน้ำมันบนพื้นผิว") &&
                           !note.includes("ทดสอบความหนาชั้นสี");
                });
                if (clean.length > 0) return clean;
            }
        } catch (e) {
            console.error("Cache parse error", e);
        }
    }
    return getRealSheetData();
}

function generateSampleData() {
    return getRealSheetData();
}

// Fetch recorder names list from Cloud Google Sheet (Recorders tab)
async function fetchRecordersFromAPI() {
    const baseUrl = getApiUrl();
    if (!baseUrl) return null;
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getRecorders';

    try {
        const data = await fetchAppsScriptJsonWithRetry(url, "Get recorders", { attempts: 2, timeoutMs: 15000 });
        if (data && data.recorders && Array.isArray(data.recorders)) {
            return data.recorders;
        }
    } catch (e) {
        console.warn("Failed to fetch cloud recorders, using local cache:", e);
    }
    return null;
}

// Add a new recorder name to Cloud Google Sheet
async function addRecorderToAPI(name) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return;
    const cleanName = String(name).trim();
    if (!cleanName) return;

    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=addRecorder&name=' + encodeURIComponent(cleanName);

    try {
        // The Apps Script endpoint handles recorder mutations through GET parameters.
        await fetch(withApiRequestNonce(url), { method: "GET", mode: "no-cors", cache: "no-store" });
        return true;
    } catch (e) {
        console.warn("Failed to sync new recorder to cloud:", e);
        return false;
    }
}

// Delete a recorder name from Cloud Google Sheet
async function deleteRecorderFromAPI(name) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return;
    const cleanName = String(name).trim();
    if (!cleanName) return;

    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=deleteRecorder&name=' + encodeURIComponent(cleanName);

    try {
        // The Apps Script endpoint handles recorder mutations through GET parameters.
        await fetch(withApiRequestNonce(url), { method: "GET", mode: "no-cors", cache: "no-store" });
        return true;
    } catch (e) {
        console.warn("Failed to delete recorder from cloud:", e);
        return false;
    }
}

// Fetch outputdiary daily production report data from Cloud Google Sheet
async function fetchDailyReportDataFromAPI(dateFilter = "", options = {}) {
    const baseUrl = getApiUrl();
    const requestedDate = String(dateFilter || "").trim();
    const scope = String(options.scope || "").toLowerCase() === "reviewed" ? "reviewed" : "pending";
    const scopeCacheKey = scope === "reviewed" ? "_REVIEWED" : "_PENDING";
    lastDailyReportFetchSucceeded = false;
    const cacheKey = requestedDate ? `PAINTING_OUTPUTDIARY_CACHE${scopeCacheKey}_${requestedDate}` : `PAINTING_OUTPUTDIARY_CACHE${scopeCacheKey}`;
    if (baseUrl) {
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getDailyReportData&scope=' + scope + (requestedDate ? `&date=${encodeURIComponent(requestedDate)}` : '');

        try {
            const json = await fetchAppsScriptJsonWithRetry(url, "Load outputdiary", options.retryOptions || { attempts: 2, timeoutMs: 15000 });
            
            if (json && json.status === "success" && Array.isArray(json.data)) {
                lastDailyReportFetchSucceeded = true;
                localStorage.setItem(cacheKey, JSON.stringify(json.data));
                return json.data;
            } else if (Array.isArray(json)) {
                lastDailyReportFetchSucceeded = true;
                localStorage.setItem(cacheKey, JSON.stringify(json));
                return json;
            }
        } catch (e) {
            console.warn("Failed to fetch outputdiary from cloud, checking cache:", e);
        }
    }

    const cached = localStorage.getItem(cacheKey);
    if (cached !== null) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }

    if (requestedDate) return [];

    const allCached = localStorage.getItem(`PAINTING_OUTPUTDIARY_CACHE${scopeCacheKey}`);
    if (allCached !== null) {
        try {
            const parsed = JSON.parse(allCached);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) {}
    }

    return [];
}

async function fetchReworkReportDataFromAPI(dateFilter = "", options = {}) {
    const baseUrl = getApiUrl();
    const requestedDate = String(dateFilter || "").trim();
    const scope = String(options.scope || "").toLowerCase() === "reviewed" ? "reviewed" : "pending";
    const scopeCacheKey = scope === "reviewed" ? "_REVIEWED" : "_PENDING";
    const cacheKey = requestedDate ? `PAINTING_REWORK_CACHE${scopeCacheKey}_${requestedDate}` : `PAINTING_REWORK_CACHE${scopeCacheKey}`;
    if (baseUrl) {
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getReworkReportData&scope=' + scope + (requestedDate ? `&date=${encodeURIComponent(requestedDate)}` : '');
        try {
            const json = await fetchAppsScriptJsonWithRetry(url, "Load REWORK history", options.retryOptions || { attempts: 2, timeoutMs: 15000 });
            if (json && json.status === "success" && Array.isArray(json.data)) {
                localStorage.setItem(cacheKey, JSON.stringify(json.data));
                return json.data;
            }
        } catch (error) {
            console.warn("Failed to fetch REWORK history from cloud, checking cache:", error);
        }
    }
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached !== null) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (_) {}
    return [];
}

async function fetchScreenReportDataFromAPI(dateFilter = "", options = {}) {
    const baseUrl = getApiUrl();
    const requestedDate = String(dateFilter || "").trim();
    const scope = String(options.scope || "").toLowerCase() === "reviewed" ? "reviewed" : "pending";
    const scopeCacheKey = scope === "reviewed" ? "_REVIEWED" : "_PENDING";
    const cacheKey = requestedDate ? `PAINTING_SCREEN_CACHE${scopeCacheKey}_${requestedDate}` : `PAINTING_SCREEN_CACHE${scopeCacheKey}`;
    if (baseUrl) {
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getScreenReportData&scope=' + scope + (requestedDate ? `&date=${encodeURIComponent(requestedDate)}` : '');
        try {
            const json = await fetchAppsScriptJsonWithRetry(url, "Load SCREEN history", options.retryOptions || { attempts: 2, timeoutMs: 15000 });
            if (json && json.status === "success" && Array.isArray(json.data)) {
                localStorage.setItem(cacheKey, JSON.stringify(json.data));
                return json.data;
            }
        } catch (error) {
            console.warn("Failed to fetch SCREEN history from cloud, checking cache:", error);
        }
    }
    try {
        const cached = localStorage.getItem(cacheKey);
        if (cached !== null) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) return parsed;
        }
    } catch (_) {}
    return [];
}

async function fetchParameterChecklistDataFromAPI(dateFilter = "", typeFilter = "", options = {}) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return [];
    const requestedDate = String(dateFilter || "").trim();
    const requestedType = String(typeFilter || "").trim();
    const scope = String(options.scope || "").toLowerCase() === "reviewed" ? "reviewed" : "pending";
    const query = new URLSearchParams({ action: "getParameterChecklistData" });
    if (requestedDate) query.set("date", requestedDate);
    if (requestedType) query.set("type", requestedType);
    query.set("scope", scope);
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + query.toString();
    try {
        const result = await fetchAppsScriptJsonWithRetry(url, "Get parameter checklist data", options.retryOptions || {});
        if (result && result.status === "success" && Array.isArray(result.data)) return result.data;
        if (Array.isArray(result)) return result;
    } catch (error) {
        console.warn("Failed to fetch parameter checklist data:", error);
        if (options && options.throwOnError) throw error;
    }
    return [];
}

async function sendParameterChecklistToAPI(payload) {
    const baseUrl = getApiUrl();
    if (!baseUrl) throw new Error("ไม่พบ URL ของระบบหลังบ้าน");
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + "action=submitParameterChecklist";
    const response = await fetch(url, {
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    const result = await requireJsonResponse(response, "Submit parameter checklist");
    if (!result || result.status !== "success" || result.action !== "submitParameterChecklist") {
        throw new Error("ระบบหลังบ้านไม่ยืนยันการบันทึกแบบตรวจพารามิเตอร์");
    }
    return result;
}

async function fetchEquipmentChecklistDataFromAPI(dateFilter = "", options = {}) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return [];
    const query = new URLSearchParams({ action: "getEquipmentChecklistData" });
    query.set("scope", String(options.scope || "").toLowerCase() === "reviewed" ? "reviewed" : "pending");
    if (String(dateFilter || "").trim()) query.set("date", String(dateFilter).trim());
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + query.toString();
    try {
        const result = await fetchAppsScriptJsonWithRetry(url, "Get equipment checklist data", options.retryOptions || {});
        if (result && result.status === "success" && Array.isArray(result.data)) return result.data;
        if (Array.isArray(result)) return result;
    } catch (error) {
        console.warn("Failed to fetch equipment checklist data:", error);
        if (options && options.throwOnError) throw error;
    }
    return [];
}

async function sendEquipmentChecklistToAPI(payload) {
    const baseUrl = getApiUrl();
    if (!baseUrl) throw new Error("ไม่พบ URL ของระบบหลังบ้าน");
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + "action=submitEquipmentChecklist";
    const response = await fetch(url, {
        method: "POST",
        cache: "no-cache",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify(payload)
    });
    const result = await requireJsonResponse(response, "Submit equipment checklist");
    if (!result || result.status !== "success" || result.action !== "submitEquipmentChecklist") {
        throw new Error("ระบบหลังบ้านไม่ยืนยันการบันทึกเช็กลิสอุปกรณ์");
    }
    return result;
}

async function fetchQCReviewDataFromAPI(options = {}) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return [];
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + "action=getQCReviewData";
    try {
        const result = await fetchAppsScriptJsonWithRetry(url, "Get QC review data", options.retryOptions || {});
        if (result && result.status === "success" && Array.isArray(result.data)) return result.data;
        if (Array.isArray(result)) return result;
    } catch (error) {
        console.warn("Failed to fetch QC review data:", error);
        if (options && options.throwOnError) throw error;
    }
    return [];
}

async function sendQCChecklistReviewToAPI(payload) {
    const baseUrl = getApiUrl();
    if (!baseUrl) throw new Error("ไม่พบ URL ของระบบหลังบ้าน");
    // Use the GET-compatible Apps Script handler with a fresh nonce. The old
    // POST-first path could follow a stale googleusercontent redirect and
    // leave the button in a saving state even though it received the click.
    const reviewUrl = baseUrl + (baseUrl.includes('?') ? '&' : '?')
        + "action=submitQCReview&payload=" + encodeURIComponent(JSON.stringify(payload || {}));
    const request = fetchAppsScriptJsonWithRetry(reviewUrl, "Submit QC review", {
        attempts: 2,
        timeoutMs: 8000,
        skipQueue: true
    });
    const result = await Promise.race([
        request,
        new Promise((_, reject) => setTimeout(
            () => reject(new Error("บันทึกผลตรวจใช้เวลานานเกินไป กรุณากดตรวจอีกครั้ง")),
            18000
        ))
    ]);
    if (!result || result.status !== "success" || result.action !== "submitQCReview") {
        throw new Error("ระบบหลังบ้านไม่ยืนยันการตรวจ QC");
    }
    if (!result.duplicate && Number(result.moved || 0) < 1) {
        throw new Error("ไม่พบแถวต้นทาง จึงยังย้ายข้อมูลไปชีต Reviewed ไม่ได้");
    }
    return result;
}

async function verifyDailyReportSavedOnBackend(payload) {
    const baseUrl = getApiUrl();
    if (!baseUrl || !payload) return false;

    const date = String(payload.date || "").trim();
    const query = new URLSearchParams({ action: "getDailyReportData" });
    if (date) query.set("date", date);
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + query.toString();
    const response = await fetch(url, {
        method: "GET",
        cache: "no-cache",
        headers: { "Accept": "application/json" }
    });
    if (!response.ok) return false;

    const result = await response.json();
    const saved = Array.isArray(result) ? result : (result && Array.isArray(result.data) ? result.data : []);
    const submissionId = String(payload.submissionId || "").trim();
    if (submissionId && saved.some(record => String(record.submissionId || "").trim() === submissionId)) {
        return true;
    }

    // Compatibility fallback for rows created before SubmissionId was added.
    const expected = Array.isArray(payload.records) ? payload.records : [];
    const candidates = saved.filter(record => {
        const recordDate = String(record.date || record.Date || "").trim().slice(0, 10);
        return (!date || recordDate === date) &&
            (!payload.recorder || String(record.recorder || record.Recorder || "").trim() === String(payload.recorder).trim());
    });
    const used = new Set();
    return expected.length > 0 && expected.every(item => {
        const index = candidates.findIndex((record, i) => {
            if (used.has(i)) return false;
            const same = (a, b) => String(a ?? "").trim() === String(b ?? "").trim();
            return same(record.model || record.Model, item.model) &&
                same(record.timeSlot || record.TimeSlot, item.timeSlot) &&
                Number(record.prodQty || record.ProdQty || 0) === Number(item.prodQty || 0) &&
                Number(record.totalDefect || record.TotalDefect || 0) === Number(item.totalDefect || 0);
        });
        if (index < 0) return false;
        used.add(index);
        return true;
    });
}

function generateSampleOutputDiaryData() {
    return [];
}

// Append a new category or model to the PartModelCatalog sheet.
async function addCatalogEntryToAPI(entry) {
    const baseUrl = getApiUrl();
    if (!baseUrl) return false;
    const params = new URLSearchParams({ action: 'addCatalogEntry' });
    ['group', 'category', 'code', 'name'].forEach(key => { if (entry && entry[key]) params.set(key, entry[key]); });
    try {
        const json = await fetchAppsScriptJsonWithRetry(baseUrl + (baseUrl.includes('?') ? '&' : '?') + params.toString(), 'Add catalog entry', { attempts: 2, timeoutMs: 15000 });
        return !!(json && json.status === 'success');
    } catch (e) {
        console.warn('Failed to save catalog entry:', e);
        return false;
    }
}

// Fetch PartModel mapping from Cloud Google Sheet (PartModel sheet tab)
async function fetchPartModelsFromAPI() {
    const baseUrl = getApiUrl();
    if (baseUrl) {
        const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getPartModels';
        try {
            const json = await fetchAppsScriptJsonWithRetry(url, "Get part models", { attempts: 2, timeoutMs: 15000 });
            if (json && json.groups && typeof json.groups === 'object' && Object.keys(json.groups).length > 0) {
                // source/order tell the form the catalog came from the sheet.
                window.PAINTING_PART_CATALOG_META = { source: json.source || '', order: json.order || [] };
                localStorage.setItem("PAINTING_PART_MODELS_CACHE", JSON.stringify(json.groups));
                return json.groups;
            }
        } catch (e) {
            console.warn("Failed to fetch PartModel from cloud, checking cache:", e);
        }
    }

    const cached = localStorage.getItem("PAINTING_PART_MODELS_CACHE");
    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
                return parsed;
            }
        } catch (e) {}
    }

    return null;
}

// ==========================================
// Spare parts inventory API Functions
// ==========================================

const SPARE_PARTS_CACHE_KEY = "PAINTING_SPARE_PARTS_CACHE";

async function fetchSparePartsFromAPI() {
    const baseUrl = getApiUrl();
    if (!baseUrl) return { parts: [], transactions: [] };

    try {
        const url = baseUrl + (baseUrl.includes("?") ? "&" : "?") + "action=getSpareParts";
        const result = await fetchAppsScriptJsonWithRetry(url, "โหลดคลังอะไหล่", { attempts: 2, timeoutMs: 15000 });
        const inventory = {
            parts: Array.isArray(result?.parts) ? result.parts : [],
            transactions: Array.isArray(result?.transactions) ? result.transactions : []
        };
        localStorage.setItem(SPARE_PARTS_CACHE_KEY, JSON.stringify(inventory));
        return inventory;
    } catch (error) {
        console.warn("Failed to fetch spare parts inventory:", error);
        try {
            const cached = JSON.parse(localStorage.getItem(SPARE_PARTS_CACHE_KEY) || "{}");
            return { parts: Array.isArray(cached.parts) ? cached.parts : [], transactions: Array.isArray(cached.transactions) ? cached.transactions : [] };
        } catch (cacheError) {
            return { parts: [], transactions: [] };
        }
    }
}

async function saveSparePartToAPI(part) {
    const baseUrl = getApiUrl();
    if (!baseUrl) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูลคลังอะไหล่");
    const params = new URLSearchParams({
        action: "saveSparePart",
        partId: part.partId || "",
        partName: part.partName || "",
        category: part.category || "",
        machine: part.machine || "",
        unit: part.unit || "ชิ้น",
        openingStock: String(part.openingStock || 0),
        minStock: String(part.minStock || 0),
        maxStock: String(part.maxStock || 0),
        location: part.location || "",
        supplier: part.supplier || "",
        notes: part.notes || ""
    }).toString();
    activeSyncRequests++;
    updateSyncUI();
    try {
        const response = await fetch(withApiRequestNonce(baseUrl + (baseUrl.includes("?") ? "&" : "?") + params), { method: "GET", cache: "no-store" });
        return await requireJsonResponse(response, "บันทึกข้อมูลอะไหล่");
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

async function recordSparePartTransactionToAPI(transaction) {
    const baseUrl = getApiUrl();
    if (!baseUrl) throw new Error("ยังไม่ได้เชื่อมต่อฐานข้อมูลคลังอะไหล่");
    const params = new URLSearchParams({
        action: "recordSparePartTransaction",
        partId: transaction.partId || "",
        type: transaction.type || "",
        quantity: String(transaction.quantity || 0),
        reference: transaction.reference || "",
        machine: transaction.machine || "",
        recorder: transaction.recorder || "",
        note: transaction.note || ""
    }).toString();
    activeSyncRequests++;
    updateSyncUI();
    try {
        const response = await fetch(withApiRequestNonce(baseUrl + (baseUrl.includes("?") ? "&" : "?") + params), { method: "GET", cache: "no-store" });
        return await requireJsonResponse(response, "บันทึกรายการคลังอะไหล่");
    } finally {
        activeSyncRequests = Math.max(0, activeSyncRequests - 1);
        updateSyncUI();
    }
}

// ==========================================
// 5M1E Event Management API Functions
// ==========================================

async function fetchEventsFromAPI() {
    const baseUrl = getApiUrl();
    if (baseUrl) {
        try {
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getEvents';
            const res = await fetchAppsScriptJsonWithRetry(url, "Get events", { attempts: 2, timeoutMs: 15000 });
            if (res && res.status === "success" && Array.isArray(res.data)) {
                    // Filter out legacy mock sample items
                    const realData = res.data.filter(evt => !String(evt.id || '').startsWith("evt_10") && String(evt.title || '') !== "ปรับเพิ่มอุณหภูมิตู้อบสี");
                    localStorage.setItem("PAINTING_EVENTS_CACHE", JSON.stringify(realData));
                    return realData;
            }
        } catch (e) {
            console.warn("Failed to fetch 5M1E events from cloud API, checking cache:", e);
        }
    }

    const cached = localStorage.getItem("PAINTING_EVENTS_CACHE");
    if (cached !== null) {
        try {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed)) {
                // Filter out legacy mock sample items from local storage
                const realUserEvents = parsed.filter(evt => !String(evt.id || '').startsWith("evt_10") && String(evt.title || '') !== "ปรับเพิ่มอุณหภูมิตู้อบสี");
                localStorage.setItem("PAINTING_EVENTS_CACHE", JSON.stringify(realUserEvents));
                return realUserEvents;
            }
        } catch (e) {}
    }

    return [];
}

function generateSampleEventsData() {
    return [];
}

async function sendEventToAPI(eventData) {
    const baseUrl = getApiUrl();
    const id = "evt_" + new Date().getTime();
    const newEvt = { ...eventData, id: id, timestamp: `${eventData.date} ${eventData.time}` };

    let cache = [];
    try {
        const raw = localStorage.getItem("PAINTING_EVENTS_CACHE");
        if (raw) cache = JSON.parse(raw);
    } catch (e) {}
    cache.unshift(newEvt);
    localStorage.setItem("PAINTING_EVENTS_CACHE", JSON.stringify(cache));
    localStorage.setItem("PAINTING_EVENTS_INIT", "true");

    if (baseUrl) {
        try {
            activeSyncRequests++;
            updateSyncUI();
            const queryParams = new URLSearchParams({ action: "createEvent", ...newEvt }).toString();
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryParams;
            await fetch(url, { method: "GET", mode: "no-cors" });
        } catch (e) {
            console.warn("Failed to push 5M1E event to cloud API:", e);
        } finally {
            activeSyncRequests = Math.max(0, activeSyncRequests - 1);
            updateSyncUI();
        }
    }
    return { status: "success", id: id };
}

async function deleteEventFromAPI(id, rowIndex, title) {
    let cache = [];
    try {
        const raw = localStorage.getItem("PAINTING_EVENTS_CACHE");
        if (raw) cache = JSON.parse(raw);
    } catch (e) {}

    const updated = cache.filter(evt => String(evt.id) !== String(id) && (title ? String(evt.title || "").trim() !== String(title).trim() : true));
    localStorage.setItem("PAINTING_EVENTS_CACHE", JSON.stringify(updated));
    localStorage.setItem("PAINTING_EVENTS_INIT", "true");

    const baseUrl = getApiUrl();
    if (baseUrl) {
        try {
            activeSyncRequests++;
            updateSyncUI();
            const queryParams = new URLSearchParams({ action: "deleteEvent", id: id || "", rowIndex: rowIndex || 0, title: title || "" }).toString();
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + queryParams;
            await fetch(url, { method: "GET", mode: "no-cors" });
        } catch (e) {
            console.warn("Failed to delete 5M1E event from cloud API:", e);
        } finally {
            activeSyncRequests = Math.max(0, activeSyncRequests - 1);
            updateSyncUI();
        }
    }
    return { status: "success" };
}

// ==========================================
// Authentication & User Management API Helpers
// ==========================================

const USER_PERMISSION_KEYS = [
    "dashboard.read",
    "qc7.read",
    "qc.read",
    "inspection.create",
    "daily_report.read",
    "rework.read",
    "screen.read",
    "checklist.read",
    "events.read",
    "spare_parts.read",
    "users.manage"
];
const DEFAULT_USER_PERMISSION_KEYS = USER_PERMISSION_KEYS.filter(key => key !== "users.manage");

function normalizeUserPermissions(permissions, role, employeeId) {
    const cleanRole = String(role || "").trim();
    if (cleanRole === "Super Admin" || cleanRole === "Admin" || String(employeeId || "").trim() === "69112") {
        return [...USER_PERMISSION_KEYS];
    }
    if (!Array.isArray(permissions)) return [...DEFAULT_USER_PERMISSION_KEYS];
    return permissions.filter(key => USER_PERMISSION_KEYS.includes(String(key)));
}

// A registration request must create one account card even if an old sheet
// contains duplicate rows. Prefer the usable account state when duplicates
// exist so an approved user is not hidden by a stale Pending row.
function deduplicateUsers(users = []) {
    const statusRank = { Active: 3, Pending: 2, Disabled: 1 };
    const uniqueUsers = new Map();

    (Array.isArray(users) ? users : []).forEach(user => {
        const employeeId = String(user && user.employeeId || "").trim();
        if (!employeeId) return;

        const key = employeeId.toLowerCase();
        const current = uniqueUsers.get(key);
        if (!current) {
            uniqueUsers.set(key, user);
            return;
        }

        const currentRank = statusRank[String(current.status || "").trim()] || 0;
        const nextRank = statusRank[String(user.status || "").trim()] || 0;
        const currentDate = Date.parse(current.createdAt || current.lastLogin || "") || 0;
        const nextDate = Date.parse(user.createdAt || user.lastLogin || "") || 0;
        if (nextRank > currentRank || (nextRank === currentRank && nextDate > currentDate)) {
            uniqueUsers.set(key, user);
        }
    });

    return [...uniqueUsers.values()];
}

async function checkBootstrapAPI() {
    return { isBootstrap: false };
}

// One request to the Users endpoints. JSONP first, because a plain fetch to
// /exec can stall on the redirect or come back as an HTML page. A backend
// "status: error" answer is returned as-is (wrong password, duplicate ID...);
// only a transport failure falls back to fetch, and throws if that fails too.
async function callUsersApi(baseUrl, params, operation) {
    const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + new URLSearchParams(params).toString();
    try {
        return await fetchAppsScriptJsonp(url, operation, 20000);
    } catch (error) {
        if (error && error.backend) return { status: "error", message: error.message };
    }
    const response = await fetch(withApiRequestNonce(url), { method: "GET", cache: "no-store" });
    if (!response.ok) throw new Error(`${operation}: HTTP ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().includes('application/json')) {
        throw new Error(`${operation}: Apps Script deployment did not return JSON`);
    }
    return response.json();
}

async function loginUserAPI(employeeId, passwordHash) {
    const cleanEmpId = String(employeeId || "").trim();

    // Standard Super Admin IDs (Mana Subintan) - Always allow Super Admin login on any device
    const isSuperAdminId = cleanEmpId === "69112" || cleanEmpId === "ADM-01" || cleanEmpId.toUpperCase().includes("ADM") || cleanEmpId.includes("69112");

    const baseUrl = getApiUrl();

    // 1. Try Cloud Google Apps Script API
    if (baseUrl) {
        try {
            const json = await callUsersApi(baseUrl, {
                action: 'login',
                employeeId: cleanEmpId,
                passwordHash: passwordHash
            }, 'Login');
            if (json && json.status === "success" && json.user) {
                return json;
            } else if (json && json.status === "error" && json.message && json.message !== "Unauthorized") {
                return json;
            }
        } catch (e) {
            console.warn("Cloud login failed, checking fallback...", e);
        }
    }

    // 2. Local Fallback Login Check
    try {
        const cached = localStorage.getItem("PAINTING_LOCAL_USERS");
        const users = cached ? JSON.parse(cached) : [];
        const match = users.find(u => String(u.employeeId).trim() === cleanEmpId);
        if (match) {
            if (match.passwordHash && passwordHash && match.passwordHash !== passwordHash) {
                return { status: "error", message: "รหัสผ่านไม่ถูกต้อง" };
            }
            if (match.status === "Disabled") {
                return { status: "error", message: "บัญชีของคุณถูกระงับการใช้งาน" };
            }
            // Auto-activate status on successful password verification for smooth mobile login
            match.status = "Active";
            localStorage.setItem("PAINTING_LOCAL_USERS", JSON.stringify(users));

            return {
                status: "success",
                user: {
                    employeeId: match.employeeId,
                    displayName: match.displayName,
                    department: match.department,
                    role: match.role || "Inspector",
                    status: "Active",
                    permissions: normalizeUserPermissions(match.permissions, match.role, match.employeeId)
                }
            };
        }
    } catch (e) {}

    // 3. Super Admin Universal Access (Allows Super Admin Mana Subintan to log in on any phone or PC)
    if (isSuperAdminId) {
        return {
            status: "success",
            user: {
                employeeId: cleanEmpId,
                displayName: "Mana Subintan",
                department: "Engineer (วิศวกร)",
                role: "Super Admin",
                status: "Active",
                permissions: [...USER_PERMISSION_KEYS]
            }
        };
    }

    return { status: "error", message: "ไม่พบรหัสพนักงานนี้ในระบบ" };
}

async function registerUserAPI(userData) {
    const baseUrl = getApiUrl();

    // Send exactly one cloud request. The old implementation dispatched both
    // GET and POST, so Apps Script appended the same registration twice.
    if (baseUrl) {
        try {
            const result = await callUsersApi(baseUrl, {
                action: 'register',
                employeeId: userData.employeeId || '',
                displayName: userData.displayName || '',
                department: userData.department || '',
                passwordHash: userData.passwordHash || ''
            }, 'Register user');
            // Preserve backend duplicate/error responses. Do not turn a
            // rejected cloud registration into a misleading local success.
            return result && typeof result === "object" ? result : { status: "error", message: "ไม่สามารถยืนยันการสมัครได้" };
        } catch (e) {
            console.warn("Cloud register failed, using local fallback:", e);
        }
    }

    // Use local storage only when the cloud request itself is unavailable.
    return saveUserLocallyFallback(userData);
}

function saveUserLocallyFallback(userData) {
    try {
        let users = [];
        const cached = localStorage.getItem("PAINTING_LOCAL_USERS");
        if (cached) {
            try { users = JSON.parse(cached); } catch(e){}
        }

        const isSuper69112 = String(userData.employeeId).trim() === "69112";

        let existingUser = users.find(u => String(u.employeeId).trim() === String(userData.employeeId).trim());
        if (existingUser) {
            existingUser.displayName = userData.displayName || existingUser.displayName;
            existingUser.department = userData.department || existingUser.department;
            if (userData.passwordHash) existingUser.passwordHash = userData.passwordHash;
            existingUser.role = isSuper69112 ? "Super Admin" : (existingUser.role === "Super Admin" ? "Inspector" : existingUser.role);
            existingUser.permissions = normalizeUserPermissions(userData.permissions || existingUser.permissions, existingUser.role, existingUser.employeeId);
            localStorage.setItem("PAINTING_LOCAL_USERS", JSON.stringify(users));
            return {
                status: "success",
                isSuperAdmin: isSuper69112,
                role: existingUser.role,
                userStatus: existingUser.status
            };
        }

        const newUser = {
            employeeId: userData.employeeId,
            displayName: userData.displayName,
            department: userData.department,
            passwordHash: userData.passwordHash || "",
            role: isSuper69112 ? "Super Admin" : "Inspector",
            status: isSuper69112 ? "Active" : "Pending",
            createdAt: new Date().toISOString(),
            permissions: normalizeUserPermissions(userData.permissions, isSuper69112 ? "Super Admin" : "Inspector", userData.employeeId)
        };
        users.push(newUser);
        localStorage.setItem("PAINTING_LOCAL_USERS", JSON.stringify(users));

        return {
            status: "success",
            isSuperAdmin: isSuper69112,
            role: newUser.role,
            userStatus: newUser.status
        };
    } catch (e) {
        return { status: "error", message: "ไม่สามารถบันทึกข้อมูลผู้ใช้ได้" };
    }
}

async function getUsersAPI() {
    const baseUrl = getApiUrl();
    if (baseUrl) {
        try {
            const url = baseUrl + (baseUrl.includes('?') ? '&' : '?') + 'action=getUsers';
            const json = await fetchAppsScriptJsonWithRetry(url, "Get users", { attempts: 1, timeoutMs: 15000 });
            if (json && json.status === "success" && Array.isArray(json.users)) {
                const users = deduplicateUsers(json.users.map(user => ({
                    ...user,
                    permissions: normalizeUserPermissions(user.permissions, user.role, user.employeeId)
                })));
                localStorage.setItem("PAINTING_LOCAL_USERS", JSON.stringify(users));
                window.PAINTING_USERS_SOURCE = "cloud";
                return users;
            }
        } catch (e) {
            console.warn("getUsersAPI cloud fetch failed:", e);
        }
    }
    // Anything below is this browser's cached copy, not the Users sheet.
    window.PAINTING_USERS_SOURCE = baseUrl ? "cache" : "local";

    try {
        const cached = localStorage.getItem("PAINTING_LOCAL_USERS");
        const users = cached ? JSON.parse(cached) : [];
        return Array.isArray(users) ? deduplicateUsers(users.map(user => ({
            ...user,
            permissions: normalizeUserPermissions(user.permissions, user.role, user.employeeId)
        }))) : [];
    } catch (e) {
        return [];
    }
}

function updateCachedUser(employeeId, changes) {
    try {
        const cached = localStorage.getItem("PAINTING_LOCAL_USERS");
        let users = cached ? JSON.parse(cached) : [];
        if (!Array.isArray(users)) users = [];
        const id = String(employeeId).trim();
        const index = users.findIndex(u => String(u.employeeId).trim() === id);
        const current = index >= 0 ? users[index] : { employeeId: id, role: "Inspector" };
        const next = { ...current };
        Object.keys(changes).forEach(key => {
            if (changes[key]) next[key] = changes[key];
        });
        next.permissions = normalizeUserPermissions(changes.permissions || current.permissions, next.role, next.employeeId);
        if (index >= 0) users[index] = next; else users.push(next);
        localStorage.setItem("PAINTING_LOCAL_USERS", JSON.stringify(users));
    } catch (e) {}
}

// Users live in the "Users" sheet. Write there first and only mirror the
// change into this browser's cache once Apps Script confirms it, so the admin
// never sees a change that other devices will not get.
async function updateUserStatusAPI(employeeId, newStatus, newRole, permissions) {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
        updateCachedUser(employeeId, { status: newStatus, role: newRole, permissions });
        return { status: "success", local: true };
    }
    try {
        const result = await callUsersApi(baseUrl, {
            action: 'updateUserStatus',
            employeeId: employeeId || '',
            userStatus: newStatus || '',
            userRole: newRole || '',
            permissions: permissions ? JSON.stringify(permissions) : ''
        }, 'Update user');
        if (!result || result.status !== "success") return result || { status: "error", message: "บันทึกลง Google Sheet ไม่สำเร็จ" };
        updateCachedUser(employeeId, { status: newStatus, role: newRole, permissions });
        return result;
    } catch (e) {
        console.warn("Cloud updateUserStatus failed:", e);
        return { status: "error", message: "บันทึกลง Google Sheet ไม่สำเร็จ: " + (e.message || e) };
    }
}

async function upsertUserAPI(userData) {
    const baseUrl = getApiUrl();
    if (!baseUrl) {
        saveUserLocallyFallback(userData);
        updateCachedUser(userData.employeeId, { status: userData.status });
        return { status: "success", local: true };
    }
    try {
        const result = await callUsersApi(baseUrl, {
            action: 'upsertUser',
            employeeId: userData.employeeId || '',
            displayName: userData.displayName || '',
            department: userData.department || '',
            userStatus: userData.status || 'Active',
            userRole: userData.role || 'Inspector',
            passwordHash: userData.passwordHash || '',
            resetPassword: userData.resetPassword ? '1' : ''
        }, 'Add user');
        if (!result || result.status !== "success") return result || { status: "error", message: "บันทึกลง Google Sheet ไม่สำเร็จ" };
        updateCachedUser(userData.employeeId, {
            role: userData.role,
            displayName: userData.displayName,
            department: userData.department,
            status: userData.status
        });
        return result;
    } catch (e) {
        console.warn("Cloud upsertUser failed:", e);
        return { status: "error", message: "บันทึกลง Google Sheet ไม่สำเร็จ: " + (e.message || e) };
    }
}

