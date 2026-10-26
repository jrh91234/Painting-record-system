const SHEET_NAME = "Inspection";
const DAILY_REPORT_ID_HEADER = "SubmissionId";
const DAILY_REPORT_COLOR_HEADER = "Color";
const DAILY_REPORT_PRODUCT_GROUP_HEADER = "ProductGroup";
const DAILY_REPORT_PART_CATEGORY_HEADER = "PartCategory";
const DAILY_REPORT_COLOR_CODE_HEADER = "ColorCode";
const DAILY_REPORT_DUST_HEADER = "Dust";
const DAILY_REPORT_OIL_HEADER = "Oil";
const DAILY_REPORT_RUST_HEADER = "Rust";
const INSPECTION_WORK_TYPE_HEADER = "WorkType";
const PARAMETER_CHECKLIST_SHEET_NAME = "ParameterChecklist";
const WATER_PARAMETER_CHECKLIST_SHEET_NAME = "WaterParameterChecklist";
const EQUIPMENT_CHECKLIST_SHEET_NAME = "EquipmentChecklist";
const REWORK_SHEET_NAME = "REWORK";
// Dedicated storage for the Screen checklist menu (created on first use).
const SCREEN_SHEET_NAME = "SCREEN";
const SPARE_PARTS_SHEET_NAME = "SpareParts";
const SPARE_PARTS_TRANSACTIONS_SHEET_NAME = "SparePartsTransactions";
const QC_PENDING_SUFFIX = "_Pending";
const QC_REVIEWED_SUFFIX = "_Reviewed";
const QC_MIGRATION_SOURCES = ["ParameterChecklist", "WaterParameterChecklist", "EquipmentChecklist", "SCREEN", "REWORK", "outputdiary"];
const REPORT_READ_MAX_ROWS = 5000;
// Recovered tabs can contain stray formatted columns. Keep history reads
// bounded so one malformed tab cannot make every QC request time out.
const REPORT_READ_MAX_COLUMNS = 64;
const PARAMETER_CHECKLIST_ID_HEADER = "SubmissionId";
const ALL_PERMISSIONS = ["dashboard.read", "qc7.read", "qc.read", "inspection.create", "daily_report.read", "rework.read", "screen.read", "checklist.read", "events.read", "spare_parts.read", "users.manage"];
const DEFAULT_USER_PERMISSIONS = ["dashboard.read", "qc7.read", "qc.read", "inspection.create", "daily_report.read", "rework.read", "screen.read", "checklist.read", "events.read", "spare_parts.read"];

function normalizeInspectionWorkType_(value) {
  const raw = String(value == null ? "" : value).trim().toUpperCase();
  if (raw === "SCREEN" || raw.indexOf("SCREEN") >= 0) return "SCREEN";
  if (raw === "REWORK" || raw.indexOf("REWORK") >= 0 || raw.indexOf("รีเวิร์ค") >= 0) return "REWORK";
  if (raw === "NEW" || raw.indexOf("งานใหม่") >= 0) return "NEW";
  return "";
}

function ensureInspectionWorkTypeColumn_(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const existingIndex = headers.indexOf(INSPECTION_WORK_TYPE_HEADER);
  if (existingIndex >= 0) return existingIndex + 1;
  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(INSPECTION_WORK_TYPE_HEADER);
  return newColumn;
}

function ensureInspectionSheet_(ss) {
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(["Date", "Rust", "Dent", "Weld", "Chemical", "Oil", "Note", "Timestamp", INSPECTION_WORK_TYPE_HEADER]);
  } else {
    ensureInspectionWorkTypeColumn_(sheet);
  }
  return sheet;
}

function inspectionRowValues_(sheet, payload, existingRow) {
  ensureInspectionWorkTypeColumn_(sheet);
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const row = Array.isArray(existingRow)
    ? existingRow.slice(0, lastColumn).concat(Array(Math.max(0, lastColumn - existingRow.length)).fill(""))
    : Array(lastColumn).fill("");
  const values = {
    Date: String(payload.date || formatDateStr(new Date(), true)),
    Rust: Number(payload.rust) || 0,
    Dent: Number(payload.dent) || 0,
    Weld: Number(payload.weld) || 0,
    Chemical: Number(payload.chemical) || 0,
    Oil: Number(payload.oil) || 0,
    Note: String(payload.note || ""),
    Timestamp: new Date(),
    [INSPECTION_WORK_TYPE_HEADER]: normalizeInspectionWorkType_(payload.workType)
  };

  // The existing Inspection tab uses Thai headers (วันที่, งานเป็นสนิม,
  // เวลา, ...), while newly-created tabs use the English headers above.
  // Match both layouts and fall back to the original column positions so a
  // new save cannot create a row containing only WorkType.
  const aliases = {
    Date: ["Date", "วันที่", "วันที่ตรวจเช็ค"],
    Rust: ["Rust", "งานเป็นสนิม", "สนิม"],
    Dent: ["Dent", "รอยบุบ"],
    Weld: ["Weld", "สะเก็ดรอยเชื่อม", "สะเก็ดเชื่อม"],
    Chemical: ["Chemical", "คราบน้ำยา"],
    Oil: ["Oil", "คราบน้ำมัน"],
    Note: ["Note", "หมายเหตุ"],
    Timestamp: ["Timestamp", "เวลา", "เวลาที่บันทึก"],
    [INSPECTION_WORK_TYPE_HEADER]: [INSPECTION_WORK_TYPE_HEADER, "ประเภทงาน", "ส่วนงานที่ตรวจเช็ค"]
  };
  const fallbackIndexes = { Date: 0, Rust: 1, Dent: 2, Weld: 3, Chemical: 4, Oil: 5, Note: 6, Timestamp: 7, [INSPECTION_WORK_TYPE_HEADER]: 8 };
  const normalizedHeaders = headers.map(header => String(header || "").trim().toLowerCase());

  const findIndex = name => {
    const names = (aliases[name] || [name]).map(alias => String(alias).trim().toLowerCase());
    const matched = normalizedHeaders.findIndex(header => names.includes(header));
    if (matched >= 0) return matched;
    const fallback = Number(fallbackIndexes[name]);
    return fallback < lastColumn ? fallback : -1;
  };

  Object.keys(values).forEach(name => {
    const index = findIndex(name);
    if (index >= 0) row[index] = values[name];
  });
  return row.slice(0, lastColumn);
}

// Production catalog used by the daily report cascading selectors.
const PART_MODEL_CATALOG = {
  "LC600 Classic": { colors: [{ value: "GREY BUTTER", label: "GREY BUTTER (1025216PX20)", code: "1025216PX20" }], categories: {
    "Flat Door": [{ value: "7517016200", label: "Flat Door (7517016200)" }],
    "Gland Plate": [{ value: "7517014800", label: "Gland Plate (7517014800)" }],
    "Cover (Four types)": [
      { value: "75170152", label: "Cover (Four types) (75170152)" },
      { value: "75170153", label: "Cover (Four types) (75170153)" },
      { value: "75170154", label: "Cover (Four types) (75170154)" },
      { value: "75170155", label: "Cover (Four types) (75170155)" }
    ],
    "Box": [{ value: "7517014500", label: "Box (7517014500)" }]
  } },
  "LC600 Visi-smart": { colors: [{ value: "WHITE", label: "WHITE (1003532PX20)", code: "1003532PX20" }], categories: {
    "Curve Door": [{ value: "7517016600", label: "Curve Door (7517016600)" }],
    "Gland Plate": [{ value: "7517014000", label: "Gland Plate (7517014000)" }],
    "Cover (Four types)": [
      { value: "75170152", label: "Cover (Four types) (75170152)" },
      { value: "75170153", label: "Cover (Four types) (75170153)" },
      { value: "75170154", label: "Cover (Four types) (75170154)" },
      { value: "75170155", label: "Cover (Four types) (75170155)" }
    ],
    "Box": [{ value: "7517014500", label: "Box (7517014500)" }]
  } },
  "PDB": { colors: [{ value: "WHITE N-47", label: "WHITE N-47 (1214891PX20)", code: "1214891PX20" }], categories: {
    "PDB": [
      { value: "827111-S", label: "DBS30 (827111-S)" },
      { value: "827198-S", label: "DBS45 (827198-S)" },
      { value: "827285-S", label: "DBS60 (827285-S)" }
    ]
  } },
  "CU (resi thai)": { colors: [{ value: "White 2910", label: "White 2910 (1223326PX20)", code: "1223326PX20" }], categories: {
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
  } },
  "NLC": { colors: [
    { value: "GREY", label: "GREY (1259025)", code: "1259025" },
    { value: "WHITE SE3", label: "WHITE SE3 (1259107)", code: "1259107" }
  ], categories: {
    "U BOX": [["BRU53714", "U BOX 450mm"], ["BRU53715", "U BOX 600mm"], ["BRU53716", "U BOX 750mm"], ["BRU53771", "U BOX 900mm"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" })),
    "Door": [["BRU53743", "Door 450mm"], ["BRU53744", "Door 600mm"], ["BRU53747", "Door 750mm"], ["BRU53749", "Door 900mm"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" })),
    "Gland Plate": [{ value: "BRU53717", label: "Gland Plate (BRU53717)" }],
    "Cover 100EZ": [["BRU53718", "Cover EZ100 450mm 12 way"], ["BRU53719", "Cover EZ100 600mm 18 way"], ["BRU53720", "Cover EZ100 600mm 24 way"], ["BRU53721", "Cover EZ100 600mm 30 way"], ["BRU53722", "Cover EZ100 750mm 36 way"], ["BRU53723", "Cover EZ100 750mm 42 way"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" })),
    "Cover 100LUG": [["BRU53724", "Cover LUG100 450mm 12 way"], ["BRU53725", "Cover LUG100 450mm 18 way"], ["BRU53726", "Cover LUG100 600mm 24 way"], ["BRU53727", "Cover LUG100 600mm 30 way"], ["BRU53728", "Cover LUG100 600mm 36 way"], ["BRU53729", "Cover LUG100 750mm 42 way"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" })),
    "Cover 250EZ": [["BRU53730", "Cover EZ250 600mm 12 way"], ["BRU53731", "Cover EZ250 600mm 18 way"], ["BRU53732", "Cover EZ250 750mm 24 way"], ["BRU53734", "Cover EZ250 750mm 30 way"], ["BRU53735", "Cover EZ250 900mm 36 way"], ["BRU53736", "Cover EZ250 900mm 42 way"], ["BRU53737", "Cover EZ250 900mm 48 way"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" })),
    "Cover 250LUG": [["BRU53738", "Cover LUG250 450mm 12 way"], ["BRU53739", "Cover LUG250 600mm 18 way"], ["BRU53740", "Cover LUG250 600mm 24 way"], ["BRU53741", "Cover LUG250 600mm 30 way"], ["BRU53742", "Cover LUG250 750mm 36 way"], ["BRU53745", "Cover LUG250 750mm 42 way"], ["BRU53746", "Cover LUG250 900mm 48 way"]].map(x => ({ value: x[0], label: x[1] + " (" + x[0] + ")" }))
  } },
  // Keep NMS selectable while its part/model catalog is being prepared.
  "NMS": { colors: [], categories: { "Box": [], "Cover": [] } }
};

// "Admin" is granted by the owner from the user-management menu and gets
// every permission, like the Super Admin, without being the system owner.
function isFullAccessRole_(role) {
  const r = String(role || "").trim();
  return r === "Super Admin" || r === "Admin";
}

function getDefaultPermissions(role) {
  return isFullAccessRole_(role) ? ALL_PERMISSIONS.slice() : DEFAULT_USER_PERMISSIONS.slice();
}

function parsePermissions(value, role) {
  if (isFullAccessRole_(role)) return ALL_PERMISSIONS.slice();
  if (!value) return getDefaultPermissions(role);
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value));
    if (!Array.isArray(parsed)) return getDefaultPermissions(role);
    return parsed.filter(p => ALL_PERMISSIONS.indexOf(String(p)) >= 0);
  } catch (e) {
    return getDefaultPermissions(role);
  }
}

function permissionsJson(value, role) {
  return JSON.stringify(parsePermissions(value, role));
}

// Keep daily-report submissions idempotent. If the browser times out after
// Google Sheets has already written the rows, retrying the same submissionId
// must not append a duplicate set of rows.
function ensureDailyReportIdColumn(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const existingIndex = headers.indexOf(DAILY_REPORT_ID_HEADER);
  if (existingIndex >= 0) return existingIndex + 1;
  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(DAILY_REPORT_ID_HEADER);
  return newColumn;
}

function ensureDailyReportColorColumn(sheet) {
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const existingIndex = headers.indexOf(DAILY_REPORT_COLOR_HEADER);
  if (existingIndex >= 0) return existingIndex + 1;
  const newColumn = lastColumn + 1;
  sheet.getRange(1, newColumn).setValue(DAILY_REPORT_COLOR_HEADER);
  return newColumn;
}

function ensureDailyReportCatalogColumns(sheet) {
  const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  const names = [DAILY_REPORT_PRODUCT_GROUP_HEADER, DAILY_REPORT_PART_CATEGORY_HEADER, DAILY_REPORT_COLOR_CODE_HEADER, DAILY_REPORT_DUST_HEADER, DAILY_REPORT_OIL_HEADER, DAILY_REPORT_RUST_HEADER];
  names.forEach(name => {
    if (headers.indexOf(name) < 0) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(name);
      headers.push(name);
    }
  });
  return names.reduce((result, name) => {
    result[name] = headers.indexOf(name) + 1;
    return result;
  }, {});
}

function hasDailyReportSubmission(sheet, submissionId, idColumn) {
  if (!submissionId || sheet.getLastRow() < 2) return false;
  const values = sheet.getRange(2, idColumn, sheet.getLastRow() - 1, 1).getValues();
  return values.some(row => String(row[0] || "").trim() === submissionId);
}

// Read only recent data rows. getDataRange() can include a large formatted
// area and make a web-app request time out before it returns JSON.
function readRecentDataRows_(sheet, maxRows) {
  if (!sheet || sheet.getLastRow() <= 1) return { values: [], firstRow: 2 };
  const lastRow = sheet.getLastRow();
  const lastColumn = Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()));
  const rowCount = Math.min(lastRow - 1, Number(maxRows) || REPORT_READ_MAX_ROWS);
  const firstRow = lastRow - rowCount + 1;
  return {
    values: sheet.getRange(firstRow, 1, rowCount, lastColumn).getValues(),
    firstRow: firstRow
  };
}

function qcReadSuffix_(e) {
  const scope = String(e && e.parameter && e.parameter.scope || "").trim().toLowerCase();
  return scope === "reviewed" ? QC_REVIEWED_SUFFIX : QC_PENDING_SUFFIX;
}

function qcHeaderColumn_(headers, names, fallback) {
  const list = Array.isArray(names) ? names : [names];
  for (let i = 0; i < list.length; i++) {
    const index = headers.indexOf(list[i]);
    if (index >= 0) return index;
  }
  return Number.isFinite(fallback) ? fallback : -1;
}

function qcCell_(row, headers, names, fallback) {
  const index = qcHeaderColumn_(headers, names, fallback);
  return index >= 0 && index < row.length ? row[index] : "";
}

// REWORK intentionally uses its own sheet, while keeping the same row shape
// as outputdiary so the production form can be reused without mixing data.
function reworkReportHeaders_() {
  return [
    "Timestamp", "Date", "Shift", "Recorder", "Checker",
    "Downtime_Burner", "Downtime_Wash", "Downtime_Oven_Etc", "Downtime_Note",
    "Model", "TimeSlot", "ProdQty", "Dent", "ColorDrop", "ThinPaint", "ThickPaint",
    "WaterStain", "OtherDefect", "TotalDefect", DAILY_REPORT_ID_HEADER, DAILY_REPORT_COLOR_HEADER,
    DAILY_REPORT_PRODUCT_GROUP_HEADER, DAILY_REPORT_PART_CATEGORY_HEADER, DAILY_REPORT_COLOR_CODE_HEADER,
    DAILY_REPORT_DUST_HEADER, DAILY_REPORT_OIL_HEADER, DAILY_REPORT_RUST_HEADER
  ];
}

function ensureReworkReportSheet_(ss) {
  let sheet = ss.getSheetByName(REWORK_SHEET_NAME + QC_PENDING_SUFFIX);
  if (!sheet) sheet = ss.insertSheet(REWORK_SHEET_NAME + QC_PENDING_SUFFIX);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(reworkReportHeaders_());
    sheet.setFrozenRows(1);
  }
  ensureDailyReportIdColumn(sheet);
  ensureDailyReportColorColumn(sheet);
  ensureDailyReportCatalogColumns(sheet);
  return sheet;
}

function appendReworkReport_(ss, payload) {
  const sheet = ensureReworkReportSheet_(ss);
  const submissionId = String(payload.submissionId || "").trim();
  const idColumn = ensureDailyReportIdColumn(sheet);
  if (hasDailyReportSubmission(sheet, submissionId, idColumn)) return { duplicate: true };

  const now = new Date();
  const dateVal = String(payload.date || formatDateStr(now, false));
  const shiftVal = String(payload.shift || "");
  const recorderVal = String(payload.recorder || "");
  const checkerVal = String(payload.checker || "");
  const dt = payload.downtime || {};
  const burner = Number(dt.burner) || 0;
  const wash = Number(dt.wash) || 0;
  const ovenEtc = (Number(dt.oven) || 0) + (Number(dt.gun) || 0) + (Number(dt.power) || 0) + (Number(dt.motor) || 0) + (Number(dt.other) || 0);
  const dtNote = String(dt.note || "");
  const records = Array.isArray(payload.records) ? payload.records : [];

  records.forEach(r => {
    const values = [
      now, dateVal, shiftVal, recorderVal, checkerVal,
      burner, wash, ovenEtc, dtNote,
      String(r.model || ""), String(r.timeSlot || ""), Number(r.prodQty) || 0,
      Number(r.dent) || 0, Number(r.colorDrop) || 0, Number(r.thinPaint) || 0,
      Number(r.thickPaint) || 0, Number(r.waterStain) || 0, Number(r.otherDefect) || 0,
      Number(r.totalDefect) || 0, submissionId, String(r.color || ""),
      String(r.productGroup || ""), String(r.partCategory || ""), String(r.colorCode || ""),
      Number(r.dust) || 0, Number(r.oil) || 0, Number(r.rust) || 0
    ];
    sheet.appendRow(values);
  });
  SpreadsheetApp.flush();
  return { duplicate: false, rows: records.length };
}

function readReworkReports_(ss, requestedDate, suffix) {
  const sheet = ss.getSheetByName(REWORK_SHEET_NAME + (suffix || QC_PENDING_SUFFIX));
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const recent = readRecentDataRows_(sheet, REPORT_READ_MAX_ROWS);
  const values = recent.values;
  const headers = sheet.getRange(1, 1, 1, Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()))).getDisplayValues()[0].map(String);
  const data = values.map(r => ({
    timestamp: formatDateStr(qcCell_(r, headers, "Timestamp", 0), true), date: formatDateStr(qcCell_(r, headers, "Date", 1), false), shift: String(qcCell_(r, headers, "Shift", 2) || ""),
    recorder: String(qcCell_(r, headers, "Recorder", 3) || ""), checker: String(qcCell_(r, headers, "Checker", 4) || ""), downtimeBurner: Number(qcCell_(r, headers, "Downtime_Burner", 5)) || 0,
    downtimeWash: Number(qcCell_(r, headers, "Downtime_Wash", 6)) || 0, downtimeOvenEtc: Number(qcCell_(r, headers, "Downtime_Oven_Etc", 7)) || 0, downtimeNote: String(qcCell_(r, headers, "Downtime_Note", 8) || ""),
    model: String(qcCell_(r, headers, "Model", 9) || ""), timeSlot: String(qcCell_(r, headers, "TimeSlot", 10) || ""), prodQty: Number(qcCell_(r, headers, "ProdQty", 11)) || 0,
    dent: Number(qcCell_(r, headers, "Dent", 12)) || 0, colorDrop: Number(qcCell_(r, headers, "ColorDrop", 13)) || 0, thinPaint: Number(qcCell_(r, headers, "ThinPaint", 14)) || 0,
    thickPaint: Number(qcCell_(r, headers, "ThickPaint", 15)) || 0, waterStain: Number(qcCell_(r, headers, "WaterStain", 16)) || 0, otherDefect: Number(qcCell_(r, headers, "OtherDefect", 17)) || 0,
    totalDefect: Number(qcCell_(r, headers, "TotalDefect", 18)) || 0, submissionId: String(qcCell_(r, headers, DAILY_REPORT_ID_HEADER, 19) || ""), color: String(qcCell_(r, headers, DAILY_REPORT_COLOR_HEADER, 20) || ""),
    productGroup: String(qcCell_(r, headers, DAILY_REPORT_PRODUCT_GROUP_HEADER, 21) || ""), partCategory: String(qcCell_(r, headers, DAILY_REPORT_PART_CATEGORY_HEADER, 22) || ""), colorCode: String(qcCell_(r, headers, DAILY_REPORT_COLOR_CODE_HEADER, 23) || ""),
    dust: Number(qcCell_(r, headers, DAILY_REPORT_DUST_HEADER, 24)) || 0, oil: Number(qcCell_(r, headers, DAILY_REPORT_OIL_HEADER, 25)) || 0, rust: Number(qcCell_(r, headers, DAILY_REPORT_RUST_HEADER, 26)) || 0
  }));
  const filter = String(requestedDate || "").trim();
  return filter ? data.filter(r => String(r.date || "").substring(0, 10) === filter) : data;
}

// SCREEN intentionally uses its own sheet while sharing the REWORK row shape.
function screenReportHeaders_() {
  return [
    "Timestamp", "Date", "Shift", "Recorder", "Checker",
    "Downtime_Burner", "Downtime_Wash", "Downtime_Oven_Etc", "Downtime_Note",
    "Model", "TimeSlot", "ProdQty", "Dent", "ColorDrop", "ThinPaint", "ThickPaint",
    "WaterStain", "OtherDefect", "TotalDefect", DAILY_REPORT_ID_HEADER, DAILY_REPORT_COLOR_HEADER,
    DAILY_REPORT_PRODUCT_GROUP_HEADER, DAILY_REPORT_PART_CATEGORY_HEADER, DAILY_REPORT_COLOR_CODE_HEADER,
    DAILY_REPORT_DUST_HEADER, DAILY_REPORT_OIL_HEADER, DAILY_REPORT_RUST_HEADER
  ];
}

function ensureScreenReportSheet_(ss) {
  let sheet = ss.getSheetByName(SCREEN_SHEET_NAME + QC_PENDING_SUFFIX);
  if (!sheet) sheet = ss.insertSheet(SCREEN_SHEET_NAME + QC_PENDING_SUFFIX);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(screenReportHeaders_());
    sheet.setFrozenRows(1);
  }
  ensureDailyReportIdColumn(sheet);
  ensureDailyReportColorColumn(sheet);
  ensureDailyReportCatalogColumns(sheet);
  return sheet;
}

function appendScreenReport_(ss, payload) {
  const sheet = ensureScreenReportSheet_(ss);
  const submissionId = String(payload.submissionId || "").trim();
  const idColumn = ensureDailyReportIdColumn(sheet);
  if (hasDailyReportSubmission(sheet, submissionId, idColumn)) return { duplicate: true };

  const now = new Date();
  const dateVal = String(payload.date || formatDateStr(now, false));
  const shiftVal = String(payload.shift || "");
  const recorderVal = String(payload.recorder || "");
  const checkerVal = String(payload.checker || "");
  const dt = payload.downtime || {};
  const burner = Number(dt.burner) || 0;
  const wash = Number(dt.wash) || 0;
  const ovenEtc = (Number(dt.oven) || 0) + (Number(dt.gun) || 0) + (Number(dt.power) || 0) + (Number(dt.motor) || 0) + (Number(dt.other) || 0);
  const dtNote = String(dt.note || "");
  const records = Array.isArray(payload.records) ? payload.records : [];
  records.forEach(r => {
    sheet.appendRow([
      now, dateVal, shiftVal, recorderVal, checkerVal,
      burner, wash, ovenEtc, dtNote,
      String(r.model || ""), String(r.timeSlot || ""), Number(r.prodQty) || 0,
      Number(r.dent) || 0, Number(r.colorDrop) || 0, Number(r.thinPaint) || 0,
      Number(r.thickPaint) || 0, Number(r.waterStain) || 0, Number(r.otherDefect) || 0,
      Number(r.totalDefect) || 0, submissionId, String(r.color || ""),
      String(r.productGroup || ""), String(r.partCategory || ""), String(r.colorCode || ""),
      Number(r.dust) || 0, Number(r.oil) || 0, Number(r.rust) || 0
    ]);
  });
  SpreadsheetApp.flush();
  return { duplicate: false, rows: records.length };
}

function readScreenReports_(ss, requestedDate, suffix) {
  const sheet = ss.getSheetByName(SCREEN_SHEET_NAME + (suffix || QC_PENDING_SUFFIX));
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const recent = readRecentDataRows_(sheet, REPORT_READ_MAX_ROWS);
  const values = recent.values;
  const headers = sheet.getRange(1, 1, 1, Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()))).getDisplayValues()[0].map(String);
  const data = values.map(r => ({
    timestamp: formatDateStr(qcCell_(r, headers, "Timestamp", 0), true), date: formatDateStr(qcCell_(r, headers, "Date", 1), false), shift: String(qcCell_(r, headers, "Shift", 2) || ""),
    recorder: String(qcCell_(r, headers, "Recorder", 3) || ""), checker: String(qcCell_(r, headers, "Checker", 4) || ""), downtimeBurner: Number(qcCell_(r, headers, "Downtime_Burner", 5)) || 0,
    downtimeWash: Number(qcCell_(r, headers, "Downtime_Wash", 6)) || 0, downtimeOvenEtc: Number(qcCell_(r, headers, "Downtime_Oven_Etc", 7)) || 0, downtimeNote: String(qcCell_(r, headers, "Downtime_Note", 8) || ""),
    model: String(qcCell_(r, headers, "Model", 9) || ""), timeSlot: String(qcCell_(r, headers, "TimeSlot", 10) || ""), prodQty: Number(qcCell_(r, headers, "ProdQty", 11)) || 0,
    dent: Number(qcCell_(r, headers, "Dent", 12)) || 0, colorDrop: Number(qcCell_(r, headers, "ColorDrop", 13)) || 0, thinPaint: Number(qcCell_(r, headers, "ThinPaint", 14)) || 0,
    thickPaint: Number(qcCell_(r, headers, "ThickPaint", 15)) || 0, waterStain: Number(qcCell_(r, headers, "WaterStain", 16)) || 0, otherDefect: Number(qcCell_(r, headers, "OtherDefect", 17)) || 0,
    totalDefect: Number(qcCell_(r, headers, "TotalDefect", 18)) || 0, submissionId: String(qcCell_(r, headers, DAILY_REPORT_ID_HEADER, 19) || ""), color: String(qcCell_(r, headers, DAILY_REPORT_COLOR_HEADER, 20) || ""),
    productGroup: String(qcCell_(r, headers, DAILY_REPORT_PRODUCT_GROUP_HEADER, 21) || ""), partCategory: String(qcCell_(r, headers, DAILY_REPORT_PART_CATEGORY_HEADER, 22) || ""), colorCode: String(qcCell_(r, headers, DAILY_REPORT_COLOR_CODE_HEADER, 23) || ""),
    dust: Number(qcCell_(r, headers, DAILY_REPORT_DUST_HEADER, 24)) || 0, oil: Number(qcCell_(r, headers, DAILY_REPORT_OIL_HEADER, 25)) || 0, rust: Number(qcCell_(r, headers, DAILY_REPORT_RUST_HEADER, 26)) || 0
  }));
  const filter = String(requestedDate || "").trim();
  return filter ? data.filter(r => String(r.date || "").substring(0, 10) === filter) : data;
}

function ensureParameterChecklistSheet(ss, checklistType) {
  const isWater = String(checklistType || "full").toLowerCase() === "water";
  const sheetName = isWater
    ? WATER_PARAMETER_CHECKLIST_SHEET_NAME
    : PARAMETER_CHECKLIST_SHEET_NAME;
  const baseHeaders = [
    "Timestamp", "Date", "Operator", "TeamLeader", "ItemNo", "Process",
    "CheckItem", "Standard", "ActualValue", "Status", "Note", PARAMETER_CHECKLIST_ID_HEADER, "ChecklistType"
  ];
  const headers = isWater ? baseHeaders.concat(["Time"]) : baseHeaders;
  let sheet = ss.getSheetByName(sheetName + QC_PENDING_SUFFIX);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName + QC_PENDING_SUFFIX);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (sheet.getLastColumn() < 13) {
    sheet.getRange(1, 13).setValue("ChecklistType");
  }
  if (isWater) {
    const lastColumn = Math.max(1, sheet.getLastColumn());
    const currentHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
    if (currentHeaders.indexOf("Time") < 0) {
      sheet.getRange(1, lastColumn + 1).setValue("Time");
    }
  }
  return sheet;
}

function hasParameterChecklistSubmission(sheet, submissionId) {
  if (!submissionId || sheet.getLastRow() < 2) return false;
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const idIndex = headers.indexOf(PARAMETER_CHECKLIST_ID_HEADER);
  if (idIndex < 0) return false;
  const values = sheet.getRange(2, idIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  return values.some(row => String(row[0] || "").trim() === submissionId);
}

function ensureEquipmentChecklistSheet(ss) {
  let sheet = ss.getSheetByName(EQUIPMENT_CHECKLIST_SHEET_NAME + QC_PENDING_SUFFIX);
  if (!sheet) {
    sheet = ss.insertSheet(EQUIPMENT_CHECKLIST_SHEET_NAME + QC_PENDING_SUFFIX);
    sheet.appendRow([
      "Timestamp", "Date", "Operator", "TeamLeader", "ItemNo", "CheckItem",
      "Method", "Standard", "ImageUrl", "Status", "Note", PARAMETER_CHECKLIST_ID_HEADER
    ]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow([
      "Timestamp", "Date", "Operator", "TeamLeader", "ItemNo", "CheckItem",
      "Method", "Standard", "ImageUrl", "Status", "Note", PARAMETER_CHECKLIST_ID_HEADER
    ]);
  }
  return sheet;
}

function hasEquipmentChecklistSubmission(sheet, submissionId) {
  if (!submissionId || sheet.getLastRow() < 2) return false;
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  const idIndex = headers.indexOf(PARAMETER_CHECKLIST_ID_HEADER);
  if (idIndex < 0) return false;
  const values = sheet.getRange(2, idIndex + 1, sheet.getLastRow() - 1, 1).getValues();
  return values.some(row => String(row[0] || "").trim() === submissionId);
}

function formatDateStr(d, includeTime) {
  if (!d) return "";
  if (d instanceof Date) {
    var yyyy = d.getFullYear();
    var mm = ('0' + (d.getMonth() + 1)).slice(-2);
    var dd = ('0' + d.getDate()).slice(-2);
    var hh = ('0' + d.getHours()).slice(-2);
    var min = ('0' + d.getMinutes()).slice(-2);
    if (includeTime) {
      return yyyy + '-' + mm + '-' + dd + ' ' + hh + ':' + min;
    }
    return yyyy + '-' + mm + '-' + dd;
  }
  var str = String(d).trim();
  if (str.includes('T')) {
    try {
      var dt = new Date(str);
      if (!isNaN(dt.getTime())) {
        var y = dt.getFullYear();
        var m = ('0' + (dt.getMonth() + 1)).slice(-2);
        var day = ('0' + dt.getDate()).slice(-2);
        var h = ('0' + dt.getHours()).slice(-2);
        var mi = ('0' + dt.getMinutes()).slice(-2);
        return y + '-' + m + '-' + day + (includeTime ? (' ' + h + ':' + mi) : '');
      }
    } catch(e) {}
    return str.split('T')[0];
  }
  return str;
}

// QC review decisions are append-only and are stored separately from the
// source tables.  A row is added only after a QC user explicitly clicks ✓/✕.
function ensureQCMirrorSheets_(ss, sourceSheetName, rowValues) {
  const base = String(sourceSheetName || "QC").trim() || "QC";
  const pendingName = base + QC_PENDING_SUFFIX;
  const reviewedName = base + QC_REVIEWED_SUFFIX;
  const dataHeaders = qcCanonicalDataHeaders_(ss, base, rowValues);
  const metadata = qcMetadataNames_();
  [pendingName, reviewedName].forEach(name => {
    let sheet = ss.getSheetByName(name);
    if (!sheet) sheet = ss.insertSheet(name);
    if (sheet.getLastRow() === 0) {
      const headers = name === pendingName ? dataHeaders : dataHeaders.concat(metadata);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
    }
  });
  return { pending: ss.getSheetByName(pendingName), reviewed: ss.getSheetByName(reviewedName) };
}

function ensureAllQCMirrorSheets_(ss) {
  QC_MIGRATION_SOURCES.forEach(name => {
    ensureQCMirrorSheets_(ss, name, []);
  });
}

function migrateExistingQCData_(ss) {
  const moved = [];
  QC_MIGRATION_SOURCES.forEach(base => {
    const source = ss.getSheetByName(base);
    if (!source || source.getLastRow() <= 1) return;
    const pendingName = base + QC_PENDING_SUFFIX;
    let pending = ss.getSheetByName(pendingName);
    if (!pending) pending = ss.insertSheet(pendingName);
    const sourceValues = source.getDataRange().getValues();
    if (pending.getLastRow() === 0) {
      pending.getRange(1, 1, sourceValues.length, sourceValues[0].length).setValues(sourceValues);
    } else {
      const existing = pending.getLastRow();
      const rows = sourceValues.slice(1);
      if (rows.length) pending.getRange(existing + 1, 1, rows.length, rows[0].length).setValues(rows);
    }
    source.deleteRows(2, source.getLastRow() - 1);
    moved.push({ source: base, pending: pendingName, rows: sourceValues.length - 1 });
  });
  SpreadsheetApp.flush();
  return moved;
}

// Build a stable identity for recovery/deduplication.  QCReviewKey is the
// strongest identity; the other forms use SubmissionId or their visible
// business fields as a deterministic fallback.
function qcRecoveryNormalize_(value) {
  return String(value == null ? "" : value)
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function qcRecoveryHeaderIndex_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index >= 0) return index;
  }
  return -1;
}

function qcRecoveryKey_(sourceName, row, headers) {
  const values = Array.isArray(row) ? row : [];
  const headerValues = Array.isArray(headers) ? headers : [];
  const sourcePrefix = String(sourceName || "").trim() + "|";
  const reviewIndex = headerValues.indexOf("QCReviewKey");
  const reviewValue = reviewIndex >= 0 ? String(values[reviewIndex] || "").trim() : "";
  if (reviewValue.indexOf(sourcePrefix) === 0) return reviewValue;
  const embeddedKey = values.find(value => String(value || "").trim().indexOf(sourcePrefix) === 0);
  if (embeddedKey) return String(embeddedKey).trim();

  const submissionIndex = headerValues.indexOf("SubmissionId");
  const submissionId = submissionIndex >= 0 ? qcRecoveryNormalize_(values[submissionIndex]) : "";
  if (submissionId) return sourcePrefix + "submissionid|" + submissionId;

  const identityNames = ["Date", "Model", "TimeSlot", "Color", "ProdQty", "TotalDefect"];
  const identityIndexes = identityNames.map(name => headerValues.indexOf(name));
  if (identityIndexes.every(index => index >= 0)) {
    const identity = identityIndexes.map(index => qcRecoveryNormalize_(values[index])).join("|");
    if (identity.replace(/\|/g, "")) return sourcePrefix + identity;
  }

  const compact = values.map(qcRecoveryNormalize_).join("|");
  return compact.replace(/\|/g, "") ? sourcePrefix + "row|" + compact : "";
}

function qcRecoveryMetadata_(sourceName, row, headers) {
  const metadata = qcMetadataFromLegacyRow_(row, headers, sourceName);
  const key = qcRecoveryKey_(sourceName, row, headers) || metadata.reviewKey;
  const status = String(metadata.status || "").trim().toLowerCase();
  let statusIndex = Array.isArray(headers) ? headers.indexOf("QCStatus") : -1;
  const keyIndex = Array.isArray(headers) ? headers.indexOf("QCReviewKey") : -1;
  if (keyIndex >= 3) statusIndex = keyIndex - 3;
  return {
    reviewKey: key,
    reviewed: !!key && ["approved", "rejected"].indexOf(status) >= 0,
    status: status === "rejected" ? "rejected" : "approved",
    reviewedAt: metadata.reviewedAt || new Date(),
    reviewer: metadata.reviewer || "Historical recovery",
    statusIndex: statusIndex
  };
}

function qcRecoveryMapRow_(sourceName, row, sourceHeaders, dataHeaders, metadata) {
  const values = Array.isArray(row) ? row : [];
  const source = Array.isArray(sourceHeaders) ? sourceHeaders : [];
  const target = Array.isArray(dataHeaders) ? dataHeaders : [];
  const result = new Array(target.length).fill("");
  const metadataStart = metadata && metadata.statusIndex >= 0 ? metadata.statusIndex : source.length;
  const sourceHasNamedColumns = source.some(name => target.indexOf(name) >= 0);
  if (sourceHasNamedColumns) {
    target.forEach((name, targetIndex) => {
      const sourceIndex = source.indexOf(name);
      if (sourceIndex >= 0 && sourceIndex < values.length && sourceIndex < metadataStart) result[targetIndex] = values[sourceIndex];
    });
  } else {
    for (let i = 0; i < Math.min(target.length, metadataStart, values.length); i++) result[i] = values[i];
  }

  const ref = qcKeyRecordRef_(sourceName, metadata && metadata.reviewKey);
  const setIfEmpty = (name, value) => {
    const index = target.indexOf(name);
    if (index >= 0 && (result[index] === "" || result[index] == null) && value !== undefined) result[index] = value;
  };
  setIfEmpty("Date", ref.date);
  setIfEmpty("Model", ref.model);
  setIfEmpty("TimeSlot", ref.timeSlot);
  setIfEmpty("Color", ref.color);
  setIfEmpty("ProdQty", ref.prodQty);
  setIfEmpty("TotalDefect", ref.totalDefect);
  while (result.length < target.length) result.push("");
  return result.slice(0, target.length);
}

function recoverHistoricalQCData_(ss, sourceSpreadsheetId, dryRun) {
  const sourceId = String(sourceSpreadsheetId || "").trim();
  if (!sourceId) throw new Error("ต้องระบุ sourceSpreadsheetId ของสำเนากู้คืน");
  const sourceSs = SpreadsheetApp.openById(sourceId);
  const report = [];

  QC_MIGRATION_SOURCES.forEach(sourceName => {
    const mirrors = ensureQCMirrorSheets_(ss, sourceName, []);
    const dataHeaders = qcStripTrailingMetadata_(qcHeaderValues_(mirrors.pending));
    const existingKeys = {};
    [mirrors.pending, mirrors.reviewed].forEach(sheet => {
      if (!sheet || sheet.getLastRow() <= 1) return;
      const headers = qcHeaderValues_(sheet);
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(1, sheet.getLastColumn())).getValues();
      rows.forEach(row => {
        const key = qcRecoveryKey_(sourceName, row, headers);
        if (key) existingKeys[key] = true;
      });
    });

    const sourceCandidates = [sourceName, sourceName + QC_PENDING_SUFFIX, sourceName + QC_REVIEWED_SUFFIX];
    let sourceSheet = null;
    for (let i = 0; i < sourceCandidates.length; i++) {
      const candidate = sourceSs.getSheetByName(sourceCandidates[i]);
      if (candidate && candidate.getLastRow() > 1) { sourceSheet = candidate; break; }
    }
    if (!sourceSheet) {
      report.push({ source: sourceName, addedPending: 0, addedReviewed: 0, skippedExisting: 0, skippedBlank: 0, sourceRows: 0 });
      return;
    }

    const sourceHeaders = qcHeaderValues_(sourceSheet);
    const sourceRows = sourceSheet.getRange(2, 1, sourceSheet.getLastRow() - 1, Math.max(1, sourceSheet.getLastColumn())).getValues();
    const pendingRows = [];
    const reviewedRows = [];
    let skippedExisting = 0;
    let skippedBlank = 0;
    sourceRows.forEach(row => {
      if (!row.some(value => String(value == null ? "" : value).trim() !== "")) { skippedBlank++; return; }
      const metadata = qcRecoveryMetadata_(sourceName, row, sourceHeaders);
      if (!metadata.reviewKey) { skippedBlank++; return; }
      if (existingKeys[metadata.reviewKey]) { skippedExisting++; return; }
      const mapped = qcRecoveryMapRow_(sourceName, row, sourceHeaders, dataHeaders, metadata);
      if (!mapped.some(value => String(value == null ? "" : value).trim() !== "")) { skippedBlank++; return; }
      if (metadata.reviewed) {
        reviewedRows.push(mapped.concat([metadata.status, metadata.reviewedAt, metadata.reviewer, metadata.reviewKey]));
      } else {
        pendingRows.push(mapped);
      }
      existingKeys[metadata.reviewKey] = true;
    });

    if (!dryRun) {
      if (pendingRows.length) mirrors.pending.getRange(mirrors.pending.getLastRow() + 1, 1, pendingRows.length, dataHeaders.length).setValues(pendingRows);
      if (reviewedRows.length) mirrors.reviewed.getRange(mirrors.reviewed.getLastRow() + 1, 1, reviewedRows.length, dataHeaders.length + qcMetadataNames_().length).setValues(reviewedRows);
    }
    report.push({
      source: sourceName,
      sourceSheet: sourceSheet.getName(),
      sourceRows: sourceRows.length,
      addedPending: pendingRows.length,
      addedReviewed: reviewedRows.length,
      skippedExisting: skippedExisting,
      skippedBlank: skippedBlank
    });
  });
  if (!dryRun) SpreadsheetApp.flush();
  return report;
}

function qcMetadataNames_() {
  return ["QCStatus", "QCReviewedAt", "QCReviewedBy", "QCReviewKey"];
}

function qcProductionDataHeaders_() {
  return [
    "Timestamp", "Date", "Shift", "Recorder", "Checker",
    "Downtime_Burner", "Downtime_Wash", "Downtime_Oven_Etc", "Downtime_Note",
    "Model", "TimeSlot", "ProdQty", "Dent", "ColorDrop", "ThinPaint",
    "ThickPaint", "WaterStain", "OtherDefect", "TotalDefect", "SubmissionId",
    "Color", "ProductGroup", "PartCategory", "ColorCode", "Dust", "Oil", "Rust"
  ];
}

function qcHeaderValues_(sheet) {
  if (!sheet || sheet.getLastColumn() <= 0) return [];
  const lastColumn = Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()));
  return sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    .map(value => String(value || "").trim());
}

function qcHasTrailingMetadata_(headers) {
  const metadata = qcMetadataNames_();
  if (!headers || headers.length < metadata.length) return false;
  const start = headers.length - metadata.length;
  return metadata.every((name, index) => headers[start + index] === name);
}

function qcStripTrailingMetadata_(headers) {
  return qcHasTrailingMetadata_(headers)
    ? headers.slice(0, headers.length - qcMetadataNames_().length)
    : headers.slice();
}

function qcCanonicalDataHeaders_(ss, sourceName, rowValues) {
  const base = String(sourceName || "").trim();
  // The live QC workflow uses only the current Pending mirror. Do not use a
  // legacy base sheet to infer the active schema.
  const candidates = [ss.getSheetByName(base + QC_PENDING_SUFFIX)];
  for (let i = 0; i < candidates.length; i++) {
    const headers = qcStripTrailingMetadata_(qcHeaderValues_(candidates[i]));
    if (headers.length && headers.some(value => value !== "")) {
      // The production forms share one stable 27-column schema. Ignore the
      // old outputdiary header because it belongs to a legacy report layout.
      if (/^(outputdiary|REWORK|SCREEN)$/i.test(base)) {
        const hasProductionShape = headers.indexOf("Timestamp") >= 0 && headers.indexOf("Model") >= 0;
        if (hasProductionShape && headers.length >= 20) return headers.slice(0, 27);
      } else {
        return headers;
      }
    }
  }
  if (/^(outputdiary|REWORK|SCREEN)$/i.test(base)) return qcProductionDataHeaders_();
  if (Array.isArray(rowValues) && rowValues.length) {
    return rowValues.map((_, index) => "Column" + (index + 1));
  }
  return [];
}

function qcCanonicalReviewedLayout_(sheet, dataHeaders) {
  if (!sheet || !dataHeaders || !dataHeaders.length) return false;
  const headers = qcHeaderValues_(sheet);
  const metadata = qcMetadataNames_();
  if (headers.length < dataHeaders.length + metadata.length) return false;
  for (let i = 0; i < dataHeaders.length; i++) {
    if (String(headers[i] || "") !== String(dataHeaders[i] || "")) return false;
  }
  return metadata.every((name, index) => headers[dataHeaders.length + index] === name);
}

function qcKeyRecordRef_(sourceName, reviewKey) {
  const parts = String(reviewKey || "").split("|");
  if (parts.length < 7 || String(parts[0] || "") !== String(sourceName || "")) return {};
  return {
    date: parts[1], model: parts[2], timeSlot: parts[3], color: parts[4],
    prodQty: parts[5], totalDefect: parts[6]
  };
}

function qcFindMatchingSourceValues_(ss, sourceName, reviewKey) {
  const ref = qcKeyRecordRef_(sourceName, reviewKey);
  if (!ref.date || !ref.model || !ref.timeSlot) return [];
  const candidates = [ss.getSheetByName(sourceName + QC_PENDING_SUFFIX)];
  for (let i = 0; i < candidates.length; i++) {
    const rows = qcSourceRows_(candidates[i], sourceName, ref);
    if (rows.length) return rows[0].values;
  }
  return [];
}

function qcMetadataFromLegacyRow_(row, headers, sourceName) {
  const values = Array.isArray(row) ? row : [];
  const metadata = qcMetadataNames_();
  let keyIndex = values.findIndex(value => String(value || "").trim().indexOf(String(sourceName || "") + "|") === 0);
  let statusIndex = -1;
  let reviewedAtIndex = -1;
  let reviewerIndex = -1;

  for (let i = 0; i <= headers.length - metadata.length; i++) {
    if (metadata.every((name, offset) => headers[i + offset] === name)) {
      const candidateKey = String(values[i + 3] || "").trim();
      const candidateStatus = String(values[i] || "").trim().toLowerCase();
      if (candidateKey.indexOf(String(sourceName || "") + "|") === 0 ||
          ["approved", "rejected"].indexOf(candidateStatus) >= 0) {
        statusIndex = i;
        reviewedAtIndex = i + 1;
        reviewerIndex = i + 2;
        if (candidateKey) keyIndex = i + 3;
      }
    }
  }

  if (keyIndex >= 0 && statusIndex < 0) {
    // Legacy rows written before the metadata columns were normalized can
    // have the key one cell after the four metadata values.
    const keyValue = String(values[keyIndex] || "").trim();
    const candidateStatus = values.findIndex(value => ["approved", "rejected"].indexOf(String(value || "").trim().toLowerCase()) >= 0);
    statusIndex = candidateStatus >= 0 ? candidateStatus : -1;
    if (statusIndex >= 0) {
      reviewedAtIndex = statusIndex + 1;
      reviewerIndex = statusIndex + 2;
    } else if (keyIndex >= 2) {
      reviewedAtIndex = keyIndex - 2;
      reviewerIndex = keyIndex - 1;
    }
  }

  const status = statusIndex >= 0 && values[statusIndex]
    ? String(values[statusIndex]).trim()
    : "approved";
  return {
    status: status || "approved",
    reviewedAt: reviewedAtIndex >= 0 ? values[reviewedAtIndex] : new Date(),
    reviewer: reviewerIndex >= 0 ? String(values[reviewerIndex] || "").trim() : "",
    reviewKey: keyIndex >= 0 ? String(values[keyIndex] || "").trim() : ""
  };
}

function qcLegacyDataRow_(row, sourceName, dataHeaders, metadata) {
  const values = Array.isArray(row) ? row : [];
  const result = new Array(dataHeaders.length).fill("");
  const sourceStart = metadata.statusIndex >= 0 ? metadata.statusIndex : -1;
  if (sourceStart > 0) {
    for (let i = 0; i < Math.min(sourceStart, dataHeaders.length); i++) result[i] = values[i] == null ? "" : values[i];
  }

  const ref = qcKeyRecordRef_(sourceName, metadata.reviewKey);
  const setIfEmpty = (name, value) => {
    const index = dataHeaders.indexOf(name);
    if (index >= 0 && (result[index] === "" || result[index] == null) && value !== undefined) result[index] = value;
  };
  setIfEmpty("Date", ref.date);
  setIfEmpty("Model", ref.model);
  setIfEmpty("TimeSlot", ref.timeSlot);
  setIfEmpty("Color", ref.color);
  setIfEmpty("ProdQty", ref.prodQty);
  setIfEmpty("TotalDefect", ref.totalDefect);
  return result;
}

function normalizeQCReviewedSheet_(ss, sourceName, sheet, rowValues) {
  if (!sheet) return { changed: false, rows: 0 };
  const dataHeaders = qcCanonicalDataHeaders_(ss, sourceName, rowValues);
  const metadataNames = qcMetadataNames_();
  if (!dataHeaders.length) return { changed: false, rows: 0 };
  if (qcCanonicalReviewedLayout_(sheet, dataHeaders)) return { changed: false, rows: Math.max(0, sheet.getLastRow() - 1) };

  const oldHeaders = qcHeaderValues_(sheet);
  const oldRows = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(1, sheet.getLastColumn())).getValues()
    : [];
  const output = [[].concat(dataHeaders, metadataNames)];
  oldRows.forEach(row => {
    const metadata = qcMetadataFromLegacyRow_(row, oldHeaders, sourceName);
    if (!metadata.reviewKey) return;
    let data = qcFindMatchingSourceValues_(ss, sourceName, metadata.reviewKey);
    if (!data.length) data = qcLegacyDataRow_(row, sourceName, dataHeaders, metadata);
    data = qcReviewDataRow_(data, dataHeaders.length);
    output.push(data.concat([metadata.status, metadata.reviewedAt, metadata.reviewer, metadata.reviewKey]));
  });

  const targetColumns = output[0].length;
  if (sheet.getMaxColumns() < targetColumns) sheet.insertColumnsAfter(sheet.getMaxColumns(), targetColumns - sheet.getMaxColumns());
  if (sheet.getLastRow() > 0 && sheet.getLastColumn() > 0) sheet.getDataRange().clearContent();
  sheet.getRange(1, 1, output.length, targetColumns).setValues(output);
  sheet.setFrozenRows(1);
  return { changed: true, rows: output.length - 1 };
}

function repairQCReviewedSheets_(ss) {
  const result = [];
  QC_MIGRATION_SOURCES.forEach(sourceName => {
    const mirrors = ensureQCMirrorSheets_(ss, sourceName, []);
    result.push({ source: sourceName, result: normalizeQCReviewedSheet_(ss, sourceName, mirrors.reviewed, []) });
  });
  SpreadsheetApp.flush();
  return result;
}

function qcText_(value) {
  return String(value == null ? "" : value).replace(/\s+/g, " ").trim().toLowerCase();
}

function qcDateToken_(value) {
  const formatted = formatDateStr(value, false);
  const text = String(formatted == null ? "" : formatted).trim();
  let match = text.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
  if (match) return match[1] + "-" + ("0" + match[2]).slice(-2) + "-" + ("0" + match[3]).slice(-2);
  match = text.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
  if (match) return match[3] + "-" + ("0" + match[2]).slice(-2) + "-" + ("0" + match[1]).slice(-2);
  return text.substring(0, 10);
}

function qcHeaderIndex_(headers, names) {
  for (let i = 0; i < names.length; i++) {
    const index = headers.indexOf(names[i]);
    if (index >= 0) return index;
  }
  return -1;
}

function qcNumericEqual_(actual, expected) {
  const left = Number(String(actual == null ? "" : actual).replace(/,/g, "").trim());
  const right = Number(String(expected == null ? "" : expected).replace(/,/g, "").trim());
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function qcSourceRows_(sheet, sourceName, recordRef) {
  if (!sheet || sheet.getLastRow() <= 1) return [];
  const ref = recordRef && typeof recordRef === "object" ? recordRef : {};
  const lastColumn = Math.max(1, sheet.getLastColumn());
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(value => String(value || "").trim());
  const values = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getValues();
  const display = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn).getDisplayValues();
  const indexes = {
    id: qcHeaderIndex_(headers, ["SubmissionId"]),
    timestamp: qcHeaderIndex_(headers, ["Timestamp"]),
    date: qcHeaderIndex_(headers, ["Date"]),
    model: qcHeaderIndex_(headers, ["Model"]),
    timeSlot: qcHeaderIndex_(headers, ["TimeSlot"]),
    color: qcHeaderIndex_(headers, ["Color"]),
    prodQty: qcHeaderIndex_(headers, ["ProdQty"]),
    totalDefect: qcHeaderIndex_(headers, ["TotalDefect"]),
    productGroup: qcHeaderIndex_(headers, ["ProductGroup"]),
    operator: qcHeaderIndex_(headers, ["Operator", "Recorder"]),
    teamLeader: qcHeaderIndex_(headers, ["TeamLeader", "Checker"])
  };
  const checklist = /ParameterChecklist|WaterParameterChecklist|EquipmentChecklist/i.test(String(sourceName || ""));
  const refId = qcText_(ref.submissionId || ref.SubmissionId);
  const result = [];

  for (let i = 0; i < values.length; i++) {
    const shown = display[i] || [];
    const rowId = indexes.id >= 0 ? qcText_(shown[indexes.id]) : "";
    if (refId && indexes.id >= 0 && rowId !== refId) continue;

    // A checklist row is one item in a submission. The QC page groups all
    // items by SubmissionId, so approving the group must move every item.
    if (checklist && refId && indexes.id >= 0) {
      result.push({ rowIndex: i + 2, values: values[i] });
      continue;
    }

    let specified = 0;
    let matched = 0;
    const compareText = (index, expected) => {
      if (index < 0 || expected === undefined || expected === null || String(expected).trim() === "") return;
      specified++;
      if (qcText_(shown[index]) === qcText_(expected)) matched++;
    };
    const compareDate = (index, expected) => {
      if (index < 0 || expected === undefined || expected === null || String(expected).trim() === "") return;
      specified++;
      if (qcDateToken_(values[i][index]) === qcDateToken_(expected)) matched++;
    };
    const compareNumber = (index, expected) => {
      if (index < 0 || expected === undefined || expected === null || String(expected).trim() === "") return;
      specified++;
      if (qcNumericEqual_(shown[index], expected)) matched++;
    };

    compareDate(indexes.date, ref.date || ref.Date);
    compareText(indexes.model, ref.model || ref.Model);
    compareText(indexes.timeSlot, ref.timeSlot || ref.TimeSlot);
    compareText(indexes.color, ref.color || ref.Color);
    compareNumber(indexes.prodQty, ref.prodQty !== undefined ? ref.prodQty : ref.ProdQty);
    compareNumber(indexes.totalDefect, ref.totalDefect !== undefined ? ref.totalDefect : ref.TotalDefect);
    compareText(indexes.productGroup, ref.productGroup || ref.ProductGroup);

    if (refId && indexes.id >= 0) {
      if (specified === 0 || matched === specified) result.push({ rowIndex: i + 2, values: values[i] });
    } else if (specified >= 2 && matched === specified) {
      result.push({ rowIndex: i + 2, values: values[i] });
    }
  }
  return result;
}

function deleteQCSourceRows_(sheet, rows) {
  if (!sheet || !rows || !rows.length) return 0;
  rows.slice().sort((a, b) => b.rowIndex - a.rowIndex).forEach(item => sheet.deleteRow(item.rowIndex));
  return rows.length;
}

function qcReviewDataRow_(row, dataColumnCount) {
  const result = Array.isArray(row) ? row.slice(0, dataColumnCount) : [];
  while (result.length < dataColumnCount) result.push("");
  return result;
}

function appendQCReviewRecord_(ss, payload) {
  let sourceName = String(payload && payload.sourceSheet || "QC").trim() || "QC";
  if (sourceName === "ScreenReports") sourceName = "SCREEN";
  const record = payload && payload.record && Array.isArray(payload.record.cells) ? payload.record.cells : [];
  const recordRef = payload && payload.recordRef && typeof payload.recordRef === "object" ? payload.recordRef : {};
  const mirrors = ensureQCMirrorSheets_(ss, sourceName, record);
  const pending = ss.getSheetByName(sourceName + QC_PENDING_SUFFIX);
  // Reviews move rows only from the current Pending mirror. Legacy base
  // sheets are intentionally excluded from the live workflow.
  const sourceSheet = pending;
  const reviewedSheet = mirrors.reviewed;
  normalizeQCReviewedSheet_(ss, sourceName, reviewedSheet, record);
  const reviewKey = String(payload && payload.reviewKey || "").trim();
  const sourceRows = qcSourceRows_(sourceSheet, sourceName, recordRef);
  const columnMap = getQCReviewColumnMap_(reviewedSheet, sourceName);
  let duplicate = false;
  if (reviewKey && reviewedSheet.getLastRow() > 1 && columnMap.keyIndex >= 0) {
    const keys = reviewedSheet.getRange(2, columnMap.keyIndex + 1, reviewedSheet.getLastRow() - 1, 1).getDisplayValues();
    duplicate = keys.some(row => String(row[0] || "").trim() === reviewKey);
  }
  if (duplicate) {
    const moved = deleteQCSourceRows_(sourceSheet, sourceRows);
    SpreadsheetApp.flush();
    return { duplicate: true, moved: moved };
  }
  if (!sourceRows.length) return { duplicate: false, moved: 0, notFound: true };

  const reviewer = payload && payload.reviewedBy;
  const reviewerName = typeof reviewer === "string"
    ? reviewer
    : String((reviewer && (reviewer.displayName || reviewer.name || reviewer.employeeId)) || "");
  const status = String(payload && payload.status || "").trim();
  const reviewedAt = new Date();
  const dataColumnCount = Math.max(1, qcCanonicalDataHeaders_(ss, sourceName, record).length);
  sourceRows.forEach(item => {
    reviewedSheet.appendRow(qcReviewDataRow_(item.values, dataColumnCount).concat([status, reviewedAt, reviewerName, reviewKey]));
  });
  // Copy-first, delete-second: only delete after every reviewed copy exists.
  const moved = deleteQCSourceRows_(sourceSheet, sourceRows);
  SpreadsheetApp.flush();
  return { duplicate: false, moved: moved };
}

function getQCReviewColumnMap_(sheet, base) {
  const lastColumn = Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()));
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0].map(value => String(value || "").trim());
  // Mirror tabs always store the four QC metadata fields in the final four
  // columns. Prefer this invariant over legacy header layouts created by
  // earlier versions of the migration.
  if (lastColumn >= 4) {
    const metadataStart = lastColumn - 4;
    if (headers[metadataStart] === "QCStatus" && headers[metadataStart + 1] === "QCReviewedAt" && headers[metadataStart + 2] === "QCReviewedBy" && headers[metadataStart + 3] === "QCReviewKey") {
      return { statusIndex: metadataStart, reviewedAtIndex: metadataStart + 1, reviewerIndex: metadataStart + 2, keyIndex: metadataStart + 3 };
    }
  }
  const map = {
    statusIndex: headers.indexOf("QCStatus"),
    reviewedAtIndex: headers.indexOf("QCReviewedAt"),
    reviewerIndex: headers.indexOf("QCReviewedBy"),
    keyIndex: headers.indexOf("QCReviewKey")
  };
  if (sheet.getLastRow() <= 1 || (map.statusIndex >= 0 && map.reviewedAtIndex >= 0 && map.reviewerIndex >= 0 && map.keyIndex >= 0)) {
    return map;
  }

  // Some mirror tabs were created before the QC metadata headers existed.
  // Inspect a small sample and infer the metadata columns from the review key.
  const sampleCount = Math.min(sheet.getLastRow() - 1, 50);
  const sampleRows = sheet.getRange(2, 1, sampleCount, lastColumn).getDisplayValues();
  const keyPrefix = String(base || "").trim() + "|";
  sampleRows.forEach(row => {
    if (map.statusIndex < 0) {
      const statusIndex = row.findIndex(value => ["approved", "rejected"].indexOf(String(value || "").trim().toLowerCase()) >= 0);
      if (statusIndex >= 0) map.statusIndex = statusIndex;
    }
    if (map.keyIndex < 0) {
      const keyIndex = row.findIndex(value => String(value || "").trim().indexOf(keyPrefix) === 0);
      if (keyIndex >= 0) map.keyIndex = keyIndex;
    }
  });
  if (map.keyIndex >= 0 && map.statusIndex < 0 && map.keyIndex >= 3) map.statusIndex = map.keyIndex - 3;
  if (map.statusIndex >= 0) {
    if (map.reviewedAtIndex < 0 && map.statusIndex + 1 < lastColumn) map.reviewedAtIndex = map.statusIndex + 1;
    if (map.reviewerIndex < 0 && map.statusIndex + 2 < lastColumn) map.reviewerIndex = map.statusIndex + 2;
    if (map.keyIndex < 0 && map.statusIndex + 3 < lastColumn) map.keyIndex = map.statusIndex + 3;
  }
  return map;
}

function readQCReviewRecords_(ss) {
  const result = [];
  QC_MIGRATION_SOURCES.forEach(base => {
    const sheet = ss.getSheetByName(base + QC_REVIEWED_SUFFIX);
    if (!sheet || sheet.getLastRow() <= 1) return;
    const map = getQCReviewColumnMap_(sheet, base);
    if (map.statusIndex < 0 || map.keyIndex < 0) return;
    const lastRow = sheet.getLastRow();
    const rowCount = Math.min(lastRow - 1, REPORT_READ_MAX_ROWS);
    const firstRow = lastRow - rowCount + 1;
    // One range read per reviewed sheet is substantially faster than four
    // separate column reads through the Apps Script Spreadsheet service.
    const readColumnCount = Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, sheet.getLastColumn()));
    const rows = sheet.getRange(firstRow, 1, rowCount, readColumnCount).getDisplayValues();
    for (let i = 0; i < rowCount; i++) {
      const row = rows[i] || [];
      const reviewKey = String(row[map.keyIndex] || "").trim();
      if (!reviewKey) continue;
      result.push({
        reviewedAt: formatDateStr(row[map.reviewedAtIndex], true),
        status: String(row[map.statusIndex] || "").trim(),
        sourceSheet: base,
        reviewKey: reviewKey,
        reviewedBy: String(row[map.reviewerIndex] || "").trim()
      });
    }
  });
  return result;
}

function doPost(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // QC review writes must not initialize/read the legacy inspection sheet.
    // That unnecessary operation was making the button wait or time out.
    const earlyAction = (e && e.parameter && e.parameter.action) || "";
    if (earlyAction === "submitQCReview") {
      let earlyPayload = {};
      try {
        earlyPayload = e && e.postData && e.postData.contents
          ? JSON.parse(e.postData.contents) : (e.parameter || {});
      } catch (parseErr) { earlyPayload = e.parameter || {}; }
      const earlyResult = appendQCReviewRecord_(ss, earlyPayload || {});
      return ContentService.createTextOutput(JSON.stringify({
        status: earlyResult.notFound ? "error" : "success", action: "submitQCReview",
        duplicate: !!earlyResult.duplicate, moved: Number(earlyResult.moved || 0),
        message: earlyResult.notFound ? "Source row not found" : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    let sheet = ensureInspectionSheet_(ss);

    /* Inspection writes are sent as GET by the web client for Apps Script CORS compatibility.
    // Keep the GET endpoint write-capable as well as the POST endpoint.
    if (action === "create") {
      if (!sheet) {
        sheet = ss.insertSheet(SHEET_NAME);
        sheet.appendRow(["Date", "Rust", "Dent", "Weld", "Chemical", "Oil", "Note", "Timestamp"]);
      }

      const dateVal = String((e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true));
      const rustVal = Number((e && e.parameter && e.parameter.rust) || 0) || 0;
      const dentVal = Number((e && e.parameter && e.parameter.dent) || 0) || 0;
      const weldVal = Number((e && e.parameter && e.parameter.weld) || 0) || 0;
      const chemicalVal = Number((e && e.parameter && e.parameter.chemical) || 0) || 0;
      const oilVal = Number((e && e.parameter && e.parameter.oil) || 0) || 0;
      const noteVal = String((e && e.parameter && e.parameter.note) || "");

      sheet.appendRow([dateVal, rustVal, dentVal, weldVal, chemicalVal, oilVal, noteVal, new Date()]);
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "create" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update") {
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "update", message: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);

      const dateVal = String((e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true));
      const rustVal = Number((e && e.parameter && e.parameter.rust) || 0) || 0;
      const dentVal = Number((e && e.parameter && e.parameter.dent) || 0) || 0;
      const weldVal = Number((e && e.parameter && e.parameter.weld) || 0) || 0;
      const chemicalVal = Number((e && e.parameter && e.parameter.chemical) || 0) || 0;
      const oilVal = Number((e && e.parameter && e.parameter.oil) || 0) || 0;
      const noteVal = String((e && e.parameter && e.parameter.note) || "");
      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || 0);
      const originalDate = String((e && e.parameter && e.parameter.originalDate) || dateVal);
      const values = sheet.getDataRange().getValues();

      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          if (rowDateStr === originalDate || rowDateStr === dateVal) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.getRange(targetRowIndex, 1, 1, 8).setValues([[dateVal, rustVal, dentVal, weldVal, chemicalVal, oilVal, noteVal, new Date()]]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update", updatedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "update", message: "Row not found for update" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "delete") {
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "delete", message: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);

      const values = sheet.getDataRange().getValues();
      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || 0);
      const searchDate = String((e && e.parameter && e.parameter.date) || "");
      const searchNote = String((e && e.parameter && e.parameter.note) || "");
      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          const rowNoteStr = String(values[i][6] || "");
          if ((searchDate && rowDateStr === searchDate) || (searchNote && rowNoteStr === searchNote)) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(targetRowIndex);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete", deletedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "delete", message: "Row not found for deletion" })).setMimeType(ContentService.MimeType.JSON);
    }

    */
    sheet = ensureInspectionSheet_(ss);

    let data = {};
    if (e && e.postData && e.postData.contents) {
      try {
        data = JSON.parse(e.postData.contents);
      } catch (pErr) {
        data = e.parameter || {};
      }
    } else if (e && e.parameter) {
      data = e.parameter;
    }

    // Explicitly check URL parameter first, then JSON body
    const action = (e && e.parameter && e.parameter.action) || (data && data.action) || "create";

    if (action === "submitQCReview") {
      const result = appendQCReviewRecord_(ss, data || {});
      return ContentService.createTextOutput(JSON.stringify({
        status: result.notFound ? "error" : "success", action: "submitQCReview",
        duplicate: !!result.duplicate, moved: Number(result.moved || 0),
        message: result.notFound ? "Source row not found" : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle checkBootstrap
    if (action === "checkBootstrap") {
      let uSheet = getOrCreateUsersSheet(ss);
      const rows = uSheet.getLastRow();
      return ContentService.createTextOutput(JSON.stringify({ isBootstrap: rows <= 1 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle login
    if (action === "login") {
      let uSheet = getOrCreateUsersSheet(ss);
      const empId = String((data && data.employeeId) || (e && e.parameter && e.parameter.employeeId) || "").trim();
      const passHash = String((data && data.passwordHash) || (e && e.parameter && e.parameter.passwordHash) || "").trim();

      const values = uSheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const rowEmpId = String(values[i][0] || "").trim();
        const rowHash = String(values[i][3] || "").trim();
        if (rowEmpId === empId) {
          if (rowHash !== passHash) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" })).setMimeType(ContentService.MimeType.JSON);
          }
          const status = String(values[i][5] || "Pending").trim();
          if (status === "Pending") {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีของคุณกำลังรอการอนุมัติสิทธิ์จากผู้ดูแลระบบ" })).setMimeType(ContentService.MimeType.JSON);
          }
          if (status === "Disabled") {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีของคุณถูกระงับการใช้งาน" })).setMimeType(ContentService.MimeType.JSON);
          }

          // Update Last Login
          const nowStr = formatDateStr(new Date(), true);
          uSheet.getRange(i + 1, 8).setValue(nowStr);
          SpreadsheetApp.flush();

          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            user: {
              employeeId: values[i][0],
              displayName: values[i][1],
              department: values[i][2],
              role: values[i][4],
              status: values[i][5],
              permissions: parsePermissions(values[i][8], values[i][4])
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบรหัสพนักงานนี้ในระบบ" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle register. The script lock closes the race where two requests
    // check the sheet before either one has appended the new employee.
    if (action === "register") {
      const result = registerUserRecord_(ss, data || {}, "Engineer");
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle getUsers
    if (action === "getUsers") {
      let uSheet = getOrCreateUsersSheet(ss);
      // Users is a nine-column table. Avoid getDataRange(), which can include
      // a large formatted area and stall the dashboard's initial load.
      const userLastRow = Math.max(1, Math.min(uSheet.getLastRow(), 5000));
      const values = uSheet.getRange(1, 1, userLastRow, 9).getValues();
      if (!values || values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", users: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      values.shift();
      const usersList = values.map(r => ({
        employeeId: String(r[0] || ""),
        displayName: String(r[1] || ""),
        department: String(r[2] || ""),
        role: String(r[4] || "Inspector"),
        status: String(r[5] || "Pending"),
        permissions: parsePermissions(r[8], String(r[4] || "Inspector")),
        createdAt: formatDateStr(r[6], true),
        lastLogin: formatDateStr(r[7], true)
      }));
      return ContentService.createTextOutput(JSON.stringify({ status: "success", users: usersList })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle updateUserStatus
    if (action === "updateUserStatus") {
      let uSheet = getOrCreateUsersSheet(ss);
      const empId = String((data && data.employeeId) || (e && e.parameter && e.parameter.employeeId) || "").trim();
      const newStatus = String((data && data.userStatus) || (e && e.parameter && e.parameter.userStatus) || "").trim();
      const newRole = String((data && data.userRole) || (e && e.parameter && e.parameter.userRole) || "").trim();
      const newPermissions = (data && data.permissions) || (e && e.parameter && e.parameter.permissions) || "";

      const values = uSheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === empId) {
          if (newStatus) uSheet.getRange(i + 1, 6).setValue(newStatus);
          if (newRole) uSheet.getRange(i + 1, 5).setValue(newRole);
          if (newPermissions) uSheet.getRange(i + 1, 9).setValue(permissionsJson(newPermissions, newRole || values[i][4]));
          SpreadsheetApp.flush();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "User not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle DELETE action
    if (action === "delete") {
      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || data.rowIndex);
      const searchDate = (e && e.parameter && e.parameter.date) || data.date || data.originalDate;
      const searchNote = String((e && e.parameter && e.parameter.note) || data.note || "");

      const values = sheet.getDataRange().getValues();

      // If rowIndex is provided and valid, verify or use directly
      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        targetRowIndex = 0;
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          const rowNoteStr = String(values[i][6] || "");
          if (rowDateStr === searchDate || (searchNote && rowNoteStr === searchNote)) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(targetRowIndex);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete", deletedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "delete", message: "Row not found for deletion" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle UPDATE action
    if (action === "update") {
      const dateVal = data.date || (e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true);
      const rustVal = Number(data.rust || (e && e.parameter && e.parameter.rust)) || 0;
      const dentVal = Number(data.dent || (e && e.parameter && e.parameter.dent)) || 0;
      const weldVal = Number(data.weld || (e && e.parameter && e.parameter.weld)) || 0;
      const chemicalVal = Number(data.chemical || (e && e.parameter && e.parameter.chemical)) || 0;
      const oilVal = Number(data.oil || (e && e.parameter && e.parameter.oil)) || 0;
      const noteVal = data.note || (e && e.parameter && e.parameter.note) || "";

      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || data.rowIndex);
      const origDate = data.originalDate || (e && e.parameter && e.parameter.originalDate) || dateVal;

      const values = sheet.getDataRange().getValues();

      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        targetRowIndex = 0;
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          if (rowDateStr === origDate || rowDateStr === dateVal) {
            targetRowIndex = i + 1;
            break;
          }
        }
      }

      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn()).setValues([inspectionRowValues_(sheet, {
          date: dateVal,
          workType: data.workType || (e && e.parameter && e.parameter.workType) || "",
          rust: rustVal,
          dent: dentVal,
          weld: weldVal,
          chemical: chemicalVal,
          oil: oilVal,
          note: noteVal
        }, values[targetRowIndex - 1])]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update", updatedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "update", message: "Row not found for update" })).setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Handle REWORK submissions in the separate REWORK sheet.
    if (action === "submitReworkReport") {
      const result = appendReworkReport_(ss, data || {});
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitReworkReport", duplicate: !!result.duplicate, rows: result.rows || 0 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle SCREEN submissions in the separate SCREEN sheet.
    if (action === "submitScreenReport") {
      const result = appendScreenReport_(ss, data || {});
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitScreenReport", duplicate: !!result.duplicate, rows: result.rows || 0 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle submitDailyReport action
    if (action === "submitDailyReport") {
      const TARGET_SHEET_NAME = "outputdiary" + QC_PENDING_SUFFIX;
      let prodSheet = ss.getSheetByName(TARGET_SHEET_NAME);
      if (!prodSheet) {
        prodSheet = ss.insertSheet(TARGET_SHEET_NAME);
      }
      
      // If sheet is empty, create header row
      if (prodSheet.getLastRow() === 0) {
        prodSheet.appendRow([
          "Timestamp", "Date", "Shift", "Recorder", "Checker", 
          "Downtime_Burner", "Downtime_Wash", "Downtime_Oven_Etc", "Downtime_Note", 
          "Model", "TimeSlot", "ProdQty", "Dent", "ColorDrop", "ThinPaint", "ThickPaint", "WaterStain", "OtherDefect", "TotalDefect", DAILY_REPORT_ID_HEADER, DAILY_REPORT_COLOR_HEADER, DAILY_REPORT_PRODUCT_GROUP_HEADER, DAILY_REPORT_PART_CATEGORY_HEADER, DAILY_REPORT_COLOR_CODE_HEADER, DAILY_REPORT_DUST_HEADER, DAILY_REPORT_OIL_HEADER, DAILY_REPORT_RUST_HEADER
        ]);
      }

      const submissionId = String(data.submissionId || "").trim();
      const submissionIdColumn = ensureDailyReportIdColumn(prodSheet);
      ensureDailyReportColorColumn(prodSheet);
      ensureDailyReportCatalogColumns(prodSheet);
      if (hasDailyReportSubmission(prodSheet, submissionId, submissionIdColumn)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitDailyReport", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }
      
      const now = new Date();
      const dateVal = data.date || formatDateStr(now, false);
      const shiftVal = data.shift || "";
      const recorderVal = data.recorder || "";
      const checkerVal = data.checker || "";

      const dt = data.downtime || {};
      const burner = dt.burner || 0;
      const wash = dt.wash || 0;
      const ovenEtc = (dt.oven||0) + (dt.gun||0) + (dt.power||0) + (dt.motor||0) + (dt.other||0);
      const dtNote = dt.note || "";
      
      if (data.records && Array.isArray(data.records)) {
        data.records.forEach(r => {
          // Columns A-I (1-9): General Info & Downtime
          // Column J (10) onwards: Model, TimeSlot, ProdQty, Dent, ColorDrop, ThinPaint, ThickPaint, WaterStain, OtherDefect, TotalDefect; catalog fields, Dust, and Oil follow afterward.
          prodSheet.appendRow([
            now,
            dateVal,
            shiftVal,
            recorderVal,
            checkerVal,
            burner,
            wash,
            ovenEtc,
            dtNote,
            r.model,          // Column J (Column 10)
            r.timeSlot,       // Column K (Column 11)
            r.prodQty,        // Column L (Column 12)
            r.dent,           // Column M (Column 13)
            r.colorDrop,      // Column N (Column 14)
            r.thinPaint,      // Column O (Column 15)
            r.thickPaint,     // Column P (Column 16)
            r.waterStain,     // Column Q (Column 17)
            r.otherDefect,    // Column R (Column 18)
            r.totalDefect,    // Column S (Column 19)
            submissionId,     // Column T: idempotency key
            r.color || "",           // Column U: production color
            r.productGroup || "",    // Column V: product group
            r.partCategory || "",     // Column W: part category
            r.colorCode || "",        // Column X: color code
            r.dust || 0,               // Column Y: dust defect
            r.oil || 0,                // Column Z: oil defect
            r.rust || 0                // Column AA: rust defect
          ]);
        });
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitDailyReport" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle parameter checklist submission
    if (action === "submitParameterChecklist") {
      const checklistType = String(data.checklistType || "full").toLowerCase() === "water" ? "water" : "full";
      const checklistSheet = ensureParameterChecklistSheet(ss, checklistType);
      const submissionId = String(data.submissionId || "").trim();
      if (hasParameterChecklistSubmission(checklistSheet, submissionId)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitParameterChecklist", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }

      const now = new Date();
      const dateVal = String(data.date || formatDateStr(now, false));
      const operatorVal = String(data.operator || "");
      const leaderVal = String(data.teamLeader || "");
      const timeVal = checklistType === "water" ? String(data.time || "") : "";
      const records = Array.isArray(data.records) ? data.records : [];
      records.forEach(item => {
        const row = [
          now,
          dateVal,
          operatorVal,
          leaderVal,
          Number(item.itemNo) || 0,
          String(item.process || ""),
          String(item.checkItem || ""),
          String(item.standard || ""),
          String(item.actualValue || ""),
          String(item.status || ""),
          String(item.note || ""),
          submissionId,
          checklistType
        ];
        if (checklistType === "water") row.push(timeVal);
        checklistSheet.appendRow(row);
      });
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitParameterChecklist" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle equipment checklist submission
    if (action === "submitEquipmentChecklist") {
      const checklistSheet = ensureEquipmentChecklistSheet(ss);
      const submissionId = String(data.submissionId || "").trim();
      if (hasEquipmentChecklistSubmission(checklistSheet, submissionId)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitEquipmentChecklist", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }

      const now = new Date();
      const dateVal = String(data.date || formatDateStr(now, false));
      const operatorVal = String(data.operator || "");
      const leaderVal = String(data.teamLeader || "");
      const records = Array.isArray(data.records) ? data.records : [];
      records.forEach(item => {
        checklistSheet.appendRow([
          now,
          dateVal,
          operatorVal,
          leaderVal,
          Number(item.itemNo) || 0,
          String(item.checkItem || ""),
          String(item.method || ""),
          String(item.standard || ""),
          String(item.imageUrl || ""),
          String(item.status || ""),
          String(item.note || ""),
          submissionId
        ]);
      });
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitEquipmentChecklist" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle addRecorder action
    if (action === "addRecorder") {
      let recSheet = ss.getSheetByName("Recorders");
      if (!recSheet) {
        recSheet = ss.insertSheet("Recorders");
        recSheet.appendRow(["Name"]);
      }
      const newName = String(data.name || (e && e.parameter && e.parameter.name) || "").trim();
      if (newName) {
        const values = recSheet.getDataRange().getValues();
        let exists = false;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]).trim() === newName) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          recSheet.appendRow([newName]);
          SpreadsheetApp.flush();
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", name: newName })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle deleteRecorder action
    if (action === "deleteRecorder") {
      let recSheet = ss.getSheetByName("Recorders");
      if (recSheet) {
        const targetName = String(data.name || (e && e.parameter && e.parameter.name) || "").trim();
        if (targetName) {
          const values = recSheet.getDataRange().getValues();
          for (let i = 1; i < values.length; i++) {
            if (String(values[i][0]).trim() === targetName) {
              recSheet.deleteRow(i + 1);
              SpreadsheetApp.flush();
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle CREATE action ONLY
    if (action === "create") {
      const dateVal = data.date || (e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true);
      const rustVal = Number(data.rust || (e && e.parameter && e.parameter.rust)) || 0;
      const dentVal = Number(data.dent || (e && e.parameter && e.parameter.dent)) || 0;
      const weldVal = Number(data.weld || (e && e.parameter && e.parameter.weld)) || 0;
      const chemicalVal = Number(data.chemical || (e && e.parameter && e.parameter.chemical)) || 0;
      const oilVal = Number(data.oil || (e && e.parameter && e.parameter.oil)) || 0;
      const noteVal = data.note || (e && e.parameter && e.parameter.note) || "";

      sheet.appendRow(inspectionRowValues_(sheet, {
        date: dateVal,
        workType: data.workType || (e && e.parameter && e.parameter.workType) || "",
        rust: rustVal,
        dent: dentVal,
        weld: weldVal,
        chemical: chemicalVal,
        oil: oilVal,
        note: noteVal
      }));

      SpreadsheetApp.flush();

      return ContentService
        .createTextOutput(JSON.stringify({
          status: "success",
          action: "create"
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: "Unknown action: " + action }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateUsersSheet(ss) {
  let uSheet = ss.getSheetByName("Users");
  if (!uSheet) {
    uSheet = ss.insertSheet("Users");
    uSheet.appendRow(["EmployeeID", "DisplayName", "Department", "PasswordHash", "Role", "Status", "CreatedAt", "LastLogin", "Permissions"]);
    SpreadsheetApp.flush();
  } else if (uSheet.getLastColumn() < 9) {
    uSheet.getRange(1, 9).setValue("Permissions");
    SpreadsheetApp.flush();
  }
  return uSheet;
}

function registerUserRecord_(ss, payload, defaultDepartment) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const data = payload || {};
    const uSheet = getOrCreateUsersSheet(ss);
    const empId = String(data.employeeId || "").trim();
    const name = String(data.displayName || "").trim();
    const dept = String(data.department || defaultDepartment || "Engineer").trim();
    const passHash = String(data.passwordHash || "").trim();

    if (!empId) {
      return { status: "error", message: "กรุณาระบุรหัสพนักงาน" };
    }

    const values = uSheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || "").trim() === empId) {
        return { status: "error", message: "รหัสพนักงานนี้ลงทะเบียนไว้แล้ว" };
      }
    }

    const isFirstUser = values.length <= 1;
    const role = isFirstUser ? "Super Admin" : "Inspector";
    const status = isFirstUser ? "Active" : "Pending";
    const permissions = getDefaultPermissions(role);
    const nowStr = formatDateStr(new Date(), true);

    uSheet.appendRow([empId, name, dept, passHash, role, status, nowStr, "", JSON.stringify(permissions)]);
    SpreadsheetApp.flush();

    return { status: "success", isSuperAdmin: isFirstUser, role: role, userStatus: status };
  } catch (error) {
    return { status: "error", message: error && error.message ? error.message : "ไม่สามารถลงทะเบียนได้" };
  } finally {
    try { lock.releaseLock(); } catch (releaseError) {}
  }
}

function upsertUserRecord_(ss, payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);

    const data = payload || {};
    const uSheet = getOrCreateUsersSheet(ss);
    const empId = String(data.employeeId || "").trim();
    const name = String(data.displayName || "").trim();
    const dept = String(data.department || "").trim();
    const status = String(data.userStatus || "Active").trim();
    const passHash = String(data.passwordHash || "").trim();
    // Only these two roles can be handed out here; Super Admin stays the owner's.
    const role = String(data.userRole || "").trim() === "Admin" ? "Admin" : "Inspector";

    if (!empId) {
      return { status: "error", message: "กรุณาระบุรหัสพนักงาน" };
    }

    const values = uSheet.getDataRange().getValues();
    for (let i = 1; i < values.length; i++) {
      if (String(values[i][0] || "").trim() === empId) {
        // Existing employee: keep the password, refresh the rest. Never
        // demote the Super Admin through this form.
        if (name) uSheet.getRange(i + 1, 2).setValue(name);
        if (dept) uSheet.getRange(i + 1, 3).setValue(dept);
        uSheet.getRange(i + 1, 6).setValue(status);
        if (String(values[i][4] || "").trim() !== "Super Admin") {
          uSheet.getRange(i + 1, 5).setValue(role);
          uSheet.getRange(i + 1, 9).setValue(JSON.stringify(getDefaultPermissions(role)));
        }
        SpreadsheetApp.flush();
        return { status: "success", created: false };
      }
    }

    const nowStr = formatDateStr(new Date(), true);
    uSheet.appendRow([empId, name, dept, passHash, role, status, nowStr, "", JSON.stringify(getDefaultPermissions(role))]);
    SpreadsheetApp.flush();
    return { status: "success", created: true };
  } catch (error) {
    return { status: "error", message: error && error.message ? error.message : "ไม่สามารถบันทึกผู้ใช้งานได้" };
  } finally {
    try { lock.releaseLock(); } catch (releaseError) {}
  }
}

// =========================================================
// Spare parts inventory
// =========================================================
const SPARE_PARTS_MASTER_HEADERS_ = [
  "PartId", "PartName", "Category", "Machine", "Unit", "OpeningStock",
  "MinStock", "MaxStock", "Location", "Supplier", "Notes", "CreatedAt",
  "UpdatedAt", "Active"
];
const SPARE_PARTS_TRANSACTION_HEADERS_ = [
  "TransactionId", "Timestamp", "PartId", "Type", "Quantity", "Reference",
  "Machine", "Recorder", "Note"
];

function getOrCreateSparePartsSheet_(ss) {
  let sheet = ss.getSheetByName(SPARE_PARTS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SPARE_PARTS_SHEET_NAME);
    sheet.getRange(1, 1, 1, SPARE_PARTS_MASTER_HEADERS_.length).setValues([SPARE_PARTS_MASTER_HEADERS_]);
  } else if (sheet.getLastColumn() < SPARE_PARTS_MASTER_HEADERS_.length) {
    const headers = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
    SPARE_PARTS_MASTER_HEADERS_.forEach(header => {
      if (headers.indexOf(header) < 0) {
        sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
        headers.push(header);
      }
    });
  }

  // Seed only an empty new catalogue. Existing user data is never overwritten.
  if (sheet.getLastRow() <= 1) {
    const now = new Date();
    const starterParts = [
      ["SP-001", "หัวเทียน", "ไฟฟ้า / จุดระเบิด", "ยังไม่ระบุ", "ชิ้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-002", "ทรานฟอร์เมอร์", "ไฟฟ้า", "ยังไม่ระบุ", "ชิ้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-003", "สายพาน", "ระบบขับเคลื่อน", "ยังไม่ระบุ", "เส้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-004", "จ๊กแขวนงาน", "แขวนงาน", "ยังไม่ระบุ", "ชิ้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-005", "ปืนพ่นสี", "ระบบพ่นสี", "ยังไม่ระบุ", "กระบอก", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-006", "สายสี", "ระบบสี", "ยังไม่ระบุ", "เส้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-007", "สายลม", "ระบบลม", "ยังไม่ระบุ", "เส้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true],
      ["SP-008", "ฟิลเตอร์", "กรองอากาศ / สี", "ยังไม่ระบุ", "ชิ้น", 0, 0, 0, "ยังไม่ระบุ", "", "", now, now, true]
    ];
    sheet.getRange(2, 1, starterParts.length, SPARE_PARTS_MASTER_HEADERS_.length).setValues(starterParts);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function getOrCreateSparePartsTransactionsSheet_(ss) {
  let sheet = ss.getSheetByName(SPARE_PARTS_TRANSACTIONS_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SPARE_PARTS_TRANSACTIONS_SHEET_NAME);
    sheet.getRange(1, 1, 1, SPARE_PARTS_TRANSACTION_HEADERS_.length).setValues([SPARE_PARTS_TRANSACTION_HEADERS_]);
    SpreadsheetApp.flush();
  }
  return sheet;
}

function sparePartsHeaderMap_(headers) {
  const map = {};
  (headers || []).forEach((header, index) => { map[String(header || "").trim()] = index; });
  return map;
}

function sparePartNumber_(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sparePartTransactionDelta_(type, quantity) {
  const qty = Math.abs(sparePartNumber_(quantity));
  const normalized = String(type || "").trim().toUpperCase();
  if (normalized === "OUT") return -qty;
  return qty;
}

function readSparePartsInventory_(ss) {
  const masterSheet = getOrCreateSparePartsSheet_(ss);
  const transactionSheet = getOrCreateSparePartsTransactionsSheet_(ss);
  const masterLastColumn = Math.max(1, masterSheet.getLastColumn());
  const masterHeaders = masterSheet.getRange(1, 1, 1, masterLastColumn).getDisplayValues()[0].map(String);
  const masterMap = sparePartsHeaderMap_(masterHeaders);
  const masterRows = masterSheet.getLastRow() > 1
    ? masterSheet.getRange(2, 1, masterSheet.getLastRow() - 1, masterLastColumn).getValues()
    : [];

  const transactionLastColumn = Math.max(1, transactionSheet.getLastColumn());
  const transactionHeaders = transactionSheet.getRange(1, 1, 1, transactionLastColumn).getDisplayValues()[0].map(String);
  const transactionMap = sparePartsHeaderMap_(transactionHeaders);
  const transactionRows = transactionSheet.getLastRow() > 1
    ? transactionSheet.getRange(2, 1, transactionSheet.getLastRow() - 1, transactionLastColumn).getValues()
    : [];
  const deltas = {};
  const transactions = transactionRows.map((row, index) => {
    const partId = String(row[transactionMap.PartId] || "").trim();
    const type = String(row[transactionMap.Type] || "").trim().toUpperCase();
    const quantity = Math.abs(sparePartNumber_(row[transactionMap.Quantity]));
    if (partId) deltas[partId] = sparePartNumber_(deltas[partId]) + sparePartTransactionDelta_(type, quantity);
    return {
      rowIndex: index + 2,
      transactionId: String(row[transactionMap.TransactionId] || ""),
      timestamp: formatDateStr(row[transactionMap.Timestamp], true),
      partId: partId,
      type: type,
      quantity: quantity,
      reference: String(row[transactionMap.Reference] || ""),
      machine: String(row[transactionMap.Machine] || ""),
      recorder: String(row[transactionMap.Recorder] || ""),
      note: String(row[transactionMap.Note] || "")
    };
  }).reverse();

  const parts = masterRows.map((row, index) => {
    const partId = String(row[masterMap.PartId] || "").trim();
    const openingStock = sparePartNumber_(row[masterMap.OpeningStock]);
    const minStock = sparePartNumber_(row[masterMap.MinStock]);
    const maxStock = sparePartNumber_(row[masterMap.MaxStock]);
    const onHand = openingStock + sparePartNumber_(deltas[partId]);
    return {
      rowIndex: index + 2,
      partId: partId,
      partName: String(row[masterMap.PartName] || ""),
      category: String(row[masterMap.Category] || ""),
      machine: String(row[masterMap.Machine] || ""),
      unit: String(row[masterMap.Unit] || "ชิ้น"),
      openingStock: openingStock,
      minStock: minStock,
      maxStock: maxStock,
      onHand: onHand,
      location: String(row[masterMap.Location] || ""),
      supplier: String(row[masterMap.Supplier] || ""),
      notes: String(row[masterMap.Notes] || ""),
      active: row[masterMap.Active] !== false && String(row[masterMap.Active] || "true").toLowerCase() !== "false",
      status: minStock > 0 ? (onHand <= minStock ? "low" : "ok") : "unset"
    };
  }).filter(part => part.partId && part.active);

  return { parts: parts, transactions: transactions };
}

function saveSparePartRecord_(ss, payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const sheet = getOrCreateSparePartsSheet_(ss);
    const inventory = readSparePartsInventory_(ss);
    const masterLastColumn = Math.max(1, sheet.getLastColumn());
    const headers = sheet.getRange(1, 1, 1, masterLastColumn).getDisplayValues()[0].map(String);
    const map = sparePartsHeaderMap_(headers);
    const requestedId = String(payload.partId || "").trim();
    const name = String(payload.partName || "").trim();
    if (!name) return { status: "error", message: "กรุณาระบุชื่ออะไหล่" };

    let partId = requestedId;
    if (!partId) {
      const maxId = inventory.parts.reduce((max, part) => {
        const number = Number(String(part.partId || "").replace(/\D/g, "")) || 0;
        return Math.max(max, number);
      }, 0);
      partId = "SP-" + String(maxId + 1).padStart(3, "0");
    }

    const rowValues = Array(masterLastColumn).fill("");
    const now = new Date();
    const values = {
      PartId: partId,
      PartName: name,
      Category: String(payload.category || "").trim(),
      Machine: String(payload.machine || "").trim(),
      Unit: String(payload.unit || "ชิ้น").trim() || "ชิ้น",
      OpeningStock: Math.max(0, sparePartNumber_(payload.openingStock)),
      MinStock: Math.max(0, sparePartNumber_(payload.minStock)),
      MaxStock: Math.max(0, sparePartNumber_(payload.maxStock)),
      Location: String(payload.location || "").trim(),
      Supplier: String(payload.supplier || "").trim(),
      Notes: String(payload.notes || "").trim(),
      CreatedAt: now,
      UpdatedAt: now,
      Active: true
    };

    let targetRow = 0;
    const valuesInSheet = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, masterLastColumn).getValues() : [];
    for (let i = 0; i < valuesInSheet.length; i++) {
      if (String(valuesInSheet[i][map.PartId] || "").trim() === partId) { targetRow = i + 2; break; }
    }
    if (targetRow) {
      const oldCreatedAt = valuesInSheet[targetRow - 2][map.CreatedAt];
      values.CreatedAt = oldCreatedAt || now;
      Object.keys(values).forEach(key => { if (map[key] >= 0) rowValues[map[key]] = values[key]; });
      sheet.getRange(targetRow, 1, 1, masterLastColumn).setValues([rowValues]);
    } else {
      Object.keys(values).forEach(key => { if (map[key] >= 0) rowValues[map[key]] = values[key]; });
      sheet.appendRow(rowValues);
    }
    SpreadsheetApp.flush();
    return { status: "success", partId: partId, action: "saveSparePart" };
  } catch (error) {
    return { status: "error", message: error && error.message ? error.message : "บันทึกข้อมูลอะไหล่ไม่สำเร็จ" };
  } finally {
    try { lock.releaseLock(); } catch (releaseError) {}
  }
}

function recordSparePartTransaction_(ss, payload) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    const partId = String(payload.partId || "").trim();
    const type = String(payload.type || "").trim().toUpperCase();
    const quantity = Math.abs(sparePartNumber_(payload.quantity));
    if (!partId || !["IN", "OUT", "RETURN"].includes(type) || quantity <= 0) {
      return { status: "error", message: "ข้อมูลรายการรับเข้า–เบิกออกไม่ครบถ้วน" };
    }

    const inventory = readSparePartsInventory_(ss);
    const part = inventory.parts.find(item => item.partId === partId);
    if (!part) return { status: "error", message: "ไม่พบอะไหล่รายการนี้" };
    if (type === "OUT" && quantity > part.onHand) {
      return { status: "error", message: `ยอดคงเหลือ ${part.onHand} ${part.unit} ไม่พอสำหรับการเบิก` };
    }

    const sheet = getOrCreateSparePartsTransactionsSheet_(ss);
    const transactionId = "SPTX-" + new Date().getTime();
    sheet.appendRow([
      transactionId,
      new Date(),
      partId,
      type,
      quantity,
      String(payload.reference || "").trim(),
      String(payload.machine || "").trim(),
      String(payload.recorder || "").trim() || "ไม่ระบุผู้บันทึก",
      String(payload.note || "").trim()
    ]);
    SpreadsheetApp.flush();
    return { status: "success", action: "recordSparePartTransaction", transactionId: transactionId };
  } catch (error) {
    return { status: "error", message: error && error.message ? error.message : "บันทึกรายการคลังอะไหล่ไม่สำเร็จ" };
  } finally {
    try { lock.releaseLock(); } catch (releaseError) {}
  }
}

// Keep the normal JSON response for fetch() callers, but also support a safe
// JSONP callback. Apps Script /exec uses a short-lived redirect; a browser
// script request can follow that redirect reliably when fetch() receives a
// stale googleusercontent.com 404.
// PartModelCatalog is the source of truth for the production form's
// Product Group -> Part Category -> Model -> Color dropdowns. Columns:
// ProductGroup | PartCategory | ModelCode | ModelName | ColorName | ColorCode.
// A row may leave ModelCode empty to add only a category, or leave both
// PartCategory and ModelCode empty to add only a color or an empty group.
function ensurePartModelCatalogSheet_(ss) {
  let catalogSheet = ss.getSheetByName("PartModelCatalog");
  if (!catalogSheet) catalogSheet = ss.insertSheet("PartModelCatalog");
  if (catalogSheet.getLastRow() <= 1) {
    const catalogRows = [["ProductGroup", "PartCategory", "ModelCode", "ModelName", "ColorName", "ColorCode"]];
    Object.keys(PART_MODEL_CATALOG).forEach(groupName => {
      const group = PART_MODEL_CATALOG[groupName];
      const firstColor = (group.colors || [])[0] || {};
      Object.keys(group.categories || {}).forEach(category => {
        (group.categories[category] || []).forEach(model => {
          catalogRows.push([groupName, category, model.value, model.label, firstColor.value || "", firstColor.code || ""]);
        });
      });
      (group.colors || []).slice(1).forEach(color => catalogRows.push([groupName, "", "", "", color.value || "", color.code || ""]));
    });
    catalogSheet.getRange(1, 1, catalogRows.length, catalogRows[0].length).setValues(catalogRows);
    catalogSheet.setFrozenRows(1);
    SpreadsheetApp.flush();
  }
  return catalogSheet;
}

function readPartModelCatalog_(catalogSheet) {
  const groups = {};
  const order = [];
  const lastRow = catalogSheet.getLastRow();
  if (lastRow < 2) return { groups, order };
  const values = catalogSheet.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
  values.forEach(row => {
    const [groupName, category, code, name, colorName, colorCode] = row.map(v => String(v || "").trim());
    if (!groupName) return;
    if (!groups[groupName]) {
      groups[groupName] = { categories: {}, colors: [] };
      order.push(groupName);
    }
    const group = groups[groupName];
    if (category) {
      if (!group.categories[category]) group.categories[category] = [];
      if (code && !group.categories[category].some(m => m.value === code)) {
        group.categories[category].push({ value: code, label: name || code });
      }
    }
    if (colorName && !group.colors.some(c => c.value === colorName)) {
      group.colors.push({ value: colorName, label: colorCode ? colorName + " (" + colorCode + ")" : colorName, code: colorCode });
    }
  });
  return { groups, order };
}

function doGet(e) {
  const result = doGetJson_(e);
  const callback = String(e && e.parameter && (e.parameter.prefix || e.parameter.callback) || "").trim();
  if (callback && /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(callback) && result && typeof result.getContent === "function") {
    return ContentService
      .createTextOutput(callback + "(" + result.getContent() + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return result;
}

function doGetJson_(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) || "";

    if (action === "migrateQCData") {
      ensureAllQCMirrorSheets_(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: action, moved: migrateExistingQCData_(ss), sheets: QC_MIGRATION_SOURCES.map(name => ({ pending: name + QC_PENDING_SUFFIX, reviewed: name + QC_REVIEWED_SUFFIX })) })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "repairQCReviewedSheets") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", action: action, repaired: repairQCReviewedSheets_(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "recoverHistoricalQCData") {
      const sourceId = String((e && e.parameter && e.parameter.sourceSpreadsheetId) || "").trim();
      const dryRun = String((e && e.parameter && e.parameter.dryRun) || "true").toLowerCase() !== "false";
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        action: action,
        dryRun: dryRun,
        sourceSpreadsheetId: sourceId,
        report: recoverHistoricalQCData_(ss, sourceId, dryRun)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "submitQCReview") {
      let payload = {};
      try { payload = JSON.parse(String((e && e.parameter && e.parameter.payload) || "{}")); } catch (parseErr) {}
      const result = appendQCReviewRecord_(ss, payload);
      return ContentService.createTextOutput(JSON.stringify({
        status: result.notFound ? "error" : "success", action: "submitQCReview",
        duplicate: !!result.duplicate, moved: Number(result.moved || 0),
        message: result.notFound ? "Source row not found" : ""
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getQCReviewData") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success", data: readQCReviewRecords_(ss)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle checkBootstrap
    if (action === "checkBootstrap") {
      let uSheet = getOrCreateUsersSheet(ss);
      const rows = uSheet.getLastRow();
      return ContentService.createTextOutput(JSON.stringify({ isBootstrap: rows <= 1 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle login
    if (action === "login") {
      let uSheet = getOrCreateUsersSheet(ss);
      const empId = String((e && e.parameter && e.parameter.employeeId) || "").trim();
      const passHash = String((e && e.parameter && e.parameter.passwordHash) || "").trim();

      const values = uSheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        const rowEmpId = String(values[i][0] || "").trim();
        const rowHash = String(values[i][3] || "").trim();
        if (rowEmpId === empId) {
          if (rowHash !== passHash) {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "รหัสผ่านไม่ถูกต้อง" })).setMimeType(ContentService.MimeType.JSON);
          }
          const status = String(values[i][5] || "Pending").trim();
          if (status === "Pending") {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีของคุณกำลังรอการอนุมัติสิทธิ์จากผู้ดูแลระบบ" })).setMimeType(ContentService.MimeType.JSON);
          }
          if (status === "Disabled") {
            return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "บัญชีของคุณถูกระงับการใช้งาน" })).setMimeType(ContentService.MimeType.JSON);
          }

          // Update Last Login
          const nowStr = formatDateStr(new Date(), true);
          uSheet.getRange(i + 1, 8).setValue(nowStr);
          SpreadsheetApp.flush();

          return ContentService.createTextOutput(JSON.stringify({
            status: "success",
            user: {
              employeeId: values[i][0],
              displayName: values[i][1],
              department: values[i][2],
              role: values[i][4],
              status: values[i][5],
              permissions: parsePermissions(values[i][8], values[i][4])
            }
          })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ไม่พบรหัสพนักงานนี้ในระบบ" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle register using the same locked writer as POST requests.
    if (action === "register") {
      const result = registerUserRecord_(ss, e && e.parameter ? e.parameter : {}, "แผนกพ่นสี");
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle getUsers
    if (action === "getUsers") {
      let uSheet = getOrCreateUsersSheet(ss);
      // Users is a nine-column table. Avoid getDataRange(), which can include
      // a large formatted area and stall the dashboard's initial load.
      const userLastRow = Math.max(1, Math.min(uSheet.getLastRow(), 5000));
      const values = uSheet.getRange(1, 1, userLastRow, 9).getValues();
      if (!values || values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", users: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      values.shift();
      const usersList = values.map(r => ({
        employeeId: String(r[0] || ""),
        displayName: String(r[1] || ""),
        department: String(r[2] || ""),
        role: String(r[4] || "Inspector"),
        status: String(r[5] || "Pending"),
        permissions: parsePermissions(r[8], String(r[4] || "Inspector")),
        createdAt: formatDateStr(r[6], true),
        lastLogin: formatDateStr(r[7], true)
      }));
      return ContentService.createTextOutput(JSON.stringify({ status: "success", users: usersList })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle updateUserStatus
    if (action === "updateUserStatus") {
      let uSheet = getOrCreateUsersSheet(ss);
      const empId = String((e && e.parameter && e.parameter.employeeId) || "").trim();
      const newStatus = String((e && e.parameter && e.parameter.userStatus) || "").trim();
      const newRole = String((e && e.parameter && e.parameter.userRole) || "").trim();
      const newPermissions = (e && e.parameter && e.parameter.permissions) || "";

      const values = uSheet.getDataRange().getValues();
      for (let i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === empId) {
          if (newStatus) uSheet.getRange(i + 1, 6).setValue(newStatus);
          if (newRole) uSheet.getRange(i + 1, 5).setValue(newRole);
          if (newPermissions) uSheet.getRange(i + 1, 9).setValue(permissionsJson(newPermissions, newRole || values[i][4]));
          SpreadsheetApp.flush();
          return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "User not found" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Admin "add / approve user": create the row in the Users sheet, or update
    // name/department/status when the employee already exists.
    if (action === "upsertUser") {
      const result = upsertUserRecord_(ss, e && e.parameter ? e.parameter : {});
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle REWORK submission via GET (fallback used by the static web app).
    if (action === "submitReworkReport") {
      let reworkPayload = {};
      if (e && e.parameter && e.parameter.payload) {
        try { reworkPayload = JSON.parse(e.parameter.payload); } catch (parseErr) {}
      } else {
        reworkPayload = e && e.parameter ? e.parameter : {};
      }
      const result = appendReworkReport_(ss, reworkPayload);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitReworkReport", duplicate: !!result.duplicate, rows: result.rows || 0 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle SCREEN submission via GET (fallback used by the static web app).
    if (action === "submitScreenReport") {
      let screenPayload = {};
      if (e && e.parameter && e.parameter.payload) {
        try { screenPayload = JSON.parse(e.parameter.payload); } catch (parseErr) {}
      } else {
        screenPayload = e && e.parameter ? e.parameter : {};
      }
      const result = appendScreenReport_(ss, screenPayload);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitScreenReport", duplicate: !!result.duplicate, rows: result.rows || 0 })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle submitDailyReport via GET (fallback)
    if (action === "submitDailyReport") {
      const TARGET_SHEET_NAME = "outputdiary" + QC_PENDING_SUFFIX;
      let prodSheet = ss.getSheetByName(TARGET_SHEET_NAME);
      if (!prodSheet) {
        prodSheet = ss.insertSheet(TARGET_SHEET_NAME);
      }
      if (prodSheet.getLastRow() === 0) {
        prodSheet.appendRow([
          "Timestamp", "Date", "Shift", "Recorder", "Checker", 
          "Downtime_Burner", "Downtime_Wash", "Downtime_Oven_Etc", "Downtime_Note", 
          "Model", "TimeSlot", "ProdQty", "Dent", "ColorDrop", "ThinPaint", "ThickPaint", "WaterStain", "OtherDefect", "TotalDefect", DAILY_REPORT_ID_HEADER, DAILY_REPORT_COLOR_HEADER, DAILY_REPORT_PRODUCT_GROUP_HEADER, DAILY_REPORT_PART_CATEGORY_HEADER, DAILY_REPORT_COLOR_CODE_HEADER, DAILY_REPORT_DUST_HEADER, DAILY_REPORT_OIL_HEADER, DAILY_REPORT_RUST_HEADER
        ]);
      }

      let payloadData = {};
      if (e && e.parameter && e.parameter.payload) {
        try { payloadData = JSON.parse(e.parameter.payload); } catch(pErr){}
      } else {
        payloadData = e.parameter || {};
      }

      const submissionId = String(payloadData.submissionId || "").trim();
      const submissionIdColumn = ensureDailyReportIdColumn(prodSheet);
      ensureDailyReportColorColumn(prodSheet);
      ensureDailyReportCatalogColumns(prodSheet);
      if (hasDailyReportSubmission(prodSheet, submissionId, submissionIdColumn)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitDailyReport", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }

      const now = new Date();
      const dateVal = payloadData.date || formatDateStr(now, false);
      const shiftVal = payloadData.shift || "";
      const recorderVal = payloadData.recorder || "";
      const checkerVal = payloadData.checker || "";

      const dt = payloadData.downtime || {};
      const burner = dt.burner || 0;
      const wash = dt.wash || 0;
      const ovenEtc = (dt.oven||0) + (dt.gun||0) + (dt.power||0) + (dt.motor||0) + (dt.other||0);
      const dtNote = dt.note || "";

      let recs = payloadData.records;
      if (!recs && e.parameter.model) {
        recs = [{
          model: e.parameter.model,
          timeSlot: e.parameter.timeSlot || "08:00 - 09:00",
          prodQty: Number(e.parameter.prodQty) || 0,
          dent: Number(e.parameter.dent) || 0,
          colorDrop: Number(e.parameter.colorDrop) || 0,
          thinPaint: Number(e.parameter.thinPaint) || 0,
          thickPaint: Number(e.parameter.thickPaint) || 0,
          waterStain: Number(e.parameter.waterStain) || 0,
          oil: Number(e.parameter.oil) || 0,
          rust: Number(e.parameter.rust) || 0,
          dust: Number(e.parameter.dust) || 0,
          otherDefect: Number(e.parameter.otherDefect) || 0,
          totalDefect: Number(e.parameter.totalDefect) || 0,
          color: e.parameter.color || "",
          productGroup: e.parameter.productGroup || "",
          partCategory: e.parameter.partCategory || "",
          colorCode: e.parameter.colorCode || ""
        }];
      }

      if (recs && Array.isArray(recs)) {
        recs.forEach(r => {
          prodSheet.appendRow([
            now, dateVal, shiftVal, recorderVal, checkerVal,
            burner, wash, ovenEtc, dtNote,
            r.model, r.timeSlot, r.prodQty,
             r.dent, r.colorDrop, r.thinPaint, r.thickPaint, r.waterStain, r.otherDefect, r.totalDefect, submissionId, r.color || "", r.productGroup || "", r.partCategory || "", r.colorCode || "", r.dust || 0, r.oil || 0, r.rust || 0
          ]);
        });
      }

      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitDailyReport" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle parameter checklist submission via GET fallback
    if (action === "submitParameterChecklist") {
      let payload = {};
      if (e && e.parameter && e.parameter.payload) {
        try { payload = JSON.parse(e.parameter.payload); } catch (parseErr) {}
      } else {
        payload = e.parameter || {};
      }

      const checklistType = String(payload.checklistType || "full").toLowerCase() === "water" ? "water" : "full";
      const checklistSheet = ensureParameterChecklistSheet(ss, checklistType);

      const submissionId = String(payload.submissionId || "").trim();
      if (hasParameterChecklistSubmission(checklistSheet, submissionId)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitParameterChecklist", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }

      const now = new Date();
      const timeVal = checklistType === "water" ? String(payload.time || "") : "";
      const records = Array.isArray(payload.records) ? payload.records : [];
      records.forEach(item => {
        const row = [
          now,
          String(payload.date || formatDateStr(now, false)),
          String(payload.operator || ""),
          String(payload.teamLeader || ""),
          Number(item.itemNo) || 0,
          String(item.process || ""),
          String(item.checkItem || ""),
          String(item.standard || ""),
          String(item.actualValue || ""),
          String(item.status || ""),
          String(item.note || ""),
          submissionId,
          checklistType
        ];
        if (checklistType === "water") row.push(timeVal);
        checklistSheet.appendRow(row);
      });
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitParameterChecklist" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle equipment checklist submission via GET fallback
    if (action === "submitEquipmentChecklist") {
      let payload = {};
      if (e && e.parameter && e.parameter.payload) {
        try { payload = JSON.parse(e.parameter.payload); } catch (parseErr) {}
      } else {
        payload = e.parameter || {};
      }

      const checklistSheet = ensureEquipmentChecklistSheet(ss);
      const submissionId = String(payload.submissionId || "").trim();
      if (hasEquipmentChecklistSubmission(checklistSheet, submissionId)) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitEquipmentChecklist", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
      }

      const now = new Date();
      const records = Array.isArray(payload.records) ? payload.records : [];
      records.forEach(item => {
        checklistSheet.appendRow([
          now,
          String(payload.date || formatDateStr(now, false)),
          String(payload.operator || ""),
          String(payload.teamLeader || ""),
          Number(item.itemNo) || 0,
          String(item.checkItem || ""),
          String(item.method || ""),
          String(item.standard || ""),
          String(item.imageUrl || ""),
          String(item.status || ""),
          String(item.note || ""),
          submissionId
        ]);
      });
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "submitEquipmentChecklist" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle REWORK history. Opening the menu creates the dedicated sheet
    // without touching outputdiary.
    if (action === "getReworkReportData") {
      const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const suffix = qcReadSuffix_(e);
      if (suffix === QC_PENDING_SUFFIX) ensureReworkReportSheet_(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: readReworkReports_(ss, requestedDate, suffix) })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle SCREEN history. Opening the menu creates SCREEN on demand.
    if (action === "getScreenReportData") {
      const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const suffix = qcReadSuffix_(e);
      if (suffix === QC_PENDING_SUFFIX) ensureScreenReportSheet_(ss);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: readScreenReports_(ss, requestedDate, suffix) })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle getDailyReportData action (current outputdiary_Pending tab only)
    if (action === "getDailyReportData") {
      let prodSheet = ss.getSheetByName("outputdiary" + qcReadSuffix_(e));
      if (!prodSheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      }

      const recent = readRecentDataRows_(prodSheet, REPORT_READ_MAX_ROWS);
      const values = recent.values;
      const headers = prodSheet.getRange(1, 1, 1, Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, prodSheet.getLastColumn()))).getDisplayValues()[0].map(String);
      if (!values || values.length === 0) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      }

      const data = values.map(r => ({
        timestamp: formatDateStr(qcCell_(r, headers, "Timestamp", 0), true),
        date: formatDateStr(qcCell_(r, headers, "Date", 1), false),
        shift: String(qcCell_(r, headers, "Shift", 2) || ""),
        recorder: String(qcCell_(r, headers, "Recorder", 3) || ""),
        checker: String(qcCell_(r, headers, "Checker", 4) || ""),
        downtimeBurner: Number(qcCell_(r, headers, "Downtime_Burner", 5)) || 0,
        downtimeWash: Number(qcCell_(r, headers, "Downtime_Wash", 6)) || 0,
        downtimeOvenEtc: Number(qcCell_(r, headers, "Downtime_Oven_Etc", 7)) || 0,
        downtimeNote: String(qcCell_(r, headers, "Downtime_Note", 8) || ""),
        model: String(qcCell_(r, headers, "Model", 9) || ""),
        timeSlot: String(qcCell_(r, headers, "TimeSlot", 10) || ""),
        prodQty: Number(qcCell_(r, headers, "ProdQty", 11)) || 0,
        dent: Number(qcCell_(r, headers, "Dent", 12)) || 0,
        colorDrop: Number(qcCell_(r, headers, "ColorDrop", 13)) || 0,
        thinPaint: Number(qcCell_(r, headers, "ThinPaint", 14)) || 0,
        thickPaint: Number(qcCell_(r, headers, "ThickPaint", 15)) || 0,
        waterStain: Number(qcCell_(r, headers, "WaterStain", 16)) || 0,
        otherDefect: Number(qcCell_(r, headers, "OtherDefect", 17)) || 0,
        totalDefect: Number(qcCell_(r, headers, "TotalDefect", 18)) || 0,
        submissionId: String(qcCell_(r, headers, DAILY_REPORT_ID_HEADER, 19) || ""),
        color: String(qcCell_(r, headers, DAILY_REPORT_COLOR_HEADER, 20) || ""),
        productGroup: String(qcCell_(r, headers, DAILY_REPORT_PRODUCT_GROUP_HEADER, 21) || ""),
        partCategory: String(qcCell_(r, headers, DAILY_REPORT_PART_CATEGORY_HEADER, 22) || ""),
        colorCode: String(qcCell_(r, headers, DAILY_REPORT_COLOR_CODE_HEADER, 23) || ""),
        dust: Number(qcCell_(r, headers, DAILY_REPORT_DUST_HEADER, 24)) || 0,
        oil: Number(qcCell_(r, headers, DAILY_REPORT_OIL_HEADER, 25)) || 0,
        rust: Number(qcCell_(r, headers, DAILY_REPORT_RUST_HEADER, 26)) || 0
      }));

      const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const filteredData = requestedDate
        ? data.filter(r => String(r.date || "").substring(0, 10) === requestedDate)
        : data;

      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: filteredData })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle parameter checklist history and create its sheet on first access
    if (action === "getParameterChecklistData") {
      const requestedType = String((e && e.parameter && e.parameter.type) || "full").toLowerCase() === "water" ? "water" : "full";
      const checklistName = requestedType === "water" ? WATER_PARAMETER_CHECKLIST_SHEET_NAME : PARAMETER_CHECKLIST_SHEET_NAME;
      const checklistSheet = ss.getSheetByName(checklistName + qcReadSuffix_(e));
      if (!checklistSheet) return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      if (checklistSheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      }

      const recent = readRecentDataRows_(checklistSheet, REPORT_READ_MAX_ROWS);
      const values = recent.values;
      const headers = checklistSheet.getRange(1, 1, 1, Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, checklistSheet.getLastColumn()))).getDisplayValues()[0].map(String);
      const data = values.map((r, i) => ({
        rowIndex: recent.firstRow + i,
        timestamp: formatDateStr(qcCell_(r, headers, "Timestamp", 0), true),
        date: formatDateStr(qcCell_(r, headers, "Date", 1), false),
        operator: String(qcCell_(r, headers, "Operator", 2) || ""),
        teamLeader: String(qcCell_(r, headers, "TeamLeader", 3) || ""),
        itemNo: Number(qcCell_(r, headers, "ItemNo", 4)) || 0,
        process: String(qcCell_(r, headers, "Process", 5) || ""),
        checkItem: String(qcCell_(r, headers, "CheckItem", 6) || ""),
        standard: String(qcCell_(r, headers, "Standard", 7) || ""),
        actualValue: String(qcCell_(r, headers, "ActualValue", 8) || ""),
        status: String(qcCell_(r, headers, "Status", 9) || ""),
        note: String(qcCell_(r, headers, "Note", 10) || ""),
        submissionId: String(qcCell_(r, headers, PARAMETER_CHECKLIST_ID_HEADER, 11) || ""),
        checklistType: String(qcCell_(r, headers, "ChecklistType", 12) || requestedType),
        time: requestedType === "water" ? String(qcCell_(r, headers, "Time", 13) || "") : ""
      }));

      const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const filteredData = requestedDate
        ? data.filter(r => String(r.date || "").substring(0, 10) === requestedDate)
        : data;
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: filteredData })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle equipment checklist history and create its sheet on first access
    if (action === "getEquipmentChecklistData") {
      const checklistSheet = ss.getSheetByName(EQUIPMENT_CHECKLIST_SHEET_NAME + qcReadSuffix_(e));
      if (!checklistSheet) return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      if (checklistSheet.getLastRow() <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      }

      const recent = readRecentDataRows_(checklistSheet, REPORT_READ_MAX_ROWS);
      const values = recent.values;
      const headers = checklistSheet.getRange(1, 1, 1, Math.min(REPORT_READ_MAX_COLUMNS, Math.max(1, checklistSheet.getLastColumn()))).getDisplayValues()[0].map(String);
      const data = values.map((r, i) => ({
        rowIndex: recent.firstRow + i,
        timestamp: formatDateStr(qcCell_(r, headers, "Timestamp", 0), true),
        date: formatDateStr(qcCell_(r, headers, "Date", 1), false),
        operator: String(qcCell_(r, headers, "Operator", 2) || ""),
        teamLeader: String(qcCell_(r, headers, "TeamLeader", 3) || ""),
        itemNo: Number(qcCell_(r, headers, "ItemNo", 4)) || 0,
        checkItem: String(qcCell_(r, headers, "CheckItem", 5) || ""),
        method: String(qcCell_(r, headers, "Method", 6) || ""),
        standard: String(qcCell_(r, headers, "Standard", 7) || ""),
        imageUrl: String(qcCell_(r, headers, "ImageUrl", 8) || ""),
        status: String(qcCell_(r, headers, "Status", 9) || ""),
        note: String(qcCell_(r, headers, "Note", 10) || ""),
        submissionId: String(qcCell_(r, headers, PARAMETER_CHECKLIST_ID_HEADER, 11) || "")
      }));

      const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const filteredData = requestedDate
        ? data.filter(r => String(r.date || "").substring(0, 10) === requestedDate)
        : data;
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: filteredData })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle getPartModels action. Keep the legacy PartModel sheet untouched;
    // the related catalog is stored in a dedicated PartModelCatalog sheet.
    // Line %Eff: standard time per part (Capacity) and the shift's time slots
    // (LineTimeSlots). Both sheets are maintained by hand in the spreadsheet.
    if (action === "getLineCapacity") {
      const capacitySheet = ss.getSheetByName("Capacity");
      const slotSheet = ss.getSheetByName("LineTimeSlots");
      const readRows = sheet => {
        if (!sheet || sheet.getLastRow() < 2) return [];
        const values = sheet.getRange(1, 1, sheet.getLastRow(), sheet.getLastColumn()).getValues();
        const headers = values[0].map(h => String(h).trim());
        return values.slice(1)
          .filter(row => String(row[0]).trim() !== "")
          .map(row => {
            const item = {};
            headers.forEach((h, i) => { if (h) item[h] = row[i]; });
            return item;
          });
      };
      const capacity = readRows(capacitySheet).map(r => ({
        partCode: String(r.PartCode).trim(),
        partName: String(r.PartName || ""),
        productGroup: String(r.ProductGroup || ""),
        qtyPerJig: Number(r.QtyPerJig) || 0,
        pitch: Number(r.Pitch_m) || 0,
        lineSpeed: Number(r.LineSpeed_m_min) || 0,
        stdSec: Number(r.StdSecPerPcs) || 0,
        // Codes the web app records for this part when they differ from the
        // part number in the capacity file (comma separated).
        appCodes: String(r.AppCodes || "").split(",").map(c => c.trim()).filter(Boolean)
      }));
      const slots = readRows(slotSheet).map(r => ({
        timeSlot: String(r.TimeSlot).trim(),
        minutes: Number(r.Minutes) || 0,
        type: String(r.Type || "Normal")
      }));
      return ContentService.createTextOutput(JSON.stringify({ status: "success", capacity, slots })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "getPartModels") {
      const catalogSheet = ensurePartModelCatalogSheet_(ss);
      const catalog = readPartModelCatalog_(catalogSheet);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", source: "sheet", groups: catalog.groups, order: catalog.order })).setMimeType(ContentService.MimeType.JSON);
    }

    // "➕ เพิ่มรายการ" in the production form: store the new category/model in
    // PartModelCatalog so every device sees it, not just the browser that added it.
    if (action === "addCatalogEntry") {
      const p = (e && e.parameter) || {};
      const group = String(p.group || "").trim();
      const category = String(p.category || "").trim();
      const code = String(p.code || "").trim();
      const name = String(p.name || "").trim();
      if (!group || !category) {
        return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "ต้องระบุกลุ่มผลิตภัณฑ์และประเภทชิ้นงาน" })).setMimeType(ContentService.MimeType.JSON);
      }
      const catalogSheet = ensurePartModelCatalogSheet_(ss);
      const lock = LockService.getScriptLock();
      lock.waitLock(10000);
      try {
        const catalog = readPartModelCatalog_(catalogSheet);
        const models = ((catalog.groups[group] || {}).categories || {})[category];
        const value = code || name;
        if (models && (!value ? true : models.some(m => String(m.value).toLowerCase() === value.toLowerCase()))) {
          return ContentService.createTextOutput(JSON.stringify({ status: "success", duplicate: true })).setMimeType(ContentService.MimeType.JSON);
        }
        const color = ((catalog.groups[group] || {}).colors || [])[0] || {};
        const label = value ? (code && name ? name + " (" + code + ")" : value) : "";
        catalogSheet.appendRow([group, category, value, label, color.value || "", color.code || ""]);
        SpreadsheetApp.flush();
      } finally {
        lock.releaseLock();
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle getRecorders action (Cloud Sync)
    if (action === "getRecorders") {
      let recSheet = ss.getSheetByName("Recorders");
      if (!recSheet) {
        recSheet = ss.insertSheet("Recorders");
        recSheet.appendRow(["Name"]);
      }

      // Remove only the old sample names from the Recorders sheet. Other sheets are untouched.
      const mockRecorders = ["สมชาย ใจดี", "วิชัย มีสุข", "สมศักดิ์ ขยันงาน", "อนันต์ ราบรื่น", "ประเสริฐ ดีเยี่ยม"];
      const valuesBeforeCleanup = recSheet.getDataRange().getValues();
      for (let i = valuesBeforeCleanup.length - 1; i >= 1; i--) {
        const name = String(valuesBeforeCleanup[i][0] || "").trim();
        if (mockRecorders.indexOf(name) >= 0) recSheet.deleteRow(i + 1);
      }

      const values = recSheet.getDataRange().getValues();
      const list = [];
      for (let i = 1; i < values.length; i++) {
        if (values[i][0]) {
          list.push(String(values[i][0]).trim());
        }
      }

      return ContentService.createTextOutput(JSON.stringify({ status: "success", recorders: list })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle addRecorder action via GET fallback
    if (action === "addRecorder") {
      let recSheet = ss.getSheetByName("Recorders");
      if (!recSheet) {
        recSheet = ss.insertSheet("Recorders");
        recSheet.appendRow(["Name"]);
      }
      const newName = String((e && e.parameter && e.parameter.name) || "").trim();
      if (newName) {
        const values = recSheet.getDataRange().getValues();
        let exists = false;
        for (let i = 1; i < values.length; i++) {
          if (String(values[i][0]).trim() === newName) {
            exists = true;
            break;
          }
        }
        if (!exists) {
          recSheet.appendRow([newName]);
          SpreadsheetApp.flush();
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", name: newName })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle deleteRecorder action via GET fallback
    if (action === "deleteRecorder") {
      let recSheet = ss.getSheetByName("Recorders");
      if (recSheet) {
        const targetName = String((e && e.parameter && e.parameter.name) || "").trim();
        if (targetName) {
          const values = recSheet.getDataRange().getValues();
          for (let i = 1; i < values.length; i++) {
            if (String(values[i][0]).trim() === targetName) {
              recSheet.deleteRow(i + 1);
              SpreadsheetApp.flush();
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle 5M1E Events (getEvents)
    if (action === "getEvents" || (e && e.parameter && e.parameter.sheet === "events") || (e && e.parameter && e.parameter.sheet === "5M1E_Events")) {
      let evtSheet = getOrCreateEventsSheet(ss);

      const values = evtSheet.getDataRange().getValues();
      if (!values || values.length <= 1) {
        return ContentService.createTextOutput(JSON.stringify({ status: "success", data: [] })).setMimeType(ContentService.MimeType.JSON);
      }

      const header = values.shift();
      const eventsData = values.map((r, i) => ({
        rowIndex: i + 2,
        date: formatDateStr(r[0], false),
        time: String(r[1] || ""),
        shift: String(r[2] || "กะเช้า"),
        category: String(r[3] || "Machine"),
        process: String(r[4] || ""),
        title: String(r[5] || ""),
        detail: String(r[6] || ""),
        action: String(r[7] || ""),
        recorder: String(r[8] || ""),
        timestamp: formatDateStr(r[9] || r[0], true),
        id: String(r[10] || ("evt_" + (i + 1))),
        quantity: Number(r[11]) || 0
      }));

      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: eventsData })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle createEvent action via GET/POST fallback
    if (action === "createEvent") {
      let evtSheet = getOrCreateEventsSheet(ss);
      const eDate = String((e && e.parameter && e.parameter.date) || "").trim();
      const eTime = String((e && e.parameter && e.parameter.time) || "").trim();
      const eShift = String((e && e.parameter && e.parameter.shift) || "กะเช้า").trim();
      const eCat = String((e && e.parameter && e.parameter.category) || "Machine").trim();
      const eProc = String((e && e.parameter && e.parameter.process) || "").trim();
      const eTitle = String((e && e.parameter && e.parameter.title) || "").trim();
      const eDetail = String((e && e.parameter && e.parameter.detail) || "").trim();
      const eAct = String((e && e.parameter && e.parameter.actionTaken) || (e && e.parameter && e.parameter.action) || "").trim();
      const eRec = String((e && e.parameter && e.parameter.recorder) || "").trim();
      const eQuantity = Math.max(0, Number((e && e.parameter && e.parameter.quantity) || 0) || 0);
      const eId = "evt_" + new Date().getTime();
      const nowStr = formatDateStr(new Date(), true);

      evtSheet.appendRow([eDate, eTime, eShift, eCat, eProc, eTitle, eDetail, eAct, eRec, nowStr, eId, eQuantity]);
      SpreadsheetApp.flush();

      return ContentService.createTextOutput(JSON.stringify({ status: "success", id: eId })).setMimeType(ContentService.MimeType.JSON);
    }

    // Handle deleteEvent action via GET/POST fallback
    if (action === "deleteEvent") {
      let evtSheet = getOrCreateEventsSheet(ss);
      if (evtSheet) {
        const targetId = String((e && e.parameter && e.parameter.id) || "").trim();
        const targetRow = Number((e && e.parameter && e.parameter.rowIndex) || 0);
        if (targetRow && targetRow >= 2 && targetRow <= evtSheet.getLastRow()) {
          evtSheet.deleteRow(targetRow);
          SpreadsheetApp.flush();
        } else if (targetId) {
          const values = evtSheet.getDataRange().getValues();
          for (let i = 1; i < values.length; i++) {
            if (String(values[i][10]).trim() === targetId || String(values[i][5]).trim() === targetId) {
              evtSheet.deleteRow(i + 1);
              SpreadsheetApp.flush();
              break;
            }
          }
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success" })).setMimeType(ContentService.MimeType.JSON);
    }

    // Spare parts inventory reads and writes. The static frontend uses GET so
    // the same endpoint works reliably from GitHub Pages without a CORS preflight.
    if (action === "getSpareParts") {
      const inventory = readSparePartsInventory_(ss);
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        parts: inventory.parts,
        transactions: inventory.transactions.slice(0, 100)
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "saveSparePart") {
      return ContentService.createTextOutput(JSON.stringify(saveSparePartRecord_(ss, e && e.parameter ? e.parameter : {}))).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "recordSparePartTransaction") {
      return ContentService.createTextOutput(JSON.stringify(recordSparePartTransaction_(ss, e && e.parameter ? e.parameter : {}))).setMimeType(ContentService.MimeType.JSON);
    }

    // Inspection writes are sent as GET by the web client for Apps Script CORS compatibility.
    let sheet = ensureInspectionSheet_(ss);
    if (action === "create") {
      sheet = ensureInspectionSheet_(ss);
      const dateVal = String((e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true));
      const rustVal = Number((e && e.parameter && e.parameter.rust) || 0) || 0;
      const dentVal = Number((e && e.parameter && e.parameter.dent) || 0) || 0;
      const weldVal = Number((e && e.parameter && e.parameter.weld) || 0) || 0;
      const chemicalVal = Number((e && e.parameter && e.parameter.chemical) || 0) || 0;
      const oilVal = Number((e && e.parameter && e.parameter.oil) || 0) || 0;
      const noteVal = String((e && e.parameter && e.parameter.note) || "");
      const workTypeVal = String((e && e.parameter && e.parameter.workType) || "");
      sheet.appendRow(inspectionRowValues_(sheet, {
        date: dateVal,
        workType: workTypeVal,
        rust: rustVal,
        dent: dentVal,
        weld: weldVal,
        chemical: chemicalVal,
        oil: oilVal,
        note: noteVal
      }));
      SpreadsheetApp.flush();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "create" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update") {
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "update", message: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      const dateVal = String((e && e.parameter && e.parameter.date) || formatDateStr(new Date(), true));
      const rustVal = Number((e && e.parameter && e.parameter.rust) || 0) || 0;
      const dentVal = Number((e && e.parameter && e.parameter.dent) || 0) || 0;
      const weldVal = Number((e && e.parameter && e.parameter.weld) || 0) || 0;
      const chemicalVal = Number((e && e.parameter && e.parameter.chemical) || 0) || 0;
      const oilVal = Number((e && e.parameter && e.parameter.oil) || 0) || 0;
      const noteVal = String((e && e.parameter && e.parameter.note) || "");
      const workTypeVal = String((e && e.parameter && e.parameter.workType) || "");
      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || 0);
      const originalDate = String((e && e.parameter && e.parameter.originalDate) || dateVal);
      const values = sheet.getDataRange().getValues();
      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          if (rowDateStr === originalDate || rowDateStr === dateVal) { targetRowIndex = i + 1; break; }
        }
      }
      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.getRange(targetRowIndex, 1, 1, sheet.getLastColumn()).setValues([inspectionRowValues_(sheet, {
          date: dateVal,
          workType: workTypeVal,
          rust: rustVal,
          dent: dentVal,
          weld: weldVal,
          chemical: chemicalVal,
          oil: oilVal,
          note: noteVal
        }, values[targetRowIndex - 1])]);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "update", updatedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "update", message: "Row not found for update" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "delete") {
      if (!sheet) return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "delete", message: "Sheet not found" })).setMimeType(ContentService.MimeType.JSON);
      const values = sheet.getDataRange().getValues();
      let targetRowIndex = Number((e && e.parameter && e.parameter.rowIndex) || 0);
      const searchDate = String((e && e.parameter && e.parameter.date) || "");
      const searchNote = String((e && e.parameter && e.parameter.note) || "");
      if (!targetRowIndex || targetRowIndex < 2 || targetRowIndex > values.length) {
        for (let i = 1; i < values.length; i++) {
          const rowDateStr = formatDateStr(values[i][0], true);
          const rowNoteStr = String(values[i][6] || "");
          if ((searchDate && rowDateStr === searchDate) || (searchNote && rowNoteStr === searchNote)) { targetRowIndex = i + 1; break; }
        }
      }
      if (targetRowIndex && targetRowIndex >= 2 && targetRowIndex <= sheet.getLastRow()) {
        sheet.deleteRow(targetRowIndex);
        SpreadsheetApp.flush();
        return ContentService.createTextOutput(JSON.stringify({ status: "success", action: "delete", deletedRow: targetRowIndex })).setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "error", action: "delete", message: "Row not found for deletion" })).setMimeType(ContentService.MimeType.JSON);
    }

    if (!sheet) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const values = sheet.getDataRange().getValues();

    if (!values || values.length <= 1) {
      return ContentService
        .createTextOutput(JSON.stringify([]))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const header = values.shift().map(String);

    const result = values.map((r, i) => ({
      rowIndex: i + 2,
      date: formatDateStr(qcCell_(r, header, "Date", 0), true),
      workType: normalizeInspectionWorkType_(qcCell_(r, header, INSPECTION_WORK_TYPE_HEADER, -1)),
      rust: Number(qcCell_(r, header, "Rust", 1)) || 0,
      dent: Number(qcCell_(r, header, "Dent", 2)) || 0,
      weld: Number(qcCell_(r, header, "Weld", 3)) || 0,
      chemical: Number(qcCell_(r, header, "Chemical", 4)) || 0,
      oil: Number(qcCell_(r, header, "Oil", 5)) || 0,
      note: qcCell_(r, header, "Note", 6) || "",
      timestamp: formatDateStr(qcCell_(r, header, "Timestamp", 7) || qcCell_(r, header, "Date", 0), true)
    }));

    const requestedDate = String((e && e.parameter && e.parameter.date) || "").trim();
    const filteredResult = requestedDate
      ? result.filter(r => String(r.date || r.timestamp || "").substring(0, 10) === requestedDate)
      : result;

    return ContentService
      .createTextOutput(JSON.stringify(filteredResult))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({
        status: "error",
        message: err.toString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateEventsSheet(ss) {
  let evtSheet = ss.getSheetByName("5M1E_Events") || ss.getSheetByName("events");
  if (!evtSheet) {
    evtSheet = ss.insertSheet("5M1E_Events");
    evtSheet.appendRow(["Date", "Time", "Shift", "Category", "Process", "Title", "Detail", "Action", "Recorder", "Timestamp", "ID", "Quantity"]);
    SpreadsheetApp.flush();
  } else if (evtSheet.getName() === "events" && !ss.getSheetByName("5M1E_Events")) {
    try {
      evtSheet.setName("5M1E_Events");
    } catch(e) {}
  }
  const lastColumn = Math.max(1, evtSheet.getLastColumn());
  const headers = evtSheet.getRange(1, 1, 1, lastColumn).getValues()[0].map(String);
  if (headers.indexOf("Quantity") < 0) {
    evtSheet.getRange(1, lastColumn + 1).setValue("Quantity");
  }
  return evtSheet;
}
