import React, { useState, useEffect, useRef } from 'react';

const SECTORS = [
  'Média / Visibilité', 'Production audiovisuelle', 'Accès lieux / expériences',
  'Restauration', 'Hébergement', 'Sécurité', 'Logistique', 'Autre',
];

function emptyForm() {
  return { firstName: '', lastName: '', company: '', sector: '', phone: '', email: '', city: '', profile: '', priority: 'Medium', status: 'New', notes: '', followUpDate: '', tags: [] };
}

function contactToForm(c) {
  return { firstName: c.firstName || '', lastName: c.lastName || '', company: c.company || '', sector: c.sector || '', phone: c.phone || '', email: c.email || '', city: c.city || '', profile: c.profile || '', priority: c.priority || 'Medium', status: c.status || 'New', notes: c.notes || '', followUpDate: c.followUpDate || '', tags: Array.isArray(c.tags) ? [...c.tags] : [] };
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
              <label className="form-label">Sector</label>
              <select className="form-input" value={form.sector} onChange={e => set('sector', e.target.value)}>
                <option value="">Select sector…</option>
                {SECTORS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">City</label>
              <input className="form-input" type="text" value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </div>
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
    </div>
  );
}
