// Password gate for the whole CRM, run by Cloudflare Pages on every request.
// Nothing (HTML, JS bundle, contact data) is served until the password matches.
//
// Set in Cloudflare: Pages project → Settings → Variables and Secrets →
//   CRM_PASSWORD (type: Secret). Changing it signs everyone out.

const COOKIE = 'atoure_crm_session';
const MAX_AGE = 60 * 60 * 24 * 30; // stay signed in for 30 days

async function sessionToken(password) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode('atoure-crm-session-v1'));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  const match = header.split(/;\s*/).find(c => c.startsWith(name + '='));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

function loginPage(error, status = 401) {
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>AToure CRM</title>
<style>
  *{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0D0C0A;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#eee;padding:16px}
  form{width:100%;max-width:360px}
  .brand{text-align:center;margin-bottom:2rem}.brand h1{font-family:Georgia,serif;font-weight:600;font-size:2.8rem;color:#C8A951;letter-spacing:.08em;margin:0}
  .brand p{font-size:9px;letter-spacing:.22em;text-transform:uppercase;color:rgba(200,169,81,.45);margin:6px 0 0}
  .card{background:rgba(255,255,255,.03);border:1px solid rgba(200,169,81,.18);border-radius:10px;padding:1.75rem}
  label{display:block;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:rgba(200,169,81,.6);text-align:center;margin-bottom:1rem}
  input{width:100%;padding:.8rem 1rem;font-size:16px;background:rgba(255,255,255,.05);border:1px solid rgba(200,169,81,.25);border-radius:6px;color:#fff;outline:none}
  input:focus{border-color:#C8A951}
  button{width:100%;margin-top:1rem;padding:.8rem;font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;background:#C8A951;color:#0D0C0A;border:0;border-radius:6px;cursor:pointer}
  .err{color:#e57373;font-size:13px;text-align:center;margin-top:.9rem}
</style></head>
<body><form method="POST" action="/__login">
  <div class="brand"><h1>AToure</h1><p>Management &amp; Consulting</p></div>
  <div class="card">
    <label for="pw">Client list · Enter password</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" autofocus required>
    <button type="submit">Unlock</button>
    ${error ? `<div class="err">${error}</div>` : ''}
  </div>
</form></body></html>`;
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' },
  });
}

export async function onRequest({ request, env, next }) {
  const password = env.CRM_PASSWORD;
  if (!password) {
    return new Response('CRM_PASSWORD is not set in Cloudflare Pages settings, so the CRM is locked.', { status: 503 });
  }
  const url = new URL(request.url);
  const expected = await sessionToken(password);

  if (url.pathname === '/__logout') {
    return new Response(null, {
      status: 302,
      headers: { Location: '/', 'Set-Cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` },
    });
  }

  if (url.pathname === '/__login' && request.method === 'POST') {
    const form = await request.formData();
    const attempt = String(form.get('password') || '');
    if (safeEqual(await sessionToken(attempt), expected)) {
      return new Response(null, {
        status: 302,
        headers: { Location: '/', 'Set-Cookie': `${COOKIE}=${expected}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; Secure; SameSite=Lax` },
      });
    }
    await new Promise(r => setTimeout(r, 800)); // slow down guessing
    return loginPage('Incorrect password. Please try again.');
  }

  if (safeEqual(readCookie(request, COOKIE), expected)) {
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set('X-Robots-Tag', 'noindex');
    return out;
  }
  return loginPage('');
}
