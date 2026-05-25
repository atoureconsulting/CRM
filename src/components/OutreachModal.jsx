import React, { useState, useEffect } from 'react';

const BRIEFS_KEY = 'atoure_briefs';
const API_KEY_KEY = 'atoure_claude_key';

const COPY_RULES = `
COPY RULES — APPLY TO EVERY DRAFT, NO EXCEPTIONS:

1. NEVER use em dashes (—). Use periods, commas, colons, or line breaks instead.

2. NEVER use these AI phrases:
   - "I'd be happy to" / "It's important to note" / "It's worth noting"
   - "leverage" (use "use") / "utilize" (use "use")
   - "game-changer" / "cutting-edge" / "revolutionary" / "groundbreaking"
   - "seamless" / "robust" / "streamline" / "elevate" / "empower"
   - "dive deep" / "unlock the power of" / "transform your"
   - "take your X to the next level" / "look no further"
   - "at the end of the day" / "let's be real" / "here's the thing"
   - "the reality is" / "moving forward" / "rest assured" / "don't miss out"
   - "without further ado" / "that being said" / "in conclusion"

3. NEVER write 3 short punchy sentences followed by a medium one. That cadence is an AI giveaway.

4. NEVER fabricate case studies, client results, quotes, or testimonials. Only reference the real Atoure projects listed below.

5. Be specific. "We placed a creator with DAZN for the Qatar campaign" beats "we have broadcast experience".

6. One idea per sentence. Two ideas? Split it.

7. Lead with what the contact gets, not what Atoure does.

8. Do not stack rhetorical questions. One is fine. Three in a row is an AI tell.
`;

const ATOURE_CONTEXT = `
ABOUT ATOURE CONSULTING:
Sports and entertainment consultancy based in Ivory Coast. We connect African talent and brands with global opportunities. Sender: Baba.

Real projects we can reference:
- IShowSpeed x AFCON (creator activation at Africa Cup of Nations)
- DAZN x Qatar campaign (broadcast/creator placement)
- Ivory Coast national team campaigns
- Ashton Hall partnership
- Chicken Shop Date collaboration
- Rotimi campaign
- Maina x TotalEnergies
- Maina pitch deck

Do NOT invent other projects or results.
`;

function loadBriefs() {
  try { return JSON.parse(localStorage.getItem(BRIEFS_KEY) || '[]'); } catch { return []; }
}

function saveBriefs(briefs) {
  localStorage.setItem(BRIEFS_KEY, JSON.stringify(briefs));
}

function waLink(phone) {
  if (!phone) return null;
  const clean = phone.replace(/[\s\-\(\)]/g, '');
  return `https://wa.me/${clean.startsWith('+') ? clean.slice(1) : clean}`;
}

export default function OutreachModal({ contact, onClose, showToast }) {
  const [channel, setChannel] = useState('email');
  const [brief, setBrief] = useState('');
  const [savedBriefs, setSavedBriefs] = useState(loadBriefs);
  const [draft, setDraft] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem(API_KEY_KEY) || '');
  const [showKeyInput, setShowKeyInput] = useState(() => !localStorage.getItem(API_KEY_KEY));
  const [keyInput, setKeyInput] = useState('');
  const [briefName, setBriefName] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);

  useEffect(() => {
    function handler(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function handleSaveKey() {
    if (!keyInput.trim()) return;
    localStorage.setItem(API_KEY_KEY, keyInput.trim());
    setApiKeyState(keyInput.trim());
    setShowKeyInput(false);
    setKeyInput('');
  }

  async function handleGenerate() {
    const key = localStorage.getItem(API_KEY_KEY);
    if (!key) { setShowKeyInput(true); return; }
    if (!brief.trim()) { showToast('Add a brief first', 'error'); return; }

    setLoading(true);
    setDraft('');
    setSubject('');

    const contactInfo = [
      contact.name && `Name: ${contact.name}`,
      contact.company && `Company: ${contact.company}`,
      contact.sector && `Sector: ${contact.sector}`,
      contact.city && `City: ${contact.city}`,
      contact.profile && `Profile: ${contact.profile}`,
      contact.notes && `Notes: ${contact.notes}`,
      contact.message && `Background: ${contact.message}`,
      contact.status && `CRM Status: ${contact.status}`,
      contact.priority && `Priority: ${contact.priority}`,
    ].filter(Boolean).join('\n');

    const isEmail = channel === 'email';

    const systemPrompt = `You are an outreach copywriter for Atoure Consulting writing on behalf of Baba.\n\n${ATOURE_CONTEXT}\n\n${COPY_RULES}`;

    const userPrompt = `Write a ${isEmail ? 'professional outreach email' : 'WhatsApp message (under 150 words)'} for this contact.\n\nContact profile:\n${contactInfo}\n\nMy brief:\n${brief.trim()}\n\n${
  isEmail
    ? `Return ONLY:\nSUBJECT: [subject line]\n---\n[email body]\n\nSign off as Baba, Atoure Consulting.`
    : `No subject line needed. Return ONLY the message text. Sign off as Baba, Atoure Consulting.`
}`;

    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API error ${res.status}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || '';

      if (isEmail) {
        const lines = text.split('\n');
        const subjectLine = lines.find(l => l.startsWith('SUBJECT:'));
        if (subjectLine) {
          setSubject(subjectLine.replace('SUBJECT:', '').trim());
          const sepIdx = lines.indexOf('---');
          const body = (sepIdx >= 0 ? lines.slice(sepIdx + 1) : lines.filter(l => !l.startsWith('SUBJECT:'))).join('\n').trim();
          setDraft(body);
        } else {
          setDraft(text.trim());
        }
      } else {
        setDraft(text.trim());
      }
    } catch (e) {
      showToast('Failed to generate: ' + e.message, 'error');
    }

    setLoading(false);
  }

  function handleSaveBrief() {
    if (!briefName.trim() || !brief.trim()) return;
    const updated = [...savedBriefs, { name: briefName.trim(), text: brief.trim(), id: Date.now() }];
    saveBriefs(updated);
    setSavedBriefs(updated);
    setBriefName('');
    setShowSaveForm(false);
    showToast('Brief saved');
  }

  function handleDeleteBrief(id) {
    const updated = savedBriefs.filter(b => b.id !== id);
    saveBriefs(updated);
    setSavedBriefs(updated);
  }

  function handleCopy() {
    const text = channel === 'email' && subject ? `Subject: ${subject}\n\n${draft}` : draft;
    navigator.clipboard.writeText(text).then(() => showToast('Copied to clipboard'));
  }

  function handleOpenEmail() {
    const to = contact.email || '';
    window.open(`mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`);
  }

  function handleOpenWhatsApp() {
    const link = waLink(contact.phone);
    if (!link) { showToast('No phone number for this contact', 'error'); return; }
    window.open(`${link}?text=${encodeURIComponent(draft)}`, '_blank');
  }

  return (
    <>
      <div className="om-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} />
      <div className="om-modal">
        <div className="om-header">
          <div className="om-title">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold)' }}>
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
            Outreach — <span style={{ color: 'var(--gold)' }}>{contact.name}</span>
          </div>
          <button className="om-close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="om-body">
          {showKeyInput && (
            <div className="om-key-box">
              <div className="om-key-label">Enter your Anthropic API key to enable Claude drafting</div>
              <div className="om-key-row">
                <input
                  className="om-input"
                  type="password"
                  placeholder="sk-ant-..."
                  value={keyInput}
                  onChange={e => setKeyInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveKey(); }}
                  autoFocus
                />
                <button className="om-btn-gold" onClick={handleSaveKey}>Save</button>
                {apiKey && <button className="om-btn-ghost" onClick={() => setShowKeyInput(false)}>Cancel</button>}
              </div>
            </div>
          )}

          <div className="om-channel-row">
            <button className={`om-channel-btn${channel === 'email' ? ' active' : ''}`} onClick={() => { setChannel('email'); setDraft(''); setSubject(''); }}>Email</button>
            <button className={`om-channel-btn${channel === 'whatsapp' ? ' active' : ''}`} onClick={() => { setChannel('whatsapp'); setDraft(''); setSubject(''); }}>WhatsApp</button>
            {!showKeyInput && (
              <button className="om-key-toggle" onClick={() => setShowKeyInput(true)} title="Update API key">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </svg>
                API Key
              </button>
            )}
          </div>

          {savedBriefs.length > 0 && (
            <div className="om-section">
              <div className="om-label">Saved Briefs</div>
              <div className="om-briefs-list">
                {savedBriefs.map(b => (
                  <div key={b.id} className="om-brief-chip">
                    <button className="om-brief-name" onClick={() => setBrief(b.text)}>{b.name}</button>
                    <button className="om-brief-del" onClick={() => handleDeleteBrief(b.id)}>×</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="om-section">
            <div className="om-label">Your brief</div>
            <textarea
              className="om-textarea"
              rows={4}
              placeholder={`e.g. Reach out about our creator network, reference the IShowSpeed AFCON campaign, keep it under 150 words, warm but professional…`}
              value={brief}
              onChange={e => setBrief(e.target.value)}
            />
            <div className="om-brief-footer">
              {!showSaveForm ? (
                <button className="om-btn-ghost om-save-link" onClick={() => setShowSaveForm(true)} disabled={!brief.trim()}>
                  + Save as template
                </button>
              ) : (
                <div className="om-key-row">
                  <input
                    className="om-input"
                    placeholder="Template name…"
                    value={briefName}
                    onChange={e => setBriefName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveBrief(); if (e.key === 'Escape') setShowSaveForm(false); }}
                    autoFocus
                  />
                  <button className="om-btn-gold" onClick={handleSaveBrief}>Save</button>
                  <button className="om-btn-ghost" onClick={() => setShowSaveForm(false)}>Cancel</button>
                </div>
              )}
            </div>
          </div>

          <button className="om-generate-btn" onClick={handleGenerate} disabled={loading || !brief.trim()}>
            {loading ? (
              <><span className="om-spinner" /> Generating…</>
            ) : (
              <>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                Generate with Claude
              </>
            )}
          </button>

          {draft && (
            <div className="om-section">
              <div className="om-label">Draft — edit freely before sending</div>
              {channel === 'email' && subject && (
                <input
                  className="om-subject-input"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Subject line"
                />
              )}
              <textarea
                className="om-textarea om-draft"
                rows={9}
                value={draft}
                onChange={e => setDraft(e.target.value)}
              />
              <div className="om-draft-actions">
                <button className="om-action-btn" onClick={handleCopy}>Copy</button>
                {channel === 'email' && (
                  <button className="om-action-btn om-action-primary" onClick={handleOpenEmail}>
                    Open in Email App
                  </button>
                )}
                {channel === 'whatsapp' && (
                  <button className="om-action-btn om-action-wa" onClick={handleOpenWhatsApp} disabled={!contact.phone}>
                    Open in WhatsApp
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .om-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6); z-index: 200;
        }
        .om-modal {
          position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 560px; max-width: 95vw; max-height: 90vh;
          background: var(--ink); border: 1px solid rgba(200,169,81,0.2);
          border-radius: 8px; display: flex; flex-direction: column;
          z-index: 201; overflow: hidden;
          animation: fadeInUp 0.2s cubic-bezier(0.22,1,0.36,1);
        }
        .om-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 20px; border-bottom: 1px solid rgba(200,169,81,0.1); flex-shrink: 0;
        }
        .om-title {
          font-size: 13px; font-weight: 500; color: var(--cream);
          display: flex; align-items: center; gap: 8px;
        }
        .om-close {
          background: none; border: none; color: var(--muted); cursor: pointer;
          padding: 4px; border-radius: 4px; display: flex; align-items: center; transition: color 0.15s;
        }
        .om-close:hover { color: var(--cream); }
        .om-body {
          flex: 1; overflow-y: auto; padding: 18px 20px;
          display: flex; flex-direction: column; gap: 16px;
        }
        .om-key-box {
          background: rgba(200,169,81,0.06); border: 1px solid rgba(200,169,81,0.15);
          border-radius: 6px; padding: 14px; display: flex; flex-direction: column; gap: 10px;
        }
        .om-key-label { font-size: 12px; color: var(--muted); }
        .om-key-row { display: flex; gap: 8px; align-items: center; }
        .om-input {
          flex: 1; background: rgba(255,255,255,0.07); border: 1px solid rgba(200,169,81,0.2);
          border-radius: 4px; color: var(--cream); padding: 7px 10px;
          font-size: 12px; font-family: 'DM Sans', sans-serif;
        }
        .om-input:focus { outline: none; border-color: var(--gold); }
        .om-btn-gold {
          padding: 7px 14px; background: var(--gold); color: var(--ink);
          border: none; border-radius: 4px; font-size: 12px; font-family: 'DM Sans', sans-serif;
          font-weight: 500; cursor: pointer; white-space: nowrap;
        }
        .om-btn-gold:hover { background: var(--gold2); }
        .om-btn-ghost {
          background: none; border: none; font-size: 12px; font-family: 'DM Sans', sans-serif;
          color: var(--muted); cursor: pointer; text-decoration: underline; text-underline-offset: 2px;
          white-space: nowrap;
        }
        .om-btn-ghost:hover { color: var(--red); }
        .om-btn-ghost:disabled { opacity: 0.4; cursor: not-allowed; }
        .om-channel-row { display: flex; gap: 6px; align-items: center; }
        .om-channel-btn {
          padding: 6px 18px; border-radius: 4px; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer;
          background: rgba(255,255,255,0.05); border: 1px solid rgba(200,169,81,0.12);
          color: var(--muted); transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .om-channel-btn.active {
          background: rgba(200,169,81,0.15); color: var(--gold); border-color: rgba(200,169,81,0.4);
        }
        .om-key-toggle {
          margin-left: auto; display: flex; align-items: center; gap: 5px;
          background: none; border: none; font-size: 11px; font-family: 'DM Sans', sans-serif;
          color: var(--muted); cursor: pointer; transition: color 0.15s;
        }
        .om-key-toggle:hover { color: var(--gold); }
        .om-section { display: flex; flex-direction: column; gap: 8px; }
        .om-label {
          font-size: 9px; font-weight: 500; letter-spacing: 0.14em;
          text-transform: uppercase; color: rgba(200,169,81,0.45);
        }
        .om-briefs-list { display: flex; flex-wrap: wrap; gap: 6px; }
        .om-brief-chip {
          display: flex; align-items: center; overflow: hidden;
          background: rgba(200,169,81,0.1); border: 1px solid rgba(200,169,81,0.2); border-radius: 4px;
        }
        .om-brief-name {
          background: none; border: none; font-size: 11.5px;
          font-family: 'DM Sans', sans-serif; color: var(--gold2); cursor: pointer; padding: 4px 10px;
        }
        .om-brief-name:hover { color: var(--cream); }
        .om-brief-del {
          background: none; border: none; font-size: 15px; color: var(--muted);
          cursor: pointer; padding: 2px 8px; line-height: 1;
          border-left: 1px solid rgba(200,169,81,0.15);
        }
        .om-brief-del:hover { color: var(--red); }
        .om-textarea {
          width: 100%; background: rgba(255,255,255,0.06); border: 1px solid rgba(200,169,81,0.18);
          border-radius: 5px; color: var(--cream); padding: 10px 12px;
          font-size: 12.5px; font-family: 'DM Sans', sans-serif;
          resize: vertical; line-height: 1.55; transition: border-color 0.15s;
        }
        .om-textarea:focus { outline: none; border-color: var(--gold); }
        .om-textarea::placeholder { color: var(--muted); }
        .om-draft { min-height: 180px; }
        .om-subject-input {
          width: 100%; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(200,169,81,0.18); border-radius: 5px;
          color: var(--gold2); padding: 8px 12px; font-size: 12.5px;
          font-family: 'DM Sans', sans-serif; font-weight: 500; transition: border-color 0.15s;
        }
        .om-subject-input:focus { outline: none; border-color: var(--gold); }
        .om-brief-footer { display: flex; align-items: center; }
        .om-save-link { font-size: 11px; }
        .om-save-link:hover { color: var(--gold) !important; }
        .om-generate-btn {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          padding: 11px; background: var(--gold); color: var(--ink);
          border: none; border-radius: 5px; font-size: 13px;
          font-family: 'DM Sans', sans-serif; font-weight: 600;
          cursor: pointer; transition: background 0.15s; width: 100%;
        }
        .om-generate-btn:hover { background: var(--gold2); }
        .om-generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .om-spinner {
          width: 13px; height: 13px; border: 2px solid rgba(0,0,0,0.2);
          border-top-color: var(--ink); border-radius: 50%;
          animation: om-spin 0.7s linear infinite; display: inline-block;
        }
        @keyframes om-spin { to { transform: rotate(360deg); } }
        .om-draft-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .om-action-btn {
          padding: 7px 16px; border-radius: 4px; font-size: 12px;
          font-family: 'DM Sans', sans-serif; font-weight: 500; cursor: pointer;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(200,169,81,0.15);
          color: var(--muted); transition: background 0.15s, color 0.15s;
        }
        .om-action-btn:hover { color: var(--cream); background: rgba(255,255,255,0.13); }
        .om-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .om-action-primary {
          background: rgba(200,169,81,0.15); color: var(--gold); border-color: rgba(200,169,81,0.3);
        }
        .om-action-primary:hover { background: rgba(200,169,81,0.25); color: var(--gold2); }
        .om-action-wa {
          background: rgba(37,211,102,0.12); color: #25D366; border-color: rgba(37,211,102,0.25);
        }
        .om-action-wa:hover { background: rgba(37,211,102,0.2); }
      `}</style>
    </>
  );
}
