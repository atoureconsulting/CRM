import React, { useState } from 'react';
import { getSheetsUrl, setSheetsUrl, syncFromSheet, getAllContacts } from '../db.js';
import { pushAllContactsToSheet } from '../sheetsSync.js';

const URL_PATTERN = /^https:\/\/script\.google\.com\/macros\/s\/.+\/exec$/;

export default function SheetConnectModal({ onClose, onConnected }) {
  const [url, setUrl] = useState(getSheetsUrl());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleConnect() {
    const trimmed = url.trim();
    if (!trimmed) { setError('Paste your Apps Script /exec URL'); return; }
    if (!URL_PATTERN.test(trimmed)) { setError("That doesn't look like an Apps Script /exec URL"); return; }
    setBusy(true); setError('');
    setSheetsUrl(trimmed);
    try {
      let count = await syncFromSheet();
      if (count === 0) {
        // Empty sheet: seed it with what's already here instead of losing local data.
        const local = getAllContacts();
        await pushAllContactsToSheet(local);
        count = local.length;
      }
      onConnected(count);
      onClose();
    } catch (e) {
      setError(e.message || 'Could not connect to that Sheet');
    }
    setBusy(false);
  }

  function handleDisconnect() {
    setSheetsUrl('');
    setUrl('');
    onConnected(null);
    onClose();
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" style={{ width: 520 }}>
        <div className="modal-header">
          <div className="modal-title">Connect Your Google Sheet</div>
          <button className="modal-close" onClick={onClose}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7, marginTop: 0, marginBottom: 16 }}>
            1. Create a Google Sheet.<br/>
            2. Open <strong style={{ color: 'var(--gold)' }}>Extensions → Apps Script</strong>, delete the placeholder code, and paste the contents of this repo's <strong style={{ color: 'var(--gold)' }}>Code.gs</strong>.<br/>
            3. <strong style={{ color: 'var(--gold)' }}>Deploy → New deployment → Web app</strong>, execute as <strong>Me</strong>, access <strong>Anyone</strong>, then Deploy.<br/>
            4. Copy the URL ending in <code>/exec</code> and paste it below.
          </p>
          <div className="form-group">
            <label className="form-label">Apps Script Web App URL</label>
            <input
              className={`form-input ${error ? 'error' : ''}`}
              type="text"
              value={url}
              onChange={e => { setUrl(e.target.value); setError(''); }}
              placeholder="https://script.google.com/macros/s/…/exec"
            />
            {error && <div className="form-error">{error}</div>}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn-outline" onClick={handleDisconnect} style={{ marginRight: 'auto', color: 'var(--red)' }}>Disconnect</button>
          <button className="btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn-gold" onClick={handleConnect} disabled={busy}>
            {busy ? 'Connecting…' : 'Connect & Sync'}
          </button>
        </div>
      </div>
    </div>
  );
}
