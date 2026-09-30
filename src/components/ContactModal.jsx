import React, { useState, useEffect, useRef } from 'react';
import { findDuplicateByPhone } from '../db.js';

const SECTORS = [
  'Média / Visibilité', 'Production audiovisuelle', 'Accès lieux / expériences',
  'Restauration', 'Hébergement', 'Sécurité', 'Logistique', 'Autre',
];

const LIST_TYPES = ['Client', 'Influencer', 'Partner', 'Vendor'];

function emptyForm() {
  return { firstName: '', lastName: '', company: '', listType: '', sector: '', phone: '', email: '', city: '', profile: '', priority: 'Medium', status: 'New', notes: '', followUpDate: '', tags: [] };
}

function contactToForm(c) {
  return { firstName: c.firstName || '', lastName: c.lastName || '', company: c.company || '', listType: c.listType || '', sector: c.sector || '', phone: c.phone || '', email: c.email || '', city: c.city || '', profile: c.profile || '', priority: c.priority || 'Medium', status: c.status || 'New', notes: c.notes || '', followUpDate: c.followUpDate || '', tags: Array.isArray(c.tags) ? [...c.tags] : [] };
}

export default function ContactModal({ mode, contact, onClose, onSave, showToast }) {
  const [form, setForm] = useState(() => mode === 'edit' && contact ? contactToForm(contact) : emptyForm());
  const [errors, setErrors] = useState({});
  const [tagInput, setTagInput] = useState('');
  const firstRef = useRef(null);

  useEffect(() => { setTimeout(() => firstRef.current?.focus(), 50); }, []);
  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function set(field, value) { setForm(f => ({ ...f, [field]: value })); setErrors(e => ({ ...e, [field]: undefined })); }

  function validate() {
    const errs = {};
    if (!form.firstName.trim() && !form.lastName.trim()) errs.firstName = 'First or last name required';
    return errs;
  }

  function handleSave() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const dup = findDuplicateByPhone(form.phone, mode === 'edit' && contact ? contact.id : undefined);
    if (dup && !confirm(`"${dup.name}" already has this phone number. Save anyway?`)) return;
    const payload = { ...form, name: [form.firstName, form.lastName].filter(Boolean).join(' '), followUpDate: form.followUpDate || null };
    onSave(payload);
  }

  function handleTagKeyDown(e) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim().replace(/,$/, '');
      if (tag && !form.tags.includes(tag)) set('tags', [...form.tags, tag]);
      setTagInput('');
    } else if (e.key === 'Backspace' && !tagInput && form.tags.length > 0) {
      set('tags', form.tags.slice(0, -1));
    }
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-title">{mode === 'edit' ? 'Edit Contact' : 'Add Contact'}</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <div className="form-row two-col">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input ref={firstRef} className={`form-input ${errors.firstName ? 'error' : ''}`} type="text" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Firstname" />
              {errors.firstName && <div className="form-error">{errors.firstName}</div>}
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" type="text" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Lastname" />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input className="form-input" type="text" value={form.company} onChange={e => set('company', e.target.value)} placeholder="Company name" />
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label className="form-label">List Type</label>
              <select className="form-input" value={form.listType} onChange={e => set('listType', e.target.value)}>
                <option value="">Unassigned</option>
                {LIST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Sector</label>
              <select className="form-input" value={form.sector} onChange={e => set('sector', e.target.value)}>
                <option value="">Select sector…</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">City</label>
            <input className="form-input" type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input className="form-input" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+225 XX XX XX XX" />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="email@example.com" />
            </div>
          </div>
          <div className="form-row two-col">
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => set('priority', e.target.value)}>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="New">New</option>
                <option value="Contacted">Contacted</option>
                <option value="Partner">Partner</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Follow-up Date</label>
            <input className="form-input" type="date" value={form.followUpDate} onChange={e => set('followUpDate', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Notes</label>
            <textarea className="form-input form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes…" rows={3} />
          </div>
          <div className="form-group">
            <label className="form-label">Tags</label>
            <div className="tags-input-wrap">
              {form.tags.map(tag => (
                <span key={tag} className="tag-chip">{tag}<button className="tag-remove" onClick={() => set('tags', form.tags.filter(t => t !== tag))}>×</button></span>
              ))}
              <input className="tag-input" type="text" value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={handleTagKeyDown} placeholder={form.tags.length === 0 ? 'Type tag + Enter…' : ''} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleSave}>
            {mode === 'edit' ? 'Save Changes' : 'Add Contact'}
          </button>
        </div>
      </div>

      <style>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.55);
          z-index: 300;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .modal {
          background: var(--ink);
          border: 1px solid rgba(200,169,81,0.2);
          border-radius: 8px;
          width: 560px;
          max-width: 100%;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: fadeInUp 0.2s cubic-bezier(0.22,1,0.36,1);
        }
        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 18px 22px;
          border-bottom: 1px solid rgba(200,169,81,0.1);
          flex-shrink: 0;
        }
        .modal-title {
          font-family: 'Cormorant Garamond', serif;
          font-size: 18px;
          font-weight: 600;
          color: var(--cream);
        }
        .modal-close {
          background: none;
          border: none;
          color: var(--muted);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          transition: color 0.15s, background 0.15s;
        }
        .modal-close:hover { color: var(--cream); background: rgba(255,255,255,0.08); }
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px 22px;
        }
        .form-row.two-col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-label {
          display: block;
          font-size: 11px;
          letter-spacing: 0.04em;
          color: var(--muted);
          margin-bottom: 6px;
        }
        .form-input {
          width: 100%;
          box-sizing: border-box;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(200,169,81,0.2);
          border-radius: 4px;
          color: var(--cream);
          padding: 8px 10px;
          font-size: 13px;
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          outline: none;
          border-color: var(--gold);
        }
        .form-input.error {
          border-color: var(--red);
        }
        .form-textarea {
          resize: vertical;
          line-height: 1.5;
        }
        select.form-input {
          cursor: pointer;
        }
        select.form-input option {
          background: var(--ink);
          color: var(--cream);
        }
        .form-error {
          font-size: 11px;
          color: var(--red);
          margin-top: 4px;
        }
        .tags-input-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(200,169,81,0.2);
          border-radius: 4px;
          padding: 6px 8px;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          padding: 3px 8px;
          background: rgba(200,169,81,0.15);
          color: var(--gold2);
          border-radius: 3px;
        }
        .tag-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          font-size: 13px;
          line-height: 1;
          padding: 0;
        }
        .tag-input {
          flex: 1;
          min-width: 80px;
          background: none;
          border: none;
          color: var(--cream);
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
        }
        .tag-input:focus { outline: none; }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 22px;
          border-top: 1px solid rgba(200,169,81,0.1);
          flex-shrink: 0;
        }
        .modal-overlay .btn-outline {
          padding: 8px 16px;
          background: none;
          border: 1px solid rgba(200,169,81,0.25);
          border-radius: 4px;
          color: var(--muted);
          font-size: 12px;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: color 0.15s, border-color 0.15s;
        }
        .modal-overlay .btn-outline:hover {
          color: var(--cream);
          border-color: var(--gold);
        }
        .modal-overlay .btn-gold {
          padding: 8px 18px;
          background: var(--gold);
          color: var(--ink);
          border: none;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.15s;
        }
        .modal-overlay .btn-gold:hover {
          background: var(--gold2);
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
