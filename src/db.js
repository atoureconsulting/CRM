const KEYS = {
  CONTACTS: 'atoure_contacts',
  ACTIVITY: 'atoure_activity',
  NEXT_ID: 'atoure_next_id',
};

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function write(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function nextId() {
  const id = read(KEYS.NEXT_ID, 10000);
  write(KEYS.NEXT_ID, id + 1);
  return id;
}

export function getAllContacts() { return read(KEYS.CONTACTS, []); }
export function saveAllContacts(contacts) { write(KEYS.CONTACTS, contacts); }

export function getContactActivity(contactId) {
  const all = read(KEYS.ACTIVITY, {});
  return (all[String(contactId)] || []).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export function addActivityEntry(contactId, action, detail = '') {
  const all = read(KEYS.ACTIVITY, {});
  const key = String(contactId);
  const entry = { id: Date.now() + Math.random(), contactId, action, detail, timestamp: new Date().toISOString() };
  all[key] = [entry, ...(all[key] || [])];
  write(KEYS.ACTIVITY, all);
  return entry;
}

export function createContact(data) {
  const contacts = getAllContacts();
  const now = new Date().toISOString();
  const contact = {
    id: nextId(),
    name: buildName(data.firstName, data.lastName, data.name),
    firstName: data.firstName || '',
    lastName: data.lastName || '',
    company: data.company || '',
    sector: data.sector || '',
    phone: data.phone || '',
    email: data.email || '',
    profile: data.profile || 'organization',
    city: data.city || '',
    message: data.message || '',
    companyScore: data.companyScore || 0,
    personScore: data.personScore || 0,
    combinedScore: data.combinedScore || 0,
    priority: data.priority || 'Medium',
    status: data.status || 'New',
    notes: data.notes || '',
    followUpDate: data.followUpDate || null,
    tags: Array.isArray(data.tags) ? data.tags : [],
    createdAt: now,
    updatedAt: now,
  };
  contacts.push(contact);
  saveAllContacts(contacts);
  addActivityEntry(contact.id, 'Contact created', '');
  return contact;
}

export function updateContact(id, data) {
  const contacts = getAllContacts();
  const idx = contacts.findIndex(c => c.id === id);
  if (idx === -1) throw new Error('Contact not found');
  const existing = contacts[idx];
  const now = new Date().toISOString();
  const updated = { ...existing, ...data, id, updatedAt: now };
  if (data.name === undefined) updated.name = buildName(data.firstName ?? existing.firstName, data.lastName ?? existing.lastName, existing.name);
  if (!Array.isArray(updated.tags)) updated.tags = existing.tags;
  contacts[idx] = updated;
  saveAllContacts(contacts);
  if (data.status !== undefined && data.status !== existing.status) {
    addActivityEntry(id, `Status changed to ${data.status}`, '');
  }
  if (data.followUpDate !== undefined && data.followUpDate !== existing.followUpDate && data.followUpDate) {
    addActivityEntry(id, `Follow-up set to ${data.followUpDate}`, '');
  }
  return updated;
}

export function deleteContact(id) {
  saveAllContacts(getAllContacts().filter(c => c.id !== id));
}

export function bulkUpdateStatus(ids, status) {
  const contacts = getAllContacts();
  const now = new Date().toISOString();
  const idSet = new Set(ids);
  const updated = contacts.map(c => {
    if (!idSet.has(c.id)) return c;
    addActivityEntry(c.id, `Status changed to ${status}`, '');
    return { ...c, status, updatedAt: now };
  });
  saveAllContacts(updated);
  return ids.length;
}

export function getStats(contacts) {
  const byStatus = { New: 0, Contacted: 0, Partner: 0, Archived: 0 };
  const byPriority = { High: 0, Medium: 0 };
  const bySector = {};
  for (const c of contacts) {
    if (c.status in byStatus) byStatus[c.status]++;
    if (c.priority in byPriority) byPriority[c.priority]++;
    if (c.sector) bySector[c.sector] = (bySector[c.sector] || 0) + 1;
  }
  return { total: contacts.length, byStatus, byPriority, bySector };
}

export function importContacts(dataArray) {
  const existing = getAllContacts();
  const phones = new Set(existing.map(c => c.phone).filter(Boolean));
  let imported = 0, skipped = 0;
  const now = new Date().toISOString();
  let id = read(KEYS.NEXT_ID, 10000);
  for (const c of dataArray) {
    if (c.phone && phones.has(c.phone)) { skipped++; continue; }
    const contact = {
      id: id++,
      name: buildName(c.firstName, c.lastName, c.name),
      firstName: c.firstName || '', lastName: c.lastName || '',
      company: c.company || '', sector: c.nature || c.sector || '',
      phone: c.phone || '', email: c.email || '', profile: c.profile || '',
      city: c.city || '', message: c.message || '',
      companyScore: c.companyScore || 0, personScore: c.personScore || 0, combinedScore: c.combinedScore || 0,
      priority: c.priority || 'Medium', status: c.status || 'New',
      notes: c.notes || '', followUpDate: c.followUpDate || null,
      tags: Array.isArray(c.tags) ? c.tags : [],
      createdAt: c.date || now, updatedAt: now,
    };
    existing.push(contact);
    if (c.phone) phones.add(c.phone);
    addActivityEntry(contact.id, 'Contact created', 'Imported');
    imported++;
  }
  write(KEYS.NEXT_ID, id);
  saveAllContacts(existing);
  return { imported, skipped };
}

export function seedIfEmpty(seedData) {
  if (getAllContacts().length > 0) return 0;
  const now = new Date().toISOString();
  const seeded = seedData.map((c, i) => ({
    id: i + 1,
    name: buildName(c.firstName, c.lastName, c.name),
    firstName: c.firstName || '', lastName: c.lastName || '',
    company: c.company || '', sector: c.nature || c.sector || '',
    phone: c.phone || '', email: c.email || '', profile: c.profile || 'organization',
    city: c.city || '', message: c.message || '',
    companyScore: c.companyScore || 0, personScore: c.personScore || 0, combinedScore: c.combinedScore || 0,
    priority: c.priority || 'Medium', status: c.status || 'New',
    notes: c.notes || '', followUpDate: c.followUpDate || null,
    tags: Array.isArray(c.tags) ? c.tags : [],
    createdAt: c.date || now, updatedAt: now,
  }));
  saveAllContacts(seeded);
  write(KEYS.NEXT_ID, seeded.length + 10);
  return seeded.length;
}

function buildName(first, last, fallback) {
  return [first, last].filter(Boolean).join(' ') || fallback || '';
}
