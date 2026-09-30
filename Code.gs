// ── ATOURE CRM — Google Apps Script Backend ──
// Deploy as: Extensions > Apps Script > Deploy > New deployment > Web app
// Execute as: Me | Who has access: Anyone
//
// Sheet used: "Contacts" — main contact data (auto-created on first save)

var CONTACTS_SHEET = 'Contacts';

var CONTACT_COLS = [
  'id', 'name', 'firstName', 'lastName', 'company', 'sector', 'phone', 'email',
  'profile', 'listType', 'city', 'message',
  'companyScore', 'personScore', 'combinedScore',
  'priority', 'status', 'notes', 'followUpDate', 'tags',
  'createdAt', 'updatedAt'
];

// ── GET (browser test) ───────────────────────────────────────────────────────
function doGet(e) {
  var result;
  try {
    var sheet = getOrCreateSheet(CONTACTS_SHEET);
    var data  = sheet.getDataRange().getValues();
    var rowCount = Math.max(0, data.length - 1);
    var headers  = data.length > 0 ? data[0] : [];
    var firstRow = data.length > 1 ? data[1] : [];
    result = {
      ok: true,
      spreadsheet: SpreadsheetApp.getActiveSpreadsheet().getName(),
      sheet: CONTACTS_SHEET,
      rowCount: rowCount,
      headers: headers,
      firstRow: firstRow
    };
  } catch (err) {
    result = { ok: false, error: err.message };
  }
  return ContentService
    .createTextOutput(JSON.stringify(result, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── POST (main API) ──────────────────────────────────────────────────────────
function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var action = body.action;

    if      (action === 'getAll')   result = getAll();
    else if (action === 'save')     result = save(body.record);
    else if (action === 'delete')   result = deleteRecord(body.id);
    else if (action === 'bulkInit') result = bulkInit(body.records);
    else                            result = { ok: false, error: 'Unknown action: ' + action };
  } catch (err) {
    result = { ok: false, error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── GET ALL ──────────────────────────────────────────────────────────────────
function getAll() {
  var sheet = getOrCreateSheet(CONTACTS_SHEET);
  var data  = sheet.getDataRange().getValues();
  if (data.length < 2) return { ok: true, data: [] };

  var headers = data[0].map(String);
  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    if (row.every(function(c){ return c === '' || c === null; })) continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) {
      obj[headers[j]] = row[j] !== undefined ? row[j] : '';
    }
    rows.push(obj);
  }
  return { ok: true, data: rows };
}

// ── SAVE (upsert by id) ──────────────────────────────────────────────────────
function save(record) {
  if (!record) return { ok: false, error: 'No record provided' };
  var sheet   = getOrCreateSheet(CONTACTS_SHEET);
  var headers = ensureHeaders(sheet, CONTACT_COLS);
  var idCol   = headers.indexOf('id');

  var data   = sheet.getDataRange().getValues();
  var rowIdx = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idCol]) === String(record.id)) { rowIdx = i + 1; break; }
  }

  var values = headers.map(function(col){ return record[col] !== undefined ? record[col] : ''; });

  if (rowIdx > 0) {
    sheet.getRange(rowIdx, 1, 1, values.length).setValues([values]);
  } else {
    sheet.appendRow(values);
  }
  return { ok: true };
}

// ── DELETE ───────────────────────────────────────────────────────────────────
function deleteRecord(id) {
  if (!id) return { ok: false, error: 'No id provided' };
  var sheet   = getOrCreateSheet(CONTACTS_SHEET);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(String);
  var idIdx   = headers.indexOf('id');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][idIdx]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'Record not found' };
}

// ── BULK INIT ────────────────────────────────────────────────────────────────
function bulkInit(records) {
  if (!records || !records.length) return { ok: false, error: 'No records provided' };
  var sheet = getOrCreateSheet(CONTACTS_SHEET);
  sheet.clearContents();

  var header = [CONTACT_COLS];
  var rows   = records.map(function(r){
    return CONTACT_COLS.map(function(col){ return r[col] !== undefined ? r[col] : ''; });
  });

  sheet.getRange(1, 1, 1, CONTACT_COLS.length).setValues(header);
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, CONTACT_COLS.length).setValues(rows);
  }
  return { ok: true };
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function getOrCreateSheet(name) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function ensureHeaders(sheet, cols) {
  var existing = sheet.getLastRow() > 0
    ? sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String)
    : [];

  if (existing.length === 0 || existing[0] === '') {
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    return cols;
  }
  return existing;
}
