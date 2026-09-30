const S_SHEET_URL = 'atoure_crm_sheets_url';

export function getSheetsUrl() {
  return (localStorage.getItem(S_SHEET_URL) || '').trim();
}

export function setSheetsUrl(url) {
  if (url) localStorage.setItem(S_SHEET_URL, url.trim());
  else localStorage.removeItem(S_SHEET_URL);
}

export function isSheetConnected() {
  return !!getSheetsUrl();
}

async function sheetsPost(body) {
  const url = getSheetsUrl();
  if (!url) throw new Error('No Google Sheet connected');
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 20000);
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'text/plain' },
      signal: ctrl.signal,
    });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === 'AbortError') throw new Error('Request timed out — check the Apps Script deployment');
    throw new Error('Cannot reach the Apps Script: ' + e.message);
  }
  clearTimeout(timeoutId);
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { throw new Error('Sheet returned a non-JSON response: ' + text.slice(0, 100)); }
}

function toRow(contact) {
  return { ...contact, tags: JSON.stringify(Array.isArray(contact.tags) ? contact.tags : []) };
}

function fromRow(row) {
  let tags = [];
  try { tags = JSON.parse(row.tags || '[]'); } catch { tags = []; }
  return { ...row, id: Number(row.id), tags: Array.isArray(tags) ? tags : [] };
}

export async function pullContactsFromSheet() {
  if (!isSheetConnected()) return null;
  const r = await sheetsPost({ action: 'getAll' });
  if (!r.ok) throw new Error(r.error || 'Sync failed');
  return (r.data || []).map(fromRow);
}

export function pushContactToSheet(contact) {
  if (!isSheetConnected()) return;
  sheetsPost({ action: 'save', record: toRow(contact) }).catch(e => console.error('Sheet sync (save) failed:', e));
}

export function deleteContactFromSheet(id) {
  if (!isSheetConnected()) return;
  sheetsPost({ action: 'delete', id }).catch(e => console.error('Sheet sync (delete) failed:', e));
}

export async function pushAllContactsToSheet(contacts) {
  if (!isSheetConnected()) return;
  const r = await sheetsPost({ action: 'bulkInit', records: contacts.map(toRow) });
  if (!r.ok) throw new Error(r.error || 'Upload failed');
}
