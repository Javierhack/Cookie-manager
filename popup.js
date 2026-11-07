const $ = (id) => document.getElementById(id);
let tab = null, pageUrl = null, cookies = [], editing = null;


function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 1800);
}

function cookieUrl(c) {
  const host = c.domain.replace(/^\./, '');
  return `${c.secure ? 'https' : 'http'}://${host}${c.path}`;
}

function toLocalInput(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fromLocalInput(v) {
  return v ? new Date(v).getTime() / 1000 : null;
}

function fmtExpiry(c) {
  return c.session ? 'Sesión' : new Date(c.expirationDate * 1000).toLocaleString();
}


async function init() {
  [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const u = new URL(tab.url);
    if (!/^https?:$/.test(u.protocol)) throw new Error('no http');
    pageUrl = u.href;
    $('site').textContent = u.hostname;
  } catch {
    pageUrl = null;
    $('site').textContent = 'Página no compatible';
    showEmpty('Abre un sitio web (http o https) para ver sus cookies.');
    ['btn-export', 'btn-import', 'btn-clear'].forEach((id) => ($(id).disabled = true));
    return;
  }
  await refresh();
}

async function refresh() {
  cookies = await chrome.cookies.getAll({ url: pageUrl });
  cookies.sort((a, b) => a.name.localeCompare(b.name));
  render();
}

function showEmpty(msg) {
  $('list').replaceChildren();
  $('empty').textContent = msg;
  $('empty').hidden = false;
  $('count').textContent = '';
}


function chip(text, on) {
  const s = document.createElement('span');
  s.className = 'chip' + (on ? ' on' : '');
  s.textContent = text;
  return s;
}

function render() {
  const q = $('search').value.trim().toLowerCase();
  const shown = cookies.filter((c) => !q || c.name.toLowerCase().includes(q) || c.value.toLowerCase().includes(q));
  $('count').textContent = `${shown.length} de ${cookies.length}`;
  const list = $('list');
  list.replaceChildren();
  $('empty').hidden = shown.length > 0;
  if (!shown.length) {
    $('empty').textContent = cookies.length
      ? 'Ninguna cookie coincide con la búsqueda.'
      : 'Este sitio no tiene cookies.';
    return;
  }
  for (const c of shown) {
    const el = document.createElement('div');
    el.className = 'cookie';

    const head = document.createElement('div');
    head.className = 'c-head';
    const name = document.createElement('div');
    name.className = 'c-name';
    name.textContent = c.name;
    name.title = c.name;

    const actions = document.createElement('div');
    actions.className = 'c-actions';
    const bCopy = mkBtn('Copiar', () => copyText(c.value, 'Valor copiado'));
    const bDel = mkBtn('Borrar', () => removeCookie(c));
    bDel.classList.add('danger');
    actions.append(bCopy, bDel);
    head.append(name, actions);

    const val = document.createElement('div');
    val.className = 'c-value';
    val.textContent = c.value || '(vacío)';
    val.title = c.value;

    const meta = document.createElement('div');
    meta.className = 'c-meta';
    meta.append(
      chip(c.domain),
      chip(c.path),
      chip(fmtExpiry(c)),
      chip('Secure', c.secure),
      chip('HttpOnly', c.httpOnly),
      chip('SameSite: ' + c.sameSite)
    );
    el.append(head, val, meta);
    list.append(el);
  }
}

function mkBtn(label, fn) {
  const b = document.createElement('button');
  b.className = 'small';
  b.textContent = label;
  b.addEventListener('click', fn);
  return b;
}

async function copyText(text, msg) {
  try {
    await navigator.clipboard.writeText(text);
    toast(msg);
  } catch {
    toast('No se pudo copiar');
  }
}


async function removeCookie(c) {
  await chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId });
  toast('Cookie borrada');
  refresh();
}

$('btn-clear').addEventListener('click', async () => {
  if (!cookies.length) return toast('No hay cookies');
  if (!confirm(`¿Borrar las ${cookies.length} cookies de este sitio?`)) return;
  await Promise.all(cookies.map((c) => chrome.cookies.remove({ url: cookieUrl(c), name: c.name, storeId: c.storeId })));
  toast('Cookies borradas');
  refresh();
});

$('btn-export').addEventListener('click', () => {
  const data = cookies.map(({ name, value, domain, path, secure, httpOnly, sameSite, expirationDate, hostOnly }) => ({
    name, value, domain, path, secure, httpOnly, sameSite, hostOnly,
    ...(expirationDate ? { expirationDate } : {})
  }));
  copyText(JSON.stringify(data, null, 2), `${data.length} cookies copiadas como JSON`);
});

$('search').addEventListener('input', render);


function openEditor(c) {
  editing = c || null;
  $('edit-title').textContent = c ? 'Editar cookie' : 'Nueva cookie';
  const host = new URL(pageUrl).hostname;
  $('f-name').value = c ? c.name : '';
  $('f-value').value = c ? c.value : '';
  $('f-domain').value = c ? c.domain : host;
  $('f-path').value = c ? c.path : '/';
  $('f-expires').value = c && !c.session ? toLocalInput(c.expirationDate) : '';
  $('f-samesite').value = c ? c.sameSite : 'unspecified';
  $('f-secure').checked = c ? c.secure : new URL(pageUrl).protocol === 'https:';
  $('f-httponly').checked = c ? c.httpOnly : false;
  $('edit-error').hidden = true;
  $('dlg-edit').showModal();
  $('f-name').focus();
}

$('edit-cancel').addEventListener('click', () => $('dlg-edit').close());

const SAMESITE = { no_restriction: 'no_restriction', none: 'no_restriction', lax: 'lax', strict: 'strict', unspecified: 'unspecified' };
function normSameSite(v) {
  return SAMESITE[String(v ?? '').toLowerCase()] || 'unspecified';
}

function normExpiry(v) {
  if (v === null || v === undefined || v === '' || v === false) return null;
  let n = typeof v === 'number' ? v : Number(v);
  if (Number.isNaN(n)) n = Date.parse(v) / 1000;
  if (Number.isNaN(n)) throw new Error('fecha de expiración no válida');
  if (n <= 0) return null; 
  if (n > 1e12) n = n / 1000; 
  return n;
}

async function saveCookie(spec) {
  const name = String(spec.name);
  let domain = (spec.domain || '').trim();
  let path = spec.path || '/';
  const secure = !!spec.secure;
  const sameSite = normSameSite(spec.sameSite);

  if (sameSite === 'no_restriction' && !secure) throw new Error('SameSite None requiere Secure');
  if (name.startsWith('__Host-')) {
    if (!secure) throw new Error('las cookies __Host- requieren Secure');
    domain = domain.replace(/^\./, '');
    path = '/';
  } else if (name.startsWith('__Secure-') && !secure) {
    throw new Error('las cookies __Secure- requieren Secure');
  }

  const exp = normExpiry(spec.expirationDate);
  if (exp && exp * 1000 <= Date.now()) {
    const e = new Error('la cookie ya está expirada');
    e.expired = true;
    throw e;
  }

  const details = {
    url: `${secure ? 'https' : 'http'}://${domain.replace(/^\./, '')}${path}`,
    name,
    value: spec.value == null ? '' : String(spec.value),
    path,
    secure,
    httpOnly: !!spec.httpOnly,
    sameSite
  };
  if (domain.startsWith('.')) details.domain = domain;
  if (exp) details.expirationDate = exp;

  const res = await chrome.cookies.set(details);
  if (!res) {
    throw new Error(chrome.runtime.lastError?.message || 'el navegador la rechazó (revisa dominio, Secure y SameSite)');
  }
  return res;
}

$('form-edit').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('edit-error');
  err.hidden = true;
  const spec = {
    name: $('f-name').value.trim(),
    value: $('f-value').value,
    domain: $('f-domain').value,
    path: $('f-path').value.trim() || '/',
    expirationDate: fromLocalInput($('f-expires').value),
    sameSite: $('f-samesite').value,
    secure: $('f-secure').checked,
    httpOnly: $('f-httponly').checked
  };
  if (spec.sameSite === 'no_restriction' && !spec.secure) {
    err.textContent = 'SameSite None requiere activar Secure.';
    err.hidden = false;
    return;
  }
  try {
   
    if (editing && (editing.name !== spec.name || editing.domain !== spec.domain || editing.path !== spec.path)) {
      await chrome.cookies.remove({ url: cookieUrl(editing), name: editing.name, storeId: editing.storeId });
    }
    await saveCookie(spec);
    $('dlg-edit').close();
    toast('Cookie guardada');
    refresh();
  } catch (ex) {
    err.textContent = ex.message;
    err.hidden = false;
  }
});


$('btn-import').addEventListener('click', () => {
  $('import-text').value = '';
  $('import-error').hidden = true;
  $('dlg-import').showModal();
});
$('import-cancel').addEventListener('click', () => $('dlg-import').close());

$('form-import').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('import-error');
  err.hidden = true;
  let items;
  try {
    items = JSON.parse($('import-text').value);
    if (items && !Array.isArray(items) && Array.isArray(items.cookies)) items = items.cookies;
    if (items && !Array.isArray(items) && typeof items === 'object') items = [items];
    if (!Array.isArray(items)) throw new Error();
  } catch {
    err.textContent = 'JSON no válido: se espera una lista de cookies.';
    err.hidden = false;
    return;
  }
  const host = new URL(pageUrl).hostname;
  let ok = 0, otherSite = 0;
  const skipped = [];
  const errors = [];
  for (const it of items) {
    try {
      if (!it || !it.name) throw new Error('falta el nombre');
      const domain = it.domain || host;
      const spec = {
        name: it.name,
        value: it.value,
        domain,
        path: it.path,
        secure: it.secure,
        httpOnly: it.httpOnly,
        sameSite: it.sameSite,
        expirationDate: it.session ? null : (it.expirationDate ?? it.expires)
      };
      await saveCookie(spec);
      ok++;
      const d = domain.replace(/^\./, '');
      if (host !== d && !host.endsWith('.' + d)) otherSite++;
    } catch (ex) {
      if (ex.expired) { skipped.push(it.name); continue; }
      errors.push(`${it && it.name ? it.name : '(sin nombre)'}: ${ex.message}`);
    }
  }
  if (ok) await refresh();
  if (errors.length) {
    const shown = errors.slice(0, 6).join('\n');
    err.textContent = `${ok} importadas, ${errors.length} con error:\n${shown}` + (errors.length > 6 ? '\n…' : '');
    err.hidden = false;
    return; 
  }
  $('dlg-import').close();
  toast(`Importadas: ${ok}` + (skipped.length ? ` · ${skipped.length} omitidas por expiradas` : '') + (otherSite ? ` · ${otherSite} son de otro dominio y no salen en esta lista` : ''));
});

init();
