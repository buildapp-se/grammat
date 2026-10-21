// Den delade ICA-listan, via ICA-appens inofficiella API (flödet från github.com/lazytarget/ha-ica-todo).
// Samma tolkning som worker/ica.ts i repot recept. ica-articles.json byggs där: uv run scripts/ica_list.py articles, sedan vikt (fold).
// Inloggningen sköter workern själv med secrets ICA_USERNAME och ICA_PASSWORD, och sparar token i tabellen ica.
import articles from './ica-articles.json' with { type: 'json' };

const AUTH = 'https://ims.icagruppen.se';
const API = 'https://apimgw-pub.ica.se/sverige/digx/mobile/shoppinglistservice/v1';
const UNSPECIFIED = 12; // ICA:s varugrupp "Ospecificerad"

const UNITS = {
  g: 'g', gr: 'g', gram: 'g', kg: 'kg', kilo: 'kg', hg: 'hg', l: 'l', liter: 'l', dl: 'dl', cl: 'cl', ml: 'ml',
  msk: 'msk', tsk: 'tsk', krm: 'krm', st: 'st', styck: 'st', stycken: 'st',
  förp: 'förp', förpackning: 'förp', paket: 'förp', pkt: 'förp', burk: 'burk', burkar: 'burk', påse: 'påse', påsar: 'påse',
  knippe: 'knippe', knippen: 'knippe', kruka: 'kruka', krukor: 'kruka', klyfta: 'klyftor', klyftor: 'klyftor', skiva: 'skivor', skivor: 'skivor', nypa: 'nypa',
};
const FRACTION = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3 };

// Samma vikning som artikelindexet byggs med: gemener, utan diakritik, bindestreck mellan ord ("gul lök" -> "gul-lok").
export const fold = s => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const amount = text => text.trim().split(/\s+/).reduce((sum, part) => {
  const [a, b] = part.split('/');
  return sum + (b === undefined ? Number(a.replace(',', '.')) : Number(a) / Number(b));
}, 0);

// Egen rad som "2 l mjölk" -> { name: 'mjölk', quantity: 2, unit: 'l' }. Ett intervall ("2-3") räknas som det övre, ett bart tal som styck.
export function parseIngredient(text) {
  let rest = text.replace(/\([^)]*\)/g, ' ')
    .replace(/(\d*)\s*([½¼¾⅓⅔])/g, (_, whole, f) => ` ${(Number(whole || 0) + FRACTION[f]).toFixed(2)} `)
    .replace(/\s+/g, ' ').trim();
  const q = /^(?:ca\.?|cirka) ?/i.exec(rest);
  if (q) rest = rest.slice(q[0].length);
  const m = /^(\d+(?:[.,]\d+)?(?: \d+\/\d+)?|\d+\/\d+)(?: ?[-–] ?(\d+(?:[.,]\d+)?))? ?/.exec(rest);
  if (!m) return { name: rest || text.trim() };
  rest = rest.slice(m[0].length);
  const quantity = Math.round(amount(m[2] ?? m[1]) * 100) / 100;
  const u = /^([a-zåäö]+)\.? /i.exec(rest);
  const unit = u ? UNITS[u[1].toLowerCase()] : undefined;
  if (unit) rest = rest.slice(u[0].length);
  const name = rest.split(',')[0].replace(/[®™]/g, '').trim();
  if (!name || !(quantity > 0)) return { name: text.trim() };
  return { name, quantity, unit: unit ?? 'st' };
}

// ICA-artikeln för ett namn: hela namnet först, sedan längsta ordföljden i det ("finhackad gul lök" hittar "gul lök").
export function matchArticle(name, index = articles) {
  const words = name.toLowerCase().split(',')[0].split(/[^\p{L}-]+/u).filter(Boolean);
  for (let len = Math.min(words.length, 4); len > 0; len--) {
    for (let at = 0; at + len <= words.length; at++) {
      const hit = index[fold(words.slice(at, at + len).join(' '))];
      if (hit) return hit;
    }
  }
  return null;
}

// En rad som ICA-appen själv skriver den: artikel-id ger ikonen, varugruppen platsen i butiken.
export function toRow(item, offlineId, index = articles) {
  const parsed = item.quantity === undefined ? parseIngredient(item.name) : item;
  const name = parsed.name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || parsed.name;
  const hit = matchArticle(name, index);
  return {
    offlineId, productName: name, isStrikedOver: false,
    sourceId: hit ? hit[0] : -1, articleGroupId: hit ? hit[1] : UNSPECIFIED, articleGroupIdExtended: hit ? hit[2] : UNSPECIFIED,
    ...(parsed.quantity === undefined ? {} : { quantity: parsed.quantity, unit: parsed.unit || 'st' }),
  };
}

export class IcaError extends Error {}

const form = data => ({ 'Content-Type': 'application/x-www-form-urlencoded', body: new URLSearchParams(data) });
const ok = async (res, what) => { if (!res.ok) throw new Error('ICA svarade ' + res.status + ' på ' + what); return res; };

// Publik klient som ICA-appen använder för att registrera sig (const.py i ha-ica-todo). Ger workern ett eget client_id.
const DCR = { client_id: 'ica-app-dcr-registration', client_secret: 'uxLHTBvZ-Z2fV-SbrHl1E-tz7vB3jQFrwAdSLlbVMMu1rxDdvJU0s8KGu9d1wLS4' };
const ACR = 'urn:se:curity:authentication:html-form:IcaCustomers';
const REDIRECT = 'icacurity://app';

async function registerClient() {
  const { body, ...h } = form({ ...DCR, grant_type: 'client_credentials', scope: 'dcr', response_type: 'token' });
  const { access_token } = await (await ok(await fetch(AUTH + '/oauth/v2/token', { method: 'POST', headers: h, body }), 'klientregistreringen')).json();
  const c = await (await ok(await fetch(AUTH + '/register', {
    method: 'POST', headers: { Authorization: 'Bearer ' + access_token, 'Content-Type': 'application/json' }, body: JSON.stringify({ software_id: 'dcr-ica-app-template' }),
  }), 'klientregistreringen')).json();
  return { client_id: c.client_id, client_secret: c.client_secret, scope: c.scope };
}

// Full inloggning med personnummer och lösenord (secrets ICA_USERNAME, ICA_PASSWORD). OAuth med PKCE, där formuläret
// mellan stegen bärs av sessionscookies. fetch har ingen cookieburk, så den här följer omdirigeringarna själv.
async function fullLogin(client, env) {
  if (!env.ICA_USERNAME || !env.ICA_PASSWORD) throw new IcaError('ICA är inte inkopplad: workern saknar ICA_USERNAME och ICA_PASSWORD.');
  const jar = new Map();
  const go = async (url, init = {}, follow = true) => {
    for (let hop = 0; hop < 6; hop++) {
      const res = await fetch(url, { ...init, redirect: 'manual', headers: { ...init.headers, Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') } });
      for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const at = kv.indexOf('='); jar.set(kv.slice(0, at).trim(), kv.slice(at + 1)); }
      const loc = res.headers.get('Location');
      if (!follow || !loc || res.status < 300 || res.status > 399) return res;
      url = new URL(loc, url).href;
      init = {};
    }
    throw new Error('ICA omdirigerade för många gånger');
  };
  const verifier = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(40)))).replace(/[^a-zA-Z0-9]/g, '');
  const challenge = btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const start = await go(AUTH + '/oauth/v2/authorize?' + new URLSearchParams({
    client_id: client.client_id, scope: client.scope, redirect_uri: REDIRECT, response_type: 'code',
    code_challenge: challenge, code_challenge_method: 'S256', prompt: 'login', acr: ACR,
  }), {}, false);
  const loc = new URL(start.headers.get('Location') || '', AUTH).href;
  const state = /[?&]state=(\w*)/.exec(loc)?.[1];
  if (!state) throw new Error('ICA gav ingen state vid inloggningen');
  await ok(await go(loc), 'inloggningssidan');
  const { body, ...h } = form({ userName: env.ICA_USERNAME, password: env.ICA_PASSWORD });
  const page = await go(AUTH + '/authn/authenticate/IcaCustomers', { method: 'POST', headers: h, body });
  if (page.status === 400) throw new IcaError('ICA nekade inloggningen: fel personnummer eller lösenord i workerns secrets?');
  const token = /name="token" value="(\w*)/.exec(await (await ok(page, 'inloggningen')).text())?.[1];
  if (!token) throw new Error('Hittade ingen token i ICA:s inloggningssvar, formuläret har troligen ändrats');
  const f2 = form({ token, state });
  const auth = await go(AUTH + '/oauth/v2/authorize?' + new URLSearchParams({ client_id: client.client_id, forceAuthN: 'true', acr: ACR }),
    { method: 'POST', headers: { 'Content-Type': f2['Content-Type'] }, body: f2.body }, false);
  const code = /[?&]code=(\w*)/.exec(auth.headers.get('Location') || '')?.[1];
  if (!code) throw new Error('ICA gav ingen kod efter inloggningen (' + auth.status + ')');
  const f3 = form({ code, client_id: client.client_id, client_secret: client.client_secret, grant_type: 'authorization_code', scope: client.scope, response_type: 'token', code_verifier: verifier, redirect_uri: REDIRECT });
  return (await ok(await fetch(AUTH + '/oauth/v2/token', { method: 'POST', headers: { 'Content-Type': f3['Content-Type'] }, body: f3.body }), 'tokenutbytet')).json();
}

// Giltig åtkomsttoken. Förnyas när den håller på att gå ut; dör förnyelsetoken (högst 90 dagar) loggar workern in igen
// med sina secrets. Första gången registrerar den också sin egen klient. Allt sparas i tabellen ica.
// ponytail: två förnyelser i samma ögonblick krockar om den roterande förnyelsetoken; ok för två personer, lås om det någonsin händer.
export async function accessToken(db, env) {
  const row = await db.prepare('SELECT state FROM ica WHERE id = 1').first();
  const state = row ? JSON.parse(row.state) : { client: null, token: null };
  if (state.token && state.token.expiry > Date.now() / 1000 + 60) return state.token.access_token;
  let fresh = null;
  if (state.token) {
    const res = await fetch(AUTH + '/oauth/v2/token', {
      method: 'POST',
      headers: { Authorization: 'Basic ' + btoa(state.client.client_id + ':' + state.client.client_secret), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: state.token.refresh_token }),
    });
    if (res.ok) fresh = await res.json();
    else if (res.status !== 400 && res.status !== 401) throw new Error('ICA svarade ' + res.status + ' på tokenförnyelsen');
  }
  if (!fresh) {
    state.client ||= await registerClient();
    fresh = await fullLogin(state.client, env);
  }
  state.token = { access_token: fresh.access_token, refresh_token: fresh.refresh_token || state.token?.refresh_token, expiry: Math.floor(Date.now() / 1000 + fresh.expires_in) };
  await db.prepare('INSERT OR REPLACE INTO ica (id, state) VALUES (1, ?)').bind(JSON.stringify(state)).run();
  return state.token.access_token;
}

// Lägger raderna på ICA-listan listId. Samma vara två gånger med samma enhet blir en rad. Ger antalet rader.
export async function addToIca(items, listId, db, env) {
  const merged = new Map();
  for (const item of items) {
    const p = item.quantity === undefined ? parseIngredient(item.name) : { ...item };
    p.name = p.name.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim() || p.name;
    const key = p.name.toLowerCase() + '|' + (p.unit || '');
    const had = merged.get(key);
    if (!had) merged.set(key, p);
    else if (had.quantity !== undefined && p.quantity !== undefined) had.quantity = Math.round((had.quantity + p.quantity) * 100) / 100;
  }
  const rows = [...merged.values()].map(item => toRow(item, crypto.randomUUID().toUpperCase()));
  if (!rows.length) return 0;
  const res = await fetch(API + '/shoppinglists/' + encodeURIComponent(listId) + '/sync', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + await accessToken(db, env), 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ createdRows: rows }),
  });
  if (!res.ok) throw new Error('ICA svarade ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return rows.length;
}
