// ponytail: minsta möjliga check av summering/skalning - körs med: node test.js
const assert = require('assert');
const fs = require('fs');
const { ingLabel, stepIngredients, aggregate, fmtNum, fmtItem, fmtIngredient, recipeAsText, spiceHint, parseImport, normalizeState, makeBackup, safeUrl, nutritionPerPortion, COURSES, normalizeCourse, normTags, normLabels, dedupeAllas, matchesQuery, stepTimers } = require('./app.js');

const recipes = JSON.parse(fs.readFileSync(__dirname + '/starter.json', 'utf8'));

// 1. Summering över två recept: vitlök finns i både köttfärssås (20 g) och kebab (5 g)
let items = aggregate(recipes, [{ id: 'kottfarssas', portions: 6 }, { id: 'kebab', portions: 6 }]);
const vitlok = items.find(i => i.key === 'vitlök');
assert.strictEqual(vitlok.amount, 25, 'vitlök ska summeras till 25 g');
assert.strictEqual(vitlok.count, 5, 'vitlök ~5 klyftor');
assert.strictEqual(vitlok.sources.length, 2, 'två källrecept');
const olivolja = items.find(i => i.key === 'olivolja');
assert.strictEqual(olivolja.amount, 170, 'olivolja 100+70 ml');

// 2. Skalning: veg-lasagne 16 -> 4 portioner = fjärdedel
items = aggregate(recipes, [{ id: 'veg-lasagne', portions: 4 }]);
assert.strictEqual(items.find(i => i.key === 'lasagneplattor').amount, 250, 'lasagneplattor 1000/4');
assert.strictEqual(items.find(i => i.key === 'riven ost').amount, 65, 'riven ost (160+100)/4');

// 3. skipList: vatten ska inte hamna i listan
assert.ok(!items.find(i => i.key === 'vatten'), 'vatten utesluts');

// 3b. struck: bockade ingredienser (har hemma/redan i grytan) utesluts per recept
items = aggregate(recipes, [{ id: 'kottfarssas', portions: 6 }, { id: 'kebab', portions: 6 }], { kottfarssas: ['vitlök'] });
assert.strictEqual(items.find(i => i.key === 'vitlök').amount, 5, 'bara kebabens vitlök kvar');
items = aggregate(recipes, [{ id: 'kottfarssas', portions: 6 }], { kottfarssas: ['vitlök'] });
assert.ok(!items.find(i => i.key === 'vitlök'), 'helt bockad vara försvinner ur listan');

// 4. efter smak: svartpeppar i veg-lasagne saknar mängd
const peppar = items.find(i => i.key === 'svartpeppar');
assert.strictEqual(fmtItem(peppar), 'efter smak');

// 5. svenskt talformat
assert.strictEqual(fmtNum(1234), '1 235', 'avrundas till närmsta 5, tusentalsmellanslag');
assert.strictEqual(fmtNum(2.5), '2,5', 'decimalkomma');

// 6. AI-import: kodstaket + prat runt JSON ska tolereras, fält normaliseras, alltid array tillbaka
const aiSvar = 'Här är receptet!\n```json\n{"title":"Testgryta","portions":4,"ingredients":[{"name":"Gul Lök ","amount":110,"unit":"g","count":1,"cat":"grönt"},{"name":"salt","toTaste":true,"cat":"felkategori"},{"name":"vatten","amount":500,"unit":"ml","skipList":true,"cat":"övrigt"}],"steps":["Koka.",""]}\n```';
const [imp, ...rest] = parseImport(aiSvar, ['testgryta']);
assert.strictEqual(rest.length, 0, 'enstaka objekt ger array med ett recept');
assert.strictEqual(imp.id, 'testgryta-2', 'krockande id får suffix');
assert.strictEqual(imp.ingredients[0].name, 'Gul Lök', 'namn trimmas');
assert.strictEqual(imp.ingredients[1].cat, 'övrigt', 'okänd kategori faller tillbaka');
assert.strictEqual(imp.ingredients[1].toTaste, true);
assert.strictEqual(imp.ingredients[2].skipList, true);
assert.strictEqual(imp.steps.length, 1, 'tomma steg filtreras');
assert.strictEqual(imp.course, 'huvudratt', 'saknad/okänd course faller tillbaka till huvudratt');
assert.throws(() => parseImport('inget json här', []), /Hittar ingen JSON/);
assert.throws(() => parseImport('{"portions":4}', []), /title/);

// 6b. AI-import av flera recept i en array: id-krock inom batchen, allt eller inget vid fel
const ing = '[{"name":"pasta","amount":200,"unit":"g","cat":"skafferi"}]';
const multi = parseImport(`Här! [{"title":"Soppa","ingredients":${ing}},{"title":"Soppa","ingredients":${ing}}]`, []);
assert.strictEqual(multi.length, 2, 'två recept läses in');
assert.strictEqual(multi[0].id, 'soppa');
assert.strictEqual(multi[1].id, 'soppa-2', 'id-krock inom samma inklistring får suffix');
assert.throws(() => parseImport(`[{"title":"Ok","ingredients":${ing}},{"portions":4}]`, []), /Recept 2: .*title/, 'fel pekar ut vilket recept, inget importeras');
assert.throws(() => parseImport('[]', []), /tom/);
const [medHakar] = parseImport(`prat [med hakar] i {"title":"Hak","ingredients":${ing}} slutet]`, []);
assert.strictEqual(medHakar.id, 'hak', 'hakparenteser i prat runt ett objekt lurar inte tolkningen');

// 7. Backup: wrapper + rå state tolereras, trasiga/okända fält normaliseras
assert.strictEqual(safeUrl('javascript:alert(1)'), '', 'osäkra käll-länkar stoppas');
const backup = makeBackup({
  recipes: [{
    id: 'test',
    title: 'Backuprecept',
    portions: 2,
    source: 'javascript:alert(1)',
    ingredients: [{ name: 'pasta', amount: 200, unit: 'g', cat: 'skafferi' }],
    steps: ['Koka.'],
  }],
  selections: [{ id: 'test', portions: 2 }, { id: 'saknas', portions: 4 }],
  extras: [{ id: 1, text: 'mjölk' }],
  checked: ['pasta'],
  struck: { test: ['pasta'], saknas: ['x'], trasig: 'inte en array' },
});
const restored = normalizeState(backup);
assert.strictEqual(restored.recipes.length, 1, 'backup wrapper läses');
assert.deepStrictEqual(restored.struck, { test: ['pasta'] }, 'struck utan recept eller med trasigt format filtreras');
assert.deepStrictEqual(normalizeState({ recipes: [] }).struck, {}, 'gammal state utan struck får tomt objekt');
assert.strictEqual(restored.recipes[0].source, '', 'osäker källa följer inte med backup');
assert.strictEqual(restored.recipes[0].course, 'huvudratt', 'saknad course i backup faller tillbaka till huvudratt');
assert.ok(COURSES.includes('sas'), 'såser & röror finns som course');
assert.strictEqual(normalizeCourse('testa'), 'testa', 'Att testa är en egen course');
assert.strictEqual(restored.selections.length, 1, 'val utan recept filtreras');
assert.strictEqual(normalizeState(restored).extras[0].text, 'mjölk', 'rå state kan också återställas');

// 8. Näringsvärde per portion: skalning, efter smak-uteslutning, saknad data flaggas
const testNutrients = { 'lök': { kcal: 40, protein: 1, carbs: 9, fat: 0.1 }, 'salt': { kcal: 0, protein: 0, carbs: 0, fat: 0 } };
const testRecipe = { portions: 2, ingredients: [
  { name: 'lök', amount: 200 },
  { name: 'salt', toTaste: true },
  { name: 'okänd ingrediens', amount: 100 },
] };
const nutr = nutritionPerPortion(testRecipe, testNutrients);
assert.strictEqual(nutr.kcal, 40, 'lök 200 g à 40 kcal/100g delat på 2 portioner = 40 kcal/portion');
assert.deepStrictEqual(nutr.missing, ['okänd ingrediens'], 'okänd ingrediens flaggas, efter smak räknas inte som saknad');

// 9. spiceHint: krm/tsk/msk-gissning för ovägda kryddor, bara för skafferi under 30 g utan count
assert.strictEqual(spiceHint(2, 'g', 'skafferi'), '2 krm');
assert.strictEqual(spiceHint(10, 'g', 'skafferi'), '2 tsk');
assert.strictEqual(spiceHint(30, 'g', 'skafferi'), '2 msk');
assert.strictEqual(spiceHint(50, 'g', 'skafferi'), '', 'för stor mängd, ingen gissning');
assert.strictEqual(spiceHint(5, 'g', 'grönt'), '', 'bara skafferi');
assert.strictEqual(spiceHint(5, 'ml', 'skafferi'), '', 'bara g, redan volym i ml');
assert.strictEqual(fmtIngredient({ amount: 3, unit: 'g', cat: 'skafferi' }, 1), '3 g (~3 krm)');
assert.strictEqual(fmtIngredient({ amount: 220, unit: 'g', count: 2, countUnit: 'st', cat: 'grönt' }, 1), '220 g (~2 st)', 'count vinner över spiceHint');

// 10. Allas recept: startpaket-id:n filtreras bort, ägarnamn visas på andras recept
const allasList = [
  { id: 'starter-1', title: 'Redan i startpaketet', owner: 'julia' },
  { id: 'unik', title: 'Bara julias', owner: 'julia' },
  { id: 'kollision', title: 'Kollision A', owner: 'julia' },
  { id: 'kollision', title: 'Kollision B', owner: 'hans' },
];
const others = dedupeAllas(allasList, ['starter-1']);
assert.strictEqual(others.length, 3, 'startpaket-id filtreras bort');
assert.strictEqual(others.find(r => r.id === 'unik')._ownerLabel, 'julia', 'ägaretikett visas alltid för andras recept');
assert.strictEqual(others.find(r => r.id === 'unik')._idCollision, false, 'unik slug flaggas inte som krock');
assert.strictEqual(others.find(r => r.owner === 'julia' && r.id === 'kollision')._ownerLabel, 'julia', 'ägaretikett vid krock');
assert.strictEqual(others.find(r => r.owner === 'hans')._ownerLabel, 'hans', 'ägaretikett vid krock');
assert.strictEqual(others.find(r => r.owner === 'hans')._idCollision, true, 'slug-krock flaggas');
assert.strictEqual(normalizeCourse('Huvudrätt'), 'huvudratt', 'visningsetikett som course normaliseras till huvudratt');
assert.strictEqual(normalizeCourse('huvudratt'), 'huvudratt', 'giltig course behålls');

// 10b. private + src överlever normalisering (sync/backup), skräp-src slängs
const privState = normalizeState({ recipes: [
  { id: 'hemlis', title: 'Hemlis', private: true, ingredients: [{ name: 'pasta', amount: 200, unit: 'g', cat: 'skafferi' }] },
  { id: 'sparad', title: 'Sparad', src: { owner: 3, id: 'original' }, ingredients: [{ name: 'pasta', amount: 200, unit: 'g', cat: 'skafferi' }] },
  { id: 'trasig-src', title: 'Trasig', src: { owner: 'inte-ett-tal' }, ingredients: [{ name: 'pasta', amount: 200, unit: 'g', cat: 'skafferi' }] },
] });
assert.strictEqual(privState.recipes[0].private, true, 'private överlever normalisering');
assert.strictEqual(privState.recipes[1].private, undefined, 'private smittar inte');
assert.deepStrictEqual(privState.recipes[1].src, { owner: 3, id: 'original' }, 'src överlever normalisering');
assert.strictEqual(privState.recipes[2].src, undefined, 'trasig src slängs');

// 11. Kopiera recept: ren text för sms/texteditor, inte JSON
const copyRecipe = {
  title: 'Testpasta',
  portions: 2,
  source: 'https://example.com/recept',
  ingredients: [
    { name: 'pasta', amount: 200, unit: 'g', cat: 'skafferi' },
    { name: 'salt', toTaste: true, cat: 'skafferi', group: 'Sås' },
  ],
  steps: ['Koka pastan.', 'Blanda med såsen.'],
};
assert.strictEqual(recipeAsText(copyRecipe, 4), [
  'Testpasta',
  '',
  '4 portioner',
  '',
  'Ingredienser',
  '- pasta: 400 g',
  '',
  'Sås',
  '- salt: efter smak',
  '',
  'Gör så här',
  '1. Koka pastan.',
  '2. Blanda med såsen.',
  '',
  'Källa',
  'https://example.com/recept',
].join('\n'), 'kopierat recept är läsbar ren text');

// Serverns saneringsgräns: en rå PUT (curl, utan klientens normalizeState) får inte
// lägga aktiv HTML i publika flödet via portions/unit.
import('./worker/worker.js').then(({ sanitizeIndexed }) => {
  const hostile = sanitizeIndexed({
    id: 'x', title: 'x', portions: '<img src=x onerror=alert(1)>', course: 'skräp',
    ingredients: [{ name: 'salt', unit: '<script>alert(1)</script>' }],
  });
  assert.strictEqual(hostile.portions, 4, 'portions tvingas till tal');
  assert.strictEqual(hostile.ingredients[0].unit, 'g', 'unit tvingas till g/ml');
  assert.strictEqual(hostile.course, 'huvudratt', 'okänd course normaliseras');
  assert.strictEqual(sanitizeIndexed({ portions: 6.4, ingredients: [{ unit: 'ml' }] }).portions, 6, 'giltiga portions behålls');
  assert.strictEqual(sanitizeIndexed({ tags: ['Hemligt'], ingredients: [] }).tags, undefined, 'egna kategorier når aldrig publika indexet');
// 12. Sök: titel eller ingrediens, skiftlägesokänsligt, tom fras matchar allt
assert.ok(matchesQuery(recipes[0], ''), 'tom sökning matchar');
assert.strictEqual(recipes.filter(r => matchesQuery(r, 'VITLÖK')).length >= 2, true, 'ingrediens-sök hittar minst köttfärssås och kebab');
assert.ok(recipes.some(r => r.id === 'veg-lasagne' && matchesQuery(r, 'lasagne')), 'titel-sök');
assert.ok(!matchesQuery(recipes[0], 'xyzzy'), 'ingen träff');

// 14. Böjning: ett recept med en ingrediens
assert.strictEqual(ingLabel(1), '1 ingrediens');
assert.strictEqual(ingLabel(15), '15 ingredienser');

// 15. Köksläget: ingredienser som nämns i ett steg, hela namn eller ordstam med ordgräns
const cookIngs = [{ name: 'gul lök' }, { name: 'vitlök' }, { name: 'räkor, avrunna' }, { name: 'mango (fryst)' }, { name: 'salt' }];
assert.deepStrictEqual(stepIngredients('Fräs löken och vitlöken', cookIngs).map(i => i.name), ['gul lök', 'vitlök']);
assert.deepStrictEqual(stepIngredients('Lägg i räkorna och mangon', cookIngs).map(i => i.name), ['räkor, avrunna', 'mango (fryst)']);
assert.deepStrictEqual(stepIngredients('Servera.', cookIngs), [], 'inget nämnt ger tom lista');

// 13. Timer ur stegtext: min och tim, intervall ger övre gränsen, dubbletter bort, sekunder ignoreras
assert.deepStrictEqual(stepTimers('Koka i 20 min, rör om'), [{ label: '20 min', minutes: 20 }]);
assert.deepStrictEqual(stepTimers('Låt vila 1 tim i kylen'), [{ label: '1 tim', minutes: 60 }]);
assert.deepStrictEqual(stepTimers('Sjud 10-15 minuter').map(t => t.minutes), [15]);
assert.deepStrictEqual(stepTimers('Stek 2 min per sida, 2 min till').length, 1, 'dubblett bort');
assert.deepStrictEqual(stepTimers('Vispa 30 sek'), [], 'sekunder ignoreras');
assert.deepStrictEqual(stepTimers('Servera med 200 g ris'), [], 'gram är ingen tid');

  console.log('Alla test OK');
});
// Egna kategorier: trimmas, dubbletter oavsett skiftläge bort, överlever backup
assert.deepStrictEqual(normTags(' Vardag, vardag ,,Julbord'), ['Vardag', 'Julbord'], 'kommasträng normaliseras');
assert.deepStrictEqual(normTags([1, 'Fest']), ['Fest'], 'icke-strängar bort');
assert.deepStrictEqual(normalizeState({ recipes: [{ title: 'T', ingredients: [{ name: 'salt' }], tags: ['Fest'] }] }).recipes[0].tags, ['Fest'], 'taggar överlever normalizeState');
assert.ok(matchesQuery({ title: 'x', ingredients: [], tags: ['Julbord'] }, 'julb'), 'sök träffar egen kategori');
// Taggar: fast lista, okända bort, följer med import och backup, sökbara
assert.deepStrictEqual(normLabels(['snabbt', 'hackat', 'vegetariskt']), ['vegetariskt', 'snabbt'], 'bara kända taggar, i listans ordning');
assert.deepStrictEqual(parseImport('{"title":"T","labels":["veganskt","x"],"ingredients":[{"name":"salt"}]}', [])[0].labels, ['veganskt'], 'import behåller kända taggar');
assert.deepStrictEqual(normalizeState({ recipes: [{ title: 'T', ingredients: [{ name: 'salt' }], labels: ['fest'] }] }).recipes[0].labels, ['fest'], 'taggar överlever backup');
assert.ok(matchesQuery({ title: 'x', ingredients: [], labels: ['vegetariskt'] }, 'vegetar'), 'sök hittar tagg');
assert.strictEqual(COURSES[0], 'testa', 'Att testa står först');
// Egen kategori: byta namn och ta bort i alla recept på en gång
{
  const { renameTag } = require('./app.js');
  const rs = [{ id: 'a', tags: ['Vardag', 'Jul'] }, { id: 'b', tags: ['vardag'] }, { id: 'c', tags: ['Jul'] }, { id: 'd' }];
  const changed = renameTag(rs, 'Vardag', 'Snabbt');
  assert.deepStrictEqual(rs.map(r => r.tags), [['Snabbt', 'Jul'], ['Snabbt'], ['Jul'], undefined], 'byter namn oavsett skiftläge, rör inget annat');
  assert.deepStrictEqual(changed.map(([r, old]) => [r.id, old]), [['a', ['Vardag', 'Jul']], ['b', ['vardag']]], 'gamla tags för ångra');
  renameTag(rs, 'Snabbt', 'Jul');
  assert.deepStrictEqual(rs.map(r => r.tags), [['Jul'], ['Jul'], ['Jul'], undefined], 'slås ihop med befintlig kategori utan dubblett');
  rs[0].tags = ['Jul', 'Fest'];
  renameTag(rs, 'jul', '');
  assert.deepStrictEqual(rs.map(r => 'tags' in r ? r.tags : null), [['Fest'], null, null, null], 'tar bort kategorin, tomt fält stryks');
  assert.deepStrictEqual(renameTag(rs, 'finns inte', 'x'), [], 'okänd kategori ändrar inget');
}
import('./worker/worker.js').then(({ sanitizeIndexed }) => {
  assert.deepStrictEqual(sanitizeIndexed({ labels: ['vegetariskt', '<img onerror=x>'], ingredients: [] }).labels, ['vegetariskt'], 'workern vitlistar taggar');
});

// Guide: måttomvandling
{
  const { parseAmount, fmtAmount, convertUnit, cToF, fToC } = require('./app.js');
  assert.strictEqual(parseAmount('1,5'), 1.5);
  assert.strictEqual(parseAmount('1 1/2'), 1.5);
  assert.strictEqual(parseAmount('3/4'), 0.75);
  assert.throws(() => parseAmount('abc'));
  assert.throws(() => parseAmount(''));
  assert.strictEqual(fmtAmount(236.588), '237');
  assert.strictEqual(fmtAmount(1.4786), '1,48');
  assert.strictEqual(fmtAmount(12500), '12 500');
  const dl = { ml: 100 }, msk = { ml: 15 }, g = { g: 1 }, cup = { ml: 236.588 };
  assert.strictEqual(convertUnit(1, dl, msk), 100 / 15);
  assert.strictEqual(fmtAmount(convertUnit(1, cup, dl)), '2,37');
  assert.strictEqual(convertUnit(2, dl, g, 60), 120, '2 dl vetemjöl = 120 g');
  assert.strictEqual(convertUnit(120, g, dl, 60), 2, 'och tillbaka');
  assert.throws(() => convertUnit(1, dl, g), 'volym till vikt utan densitet kastar');
  assert.strictEqual(cToF(180), 356);
  assert.strictEqual(fToC(212), 100);
}

// Guide: datakontroll av guide.json (svensk text, kopplingar, enheter)
{
  const g = JSON.parse(fs.readFileSync(__dirname + '/guide.json', 'utf8'));
  const bad = [];
  const walk = (v, path) => {
    if (typeof v === 'string') {
      if (/—/.test(v)) bad.push(path + ': tankstreck');
      if (!/^(sources|url|svg|body|viewBox|d)\b|\.(en|url|id|cutId|animal|viewBox|body)$|\.svg\.|\.sources\./.test(path) && /\d\.\d/.test(v)) bad.push(path + ': decimalpunkt i "' + v + '"');
    } else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, path + '.' + k);
  };
  walk(g, 'guide');
  const cutIds = new Set(g.cuts.animals.flatMap(a => a.regions.map(r => r.id)));
  for (const x of [...g.sousvide, ...g.ugn]) if (x.cutId && !cutIds.has(x.cutId)) bad.push(x.id + ': okänd cutId ' + x.cutId);
  for (const a of g.cuts.animals) if (a.svg) {
    for (const id of Object.keys(a.svg.regions)) if (!a.regions.some(r => r.id === id)) bad.push(a.id + ': svg-region utan del ' + id);
    for (const r of a.regions) if (!a.svg.regions[r.id]) bad.push(a.id + ': del utan svg-region ' + r.id);
    for (const r of a.regions) if (!(a.svg.labels[r.id] || (a.svg.callouts || {})[r.id])) bad.push(a.id + ': del utan text i bilden ' + r.id);
  }
  for (const u of [...g.matt.volume, ...g.matt.weight]) if (!(u.ml > 0) === !(u.g > 0)) bad.push(u.id + ': enhet behöver ml eller g');
  for (const d of g.matt.density) if (!(d.gPerDl > 0)) bad.push(d.id + ': gPerDl saknas');
  // Receptrad till densitet: exakt namn eller aka, parentes och komma bortses, aldrig delsträng
  const { densityFor } = require('./app.js');
  const dens = name => (densityFor(name, g.matt.density) || {}).id || null;
  assert.strictEqual(dens('vetemjöl'), 'vetemjol');
  assert.strictEqual(dens('ris (gärna jasmin)'), 'ris');
  assert.strictEqual(dens('Olivolja (salsa)'), 'olja');
  assert.strictEqual(dens('salt'), 'salt-fint');
  assert.strictEqual(dens('flingsalt (till glaskanten)'), 'flingsalt');
  assert.strictEqual(dens('röda linser (torkade)'), 'linser');
  assert.strictEqual(dens('jordnötssmör'), null, 'delsträng matchar inte');
  assert.strictEqual(dens('rött vin (eller vatten)'), null, 'alternativ i parentes matchar inte');
  assert.strictEqual(dens('nötfärs'), null);
  for (const d of g.matt.density) for (const a of d.aka || []) assert.strictEqual(dens(a), d.id, 'aka ' + a + ' krockar med en annan rad');
  if (new Set(g.sousvide.map(x => x.id)).size !== g.sousvide.length || new Set(g.ugn.map(x => x.id)).size !== g.ugn.length) bad.push('dubbla id i tider');
  assert.deepStrictEqual(bad, [], 'guide.json:\n' + bad.join('\n'));
}
