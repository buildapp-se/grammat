'use strict';

// ---------- rena funktioner (testas i test.js) ----------
const CATS = ['grönt', 'kött', 'mejeri', 'skafferi', 'fryst', 'övrigt'];
const CAT_LABELS = { 'grönt': 'Grönt', 'kött': 'Kött & chark', 'mejeri': 'Mejeri', 'skafferi': 'Skafferi', 'fryst': 'Fryst', 'övrigt': 'Övrigt' };
const COURSES = ['forratt', 'huvudratt', 'efterratt', 'dryck', 'sas', 'testa'];
const COURSE_LABELS = { forratt: 'Förrätt', huvudratt: 'Huvudrätt', efterratt: 'Efterrätt', dryck: 'Drycker', sas: 'Såser & röror', testa: 'Att testa' };

function keyOf(name) { return name.toLowerCase().trim(); }
function ingLabel(n) { return n === 1 ? '1 ingrediens' : n + ' ingredienser'; }
function normalizeCourse(course) { return COURSES.includes(course) ? course : 'huvudratt'; }

// Summerar valda recept (skalade till valda portioner) till inköpsrader.
// struck = { receptId: [ingrediensnyckel, ...] }: bockade ingredienser (har hemma/redan i grytan) utesluts.
function aggregate(recipes, selections, struck) {
  const byId = Object.fromEntries(recipes.map(r => [r.id, r]));
  const items = new Map();
  for (const sel of selections) {
    const r = byId[sel.id];
    if (!r) continue;
    const f = sel.portions / r.portions;
    for (const ing of r.ingredients) {
      if (ing.skipList) continue;
      const k = keyOf(ing.name);
      if (struck && struck[sel.id] && struck[sel.id].includes(k)) continue;
      let it = items.get(k);
      if (!it) {
        it = { key: k, name: ing.name, cat: CATS.includes(ing.cat) ? ing.cat : 'övrigt', amount: 0, unit: null, count: 0, countUnit: null, toTaste: false, sources: [] };
        items.set(k, it);
      }
      if (ing.amount != null) {
        it.amount += ing.amount * f;
        if (!it.unit) it.unit = ing.unit || 'g';
        if (ing.count) { it.count += ing.count * f; if (!it.countUnit) it.countUnit = ing.countUnit || 'st'; }
      } else if (ing.toTaste) {
        it.toTaste = true;
      }
      it.sources.push({ title: r.title, amount: ing.amount != null ? ing.amount * f : null, unit: ing.unit || null });
    }
  }
  return [...items.values()];
}

// Svenskt talformat: decimalkomma, mellanslag som tusentalsavgränsare.
function fmtNum(n) {
  const r = n >= 100 ? Math.round(n / 5) * 5 : n >= 10 ? Math.round(n) : Math.round(n * 10) / 10;
  const [int, dec] = String(r).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  return dec ? grouped + ',' + dec : grouped;
}

function fmtCount(n) { return fmtNum(Math.round(n * 2) / 2); }

// ponytail: kryddmått/tsk/msk-gissning för småmängder skafferivaror man inte vill väga upp.
// Antar densitet ~1 g/ml (stämmer ungefär för salt/kryddpulver, inte exakt för flingiga örter) - ren display, ingen datamigrering.
function spiceHint(amount, unit, cat) {
  if (unit !== 'g' || cat !== 'skafferi' || !(amount > 0) || amount > 30) return '';
  if (amount < 4) return fmtCount(amount) + ' krm';
  if (amount < 12.5) return fmtCount(amount / 5) + ' tsk';
  return fmtCount(amount / 15) + ' msk';
}

function fmtItem(it) {
  if (it.amount > 0) {
    let s = fmtNum(it.amount) + ' ' + it.unit;
    if (it.count > 0) s += ' (~' + fmtCount(it.count) + ' ' + (it.countUnit || 'st') + ')';
    else { const hint = spiceHint(it.amount, it.unit, it.cat); if (hint) s += ' (~' + hint + ')'; }
    if (it.toTaste) s += ' + efter smak';
    return s;
  }
  return 'efter smak';
}

function fmtIngredient(ing, f) {
  if (ing.amount == null) return 'efter smak';
  const amount = ing.amount * f;
  let s = fmtNum(amount) + ' ' + (ing.unit || 'g');
  if (ing.count) s += ' (~' + fmtCount(ing.count * f) + ' ' + (ing.countUnit || 'st') + ')';
  else { const hint = spiceHint(amount, ing.unit, ing.cat); if (hint) s += ' (~' + hint + ')'; }
  return s;
}

function recipeAsText(recipe, portions) {
  const p = portions || recipe.portions;
  const f = p / recipe.portions;
  const lines = [recipe.title, '', fmtNum(p) + ' portioner', '', 'Ingredienser'];
  let lastGroup = null;
  for (const ing of recipe.ingredients) {
    if ((ing.group || null) !== lastGroup) {
      lastGroup = ing.group || null;
      if (lastGroup) lines.push('', lastGroup);
    }
    lines.push('- ' + ing.name + ': ' + fmtIngredient(ing, f));
  }
  lines.push('', 'Gör så här');
  if (recipe.steps && recipe.steps.length) {
    recipe.steps.forEach((step, i) => lines.push((i + 1) + '. ' + step));
  } else {
    lines.push('Inga steg nedskrivna.');
  }
  if (recipe.source) lines.push('', 'Källa', recipe.source);
  return lines.join('\n');
}

// Slår upp näringsdata för ett ingrediensnamn. Exakt träff först, annars faller den tillbaka
// på den längsta nutrients-nyckeln som förekommer som ett helt ord i namnet (t.ex. "färskost"
// i "färskost med vitlök"), så sammansatta/smaksatta varianter inte bara saknas i onödan.
function findNutrient(name, nutrients) {
  const key = keyOf(name);
  if (nutrients[key]) return nutrients[key];
  let bestKey = null;
  for (const k of Object.keys(nutrients)) {
    const re = new RegExp('(^|[^a-zà-öø-ÿ])' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-zà-öø-ÿ])');
    if (re.test(key) && (!bestKey || k.length > bestKey.length)) bestKey = k;
  }
  return bestKey ? nutrients[bestKey] : null;
}

// Näringsvärde per portion, oberoende av hur många portioner man just nu lagar.
// ponytail: ml behandlas som g (ingen densitetstabell), samma precisionsnivå som aggregate().
function nutritionPerPortion(recipe, nutrients) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  const missing = [];
  for (const ing of recipe.ingredients) {
    if (ing.amount == null) continue; // efter smak: går inte att räkna
    const n = findNutrient(ing.name, nutrients);
    if (!n) { missing.push(ing.name); continue; }
    const f = ing.amount / 100;
    t.kcal += n.kcal * f; t.protein += n.protein * f; t.carbs += n.carbs * f; t.fat += n.fat * f;
  }
  return { kcal: t.kcal / recipe.portions, protein: t.protein / recipe.portions, carbs: t.carbs / recipe.portions, fat: t.fat / recipe.portions, missing };
}

function slugify(title, taken) {
  let base = title.toLowerCase().replace(/[åä]/g, 'a').replace(/ö/g, 'o').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'recept';
  let id = base, i = 2;
  while (taken.includes(id)) id = base + '-' + i++;
  return id;
}

function safeUrl(value) {
  const s = typeof value === 'string' ? value.trim() : '';
  if (!s) return '';
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : '';
  } catch (e) {
    return '';
  }
}

function normalizeState(raw) {
  const s = raw && typeof raw === 'object' && raw.state && typeof raw.state === 'object' ? raw.state : raw;
  if (!s || typeof s !== 'object') throw new Error('Backupen innehåller ingen giltig state.');
  if (!Array.isArray(s.recipes)) throw new Error('Backupen saknar receptlista.');

  const taken = [];
  const recipes = s.recipes.map(r => {
    if (!r || typeof r !== 'object') throw new Error('Backupen innehåller ett trasigt recept.');
    const title = typeof r.title === 'string' && r.title.trim() ? r.title.trim() : '';
    if (!title) throw new Error('Ett recept i backupen saknar namn.');
    if (!Array.isArray(r.ingredients) || !r.ingredients.length) throw new Error('Receptet "' + title + '" saknar ingredienser.');
    const idBase = typeof r.id === 'string' && r.id.trim() ? slugify(r.id, []) : slugify(title, []);
    const id = taken.includes(idBase) ? slugify(idBase, taken) : idBase;
    taken.push(id);
    const out = {
      id,
      title,
      portions: typeof r.portions === 'number' && r.portions >= 1 ? Math.round(r.portions) : 4,
      course: normalizeCourse(r.course),
      source: safeUrl(r.source),
      ingredients: r.ingredients.map(x => {
        if (!x || typeof x !== 'object' || typeof x.name !== 'string' || !x.name.trim()) throw new Error('En ingrediens i "' + title + '" saknar namn.');
        const ing = { name: x.name.trim(), cat: CATS.includes(x.cat) ? x.cat : 'övrigt' };
        if (typeof x.amount === 'number' && x.amount > 0) { ing.amount = x.amount; ing.unit = x.unit === 'ml' ? 'ml' : 'g'; }
        else ing.toTaste = true;
        if (typeof x.count === 'number' && x.count > 0) { ing.count = x.count; ing.countUnit = typeof x.countUnit === 'string' && x.countUnit.trim() ? x.countUnit.trim() : 'st'; }
        if (x.skipList === true) ing.skipList = true;
        if (typeof x.group === 'string' && x.group.trim()) ing.group = x.group.trim();
        return ing;
      }),
      steps: Array.isArray(r.steps) ? r.steps.filter(x => typeof x === 'string' && x.trim()).map(x => x.trim()) : [],
    };
    if (r.private === true) out.private = true; // hemligt: indexeras aldrig av servern
    // src = varifrån receptet sparades (ägar-id + recept-id), driver sparräknaren vid borttag
    if (r.src && typeof r.src === 'object' && Number.isInteger(r.src.owner) && typeof r.src.id === 'string') out.src = { owner: r.src.owner, id: r.src.id };
    return out;
  });

  const struck = {};
  if (s.struck && typeof s.struck === 'object' && !Array.isArray(s.struck)) {
    for (const [id, keys] of Object.entries(s.struck)) {
      if (!Array.isArray(keys) || !recipes.some(r => r.id === id)) continue;
      const ks = keys.filter(k => typeof k === 'string' && k);
      if (ks.length) struck[id] = ks;
    }
  }

  return {
    recipes,
    selections: Array.isArray(s.selections) ? s.selections.map(x => ({ id: String(x.id || ''), portions: Math.max(1, Math.round(Number(x.portions) || 1)) })).filter(x => recipes.some(r => r.id === x.id)) : [],
    extras: Array.isArray(s.extras) ? s.extras.map(x => ({ id: x.id != null ? x.id : Date.now(), text: String(x.text || '').trim().slice(0, 80) })).filter(x => x.text) : [],
    checked: Array.isArray(s.checked) ? s.checked.map(String) : [],
    struck,
  };
}

function makeBackup(state) {
  return { app: 'grammat', version: 1, exportedAt: new Date().toISOString(), state: normalizeState(state) };
}

// Allas recept: plockar bort recept som redan finns i startpaketet, taggar kvarvarande
// med ägarnamn ENDAST när samma id förekommer hos fler än en ägare (disambiguering).
// Sök: titel eller ingrediensnamn innehåller frasen, skiftlägesokänsligt.
function matchesQuery(r, q) {
  q = String(q || '').trim().toLowerCase();
  if (!q) return true;
  return r.title.toLowerCase().includes(q) || r.ingredients.some(i => i.name.toLowerCase().includes(q));
}

// Tider i ett stegs text ("koka 20 min", "vila 1 tim") -> [{ label, minutes }].
// ponytail: intervall som "10-15 min" ger övre gränsen, sekunder ignoreras.
function stepTimers(text) {
  const out = [];
  for (const m of String(text).matchAll(/(\d+(?:[,.]\d+)?)\s*(minuter|minut|min|timmar|timme|tim|h)\b/gi)) {
    const n = Number(m[1].replace(',', '.'));
    const minutes = /^(tim|h)/i.test(m[2]) ? n * 60 : n;
    if (minutes > 0 && minutes <= 24 * 60 && !out.some(t => t.minutes === minutes)) out.push({ label: m[0].trim(), minutes });
  }
  return out;
}

// Ingredienser som nämns i ett steg: hela namnet först, annars ett ord ur namnet (minst tre
// tecken, med ordgräns framför så "lök" träffar "löken" men inte "vitlöken"). Parenteser och
// småord hoppas över. Tomt svar betyder att köksläget inte visar någon ruta för steget.
const STEP_STOP = new Set(['och', 'eller', 'till', 'med', 'utan', 'fryst', 'färsk', 'färska', 'hackad', 'riven', 'tärnad', 'skivad', 'stor', 'liten', 'små', 'gul', 'röd', 'grön', 'vit']);
function stepIngredients(stepText, ingredients) {
  const text = String(stepText).toLowerCase();
  const bound = w => new RegExp('(^|[^a-zåäöé])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return ingredients.filter(ing => {
    const name = ing.name.toLowerCase().replace(/\(.*?\)/g, ' ').trim();
    if (name && bound(name).test(text)) return true;
    return name.split(/[\s,]+/).some(w => w.length >= 3 && !STEP_STOP.has(w) && bound(w).test(text));
  });
}

function dedupeAllas(allasList, starterIds) {
  const starterSet = new Set(starterIds);
  const others = allasList.filter(r => !starterSet.has(r.id));
  const counts = {};
  for (const r of others) counts[r.id] = (counts[r.id] || 0) + 1;
  return others.map(r => ({ ...r, _ownerLabel: r.owner || null, _idCollision: counts[r.id] > 1 }));
}

// Tolkar och normaliserar JSON (ett recept eller en array av recept) som en AI-modell
// producerat med importprompten. Returnerar alltid en array. Allt eller inget vid fel.
function parseImport(text, takenIds) {
  let t = String(text).trim().replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  const oa = t.indexOf('{'), ob = t.lastIndexOf('}');
  const aa = t.indexOf('['), ab = t.lastIndexOf(']');
  let d = null;
  if (aa !== -1 && ab > aa && (oa === -1 || aa < oa)) {
    try { d = JSON.parse(t.slice(aa, ab + 1)); } catch (e) { /* prova objektet nedan */ }
  }
  if (d === null) {
    if (oa === -1 || ob <= oa) throw new Error('Hittar ingen JSON i det inklistrade. Klistra in hela svaret från AI-modellen.');
    try { d = JSON.parse(t.slice(oa, ob + 1)); } catch (e) { throw new Error('Trasig JSON: ' + e.message); }
  }
  const list = Array.isArray(d) ? d : [d];
  if (!list.length) throw new Error('Arrayen är tom, inga recept att läsa in.');
  const taken = takenIds.slice();
  return list.map((r, i) => {
    let recipe;
    try { recipe = importRecipe(r, taken); }
    catch (e) { throw list.length > 1 ? new Error('Recept ' + (i + 1) + ': ' + e.message) : e; }
    taken.push(recipe.id);
    return recipe;
  });
}

function importRecipe(d, takenIds) {
  if (!d || typeof d !== 'object') throw new Error('Receptet är inte ett JSON-objekt.');
  if (typeof d.title !== 'string' || !d.title.trim()) throw new Error('Fältet "title" saknas.');
  if (!Array.isArray(d.ingredients) || !d.ingredients.length) throw new Error('Fältet "ingredients" saknas eller är tomt.');
  const ingredients = d.ingredients.map(x => {
    if (!x || typeof x.name !== 'string' || !x.name.trim()) throw new Error('En ingrediens saknar namn.');
    const ing = { name: x.name.trim(), cat: CATS.includes(x.cat) ? x.cat : 'övrigt' };
    if (typeof x.amount === 'number' && x.amount > 0) { ing.amount = x.amount; ing.unit = x.unit === 'ml' ? 'ml' : 'g'; }
    else ing.toTaste = true;
    if (typeof x.count === 'number' && x.count > 0) { ing.count = x.count; ing.countUnit = typeof x.countUnit === 'string' && x.countUnit.trim() ? x.countUnit.trim() : 'st'; }
    if (x.skipList === true) ing.skipList = true;
    if (typeof x.group === 'string' && x.group.trim()) ing.group = x.group.trim();
    return ing;
  });
  return {
    id: slugify(d.title, takenIds),
    title: d.title.trim(),
    portions: typeof d.portions === 'number' && d.portions >= 1 ? Math.round(d.portions) : 4,
    course: normalizeCourse(d.course),
    source: safeUrl(d.source),
    ingredients,
    steps: Array.isArray(d.steps) ? d.steps.filter(s => typeof s === 'string' && s.trim()).map(s => s.trim()) : [],
  };
}

const AI_PROMPT = `Du får ett eller flera recept nedan (som text eller länkar). Gör om dem till JSON enligt exakt detta format och svara med ENBART en JSON-array, utan kodstaket och utan förklaringar.

[{
  "title": "Receptets namn",
  "portions": 4,
  "course": "huvudratt",
  "source": "",
  "ingredients": [
    { "name": "gul lök", "amount": 220, "unit": "g", "count": 2, "countUnit": "st", "cat": "grönt" },
    { "name": "olivolja", "amount": 30, "unit": "ml", "cat": "skafferi" },
    { "name": "salt", "toTaste": true, "cat": "skafferi" },
    { "name": "vatten", "amount": 200, "unit": "ml", "skipList": true, "cat": "övrigt" }
  ],
  "steps": ["Första steget.", "Andra steget."]
}]

Regler:
- Svara alltid med en array, även för ett enda recept. Får du flera recept eller flera länkar: lägg alla som egna objekt i samma array.
- Alla mängder i gram ("unit": "g") eller milliliter ("unit": "ml"). Konvertera: 1 msk = 15 ml, 1 tsk = 5 ml, 1 krm = 1 ml, 1 dl = 100 ml.
- Styckvaror: räkna om till gram med normalvikter (gul lök 110 g/st, morot 120 g/st, tomat 120 g/st, vitlök 5 g/klyfta, lime 65 g/st, potatis 100 g/st) och ange dessutom "count" (ungefärligt antal) och "countUnit" ("st", "klyftor", "burk", "förp", "bunt").
- Torrvaror per dl: vetemjöl 60 g, socker 85 g, ris 85 g, havregryn 35 g, riven ost 40 g, linser 85 g. Smör: 1 msk = 15 g.
- Kryddor eller annat utan angiven mängd ("efter smak", "till servering"): utelämna "amount" och sätt "toTaste": true.
- Vatten och annat man inte köper i butiken: behåll mängden men sätt "skipList": true.
- "cat" måste vara exakt en av: "grönt", "kött", "mejeri", "skafferi", "fryst", "övrigt".
- "portions": antalet portioner receptet gäller. Framgår det inte, uppskatta.
- "course" måste vara exakt en av: "forratt", "huvudratt", "efterratt", "dryck", "sas" (såser & röror). Gissa den som passar bäst, framgår det inte: "huvudratt".
- Har receptet delar (t.ex. sås, garnering): sätt "group": "Sås" osv. på de ingrediensernas rader.
- "steps": tillagningsstegen som en lista med strängar, ett steg per element. Saknas steg: tom lista.
- Ingrediensnamn: gemener, korta och butiksvänliga ("gul lök", inte "finhackad stor gul lök"). Samma vara ska heta samma sak som i andra recept.
- Beskriver källan HUR en ingrediens ska förberedas (finhackad, riven, tärnad, skivad, pressad osv.) och det inte redan står i ett steg: flytta in det i lämpligt steg i stället för att bara stryka det, t.ex. "Finhacka jalapeñon och blanda ihop alla ingredienser."
- "source": receptets webbadress om den framgår, annars tom sträng.

Recept:
`;

if (typeof module !== 'undefined') { module.exports = { ingLabel, stepIngredients, CATS, COURSES, COURSE_LABELS, normalizeCourse, aggregate, fmtNum, fmtItem, fmtIngredient, recipeAsText, spiceHint, nutritionPerPortion, findNutrient, keyOf, slugify, safeUrl, normalizeState, makeBackup, parseImport, dedupeAllas, matchesQuery, stepTimers }; }

// ---------- app ----------
if (typeof document !== 'undefined') (async function () {
  const API = 'https://recept-api.buildapp.se';
  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let fb = null;                 // Firebase-modulen (window.fb), null tills CDN-laddningen är klar
  let fbUser = null;             // inloggad Firebase-användare
  let legacy = JSON.parse(localStorage.getItem('auth') || 'null'); // gammalt namn+PIN-konto (utfasas)
  let authName = localStorage.getItem('authName') || (legacy ? legacy.name : null); // D1-namnet, sätts av /state
  const loggedIn = () => !!(fbUser || legacy);
  let state = JSON.parse(localStorage.getItem('state') || 'null');
  let starter = [];
  let nutrients = {};
  // versionsquery av samma skäl som app.js i index.html: Cloudflare-edgecachen har lång max-age
  try { starter = await (await fetch('starter.json?v=steps-20260804')).json(); } catch (e) { /* offline utan cache */ }
  try { nutrients = await (await fetch('nutrients.json')).json(); } catch (e) { /* offline utan cache */ }
  if (!state) state = { recipes: [], selections: [], extras: [], checked: [], struck: {} };
  try { state = normalizeState(state); } catch (e) { state = { recipes: [], selections: [], extras: [], checked: [], struck: {} }; }

  async function api(path, opts = {}) {
    const token = fbUser ? await fbUser.getIdToken() : legacy ? legacy.token : null;
    const res = await fetch(API + path, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Något gick fel (' + res.status + ').');
    return data;
  }

  let pushTimer = null;
  let syncError = false;
  let lastSynced = null; // senaste lyckade skrivning eller läsning mot servern
  // Synkstatus för listan: bockar skrivs alltid lokalt först, servern får dem 800 ms senare.
  function syncStatus() {
    if (!loggedIn()) return { cls: '', text: 'Sparas i den här webbläsaren' };
    if (!navigator.onLine || syncError) return { cls: 'is-offline', text: 'Offline · sparas lokalt, synkas sen' };
    if (pushTimer) return { cls: '', text: 'Sparar…' };
    if (lastSynced) return { cls: '', text: 'Synkad ' + lastSynced.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' }) };
    return { cls: '', text: 'Synkad' };
  }
  function syncPill(allDone) {
    const st = allDone ? { cls: 'is-ok', text: 'Allt klart' } : syncStatus();
    return `<div class="pill ${st.cls}" id="syncPill"><i></i>${esc(st.text)}</div>`;
  }
  function updateSyncPill() {
    const pill = $('#syncPill');
    if (pill && !pill.classList.contains('is-ok')) pill.outerHTML = syncPill(false);
  }
  function save(rerender = true) {
    localStorage.setItem('state', JSON.stringify(state));
    if (loggedIn()) {
      clearTimeout(pushTimer);
      pushTimer = setTimeout(async () => {
        try { await api('/state', { method: 'PUT', body: JSON.stringify(state) }); syncError = false; lastSynced = new Date(); }
        catch (e) { syncError = true; renderNav(); }
        pushTimer = null;
        updateSyncPill();
      }, 800);
    }
    if (rerender) render();
  }
  window.addEventListener('online', () => { if (syncError && loggedIn()) save(false); updateSyncPill(); });
  window.addEventListener('offline', updateSyncPill);

  async function pullState() {
    if (!loggedIn()) return;
    try {
      const { state: remote, name } = await api('/state');
      if (name) { authName = name; localStorage.setItem('authName', name); }
      if (remote && Array.isArray(remote.recipes)) { state = normalizeState(remote); localStorage.setItem('state', JSON.stringify(state)); }
      else save(false); // nytt konto: ladda upp det lokala
      syncError = false;
      lastSynced = new Date();
    } catch (e) {
      if (e.message === 'Inte inloggad.' || String(e.message).includes('401')) { legacy = null; localStorage.removeItem('auth'); }
      syncError = true;
    }
  }

  // ---------- toast och sheet ----------
  // Toast längst ner ovanför naven. onTimeout körs när den försvinner av sig själv (inte vid Ångra),
  // så en destruktiv åtgärd kan vänta med skrivningen tills ångra-fönstret gått ut.
  let toastTimer = null;
  let toastOnTimeout = null;
  function hideToast(byAction) {
    clearTimeout(toastTimer);
    const pending = toastOnTimeout;
    toastOnTimeout = null;
    $('#toast').hidden = true;
    if (!byAction && pending) pending();
  }
  function toast(text, opts = {}) {
    if (toastOnTimeout) hideToast(false); // föregående ångra-fönster stängs: dess skrivning görs nu
    const el = $('#toast');
    const action = !opts.action ? '' : opts.href
      ? `<a class="toast-action" href="${esc(opts.href)}">${esc(opts.action)}</a>`
      : `<button class="toast-action" type="button">${esc(opts.action)}</button>`;
    el.innerHTML = `<span class="toast-text">${esc(text)}</span>${action}`;
    el.hidden = false;
    const act = el.querySelector('.toast-action');
    if (act) act.onclick = () => { hideToast(true); if (opts.onAction) opts.onAction(); };
    toastOnTimeout = opts.onTimeout || null;
    toastTimer = setTimeout(() => hideToast(false), opts.ms || 4000);
  }
  function openSheet(html, title) {
    const sh = $('#sheet');
    sh.querySelector('.sheet-panel').innerHTML = (title ? `<div class="sheet-title">${esc(title)}</div>` : '') + html;
    sh.hidden = false;
    sh.querySelector('.sheet-back').onclick = closeSheet;
    sh.querySelectorAll('[data-close]').forEach(b => { b.onclick = closeSheet; });
    sh.querySelectorAll('a.sheet-item').forEach(a => a.addEventListener('click', closeSheet));
    const first = sh.querySelector('button, a, input, select');
    if (first) first.focus();
    return sh.querySelector('.sheet-panel');
  }
  function closeSheet() { $('#sheet').hidden = true; }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  const sheetItem = (label, attrs, sub) => `<button class="sheet-item" type="button" ${attrs}>${esc(label)}${sub ? ` <small>${esc(sub)}</small>` : ''}</button>`;

  // ---------- vyer ----------
  function selFor(id) { return state.selections.find(s => s.id === id); }
  let query = ''; // sökfras, delas av Mina/Allas/Vänner och överlever omrendering
  const searchBox = () => `<p class="search"><input type="search" id="q" value="${esc(query)}" placeholder="${desk.matches ? 'Sök recept, ingrediens' : 'Sök recept eller ingrediens'}" aria-label="Sök recept" autocomplete="off"></p>`;
  const noMatch = () => `<p class="empty">Inget recept matchar "${esc(query.trim())}".</p>`;
  const previewPortions = {}; // portionsvisning på receptsidan innan receptet lagts i listan
  const recipeIdFromHash = (h = location.hash) => { const m = h.match(/^#\/recept\/([^/]+)/); return m ? localRecipeId(decodeURIComponent(m[1])) : null; };
  let lastTab = '#/'; // fliken man kom ifrån, ger receptvyns tillbaka-knapp sitt namn
  const BACK_LABELS = { '#/': 'Mina recept', '#/lista': 'Lista', '#/vanner': 'Vänner', '#/allas': 'Allas recept' };
  // recept kan visas/öppnas innan de finns i egna state.recipes (Allas recept-fliken)
  function publicRowKey(r) { return Number.isInteger(r.ownerId) ? r.ownerId + '|' + r.id : 'starter|' + r.id; }
  function allPublicRows() {
    return (allasList || [])
      .concat(friendList || [])
      .concat(Object.values(userProfiles).flatMap(p => p.recipes || []));
  }
  function findPublicRecipe(id) {
    return allPublicRows().find(x => publicRowKey(x) === id) || allPublicRows().find(x => x.id === id);
  }
  function findRecipe(id) { return state.recipes.find(x => x.id === id) || starter.find(x => x.id === id) || findPublicRecipe(id); }
  function localRecipeId(id) {
    const own = allPublicRows().find(r => publicRowKey(r) === id && authName && r.owner === authName);
    return own && state.recipes.some(r => r.id === own.id) ? own.id : id;
  }

  let allasList = null; // null = ej hämtad än
  let allasLoading = false;
  let allasLoadError = false;
  let friendList = null;
  let friendLoading = false;
  let friendLoadError = false;
  let connections = null;
  let connectionsLoading = false;
  let connectionsError = false;
  let connectionsVersion = 0;
  let friendNotice = '';
  let friendErrorMessage = '';
  let friendNameDraft = '';
  let friendsBusy = false;
  let userProfiles = {};
  function resetRemoteCaches() {
    allasList = null;
    friendList = null;
    connections = null;
    connectionsVersion++;
    connectionsLoading = false;
    friendLoading = false;
    friendLoadError = false;
    userProfiles = {};
    friendNotice = '';
    friendErrorMessage = '';
    friendNameDraft = '';
    connectionsError = false;
  }
  function loadAllas() {
    if (allasList !== null || allasLoading) return;
    allasLoading = true;
    allasLoadError = false;
    api('/feed')
      .catch(() => api('/allas-recept').then(list => list.map(r => ({ ...r, course: normalizeCourse(r.course) }))))
      .then(list => { allasList = list.map(r => ({ ...r, course: normalizeCourse(r.course) })); render(); })
      .catch(() => { allasLoadError = true; render(); })
      .finally(() => { allasLoading = false; });
  }

  function loadUserProfile(ownerId) {
    if (!loggedIn() || userProfiles[ownerId]?.loading || userProfiles[ownerId]?.recipes) return;
    userProfiles[ownerId] = { loading: true, error: false, recipes: null, owner: '' };
    api('/users/' + encodeURIComponent(ownerId) + '/recipes')
      .then(data => {
        userProfiles[ownerId] = {
          loading: false,
          error: false,
          owner: data.owner || '',
          recipes: (data.recipes || []).map(r => ({ ...r, course: normalizeCourse(r.course) })),
        };
        render();
      })
      .catch(() => { userProfiles[ownerId] = { loading: false, error: true, recipes: null, owner: '' }; render(); });
  }

  function loadFriends() {
    if (!loggedIn() || friendList !== null || friendLoading) return;
    friendLoading = true;
    friendLoadError = false;
    const version = connectionsVersion;
    api('/friends-feed')
      .then(list => { if (version === connectionsVersion) friendList = list.map(r => ({ ...r, course: normalizeCourse(r.course), _ownerLabel: r.owner || '' })); })
      .catch(() => { if (version === connectionsVersion) friendLoadError = true; })
      .finally(() => { if (version === connectionsVersion) { friendLoading = false; render(); } });
  }

  function loadConnections() {
    if (!loggedIn() || connections !== null || connectionsLoading || connectionsError) return;
    connectionsLoading = true;
    const version = connectionsVersion;
    api('/friends')
      .then(data => { if (version === connectionsVersion) connections = data; })
      .catch(() => { if (version === connectionsVersion) connectionsError = true; })
      .finally(() => { if (version === connectionsVersion) { connectionsLoading = false; render(); } });
  }

  function refreshFriends() {
    connectionsVersion++;
    connectionsLoading = false;
    friendLoading = false;
    connections = null;
    connectionsError = false;
    friendList = null;
    friendLoadError = false;
    render();
  }

  // Knapparna delas av korten, raderna och desktopens innehållsförteckning.
  function listBtn(r) {
    const sel = selFor(r.id);
    return `<button type="button" class="rcard-btn${sel ? ' is-on' : ''}" data-toggle-list="${esc(r.id)}" aria-pressed="${sel ? 'true' : 'false'}" aria-label="${sel ? 'Ta bort ur listan' : 'Lägg i listan'}: ${esc(r.title)}">${sel ? '✓' : '+'}</button>`;
  }
  function saveBtn(r) {
    const key = publicRowKey(r);
    return mineForPublic(r)
      ? `<button type="button" class="rcard-btn is-on" data-remove-allas="${esc(key)}" aria-pressed="true" aria-label="Ta bort ur mina recept: ${esc(r.title)}">✓</button>`
      : `<button type="button" class="rcard-btn" data-add-allas="${esc(key)}" aria-pressed="false" aria-label="Spara till mina recept: ${esc(r.title)}">+</button>`;
  }

  // Hela kortet öppnar receptet, knappen i hörnet lägger i/tar ur listan. Kortet byter aldrig höjd.
  function recipeCard(r) {
    const sel = selFor(r.id);
    const nutr = nutritionPerPortion(r, nutrients);
    const portions = sel ? sel.portions : r.portions;
    return `<article class="card rcard">
      <a class="rcard-link" href="#/recept/${esc(r.id)}"><span class="card-title">${esc(r.title)}</span><span class="card-meta">${portions} port${nutr.kcal ? ` · ${fmtNum(nutr.kcal)} kcal/port` : ''}</span></a>
      ${listBtn(r)}
    </article>`;
  }

  // ---------- desktop: listorna som innehållsförteckning (AP8, mockup H) ----------
  // Från 700 px ritas Mina recept, Allas recept, Vänner och användarsidan som numrerade rader
  // med ett register i en klistrad vänsterspalt. Under 700 px gäller korten och raderna ovan
  // och nedan. jsdom saknar matchMedia, så test-ui.cjs prövar alltid mobilvyn.
  const desk = window.matchMedia ? window.matchMedia('(min-width:700px)') : { matches: false };
  if (desk.addEventListener) desk.addEventListener('change', () => render());
  let tocFilter = null; // Allas recept: registret filtrerar på en kategori i stället för att rulla

  // Löpnumret ritas av en CSS-räknare (decimal-leading-zero), det finns inte i DOM.
  function tocRow(r, linkId, btn, extra = '') {
    const nutr = nutritionPerPortion(r, nutrients);
    const sel = selFor(r.id);
    const portions = btn === listBtn && sel ? sel.portions : r.portions;
    return `<article class="toc-row">
      <a class="toc-title" href="#/recept/${esc(linkId)}">${esc(r.title)}<span class="toc-open" aria-hidden="true">Öppna ›</span></a>
      <span class="toc-meta">${esc(portions)} port${nutr.kcal ? ` · ${fmtNum(nutr.kcal)} kcal` : ''}${extra}</span>
      ${btn(r)}
    </article>`;
  }
  const tocOwnRow = r => tocRow(r, r.id, listBtn);
  function tocPublicRow(r, showOwner) {
    if (authName && r.owner === authName) {
      const own = state.recipes.find(x => x.id === r.id);
      if (own) return tocRow(own, own.id, listBtn, ' · ditt recept');
    }
    return tocRow(r, Number.isInteger(r.ownerId) ? publicRowKey(r) : r.id, saveBtn,
      (r.saves ? ` · sparad av ${fmtNum(r.saves)}` : '') + (showOwner && r._ownerLabel ? ' · från ' + esc(r._ownerLabel) : ''));
  }
  const tocSection = (id, label, body, accent) => `<section id="toc-${esc(id)}"><h2 class="toc-h${accent ? ' is-accent' : ''}">${esc(label)}</h2>${body}</section>`;
  // Registret är knappar, inte #-länkar: hashen är appens router, ett ankare hade bytt vy.
  const regRow = (target, label, n, cls) => `<button type="button" class="${cls || ''}" data-toc="${esc(target)}"><span>${esc(label)}</span><span class="n">${n}</span></button>`;
  function tocLayout(title, count, register, main, o = {}) {
    return `<div class="toc"${o.filter ? ' data-filter="1"' : ''}>
      <aside class="toc-side">
        <div><h1>${esc(title).replace(' ', '<br>')}</h1><div class="toc-count">${count}</div></div>
        ${o.search === false ? '' : searchBox()}
        <nav class="toc-reg" aria-label="Register">${register}</nav>
        ${o.side || ''}
      </aside>
      <div class="toc-main">${main}</div>
    </div>`;
  }
  function groupByCourse(list) {
    const by = {};
    for (const r of list) { const c = normalizeCourse(r.course); (by[c] = by[c] || []).push(r); }
    return by;
  }
  // Allas recept och användarsidan. o: showOwner, filter (registret filtrerar), empty, tail, side
  function tocPublic(title, list, o = {}) {
    const hits = list.filter(r => matchesQuery(r, query));
    const by = groupByCourse(hits);
    const courses = COURSES.filter(c => by[c]);
    const active = o.filter && courses.includes(tocFilter) ? tocFilter : null;
    const register = (o.filter ? regRow('', 'Alla', hits.length, active ? '' : 'is-on') : '')
      + courses.map(c => regRow(c, COURSE_LABELS[c], by[c].length, active === c ? 'is-on' : '')).join('');
    const sections = (active ? [active] : courses)
      .map(c => tocSection(c, COURSE_LABELS[c], by[c].map(r => tocPublicRow(r, o.showOwner !== false)).join(''))).join('');
    return tocLayout(title, `${list.length} recept`, register,
      (hits.length ? sections : list.length ? noMatch() : o.empty || '') + (o.tail || ''), o);
  }

  function viewCatalog() {
    const hits = state.recipes.filter(r => matchesQuery(r, query));
    const inList = hits.filter(r => selFor(r.id));
    const byCourse = {};
    for (const r of hits) if (!selFor(r.id)) (byCourse[r.course] = byCourse[r.course] || []).push(r);
    const sections = (inList.length ? `<h2>I listan</h2><div class="cards">${inList.map(recipeCard).join('')}</div>` : '')
      + COURSES.filter(c => byCourse[c]).map(c => `
      <h2>${esc(COURSE_LABELS[c])}</h2>
      <div class="cards">${byCourse[c].map(recipeCard).join('')}</div>`).join('');
    const empty = `<div class="empty-state">
      <div class="empty-title">Inga recept ännu</div>
      <p>Skriv ditt första recept eller spara ett från Allas recept.</p>
      <p class="action-row"><a class="btn btn-ink" href="#/nytt">Skriv ett recept</a><a class="btn btn-ghost" href="#/allas">Allas recept</a></p>
    </div>`;
    if (desk.matches && state.recipes.length) {
      const courses = COURSES.filter(c => byCourse[c]);
      const n = state.selections.length;
      return tocLayout('Mina recept', `${state.recipes.length} recept${n ? ` · ${n} i listan` : ''}`,
        (inList.length ? regRow('lista', 'I listan', inList.length, 'is-accent') : '') + courses.map(c => regRow(c, COURSE_LABELS[c], byCourse[c].length)).join(''),
        !hits.length ? noMatch() : (inList.length ? tocSection('lista', 'I listan', inList.map(tocOwnRow).join(''), true) : '')
          + courses.map(c => tocSection(c, COURSE_LABELS[c], byCourse[c].map(tocOwnRow).join(''))).join(''));
    }
    return `<div class="view-head"><h1>Mina recept</h1></div>
      ${state.recipes.length ? searchBox() : ''}
      ${!state.recipes.length ? empty : hits.length ? sections : noMatch()}`;
  }

  function mineForPublic(r) {
    const mySrcs = new Set(state.recipes.filter(r => r.src).map(r => r.src.owner + '|' + r.src.id));
    const myLocalIds = new Set(state.recipes.filter(r => !r.src).map(r => r.id));
    return Number.isInteger(r.ownerId)
      ? mySrcs.has(publicRowKey(r)) || ((r.owner === 'grammat' || r.owner === authName) && myLocalIds.has(r.id))
      : myLocalIds.has(r.id);
  }

  // Allas, Vänner och profilsidor: en rad på 64 px per recept, hela raden öppnar receptet,
  // knappen till höger sparar (+) eller visar att det redan är sparat (grön ✓).
  function publicRecipeRow(r, showOwner = true) {
    if (authName && r.owner === authName) {
      const own = state.recipes.find(x => x.id === r.id);
      if (own) return recipeRowOwn(own);
    }
    const nutr = nutritionPerPortion(r, nutrients);
    const linkId = Number.isInteger(r.ownerId) ? publicRowKey(r) : r.id;
    const owner = showOwner && r._ownerLabel ? ' · från ' + esc(r._ownerLabel) : '';
    return `<article class="prow">
      <a class="prow-link" href="#/recept/${esc(linkId)}"><span class="prow-title">${esc(r.title)}</span><span class="prow-meta">${esc(r.portions)} port${nutr.kcal ? ` · ${fmtNum(nutr.kcal)} kcal` : ''}${r.saves ? ` · sparad av ${fmtNum(r.saves)}` : ''}${owner}</span></a>
      ${saveBtn(r)}
    </article>`;
  }
  // Ett eget recept som råkar ligga i det publika flödet: samma rad, knappen styr listan.
  function recipeRowOwn(r) {
    const sel = selFor(r.id);
    const nutr = nutritionPerPortion(r, nutrients);
    return `<article class="prow">
      <a class="prow-link" href="#/recept/${esc(r.id)}"><span class="prow-title">${esc(r.title)}</span><span class="prow-meta">${(sel ? sel.portions : r.portions)} port${nutr.kcal ? ` · ${fmtNum(nutr.kcal)} kcal` : ''} · ditt recept</span></a>
      ${listBtn(r)}
    </article>`;
  }

  // Kategorierna fälls ihop, valet minns i localStorage. Stora kategorier visar fem rader
  // och "Visa N till" tills man bett om resten (i minnet, nollställs vid omladdning).
  const CAT_SHOW = 5;
  const expandedCourses = new Set();
  function catOpenState() { try { return JSON.parse(localStorage.getItem('grammat:allasOpen') || '{}'); } catch (e) { return {}; } }
  function publicRecipeSections(list, showOwner = true) {
    const byCourse = {};
    list = list.filter(r => matchesQuery(r, query));
    if (!list.length && query.trim()) return noMatch();
    for (const r of list) {
      const course = normalizeCourse(r.course);
      (byCourse[course] = byCourse[course] || []).push({ ...r, course });
    }
    const openState = catOpenState();
    const searching = !!query.trim();
    return COURSES.filter(c => byCourse[c]).map(c => {
      const all = byCourse[c];
      const shown = searching || expandedCourses.has(c) ? all : all.slice(0, CAT_SHOW);
      const open = searching || openState[c] !== false;
      return `<details class="cat" data-course="${c}"${open ? ' open' : ''}>
        <summary><span>${esc(COURSE_LABELS[c])} · ${all.length}</span></summary>
        <div class="cat-list">${shown.map(r => publicRecipeRow(r, showOwner)).join('')}${shown.length < all.length ? `<button type="button" class="cat-more" data-more="${c}">Visa ${all.length - shown.length} till</button>` : ''}</div>
      </details>`;
    }).join('');
  }

  function viewAllasRecept() {
    // Startrecepten kommer från systemkontot grammat (samma källa som allt annat), oavsett
    // inloggning, feeden är publik. Bara laddar-state skiljer sig innan första hämtningen.
    let starterRows = starter, othersHtml;
    if (allasList === null) {
      loadAllas();
      othersHtml = allasLoadError ? '<p class="warn">Kunde inte ladda recept från andra just nu.</p>' : '<p class="hint">Laddar recept från andra …</p>';
    } else {
      const sys = allasList.filter(r => r.owner === 'grammat');
      if (sys.length) starterRows = sys;
      const withLabels = dedupeAllas(allasList.filter(r => r.owner !== 'grammat' && r.owner !== authName), starterRows.map(r => r.id));
      starterRows = starterRows.concat(withLabels);
      othersHtml = '';
    }

    if (desk.matches) return tocPublic('Allas recept', starterRows, { filter: true, tail: othersHtml });
    return `<div class="list-head"><h1>Allas recept</h1><span class="list-count">${starterRows.length} recept</span></div>
      ${searchBox()}
      ${publicRecipeSections(starterRows)}
      ${othersHtml}`;
  }

  const INVITE_RE = /^[a-zåäö0-9_-]{2,20}$/;
  function inviteUrl(name) { return location.origin + location.pathname + '#/hej/' + encodeURIComponent(name); }
  function viewFriends() {
    if (!loggedIn()) return '<div class="view-head"><h1>Vänner</h1></div><p>Logga in för att lägga till vänner och se deras recept.</p><p><a class="btn btn-ink" href="#/konto">Logga in</a></p>';
    loadConnections();
    if (friendList === null && !friendLoadError) loadFriends();
    const head = `<div class="view-head"><h1>Vänner</h1><button class="btn btn-ghost" id="addFriend" type="button">Lägg till vän</button></div>
      ${connectionsError ? '<p class="warn">Kunde inte ladda vänner. Öppna fliken igen för att försöka på nytt.</p>' : connections === null ? '<p class="hint">Laddar vänner …</p>' : ''}
      ${friendNotice ? `<p role="status" class="hint">${esc(friendNotice)}</p>` : ''}`;
    const rows = (list, kind) => list.map(f => {
      const actions = kind === 'incoming'
        ? '<button class="btn btn-ink" data-accept-friend="' + f.id + '">Acceptera</button> <button class="btn btn-ghost" data-cancel-friend="' + f.id + '">Neka</button>'
        : kind === 'outgoing' ? '<span class="hint">Väntar på svar</span> <button class="btn btn-ghost" data-cancel-friend="' + f.id + '">Återkalla</button>'
        : '<button class="btn btn-ghost" data-remove-friend="' + f.userId + '" data-friend-name="' + esc(f.name) + '">Ta bort vän</button>';
      return '<li class="friend-row"><a href="#/anvandare/' + f.userId + '">' + esc(f.name) + '</a><span class="friend-actions">' + actions + '</span></li>';
    }).join('');
    const section = (title, list, kind) => list.length ? '<h2>' + title + '</h2><ul class="friend-list">' + rows(list, kind) + '</ul>' : '';
    if (!connections) return head;
    const pending = section('Förfrågningar till dig', connections.incoming, 'incoming') + section('Skickade förfrågningar', connections.outgoing, 'outgoing');
    if (!connections.friends.length && !pending) {
      return head + `<div class="empty-state">
        <div class="empty-title">Inga vänner ännu</div>
        <p>Skicka din inbjudningslänk, så blir ni vänner direkt när personen loggat in. Vänner ser varandras offentliga recept, aldrig hemliga.</p>
        <p class="action-row"><button class="btn btn-ink" type="button" data-copy-invite>Kopiera min inbjudningslänk</button></p>
      </div>`;
    }
    if (desk.matches) {
      // Desktop: ett avsnitt per vän, registret rullar dit. Förfrågningar först, vänlistan sist.
      const hits = (friendList || []).filter(r => matchesQuery(r, query));
      const groups = connections.friends.map(f => ({ f, own: hits.filter(r => r.ownerId === f.userId) })).filter(g => g.own.length || !query.trim());
      const inc = connections.incoming.length;
      const register = (pending ? regRow('pending', 'Förfrågningar', inc || '', inc ? 'is-accent' : '') : '')
        + groups.map(g => regRow('van-' + g.f.userId, g.f.name, g.own.length)).join('')
        + (connections.friends.length ? regRow('friends', 'Dina vänner', connections.friends.length) : '');
      const main = (connectionsError ? '<p class="warn">Kunde inte ladda vänner. Öppna fliken igen för att försöka på nytt.</p>' : '')
        + (friendNotice ? `<p role="status" class="hint">${esc(friendNotice)}</p>` : '')
        + (pending ? `<section id="toc-pending">${pending}</section>` : '')
        + (friendLoadError ? '<p class="warn">Kunde inte ladda vänners recept just nu.</p>' : friendList === null ? '<p class="hint">Laddar recept …</p>' : '')
        + groups.map(g => tocSection('van-' + g.f.userId, g.f.name, g.own.length ? g.own.map(r => tocPublicRow(r, false)).join('') : '<p class="hint">Inga offentliga recept än.</p>')).join('')
        + (query.trim() && !hits.length ? noMatch() : '')
        + `<section id="toc-friends">${section('Dina vänner', connections.friends, 'friends')}</section>`;
      return tocLayout('Vänner', `${(friendList || []).length} recept · ${connections.friends.length} ${connections.friends.length === 1 ? 'vän' : 'vänner'}`, register, main,
        { search: !!(friendList || []).length, side: '<button class="btn btn-ghost" id="addFriend" type="button">Lägg till vän</button>' });
    }
    // Vännernas recept grupperade per vän, i samma radkomponent som Allas.
    let recipes = '';
    if (friendLoadError) recipes = '<p class="warn">Kunde inte ladda vänners recept just nu.</p>';
    else if (friendList === null) recipes = '<p class="hint">Laddar recept …</p>';
    else if (connections.friends.length) {
      const hits = friendList.filter(r => matchesQuery(r, query));
      const openState = catOpenState();
      recipes = (friendList.length ? searchBox() : '') + connections.friends.map(f => {
        const own = hits.filter(r => r.ownerId === f.userId);
        if (!own.length && query.trim()) return '';
        const key = 'van:' + f.userId;
        return `<details class="cat" data-course="${key}"${query.trim() || openState[key] !== false ? ' open' : ''}>
          <summary><span>${esc(f.name)} · ${own.length}</span></summary>
          <div class="cat-list">${own.length ? own.map(r => publicRecipeRow(r, false)).join('') : '<p class="hint" style="padding:12px 16px;margin:0">Inga offentliga recept än.</p>'}</div>
        </details>`;
      }).join('');
      if (query.trim() && !hits.length) recipes += noMatch();
    }
    return head + pending + (connections.friends.length ? '<h2>Vänners recept</h2>' + recipes + section('Dina vänner', connections.friends, 'friends') : '');
  }

  // Startsida via inbjudningslänk #/hej/NAMN: inbjudarens offentliga recept och två vägar in.
  // Inbjudaren sparas i sessionStorage och vänförfrågan skickas automatiskt efter inloggning.
  let inviteShowAll = false;
  function viewInvite(name) {
    name = String(name || '').toLowerCase();
    if (!INVITE_RE.test(name)) return '<p class="empty">Länken är trasig.</p>';
    if (allasList === null) loadAllas();
    const recipes = (allasList || []).filter(r => r.owner === name);
    const shown = inviteShowAll ? recipes : recipes.slice(0, 3);
    const initial = name.slice(0, 1).toUpperCase();
    const own = loggedIn() && authName === name;
    if (!loggedIn()) { try { sessionStorage.setItem('grammat:invite', name); } catch (e) { /* privat läge */ } }
    const actions = !loggedIn()
      ? `<div class="invite-actions">
          <button class="btn btn-ink btn-block" id="googleLogin" type="button">Fortsätt med Google</button>
          <a class="btn btn-ghost btn-block" href="#/konto">Använd e-post och lösenord</a>
          <p id="authError" class="warn" hidden></p>
          <p class="hint">Ni blir vänner direkt när du loggat in.</p>
        </div>`
      : own
        ? `<div class="invite-actions"><p class="hint">Det här är din egen inbjudningslänk.</p><button class="btn btn-ink btn-block" type="button" data-copy-invite>Kopiera min inbjudningslänk</button></div>`
        : `<div class="invite-actions"><button class="btn btn-ink btn-block" type="button" data-invite-add="${esc(name)}">Lägg till ${esc(name)} som vän</button><p class="hint">Ni ser varandras offentliga recept när ${esc(name)} accepterat.</p></div>`;
    return `<div class="invite">
      <div class="invite-pill"><i>${esc(initial)}</i>${own ? 'Din inbjudningslänk' : esc(name) + ' bjöd in dig'}</div>
      <h1>${esc(name)}s recept, och plats för dina egna.</h1>
      <p class="invite-lede">Spara recept, laga steg för steg med timer i köket, och få en inköpslista som ni bockar av tillsammans i butiken. Gratis, utan reklam.</p>
      ${actions}
      <div class="invite-recipes">
        <div class="label">${esc(name)} lagar just nu</div>
        ${allasList === null ? (allasLoadError ? '<p class="warn">Kunde inte ladda recepten just nu.</p>' : '<p class="hint">Laddar recept …</p>')
          : !recipes.length ? '<p class="hint">Inga offentliga recept än.</p>'
          : `<div class="cat-list">${shown.map(r => publicRecipeRow(r, false)).join('')}</div>${shown.length < recipes.length ? `<button class="invite-more" type="button" id="inviteMore">Se alla ${recipes.length} offentliga recept ›</button>` : ''}`}
      </div>
    </div>`;
  }

  function viewJoin() {
    return '<h1>Grupper har blivit vänner</h1><p>Den gamla gruppinbjudan används inte längre. Skicka en vänförfrågan med personens kontonamn i stället.</p><p><a class="btn" href="#/vanner">Till Vänner</a></p>';
  }

  function viewUserProfile(ownerId) {
    if (!loggedIn()) return '<p class="empty">Logga in för att se användarens recept.</p>';
    if (!userProfiles[ownerId] || userProfiles[ownerId].loading) {
      loadUserProfile(ownerId);
      return '<p class="hint">Laddar recept …</p>';
    }
    const profile = userProfiles[ownerId];
    if (profile.error) return '<p class="warn">Kunde inte ladda användarens recept just nu.</p>';
    const recipes = (profile.recipes || []).map(r => ({ ...r, _ownerLabel: profile.owner || r.owner || '' }));
    if (desk.matches) return tocPublic(profile.owner || 'Användare', recipes, { showOwner: false, empty: '<p class="empty">Inga offentliga recept än.</p>', side: '<a class="btn btn-ghost" href="#/allas">Alla recept</a>' });
    return `<div class="view-head"><h1>${esc(profile.owner || 'Användare')}</h1><a class="btn btn-ghost" href="#/allas">Alla recept</a></div>
      ${recipes.length ? publicRecipeSections(recipes, false) : '<p class="empty">Inga offentliga recept än.</p>'}`;
  }

  // Stegen med timerchips. En timer som redan går ritas som nedräkning på sin plats, i både
  // listvyn och köksläget (samma nyckel receptId|stegindex|minuter).
  function stepHtml(id, i, text) {
    const stepKey = minutes => `${id}|${i}|${minutes}`;
    return esc(text) + stepTimers(text).map(t => {
      const running = timers.find(x => x.key === stepKey(t.minutes));
      return running
        ? ' ' + timerChip(running)
        : ` <button class="timer-btn" type="button" data-timer="${t.minutes}" data-timer-label="${esc(t.label)}" data-timer-key="${esc(stepKey(t.minutes))}" aria-label="Starta timer ${esc(t.label)}">${esc(t.label)}</button>`;
    }).join('');
  }
  function ownerLabel(r, mine) {
    if (mine) return authName || '';
    return r._ownerLabel || r.owner || '';
  }
  function portionsFor(r, id) {
    const sel = state.recipes.some(x => x.id === id) ? selFor(id) : null;
    return sel ? sel.portions : (previewPortions[id] || r.portions);
  }

  function viewRecipe(id) {
    id = localRecipeId(id);
    const r = findRecipe(id);
    if (!r) return '<p class="empty">Receptet finns inte.</p>';
    const mine = state.recipes.some(x => x.id === id);
    const sel = mine ? selFor(id) : null;
    const portions = portionsFor(r, id);
    const f = portions / r.portions;
    const from = (history.state && history.state.from) || (mine || lastTab !== '#/' ? lastTab : '#/allas');
    // Bockade rader (har hemma/redan i grytan) samlas längst ner, senast bockad överst,
    // och utesluts ur inköpslistan.
    const struckKeys = state.struck[id] || [];
    let rows = '', lastGroup = null;
    const struckRows = [];
    r.ingredients.forEach((ing, i) => {
      const k = keyOf(ing.name);
      const isStruck = mine && struckKeys.includes(k);
      const attr = mine ? ` data-ing="${esc(k)}" style="view-transition-name:ing-${i}"` : '';
      const row = `<tr class="ing-row${isStruck ? ' struck' : ''}"${attr}><td>${isStruck ? '<span class="tick">✓</span>' : ''}${esc(ing.name)}</td><td class="num">${esc(fmtIngredient(ing, f))}</td></tr>`;
      if (isStruck) { struckRows.push({ row, order: struckKeys.indexOf(k) }); return; }
      if ((ing.group || null) !== lastGroup) { lastGroup = ing.group || null; if (lastGroup) rows += `<tr class="ing-group"><td colspan="2">${esc(lastGroup)}</td></tr>`; }
      rows += row;
    });
    rows += struckRows.sort((a, b) => b.order - a.order).map(x => x.row).join('');
    const steps = r.steps.length
      ? '<ol class="steps">' + r.steps.map((t, i) => `<li>${stepHtml(id, i, t)}</li>`).join('') + '</ol>'
      : '<p class="empty">Inga steg nedskrivna.</p>';
    const nutr = nutritionPerPortion(r, nutrients);
    const nutrLine = `<p class="hint">Per portion: ${fmtNum(nutr.kcal)} kcal · ${fmtNum(nutr.protein)} g protein · ${fmtNum(nutr.carbs)} g kolhydrater · ${fmtNum(nutr.fat)} g fett${nutr.missing.length ? ' · ofullständigt, saknar data för ' + nutr.missing.map(esc).join(', ') : ''} (källa: <a href="https://soknaringsinnehall.livsmedelsverket.se/" rel="noopener">Livsmedelsverket</a> m.fl.)</p>`;
    const owner = ownerLabel(r, mine);
    const saved = mine || mineForPublic(r) || (authName && r.owner === authName);
    const listBtn = mine
      ? (sel
        ? `<button class="btn btn-ghost is-on" type="button" data-toggle-list="${esc(id)}" aria-pressed="true">I listan ✓</button>`
        : `<button class="btn btn-ghost" type="button" data-toggle-list="${esc(id)}" data-portions="${portions}" aria-pressed="false">+ Lägg i listan</button>`)
      : saved
        ? '<span class="btn btn-ghost is-on" aria-disabled="true">Finns i mina ✓</span>'
        : `<button class="btn btn-ghost" type="button" data-add-allas="${esc(id)}">Spara till mina</button>`;
    const cookBtn = r.steps.length ? `<a class="btn btn-ink" href="#/recept/${esc(id)}/laga/1">Laga steg för steg</a>` : '';
    return `<div class="rv-top"><a class="btn btn-ghost" href="${esc(from)}">‹ ${esc(BACK_LABELS[from] || (from.startsWith('#/hej/') ? 'Inbjudan' : 'Tillbaka'))}</a>${mine ? `<a class="btn btn-ghost" href="#/redigera/${esc(r.id)}">Ändra</a>` : ''}</div>
      <div class="rv-kicker">${esc(COURSE_LABELS[r.course])}${owner ? ' · ' + esc(owner) : ''}${r.private ? ' · Hemligt' : ''}</div>
      <h1 class="rv-title">${esc(r.title)}</h1>
      <div class="rv-portions">
        <div class="stepper"><button type="button" data-rstep="-1" aria-label="Färre portioner">−</button><span>${portions} port</span><button type="button" data-rstep="1" aria-label="Fler portioner">+</button></div>
        <div class="meta">${nutr.kcal ? fmtNum(nutr.kcal) + ' kcal/port · ' : ''}${ingLabel(r.ingredients.length)}</div>
      </div>
      <div class="rv-actions">${listBtn}${cookBtn}</div>
      <div class="card rv-card">
        <div class="label">Ingredienser</div>
        ${mine ? '<p class="hint">Tryck på en rad när du har varan hemma eller redan lagt den i grytan, den stryks och hoppar ur inköpslistan.</p>' : ''}
        <table class="ing-table"><tbody>${rows}</tbody></table>
      </div>
      ${nutrLine}
      <div class="rv-steps">
        <div class="label">Gör så här</div>
        ${steps}
        ${r.steps.some(t => stepTimers(t).length) ? '<p class="hint">Tryck på en tid för att starta en timer. Den räknar ner på plats och ringer när den är klar.</p>' : ''}
      </div>
      ${r.source ? `<p class="source"><a href="${esc(r.source)}" rel="noopener">Källa</a></p>` : ''}`;
  }

  // Köksläget: ett steg per skärm, 24 px text, ingredienserna som nämns i steget skalade
  // till valda portioner. Svep byter steg, wake lock håller skärmen tänd.
  function viewCook(id, n) {
    id = localRecipeId(id);
    const r = findRecipe(id);
    if (!r || !r.steps.length) return '<p class="empty">Receptet finns inte.</p>';
    const total = r.steps.length;
    n = Math.min(Math.max(1, n), total);
    const portions = portionsFor(r, id);
    const f = portions / r.portions;
    const ings = stepIngredients(r.steps[n - 1], r.ingredients);
    const base = `#/recept/${esc(id)}`;
    return `<div class="cook" id="cook" data-n="${n}" data-total="${total}">
      <div class="cook-top">
        <a class="btn btn-ghost" href="${base}">Stäng</a>
        <span class="rv-kicker" id="wakeNote">${wakeActive ? 'Skärmen hålls tänd' : ''}</span>
        <button class="btn btn-ghost cook-portions" type="button" id="cookPortions">${portions} port</button>
      </div>
      <div class="cook-title">${esc(r.title)}</div>
      <div class="progress" aria-label="Steg ${n} av ${total}">${r.steps.map((_, i) => `<i class="${i < n - 1 ? 'done' : i === n - 1 ? 'now' : ''}"></i>`).join('')}</div>
      ${ings.length ? `<div class="cook-ings"><div class="label">Till det här steget</div>${ings.map(ing => `<div><span>${esc(ing.name)}</span><span class="qty">${esc(fmtIngredient(ing, f))}</span></div>`).join('')}</div>` : ''}
      <div class="cook-step">
        <div class="cook-stepno">STEG ${n}</div>
        <p class="cook-text">${stepHtml(id, n - 1, r.steps[n - 1])}</p>
        ${stepTimers(r.steps[n - 1]).length ? '<p class="hint">Tryck på en tid för att starta timern.</p>' : ''}
      </div>
      <div class="cook-nav">
        <a class="btn btn-ghost" href="${base}/laga/${n - 1}"${n === 1 ? ' aria-disabled="true"' : ''}>Föregående</a>
        ${n < total ? `<a class="btn btn-ink" href="${base}/laga/${n + 1}">Nästa steg</a>` : `<a class="btn btn-ink" href="${base}">Klart</a>`}
      </div>
    </div>`;
  }

  function listAsText() {
    const checked = new Set(state.checked);
    const items = aggregate(state.recipes, state.selections, state.struck).filter(it => !checked.has(it.key));
    const byCat = {};
    for (const it of items) (byCat[it.cat] = byCat[it.cat] || []).push(it);
    const lines = [];
    for (const cat of CATS) {
      if (!byCat[cat]) continue;
      lines.push(CAT_LABELS[cat].toUpperCase());
      for (const it of byCat[cat].sort((a, b) => a.name.localeCompare(b.name, 'sv'))) lines.push('- ' + it.name + ': ' + fmtItem(it));
    }
    const extras = state.extras.filter(ex => !checked.has('extra:' + ex.id));
    if (extras.length) {
      lines.push('EGNA RADER');
      for (const ex of extras) lines.push('- ' + ex.text);
    }
    return lines.join('\n');
  }

  let cartOpen = false; // "I vagnen" öppen eller hopfälld, överlever omrendering
  function viewList() {
    const items = aggregate(state.recipes, state.selections, state.struck);
    const byCat = {};
    for (const it of items) (byCat[it.cat] = byCat[it.cat] || []).push(it);
    const checked = new Set(state.checked);
    // Mängden ligger direkt efter namnet i mono, så ögat slipper hoppa över raden.
    const row = (key, name, qty, right, done) => `<label class="row${done ? ' done' : ''}">
        <input type="checkbox" class="row-check" data-check="${esc(key)}"${done ? ' checked' : ''} aria-label="Bocka av ${esc(name)}">
        <span class="row-name">${esc(name)}${qty ? `<span class="row-qty">${esc(qty)}</span>` : ''}</span>${right}
      </label>`;
    let body = '';
    const cart = [];
    for (const cat of CATS) {
      if (!byCat[cat]) continue;
      const open = byCat[cat].filter(it => !checked.has(it.key)).sort((a, b) => a.name.localeCompare(b.name, 'sv'));
      for (const it of byCat[cat]) if (checked.has(it.key)) cart.push(row(it.key, it.name, fmtItem(it), '', true));
      if (!open.length) continue;
      body += `<div class="kvitto-cat">· · · ${esc(CAT_LABELS[cat].toUpperCase())} · · ·</div>`;
      for (const it of open) body += row(it.key, it.name, fmtItem(it), '', false);
    }
    const extraRight = ex => `<span class="row-tag">EGEN</span><button type="button" class="row-del" data-del-extra="${esc(ex.id)}" aria-label="Ta bort ${esc(ex.text)}">✕</button>`;
    const openExtras = state.extras.filter(ex => !checked.has('extra:' + ex.id));
    for (const ex of state.extras) if (checked.has('extra:' + ex.id)) cart.push(row('extra:' + ex.id, ex.text, '', extraRight(ex), true));
    if (openExtras.length) {
      body += '<div class="kvitto-cat">· · · EGNA RADER · · ·</div>';
      for (const ex of openExtras) body += row('extra:' + ex.id, ex.text, '', extraRight(ex), false);
    }
    const total = items.length + state.extras.length;
    const left = total - cart.length;
    const recipeRows = state.selections.map(sel => {
      const r = state.recipes.find(x => x.id === sel.id);
      return r ? `<a class="list-recipe" href="#/recept/${esc(r.id)}"><span class="t">${esc(r.title)}</span><span class="p">${sel.portions} port ›</span></a>` : '';
    }).join('');
    const cartHtml = cart.length ? `<details class="cart" id="cart"${cartOpen ? ' open' : ''}>
        <summary><span><span class="tick">✓</span>I vagnen</span><span class="n">${cart.length} · ${cartOpen ? 'dölj' : 'visa'}</span></summary>
        ${cart.join('')}
      </details>` : '';
    return `<div class="list-head"><h1>Lista</h1>${total ? `<span class="list-count">${left} kvar av ${total}</span>` : ''}</div>
      ${syncPill(total > 0 && left === 0)}
      ${total === 0 ? '<div class="empty-state"><div class="empty-title">Listan är tom</div><p>Lägg recept i listan från Recept, eller skriv en egen rad nedan.</p></div>' : `
      <div class="list">
        ${recipeRows}
        ${body}
        ${cartHtml}
      </div>`}
      <form class="extra-form extra-fixed" id="extraForm">
        <input type="text" id="extraText" placeholder="Egen rad, t.ex. mjölk" maxlength="80" required aria-label="Egen rad">
        <button class="btn extra-add" type="submit" aria-label="Lägg till raden">+</button>
      </form>`;
  }

  function viewEditor(id) {
    const r = id ? state.recipes.find(x => x.id === id) : null;
    if (id && !r) return '<p class="empty">Receptet finns inte.</p>';
    const ings = r ? r.ingredients : [{}, {}, {}];
    // Ett kort per ingrediens: namn och ta bort på rad 1, mängd/enhet/avdelning på rad 2,
    // ungefärligt styckantal på rad 3 (bara när enheten är g eller ml).
    const rowHtml = (ing = {}) => {
      const unit = ing.toTaste ? 'smak' : (ing.unit || 'g');
      return `<div class="ed-row">
      <div class="ed-line1"><input type="text" class="ed-name" placeholder="ingrediens" value="${esc(ing.name || '')}" maxlength="80" aria-label="Ingrediens"><button type="button" class="ed-remove" aria-label="Ta bort raden">✕</button></div>
      <div class="ed-line2">
        <input type="number" class="ed-amount" placeholder="mängd" value="${ing.amount != null ? ing.amount : ''}" min="0" step="any" inputmode="decimal" aria-label="Mängd"${unit === 'smak' ? ' disabled' : ''}>
        <select class="ed-unit" aria-label="Enhet"><option value="g"${unit === 'g' ? ' selected' : ''}>g</option><option value="ml"${unit === 'ml' ? ' selected' : ''}>ml</option><option value="smak"${unit === 'smak' ? ' selected' : ''}>efter smak</option></select>
        <select class="ed-cat" aria-label="Avdelning"><option value="" disabled${ing.cat ? '' : ' selected'}>Avdelning</option>${CATS.map(c => `<option value="${c}"${ing.cat === c ? ' selected' : ''}>${CAT_LABELS[c]}</option>`).join('')}</select>
      </div>
      <div class="ed-line3"${unit === 'smak' ? ' hidden' : ''}><span>Ungefär</span><input type="number" class="ed-count" value="${ing.count != null ? ing.count : ''}" min="0" step="any" inputmode="decimal" aria-label="Ungefärligt antal"><span>st (valfritt)</span></div>
    </div>`;
    };
    return `<form id="edForm" data-id="${r ? esc(r.id) : ''}">
      <div class="ed-top"><a class="btn btn-ghost" href="${r ? '#/recept/' + esc(r.id) : '#/'}">Avbryt</a><button class="btn" type="submit">Spara recept</button></div>
      <h1>${r ? 'Ändra recept' : 'Nytt recept'}</h1>
      <label class="ed-field">Namn <input type="text" id="edTitle" value="${r ? esc(r.title) : ''}" maxlength="80" required></label>
      <div class="ed-grid">
        <div class="ed-field">Portioner
          <div class="stepper"><button type="button" data-edstep="-1" aria-label="Färre portioner">−</button><span id="edPortionsOut">${r ? r.portions : 4}</span><button type="button" data-edstep="1" aria-label="Fler portioner">+</button></div>
          <input type="hidden" id="edPortions" value="${r ? r.portions : 4}">
        </div>
        <label class="ed-field">Kategori <select id="edCourse">${COURSES.map(c => `<option value="${c}"${(r ? r.course : 'huvudratt') === c ? ' selected' : ''}>${COURSE_LABELS[c]}</option>`).join('')}</select></label>
      </div>
      <label class="ed-field">Källa (länk, valfritt) <input type="url" id="edSource" value="${r ? esc(r.source || '') : ''}"></label>
      <label class="check-row"><input type="checkbox" id="edPrivate"${r && r.private ? ' checked' : ''}> Hemligt recept, visas inte under Allas recept</label>
      <div class="ed-section"><div class="label">Ingredienser · <span id="edCount">${ings.length}</span></div><div class="ed-rules">1 msk = 15 ml · 1 tsk = 5 ml · 1 dl = 100 ml · tom mängd = efter smak</div></div>
      <div id="edRows">${ings.map(rowHtml).join('')}</div>
      <button type="button" class="ed-add" id="edAddRow">+ Ingrediens</button>
      <div class="ed-section"><div class="label">Gör så här · ett steg per rad</div></div>
      <textarea id="edSteps" rows="8" aria-label="Gör så här">${r ? esc(r.steps.join('\n')) : ''}</textarea>
    </form>
    <template id="edRowTpl">${rowHtml()}</template>`;
  }

  function viewImport() {
    return `<div class="view-head"><h1>Klistra in från AI</h1></div>
      <ol class="steps howto">
        <li>Kopiera prompten nedan.</li>
        <li>Klistra in den i valfri AI-modell (Claude, ChatGPT, Gemini ...) och klistra in ett eller flera recept efter, eller länkar till recepten.</li>
        <li>Kopiera JSON-svaret du får tillbaka och klistra in det i rutan längst ner. Alla recepten läses in på en gång. Klart.</li>
      </ol>
      <p><button class="btn" id="copyPrompt">Kopiera prompten</button></p>
      <details class="prompt-box"><summary>Visa prompten</summary><pre>${esc(AI_PROMPT)}</pre></details>
      <form id="importForm">
        <label>AI-modellens svar
        <textarea id="importText" rows="10" placeholder='[ { "title": ... } ]' required></textarea></label>
        <p id="importError" class="warn" hidden></p>
        <p><button class="btn" type="submit">Läs in</button></p>
      </form>`;
  }

  // Firebase-felkoder till svenska.
  function fbErr(e) {
    const m = {
      'auth/invalid-credential': 'Fel e-post eller lösenord.',
      'auth/wrong-password': 'Fel e-post eller lösenord.',
      'auth/user-not-found': 'Inget konto med den e-postadressen.',
      'auth/email-already-in-use': 'E-postadressen har redan ett konto, logga in i stället.',
      'auth/weak-password': 'Lösenordet behöver minst 6 tecken.',
      'auth/invalid-email': 'Ogiltig e-postadress.',
      'auth/popup-closed-by-user': 'Inloggningen avbröts.',
      'auth/cancelled-popup-request': 'Inloggningen avbröts.',
      'auth/popup-blocked': 'Webbläsaren blockerade inloggningsfönstret, tillåt popupfönster och försök igen.',
      'auth/credential-already-in-use': 'Den inloggningen används redan av ett annat konto.',
      'auth/requires-recent-login': 'Av säkerhetsskäl: logga ut, logga in igen och försök direkt.',
      'auth/too-many-requests': 'För många försök, vänta en stund.',
      'auth/network-request-failed': 'Ingen kontakt med inloggningstjänsten.',
    };
    return (e && m[e.code]) || (e && e.message) || 'Något gick fel.';
  }

  function viewAccount() {
    const backup = `<h2>Backup</h2>
      <p>Backupen innehåller dina recept, valda recept, egna rader och avbockningar. Kontot och dina vänskaper ingår inte.</p>
      <p class="hint">När du trycker på ”Ladda ner backup” sparas en JSON-fil på din enhet, med namn som grammat-backup-2026-09-11.json. Spara filen på ett säkert ställe. Välj ”Återställ från backup” och samma fil för att läsa in den igen. Då ersätts dina nuvarande recept och din inköpslista.</p>
      <p class="backup-actions">
        <button class="btn" id="exportBackup" type="button">Ladda ner backup</button>
        <label class="btn btn-ghost backup-file">Återställ från backup <input type="file" id="importBackup" accept="application/json,.json"></label>
      </p>
      <p id="backupError" class="warn" hidden></p>`;
    const loginForms = `
      <p><button class="gsi btn-block" id="googleLogin" type="button"><svg class="gsi-logo" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>Fortsätt med Google</button></p>
      <form id="emailForm">
        <label>E-post <input type="email" id="authEmail" autocomplete="username" required></label>
        <label>Lösenord <input type="password" id="authPw" minlength="6" maxlength="64" autocomplete="current-password" required></label>
        <p id="authError" class="warn" hidden></p>
        <p><button class="btn btn-ink btn-block" type="submit" data-mode="login">Logga in</button></p>
        <p class="linkrow"><button class="btn-link" type="submit" data-mode="register">Skapa konto</button> · <button class="btn-link" type="button" id="forgotPw">Glömt lösenordet?</button></p>
      </form>`;
    if (fbUser) {
      const providers = fbUser.providerData.map(p => p.providerId);
      const hasPw = providers.includes('password'), hasGoogle = providers.includes('google.com');
      const ways = [hasGoogle ? 'Google' : '', hasPw ? 'e-post & lösenord' : ''].filter(Boolean).join(' · ');
      return `<div class="view-head"><h1>Konto</h1></div>
        <p>Inloggad som <strong>${esc(authName || fbUser.email || '')}</strong>${fbUser.email ? ' · ' + esc(fbUser.email) : ''}. Recept och inköpslista synkas mellan dina enheter.</p>
        <p><button class="btn btn-ghost" id="logout">Logga ut</button></p>
        ${syncError ? '<p class="warn">Kunde inte nå servern, ändringar sparas lokalt och synkas när det går igen.</p>' : ''}
        <h2>Namn</h2>
        <form id="nameForm">
          <label>Visas som ägare på dina recept under Allas recept.
          <input type="text" id="nameNew" value="${esc(authName || '')}" maxlength="20" required></label>
          <p id="nameError" class="warn" hidden></p>
          <p><button class="btn btn-ghost" type="submit">Byt namn</button></p>
        </form>
        <h2>Inloggningssätt</h2>
        <p class="hint">${ways}</p>
        ${hasGoogle ? '' : '<p><button class="btn btn-ghost" id="linkGoogle" type="button">Koppla Google-inloggning</button></p>'}
        ${hasPw ? '' : `<form id="pwForm">
          <label>Skapa lösenord: då kan även din partner logga in på kontot med ${esc(fbUser.email || 'din e-post')} och lösenordet.
          <input type="password" id="pwNew" minlength="6" maxlength="64" autocomplete="new-password" required></label>
          <p id="pwError" class="warn" hidden></p>
          <p><button class="btn btn-ghost" type="submit">Spara lösenord</button></p>
        </form>`}
        <p><a class="btn btn-ghost" href="#/vanner">Hantera vänner och förfrågningar</a></p>
        ${backup}
        <p class="action-row"><button class="btn btn-danger" id="deleteAccount" type="button">Radera kontot</button></p>`;
    }
    if (legacy) {
      return `<div class="view-head"><h1>Konto</h1></div>
        <p>Inloggad som <strong>${esc(legacy.name)}</strong> med gamla PIN-inloggningen.</p>
        <p><button class="btn btn-ghost" id="logout">Logga ut</button></p>
        ${syncError ? '<p class="warn">Kunde inte nå servern, ändringar sparas lokalt och synkas när det går igen.</p>' : ''}
        <h2>Byt till nya inloggningen</h2>
        <p class="hint">PIN-inloggningen fasas ut. Logga in med Google eller skapa konto med e-post, så följer dina recept med automatiskt och du kan återställa lösenordet själv.</p>
        ${loginForms}
        <p><a class="btn btn-ghost" href="#/vanner">Hantera vänner och förfrågningar</a></p>
        ${backup}`;
    }
    return `<div class="view-head"><h1>Konto</h1></div>
      <p>Utan konto sparas allt bara i den här webbläsaren. Logga in för att nå recepten och listan från mobilen i butiken.</p>
      ${loginForms}
      ${backup}`;
  }

  // ---------- timer ----------
  // Timers lever i minnet, inte i state: de ska inte synkas eller överleva omladdning.
  // ponytail: i bakgrundsflik kan larmet dröja och vibration uteblir, Notification API om det behövs.
  const timers = [];
  let audioCtx = null;
  function fmtLeft(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
  }
  function timerChip(t) {
    return `<span class="timer${t.done ? ' done' : ''}" data-timer-id="${t.id}"><strong class="timer-left">${t.done ? 'Klar' : fmtLeft(t.end - Date.now())}</strong><button type="button" data-timer-stop="${t.id}" aria-label="Ta bort timer ${esc(t.label)}">✕</button></span>`;
  }
  function startTimer(minutes, label, key) {
    // AudioContext måste skapas i ett användartryck, annars vägrar mobilen spela ljud senare.
    // iPhone dessutom: utan audioSession.type = 'playback' är sidan helt tyst så fort
    // ringklockan står på ljudlöst, vilket den oftast gör. Finns från iOS 17.
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      const r = audioCtx.resume();
      if (r && r.catch) r.catch(() => {}); // avvisat löfte får inte bli ett obehandlat fel
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* inget ljud, den röda brickan syns ändå */ }
    timers.push({ id: Date.now() + Math.random(), end: Date.now() + minutes * 60000, label, done: false, key: key || null });
    render();
  }
  function alarm() {
    // Safari saknar vibrate helt, en iPhone får alltså bara ljudet och den röda brickan.
    if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 700]);
    if (!audioCtx) return;
    const tones = () => {
      for (let i = 0; i < 3; i++) {
        const t0 = audioCtx.currentTime + i * 0.5, o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.4, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
        o.start(t0); o.stop(t0 + 0.45);
      }
    };
    // Har fliken varit i bakgrunden är kontexten suspenderad, och då blir larmet tyst.
    // Gamla webkitAudioContext returnerar inget löfte från resume, därav kontrollen.
    const resumed = audioCtx.state === 'suspended' ? audioCtx.resume() : null;
    if (resumed && resumed.then) resumed.then(tones).catch(() => {});
    else tones();
  }
  setInterval(() => {
    const now = Date.now();
    for (const t of timers) {
      if (!t.done && now >= t.end) { t.done = true; alarm(); }
      const el = document.querySelector(`[data-timer-id="${t.id}"]`);
      if (!el) continue;
      el.classList.toggle('done', t.done);
      el.querySelector('.timer-left').textContent = t.done ? 'Klar' : fmtLeft(t.end - now);
    }
  }, 1000);

  // ---------- render + händelser ----------
  // Skärmen hålls vaken medan ett recept är uppe (man står och lagar mat).
  let wakeLock = null; // promise för aktivt/väntande lås
  let wakeActive = false; // låset är beviljat: köksläget visar "Skärmen hålls tänd"
  function setWakeActive(on) {
    wakeActive = on;
    const note = $('#wakeNote');
    if (note) note.textContent = on ? 'Skärmen hålls tänd' : '';
  }
  function syncWakeLock() {
    const want = /^#\/recept\//.test(location.hash) && document.visibilityState === 'visible';
    if (want && !wakeLock && navigator.wakeLock) {
      const p = navigator.wakeLock.request('screen').then(l => {
        setWakeActive(true);
        l.addEventListener('release', () => { setWakeActive(false); if (wakeLock === p) wakeLock = null; });
        return l;
      }).catch(() => { if (wakeLock === p) wakeLock = null; return null; });
      wakeLock = p;
    } else if (!want && wakeLock) {
      wakeLock.then(l => l && l.release().catch(() => {}));
      wakeLock = null;
      setWakeActive(false);
    }
  }
  document.addEventListener('visibilitychange', syncWakeLock);

  // De fyra flikarna. Senaste flik sparas så att appen öppnar där man var, i butiken alltså listan.
  const TABS = ['#/', '#/lista', '#/vanner', '#/allas'];
  function rememberRoute(h) {
    if (!TABS.includes(h)) return;
    try { localStorage.setItem('grammat:lastRoute', h); } catch (e) { /* privat läge */ }
  }

  function renderNav() {
    const n = state.selections.length;
    const badge = $('#navListCount');
    badge.textContent = n || '';
    badge.hidden = !n;
    const h = location.hash || '#/';
    const user = $('#navUser');
    const name = loggedIn() ? (authName || '') : '';
    user.dataset.name = name;
    user.classList.toggle('is-guest', !loggedIn());
    user.textContent = loggedIn() ? (name || 'k').slice(0, 1).toUpperCase() : 'Logga in';
    user.setAttribute('aria-label', loggedIn() ? 'Konto: ' + (name || fbUser?.email || '') : 'Logga in');
    $('#tagline').hidden = !((h === '#/' || h.startsWith('#/hej/')) && !loggedIn());
    $('#headNew').hidden = h !== '#/';
    $('#headMore').hidden = !headMoreItems;
    document.body.classList.toggle('has-fixed-form', h === '#/lista');
    document.querySelectorAll('.nav a').forEach(a => {
      const m = a.dataset.match;
      let active;
      const id = recipeIdFromHash(h);
      if (id !== null) {
        const mine = state.recipes.some(x => x.id === id);
        active = mine ? m === '#/' : (friendList || []).some(x => publicRowKey(x) === id) ? m === '#/vanner' : m === '#/allas';
      } else {
        active = m === '#/'
          ? !h.startsWith('#/lista') && !h.startsWith('#/konto') && !h.startsWith('#/allas') && !h.startsWith('#/anvandare') && !h.startsWith('#/vanner') && !h.startsWith('#/join') && !h.startsWith('#/hej/')
          : (m === '#/allas' ? h.startsWith('#/allas') || h.startsWith('#/anvandare') : h.startsWith(m));
      }
      a.classList.toggle('active', active);
    });
  }

  // Vyn som ritas kan lägga sina sekundära val (Kopiera, Töm …) bakom ··· i headern.
  let headMoreItems = null;
  function setHeadMore(html, title) { headMoreItems = html ? { html, title } : null; }

  function render() {
    const h = location.hash || '#/';
    headMoreItems = null;
    const cook = h.match(/^#\/recept\/([^/]+)\/laga\/(\d+)$/);
    const m = h.match(/^#\/(recept|redigera)\/(.+)$/);
    const userMatch = h.match(/^#\/anvandare\/(\d+)$/);
    const joinMatch = h.match(/^#\/join\/([A-Z0-9]{6,16})$/);
    const inviteMatch = h.match(/^#\/hej\/([^/]+)$/);
    if (TABS.includes(h)) lastTab = h;
    document.body.classList.toggle('is-cooking', !!cook);
    let html;
    if (cook) html = viewCook(decodeURIComponent(cook[1]), Number(cook[2]));
    else if (m && m[1] === 'recept') {
      if (!history.state || !history.state.from) { try { history.replaceState({ from: lastTab }, ''); } catch (e) { /* file:// */ } }
      html = viewRecipe(decodeURIComponent(m[2]));
      const id = recipeIdFromHash(h);
      const own = state.recipes.find(x => x.id === id);
      if (findRecipe(id)) setHeadMore(sheetItem('Kopiera recept', 'id="shareRecipe"')
        + (own ? sheetItem(own.private ? 'Gör synligt under Allas recept' : 'Gör hemligt', 'id="togglePrivate"') + sheetItem('Ta bort recept', 'id="deleteRecipe" class="sheet-item is-danger"') : ''), 'Receptet');
    }
    else if (m && m[1] === 'redigera') html = viewEditor(decodeURIComponent(m[2]));
    else if (userMatch) html = viewUserProfile(userMatch[1]);
    else if (joinMatch) html = viewJoin(joinMatch[1]);
    else if (inviteMatch) { html = viewInvite(decodeURIComponent(inviteMatch[1])); lastTab = h; }
    else if (h === '#/nytt') html = viewEditor(null);
    else if (h === '#/importera') html = viewImport();
    else if (h === '#/lista') { html = viewList(); if (state.selections.length || state.extras.length) setHeadMore(sheetItem('Kopiera listan', 'id="copyList"') + sheetItem('Töm listan', 'id="clearList" class="sheet-item is-danger"'), 'Listan'); }
    else if (h === '#/konto') html = viewAccount();
    else if (h === '#/vanner') html = viewFriends();
    else if (h === '#/allas') html = viewAllasRecept();
    else html = viewCatalog();
    $('#view').innerHTML = html;
    renderNav();
    bind();
    syncWakeLock();
    rememberRoute(h);
  }

  function bind() {
    const view = $('#view');

    const q = $('#q');
    if (q) q.oninput = () => {
      query = q.value;
      render(); // hela vyn ritas om, fokus och markör återställs så tangentbordet inte tappas
      const nq = $('#q');
      nq.focus();
      nq.setSelectionRange(nq.value.length, nq.value.length);
    };
    view.querySelectorAll('[data-toc]').forEach(b => b.onclick = () => {
      if (b.closest('.toc').dataset.filter) { tocFilter = b.dataset.toc || null; render(); }
      else document.getElementById('toc-' + b.dataset.toc).scrollIntoView();
    });
    view.querySelectorAll('[data-timer]').forEach(b => b.onclick = () => startTimer(Number(b.dataset.timer), b.dataset.timerLabel, b.dataset.timerKey));
    view.querySelectorAll('[data-timer-stop]').forEach(b => b.onclick = () => {
      const i = timers.findIndex(t => String(t.id) === b.dataset.timerStop);
      if (i >= 0) timers.splice(i, 1);
      render();
    });
    view.querySelectorAll('[data-ing]').forEach(row => row.onclick = () => {
      const id = recipeIdFromHash();
      const k = row.dataset.ing;
      const cur = state.struck[id] || [];
      const next = cur.includes(k) ? cur.filter(x => x !== k) : [...cur, k];
      if (next.length) state.struck[id] = next; else delete state.struck[id];
      if (document.startViewTransition) document.startViewTransition(() => save()); else save();
    });
    view.querySelectorAll('[data-card]').forEach(c => c.onclick = e => {
      if (e.target.closest('.card-row, a, button')) return; // knappraden är död zon
      location.hash = '#/recept/' + encodeURIComponent(c.dataset.card);
    });
    // köksläget: svep vänster/höger byter steg, portionsknappen öppnar en stepper
    const cook = $('#cook');
    if (cook) {
      let x0 = null, y0 = null;
      cook.ontouchstart = e => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; };
      cook.ontouchend = e => {
        if (x0 === null) return;
        const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
        x0 = null;
        if (Math.abs(dx) < 60 || Math.abs(dy) > 80) return;
        const n = Number(cook.dataset.n), total = Number(cook.dataset.total);
        const next = dx < 0 ? n + 1 : n - 1;
        if (next >= 1 && next <= total) location.hash = location.hash.replace(/\/laga\/\d+$/, '/laga/' + next);
      };
      $('#cookPortions').onclick = () => {
        openSheet(`<div class="rv-portions" style="align-items:center;padding:8px 0 4px"><div class="stepper"><button type="button" data-rstep="-1" aria-label="Färre portioner">−</button><span id="sheetPortions">${portionsFor(findRecipe(recipeIdFromHash()), recipeIdFromHash())} port</span><button type="button" data-rstep="1" aria-label="Fler portioner">+</button></div></div><button class="btn btn-ghost sheet-cancel" type="button" data-close>Klar</button>`, 'Portioner');
        bindSheet();
      };
    }
    view.querySelectorAll('[data-toggle-list]').forEach(b => b.onclick = e => {
      e.preventDefault(); e.stopPropagation(); // kortet runt knappen är en länk
      const id = b.dataset.toggleList;
      const r = state.recipes.find(x => x.id === id);
      const sel = selFor(id);
      if (sel) {
        const struck = state.struck[id];
        state.selections = state.selections.filter(s => s.id !== id);
        delete state.struck[id];
        save();
        toast('Borttagen ur listan', { action: 'Ångra', onAction: () => { state.selections.push(sel); if (struck) state.struck[id] = struck; save(); } });
      } else {
        const portions = Number(b.dataset.portions) || r.portions;
        state.selections.push({ id, portions });
        delete previewPortions[id];
        save();
        toast(`${r.title} i listan · ${portions} port`, { action: 'Visa listan', href: '#/lista' });
      }
    });
    view.querySelectorAll('[data-rstep]').forEach(b => b.onclick = () => stepPortions(Number(b.dataset.rstep)));
    view.querySelectorAll('[data-more]').forEach(b => b.onclick = () => { expandedCourses.add(b.dataset.more); render(); });
    view.querySelectorAll('details.cat').forEach(d => d.ontoggle = () => {
      if (query.trim()) return; // sökning tvingar upp allt, inget att minnas
      const st = catOpenState();
      st[d.dataset.course] = d.open;
      try { localStorage.setItem('grammat:allasOpen', JSON.stringify(st)); } catch (e) { /* privat läge */ }
    });
    view.querySelectorAll('[data-add-allas]').forEach(b => b.onclick = () => {
      const id = b.dataset.addAllas;
      // feed-raden först: den bär ownerId som starter.json saknar
      const r = allPublicRows().find(x => publicRowKey(x) === id) || starter.find(x => 'starter|' + x.id === id || x.id === id);
      if (!r || mineForPublic(r) || (authName && r.owner === authName)) return;
      const copy = JSON.parse(JSON.stringify(r));
      delete copy.owner; delete copy.ownerId; delete copy.saves; delete copy._ownerLabel; delete copy._idCollision;
      if (state.recipes.some(x => x.id === copy.id)) copy.id = slugify(copy.title, state.recipes.map(x => x.id));
      if (loggedIn() && Number.isInteger(r.ownerId)) {
        copy.src = { owner: r.ownerId, id: r.id };
        api('/save', { method: 'POST', body: JSON.stringify({ ownerId: r.ownerId, recipeId: r.id }) }).catch(() => {});
        r.saves = (r.saves || 0) + 1;
      }
      state.recipes.push(copy);
      save();
    });
    view.querySelectorAll('[data-remove-allas]').forEach(b => b.onclick = () => {
      const key = b.dataset.removeAllas;
      const r = state.recipes.find(x => x.src ? x.src.owner + '|' + x.src.id === key : 'starter|' + x.id === key || x.id === key);
      if (!r) return;
      // Kopian kan vara redigerad, så ett klick på ✓ får inte vara slutgiltigt: allt läggs
      // tillbaka vid Ångra, och sparräknaren på servern rörs först när ångra-fönstret gått ut.
      const at = state.recipes.indexOf(r), sel = selFor(r.id), struck = state.struck[r.id];
      state.recipes = state.recipes.filter(x => x !== r);
      state.selections = state.selections.filter(s => s.id !== r.id);
      delete state.struck[r.id];
      save();
      toast('Borttaget ur mina recept', {
        action: 'Ångra',
        onAction: () => { if (state.recipes.some(x => x.id === r.id)) return; /* sparat på nytt under tiden */ state.recipes.splice(at, 0, r); if (sel) state.selections.push(sel); if (struck) state.struck[r.id] = struck; save(); },
        onTimeout: () => unsave(r),
      });
    });

    view.querySelectorAll('[data-check]').forEach(b => b.onchange = () => {
      const k = b.dataset.check;
      state.checked = state.checked.includes(k) ? state.checked.filter(x => x !== k) : [...state.checked, k];
      if (navigator.vibrate) navigator.vibrate(30); // kvitto i handen när man inte tittar
      save();
    });
    const cart = $('#cart');
    if (cart) cart.ontoggle = () => { cartOpen = cart.open; cart.querySelector('.n').textContent = cart.querySelectorAll('.row').length + ' · ' + (cartOpen ? 'dölj' : 'visa'); };
    view.querySelectorAll('[data-del-extra]').forEach(b => b.onclick = () => {
      state.extras = state.extras.filter(x => String(x.id) !== b.dataset.delExtra);
      state.checked = state.checked.filter(k => k !== 'extra:' + b.dataset.delExtra);
      save();
    });
    const extraForm = $('#extraForm');
    if (extraForm) extraForm.onsubmit = e => {
      e.preventDefault();
      state.extras.push({ id: Date.now(), text: $('#extraText').value.trim() });
      save();
    };

    const edForm = $('#edForm');
    if (edForm) {
      const rowsEl = $('#edRows');
      const updateCount = () => { $('#edCount').textContent = rowsEl.querySelectorAll('.ed-row').length; };
      const addRow = () => {
        rowsEl.insertAdjacentHTML('beforeend', $('#edRowTpl').innerHTML);
        updateCount();
        rowsEl.lastElementChild.querySelector('.ed-name').focus();
      };
      $('#edAddRow').onclick = addRow;
      view.querySelectorAll('[data-edstep]').forEach(b => b.onclick = () => {
        const inp = $('#edPortions');
        inp.value = Math.min(99, Math.max(1, Number(inp.value) + Number(b.dataset.edstep)));
        $('#edPortionsOut').textContent = inp.value;
      });
      rowsEl.onclick = e => {
        const btn = e.target.closest('.ed-remove');
        if (!btn) return;
        const row = btn.closest('.ed-row');
        const next = row.nextElementSibling;
        row.remove();
        updateCount();
        toast('Raden borttagen', { action: 'Ångra', onAction: () => { rowsEl.insertBefore(row, next && next.parentNode === rowsEl ? next : null); updateCount(); } });
      };
      rowsEl.onchange = e => { // "efter smak" stänger mängd- och antalsfälten
        if (!e.target.classList.contains('ed-unit')) return;
        const row = e.target.closest('.ed-row');
        const smak = e.target.value === 'smak';
        row.querySelector('.ed-amount').disabled = smak;
        row.querySelector('.ed-line3').hidden = smak;
      };
      rowsEl.onkeydown = e => { // Enter i sista raden ger en ny rad, annars hoppar den till nästa
        if (e.key !== 'Enter' || e.target.tagName !== 'INPUT') return;
        e.preventDefault();
        const row = e.target.closest('.ed-row');
        if (row === rowsEl.lastElementChild) addRow();
        else row.nextElementSibling.querySelector('.ed-name').focus();
      };
      edForm.onsubmit = e => {
        e.preventDefault();
        const ingredients = [...view.querySelectorAll('.ed-row')].map(row => {
          const name = row.querySelector('.ed-name').value.trim();
          if (!name) return null;
          const unit = row.querySelector('.ed-unit').value;
          const amount = unit === 'smak' ? '' : row.querySelector('.ed-amount').value;
          const count = unit === 'smak' ? '' : row.querySelector('.ed-count').value;
          const ing = { name, cat: row.querySelector('.ed-cat').value || 'övrigt' };
          if (amount !== '') { ing.amount = Number(amount); ing.unit = unit; }
          else ing.toTaste = true;
          if (count !== '') { ing.count = Number(count); ing.countUnit = 'st'; }
          return ing;
        }).filter(Boolean);
        if (!ingredients.length) { alert('Minst en ingrediens behövs.'); return; }
        const oldId = edForm.dataset.id;
        const recipe = {
          id: oldId || slugify($('#edTitle').value, state.recipes.map(r => r.id)),
          title: $('#edTitle').value.trim(),
          portions: Number($('#edPortions').value),
          course: $('#edCourse').value,
          source: safeUrl($('#edSource').value),
          ingredients,
          steps: $('#edSteps').value.split('\n').map(s => s.trim()).filter(Boolean),
        };
        if ($('#edPrivate').checked) recipe.private = true;
        const old = oldId && state.recipes.find(r => r.id === oldId);
        if (old && old.src) recipe.src = old.src; // redigerad kopia räknas fortfarande som sparad
        if (oldId) state.recipes = state.recipes.map(r => r.id === oldId ? recipe : r);
        else state.recipes.push(recipe);
        location.hash = '#/recept/' + recipe.id;
        save();
      };
    }

    const copyBtn = $('#copyPrompt');
    if (copyBtn) copyBtn.onclick = async () => {
      try { await navigator.clipboard.writeText(AI_PROMPT); copyBtn.textContent = 'Kopierad!'; }
      catch (e) { copyBtn.textContent = 'Kunde inte kopiera, visa prompten och kopiera manuellt'; }
      setTimeout(() => { copyBtn.textContent = 'Kopiera prompten'; }, 2500);
    };
    const importForm = $('#importForm');
    if (importForm) importForm.onsubmit = e => {
      e.preventDefault();
      const errEl = $('#importError');
      errEl.hidden = true;
      try {
        const recipes = parseImport($('#importText').value, state.recipes.map(r => r.id));
        state.recipes.push(...recipes);
        location.hash = recipes.length === 1 ? '#/recept/' + recipes[0].id : '#/';
        save();
      } catch (err) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      }
    };

    // ---- inloggning (Firebase + legacy) ----
    const showErr = (el, msg) => { el.textContent = msg; el.hidden = false; };
    const addFriend = $('#addFriend');
    if (addFriend) addFriend.onclick = openFriendSheet;
    view.querySelectorAll('[data-copy-invite]').forEach(b => b.onclick = shareInvite);
    view.querySelectorAll('[data-invite-add]').forEach(b => b.onclick = () => friendAction('/friend-requests', 'POST', 'Förfrågan skickad till ' + b.dataset.inviteAdd, { name: b.dataset.inviteAdd }));
    const inviteMore = $('#inviteMore');
    if (inviteMore) inviteMore.onclick = () => { inviteShowAll = true; render(); };
    view.querySelectorAll('[data-accept-friend]').forEach(b => b.onclick = () => friendAction('/friend-requests/' + b.dataset.acceptFriend + '/accept', 'POST', 'Ni är nu vänner.'));
    view.querySelectorAll('[data-cancel-friend]').forEach(b => b.onclick = () => friendAction('/friend-requests/' + b.dataset.cancelFriend, 'DELETE', b.textContent === 'Neka' ? 'Förfrågan nekad.' : 'Förfrågan återkallad.'));
    view.querySelectorAll('[data-remove-friend]').forEach(b => b.onclick = () => {
      if (confirm('Ta bort ' + b.dataset.friendName + ' som vän? Recept du redan sparat finns kvar i Mina recept.')) {
        void friendAction('/friends/' + b.dataset.removeFriend, 'DELETE', 'Vännen har tagits bort.');
      }
    });
    const googleLogin = $('#googleLogin');
    if (googleLogin) googleLogin.onclick = async () => {
      const errEl = $('#authError');
      errEl.hidden = true;
      if (!fb) return showErr(errEl, 'Inloggningen kunde inte laddas, kontrollera nätet och ladda om sidan.');
      try { await fb.signInWithPopup(fb.auth, new fb.GoogleAuthProvider()); location.hash = '#/'; }
      catch (e) { showErr(errEl, fbErr(e)); }
    };
    const emailForm = $('#emailForm');
    if (emailForm) emailForm.onsubmit = async e => {
      e.preventDefault();
      const errEl = $('#authError');
      errEl.hidden = true;
      if (!fb) return showErr(errEl, 'Inloggningen kunde inte laddas, kontrollera nätet och ladda om sidan.');
      const mode = e.submitter ? e.submitter.dataset.mode : 'login';
      try {
        if (mode === 'register') await fb.createUserWithEmailAndPassword(fb.auth, $('#authEmail').value.trim(), $('#authPw').value);
        else await fb.signInWithEmailAndPassword(fb.auth, $('#authEmail').value.trim(), $('#authPw').value);
        location.hash = '#/';
      } catch (err) { showErr(errEl, fbErr(err)); }
    };
    const forgotPw = $('#forgotPw');
    if (forgotPw) forgotPw.onclick = async () => {
      const errEl = $('#authError');
      errEl.hidden = true;
      const email = $('#authEmail').value.trim();
      if (!fb || !email) return showErr(errEl, 'Fyll i e-postadressen först.');
      try { await fb.sendPasswordResetEmail(fb.auth, email); showErr(errEl, 'Återställningsmejl skickat till ' + email + '.'); }
      catch (err) { showErr(errEl, fbErr(err)); }
    };
    const pwForm = $('#pwForm');
    if (pwForm) pwForm.onsubmit = async e => {
      e.preventDefault();
      try { await fb.updatePassword(fbUser, $('#pwNew').value); render(); }
      catch (err) { showErr($('#pwError'), fbErr(err)); }
    };
    const nameForm = $('#nameForm');
    if (nameForm) nameForm.onsubmit = async e => {
      e.preventDefault();
      const errEl = $('#nameError');
      errEl.hidden = true;
      try {
        const { name } = await api('/name', { method: 'PUT', body: JSON.stringify({ name: $('#nameNew').value }) });
        authName = name;
        localStorage.setItem('authName', name);
        resetRemoteCaches(); // ägaretiketterna har bytt namn
        render();
      } catch (err) { showErr(errEl, err.message); }
    };
    const linkGoogle = $('#linkGoogle');
    if (linkGoogle) linkGoogle.onclick = async () => {
      try { await fb.linkWithPopup(fbUser, new fb.GoogleAuthProvider()); render(); }
      catch (e) { alert(fbErr(e)); }
    };
    const logout = $('#logout');
    if (logout) logout.onclick = async () => {
      if (fbUser && fb) await fb.signOut(fb.auth).catch(() => {});
      legacy = null;
      localStorage.removeItem('auth');
      authName = null;
      localStorage.removeItem('authName');
      resetRemoteCaches();
      render();
    };
    const deleteAccount = $('#deleteAccount');
    if (deleteAccount) deleteAccount.onclick = async () => {
      if (!confirm('Radera kontot permanent? Allt på servern försvinner, går inte att ångra. Recepten i den här webbläsaren behålls lokalt.')) return;
      try {
        await api('/account', { method: 'DELETE' });
        if (fbUser) await fbUser.delete(); // raderar Firebase-användaren, triggar onAuthStateChanged(null)
        authName = null;
        localStorage.removeItem('authName');
        resetRemoteCaches();
        render();
      } catch (e) { alert(fbErr(e)); }
    };

    const exportBackup = $('#exportBackup');
    if (exportBackup) exportBackup.onclick = () => {
      const blob = new Blob([JSON.stringify(makeBackup(state), null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'grammat-backup-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    };
    const importBackup = $('#importBackup');
    if (importBackup) importBackup.onchange = async () => {
      const errEl = $('#backupError');
      errEl.hidden = true;
      const file = importBackup.files && importBackup.files[0];
      if (!file) return;
      try {
        const restored = normalizeState(JSON.parse(await file.text()));
        if (!confirm('Återställ backupen? Nuvarande recept och lista ersätts.')) return;
        state = restored;
        localStorage.setItem('state', JSON.stringify(state));
        save();
        location.hash = '#/';
      } catch (err) {
        errEl.textContent = err.message || 'Kunde inte läsa backupen.';
        errEl.hidden = false;
      } finally {
        importBackup.value = '';
      }
    };
  }

  // Fire-and-forget mot sparräknaren: kopian i egna state är det viktiga, ett tappat
  // räknar-anrop är ofarligt. Räknaren i vyn uppdateras optimistiskt.
  function unsave(r) {
    if (!r || !r.src || !loggedIn()) return;
    api('/save', { method: 'DELETE', body: JSON.stringify({ ownerId: r.src.owner, recipeId: r.src.id }) }).catch(() => {});
    const row = allPublicRows().find(x => x.id === r.src.id && x.ownerId === r.src.owner);
    if (row && row.saves > 0) row.saves--;
  }
  // Portionsväljaren i receptvyn och köksläget: styr listans mängder om receptet ligger där,
  // annars bara förhandsvisningen.
  function stepPortions(delta) {
    const id = recipeIdFromHash();
    const r = findRecipe(id);
    if (!r) return;
    const sel = state.recipes.some(x => x.id === id) ? selFor(id) : null;
    if (sel) { sel.portions = Math.max(1, sel.portions + delta); save(); }
    else { previewPortions[id] = Math.max(1, (previewPortions[id] || r.portions) + delta); render(); }
    const sp = $('#sheetPortions');
    if (sp) sp.textContent = portionsFor(r, id) + ' port';
  }

  // Vänförfrågningar och vänskap. Felet visas i formuläret om det är öppet, annars som toast.
  async function friendAction(path, method, notice, body) {
    if (friendsBusy) return;
    friendsBusy = true;
    friendErrorMessage = '';
    document.querySelectorAll('#friendForm button, [data-accept-friend], [data-cancel-friend], [data-remove-friend], [data-invite-add]').forEach(b => { b.disabled = true; });
    try {
      await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      friendNotice = notice;
      if (body) friendNameDraft = '';
      closeSheet();
      toast(notice);
      refreshFriends();
    } catch (err) {
      friendErrorMessage = err.message;
      const errEl = $('#friendError');
      if (errEl) { errEl.textContent = err.message; errEl.hidden = false; } else toast(err.message);
    } finally {
      friendsBusy = false;
      document.querySelectorAll('#friendForm button, [data-accept-friend], [data-cancel-friend], [data-remove-friend], [data-invite-add]').forEach(b => { b.disabled = false; });
    }
  }
  // Inbjudningslänken: delas via navigator.share där det finns, annars kopieras den.
  async function shareInvite() {
    const url = inviteUrl(authName);
    if (navigator.share) {
      try { await navigator.share({ title: 'Grammat', text: authName + ' bjuder in dig till Grammat', url }); return; }
      catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try { await navigator.clipboard.writeText(url); toast('Länken kopierad'); }
    catch (e) { toast(url); }
  }
  function openFriendSheet() {
    openSheet(`<form id="friendForm" class="sheet-form">
        <label for="friendName">Vännens kontonamn <input id="friendName" type="text" minlength="2" maxlength="20" required autocomplete="off" autocapitalize="none" spellcheck="false" value="${esc(friendNameDraft)}" aria-describedby="friendNameHint"></label>
        <p id="friendError" class="warn" role="alert" ${friendErrorMessage ? '' : 'hidden'}>${esc(friendErrorMessage)}</p>
        <button class="btn btn-ink btn-block" type="submit">Skicka förfrågan</button>
        <p id="friendNameHint" class="hint">Personen hittar sitt kontonamn under Konto. Enklare: skicka din länk, så slipper ni stava.</p>
      </form>
      <button class="sheet-item is-stacked" type="button" id="copyInvite">Kopiera min inbjudningslänk <small>${esc(inviteUrl(authName || '').replace(/^https?:\/\//, ''))}</small></button>
      <button class="btn btn-ghost sheet-cancel" type="button" data-close>Avbryt</button>`, 'Lägg till vän');
    bindSheet();
  }

  // Knapparna i ···-menyn. Töm listan skriver inte mot servern förrän ångra-fönstret (6 s) gått ut.
  function bindSheet() {
    const friendInput = $('#friendName');
    if (friendInput) friendInput.oninput = () => { friendNameDraft = friendInput.value; };
    const friendForm = $('#friendForm');
    if (friendForm) friendForm.onsubmit = e => {
      e.preventDefault();
      void friendAction('/friend-requests', 'POST', 'Vänförfrågan skickad.', { name: friendNameDraft });
    };
    const copyInvite = $('#copyInvite');
    if (copyInvite) copyInvite.onclick = () => { closeSheet(); shareInvite(); };
    const sh = $('#sheet');
    sh.querySelectorAll('[data-rstep]').forEach(b => b.onclick = () => stepPortions(Number(b.dataset.rstep)));
    const share = $('#shareRecipe');
    if (share) share.onclick = async () => {
      closeSheet();
      const id = recipeIdFromHash();
      const r = findRecipe(id);
      try { await navigator.clipboard.writeText(recipeAsText(r, portionsFor(r, id))); toast('Receptet kopierat som text'); }
      catch (e) { toast('Kunde inte kopiera'); }
    };
    const priv = $('#togglePrivate');
    if (priv) priv.onclick = () => {
      closeSheet();
      const r = state.recipes.find(x => x.id === recipeIdFromHash());
      if (!r) return;
      if (r.private) delete r.private; else r.private = true;
      save();
      toast(r.private ? 'Receptet är hemligt och visas inte för andra' : 'Receptet visas under Allas recept');
    };
    const del = $('#deleteRecipe');
    if (del) del.onclick = () => {
      closeSheet();
      const r = state.recipes.find(x => x.id === recipeIdFromHash());
      if (!r || !confirm('Ta bort "' + r.title + '"? Tas endast bort från dina recept, går inte att ångra.')) return;
      unsave(r);
      state.recipes = state.recipes.filter(x => x.id !== r.id);
      state.selections = state.selections.filter(s => s.id !== r.id);
      delete state.struck[r.id];
      location.hash = '#/';
      save();
    };
    const copyListBtn = $('#copyList');
    if (copyListBtn) copyListBtn.onclick = async () => {
      closeSheet();
      try { await navigator.clipboard.writeText(listAsText()); toast('Listan kopierad'); }
      catch (e) { toast('Kunde inte kopiera'); }
    };
    const clearBtn = $('#clearList');
    if (clearBtn) clearBtn.onclick = () => {
      closeSheet();
      const before = { selections: state.selections, extras: state.extras, checked: state.checked, struck: state.struck };
      state.selections = []; state.extras = []; state.checked = []; state.struck = {};
      render();
      toast('Listan tömd', { ms: 6000, action: 'Ångra',
        onAction: () => { Object.assign(state, before); render(); },
        onTimeout: () => save(false) });
    };
  }

  // Kom man via #/hej/NAMN skickas vänförfrågan automatiskt när kontot finns.
  async function sendPendingInvite() {
    let name = null;
    try { name = sessionStorage.getItem('grammat:invite'); sessionStorage.removeItem('grammat:invite'); } catch (e) { return; }
    if (!name || !INVITE_RE.test(name) || name === authName) return;
    try { await api('/friend-requests', { method: 'POST', body: JSON.stringify({ name }) }); toast('Förfrågan skickad till ' + name); }
    catch (e) { toast(e.message); }
    resetRemoteCaches();
    location.hash = '#/';
  }

  // Firebase startas efter första renderingen. onAuthStateChanged fyller på när den
  // persisterade sessionen återställts; hade man kvar en legacy-inloggning kopplas den
  // gamla kontoraden automatiskt till Firebase-uid:t (engångsuppgradering).
  function initFirebase() {
    fb = window.fb;
    fb.onAuthStateChanged(fb.auth, async user => {
      fbUser = user;
      if (user) {
        if (legacy) {
          try { await api('/link', { method: 'POST', body: JSON.stringify({ legacyToken: legacy.token }) }); }
          catch (e) { /* redan kopplat eller konflikt: /state avgör vad kontot ser */ }
          legacy = null;
          localStorage.removeItem('auth');
        }
        resetRemoteCaches();
        await pullState();
        await sendPendingInvite();
      } else if (!legacy) {
        authName = null;
        localStorage.removeItem('authName');
      }
      render();
    });
  }

  $('#headMore').onclick = () => {
    if (!headMoreItems) return;
    openSheet(headMoreItems.html + '<button class="btn btn-ghost sheet-cancel" type="button" data-close>Avbryt</button>', headMoreItems.title);
    bindSheet();
  };
  $('#headNew').onclick = e => {
    e.preventDefault();
    openSheet(`<a class="sheet-item" href="#/nytt">Skriv själv</a>
      <a class="sheet-item" href="#/importera">Klistra in text <small>t.ex. från ChatGPT</small></a>
      <button class="btn btn-ghost sheet-cancel" type="button" data-close>Avbryt</button>`, 'Nytt recept');
  };
  window.addEventListener('hashchange', () => {
    closeSheet();
    if (location.hash === '#/vanner') refreshFriends(); else render();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location.hash === '#/vanner' && loggedIn()) refreshFriends();
  });
  if (legacy) await pullState(); // gammal inloggning funkar som förut, utan Firebase
  if (!location.hash) { // öppnad utan adress: tillbaka till fliken man lämnade
    const last = localStorage.getItem('grammat:lastRoute');
    if (last && TABS.includes(last) && last !== '#/') location.replace(last);
  }
  render();
  if (window.fb) initFirebase(); else window.addEventListener('fb-ready', initFirebase, { once: true });
})();
