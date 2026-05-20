import React, { useState, useCallback, useMemo } from 'react';
import LoginScreen from './components/LoginScreen.jsx';
import Header from './components/Header.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toolbar from './components/Toolbar.jsx';
import StatsBar from './components/StatsBar.jsx';
import ContactTable from './components/ContactTable.jsx';
import ContactDrawer from './components/ContactDrawer.jsx';
import ContactModal from './components/ContactModal.jsx';
import Toast from './components/Toast.jsx';
import {
  getAllContacts, createContact, updateContact, deleteContact,
  bulkUpdateStatus, getContactActivity, addActivityEntry, getStats, importContacts,
} from './db.js';

const ALL_COLUMNS = ['name', 'sector', 'phone', 'score', 'priority', 'status', 'followUpDate', 'actions'];

function loadVisibleColumns() {
  try {
    const s = localStorage.getItem('atoure_columns');
    if (s) { const a = JSON.parse(s); if (Array.isArray(a) && a.length) return a; }
  } catch {}
  return ALL_COLUMNS;
}

function applyFilters(all, { search, filters, sort, page, pageSize }) {
  let r = all;
  if (search) {
    const s = search.toLowerCase();
    r = r.filter(c => [c.name, c.company, c.phone, c.city, c.message, c.notes].some(v => v && v.toLowerCase().includes(s)));
  }
  if (filters.sector) r = r.filter(c => c.sector === filters.sector);
  if (filters.status) r = r.filter(c => c.status === filters.status);
  if (filters.priority) r = r.filter(c => c.priority === filters.priority);
  const { field, dir } = sort;
  r = [...r].sort((a, b) => {
    const av = a[field] ?? '', bv = b[field] ?? '';
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });
  return { contacts: r.slice((page - 1) * pageSize, page * pageSize), total: r.length };
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(() => localStorage.getItem('atoure_auth') === '1');
  if (!authenticated) return <LoginScreen onAuthenticated={() => setAuthenticated(true)} />;
  return <CRMApp onLogout={() => { localStorage.removeItem('atoure_auth'); setAuthenticated(false); }} />;
}

function CRMApp({ onLogout }) {
  const [allContacts, setAllContacts] = useState(getAllContacts);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(25);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ sector: '', status: '', priority: '' });
  const [sort, setSort] = useState({ field: 'combinedScore', dir: 'desc' });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [visibleColumns, setVisibleColumns] = useState(loadVisibleColumns);
  const [drawerContact, setDrawerContact] = useState(null);
  const [drawerActivity, setDrawerActivity] = useState([]);
  const [modalMode, setModalMode] = useState(null);
  const [modalContact, setModalContact] = useState(null);
  const [toasts, setToasts] = useState([]);

  function refresh() { setAllContacts(getAllContacts()); }

  const stats = useMemo(() => getStats(allContacts), [allContacts]);
  const { contacts, total } = useMemo(
    () => applyFilters(allContacts, { search, filters, sort, page, pageSize }),
    [allContacts, search, filters, sort, page, pageSize]
  );

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3000);
  }, []);

  const dismissToast = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

  const handleFilterChange = useCallback((key, value) => {
    setFilters(f => ({ ...f, [key]: f[key] === value ? '' : value }));
    setPage(1); setSelectedIds(new Set());
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters({ sector: '', status: '', priority: '' }); setPage(1); setSelectedIds(new Set());
  }, []);

  const handleSearchChange = useCallback((val) => { setSearch(val); setPage(1); setSelectedIds(new Set()); }, []);
  const handleSortChange = useCallback((field, dir) => { setSort({ field, dir }); setPage(1); }, []);
  const handlePageChange = useCallback((p) => { setPage(p); setSelectedIds(new Set()); }, []);

  const handleToggleColumn = useCallback((col) => {
    setVisibleColumns(cols => {
      const next = cols.includes(col) ? cols.filter(c => c !== col) : [...cols, col];
      localStorage.setItem('atoure_columns', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleRowClick = useCallback((contact) => {
    setDrawerContact(contact);
    setDrawerActivity(getContactActivity(contact.id));
  }, []);

  const handleDrawerClose = useCallback(() => { setDrawerContact(null); setDrawerActivity([]); }, []);

  const handleDrawerUpdate = useCallback((id, data) => {
    const updated = updateContact(id, data);
    refresh();
    setDrawerContact(dc => dc && dc.id === id ? { ...dc, ...updated } : dc);
    setDrawerActivity(getContactActivity(id));
    return updated;
  }, []);

  const handleDrawerAddActivity = useCallback((contactId, action, detail) => {
    addActivityEntry(contactId, action, detail);
    setDrawerActivity(getContactActivity(contactId));
  }, []);

  const handleStatusCycle = useCallback((contact) => {
    const order = ['New', 'Contacted', 'Partner', 'Archived'];
    const updated = updateContact(contact.id, { status: order[(order.indexOf(contact.status) + 1) % order.length] });
    refresh();
    setDrawerContact(dc => dc && dc.id === contact.id ? { ...dc, ...updated } : dc);
  }, []);

  const handleDelete = useCallback((id) => {
    if (!confirm('Delete this contact?')) return;
    deleteContact(id);
    refresh();
    if (drawerContact && drawerContact.id === id) handleDrawerClose();
    showToast('Contact deleted');
  }, [drawerContact, handleDrawerClose, showToast]);

  const handleEdit = useCallback((contact) => { setModalContact(contact); setModalMode('edit'); }, []);
  const handleAddContact = useCallback(() => { setModalContact(null); setModalMode('add'); }, []);
  const handleModalClose = useCallback(() => { setModalMode(null); setModalContact(null); }, []);

  const handleModalSave = useCallback((data) => {
    if (modalMode === 'edit' && modalContact) updateContact(modalContact.id, data);
    else createContact(data);
    refresh();
    handleModalClose();
    showToast('Contact saved');
  }, [modalMode, modalContact, handleModalClose, showToast]);

  const handleBulkStatus = useCallback((status) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    bulkUpdateStatus(ids, status);
    refresh();
    setSelectedIds(new Set());
    showToast(`${ids.length} contacts updated to ${status}`);
  }, [selectedIds, showToast]);

  const handleImport = useCallback((file) => {
    file.text().then(text => {
      try {
        const data = JSON.parse(text);
        if (!Array.isArray(data)) throw new Error('Expected array');
        const result = importContacts(data);
        refresh();
        showToast(`${result.imported} imported${result.skipped ? `, ${result.skipped} skipped` : ''}`);
      } catch (e) { showToast('Import failed: ' + e.message, 'error'); }
    });
  }, [showToast]);

  const handleExport = useCallback(() => {
    const { contacts: all } = applyFilters(allContacts, { search, filters, sort, page: 1, pageSize: 9999999 });
    const cols = ['name', 'company', 'sector', 'phone', 'email', 'city', 'profile', 'combinedScore', 'priority', 'status', 'followUpDate', 'notes', 'tags', 'message'];
    const esc = v => { const s = v == null ? '' : String(v); return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const lines = [cols.join(','), ...all.map(c => cols.map(col => col === 'tags' ? esc((Array.isArray(c.tags) ? c.tags : []).join('; ')) : esc(c[col])).join(','))];
    const url = URL.createObjectURL(new Blob([lines.join('\r\n')], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `atoure-contacts-${new Date().toISOString().split('T')[0]}.csv` });
    a.click(); URL.revokeObjectURL(url);
  }, [allContacts, search, filters, sort]);

  const handleSelectAll = useCallback((checked) => {
    setSelectedIds(checked ? new Set(contacts.map(c => c.id)) : new Set());
  }, [contacts]);

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  return (
    <div className="app-layout">
      <div className="app-header">
        <Header onAddContact={handleAddContact} onImport={handleImport} onExport={handleExport} onLogout={onLogout} />
      </div>
      <div className="app-sidebar">
        <Sidebar stats={stats} filters={filters} onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} />
      </div>
      <main className="app-main">
        <Toolbar search={search} onSearchChange={handleSearchChange} sort={sort} onSortChange={handleSortChange} visibleColumns={visibleColumns} allColumns={ALL_COLUMNS} onToggleColumn={handleToggleColumn} total={total} />
        <StatsBar stats={stats} contacts={allContacts} />
        {selectedIds.size > 0 && (
          <div className="bulk-bar">
            <span className="bulk-count">{selectedIds.size} selected</span>
            <span className="bulk-label">Change Status:</span>
            {['New', 'Contacted', 'Partner', 'Archived'].map(s => (
              <button key={s} className="bulk-status-btn" onClick={() => handleBulkStatus(s)}>{s}</button>
            ))}
            <button className="bulk-clear-btn" onClick={() => setSelectedIds(new Set())}>Clear</button>
          </div>
        )}
        <ContactTable contacts={contacts} total={total} loading={false} page={page} pageSize={pageSize} visibleColumns={visibleColumns} selectedIds={selectedIds} onRowClick={handleRowClick} onSelectAll={handleSelectAll} onToggleSelect={handleToggleSelect} onStatusCycle={handleStatusCycle} onEdit={handleEdit} onDelete={handleDelete} onPageChange={handlePageChange} />
      </main>
      {drawerContact && (
        <ContactDrawer contact={drawerContact} activity={drawerActivity} onClose={handleDrawerClose} onUpdate={handleDrawerUpdate} onAddActivity={handleDrawerAddActivity} onEdit={handleEdit} onDelete={handleDelete} showToast={showToast} />
      )}
      {modalMode && (
        <ContactModal mode={modalMode} contact={modalContact} onClose={handleModalClose} onSave={handleModalSave} showToast={showToast} />
      )}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
