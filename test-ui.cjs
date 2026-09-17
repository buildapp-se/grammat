// npm install --prefix backups/test-deps --no-save jsdom@29.1.1
// node test-ui.cjs (isolated DOM + real Worker and SQLite, no production requests)
const { JSDOM, VirtualConsole } = require('./backups/test-deps/node_modules/jsdom');
const { createTestDb } = require('./test-d1.cjs');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const tick = () => new Promise(resolve => setTimeout(resolve, 15));
async function until(check, label) {
  for (let i = 0; i < 150; i++) { if (check()) return; await tick(); }
  throw new Error('Timed out: ' + label);
}
(async () => {
  const { default: worker } = await import('./worker/worker.js');
  const { db, sqlite } = createTestDb();
  const errors = [];
  const windows = [];
  const recipe = (id, title) => ({ id, title, portions: 2, course: 'huvudratt', ingredients: [{name: 'pasta',amount: 200,unit: 'g',cat: 'skafferi'}],steps:['Koka.'] });
  for (const [id, name, recipes] of [[1,'alice',[recipe('pasta','Alice pasta')]], [2,'bob',[recipe('pasta','Bob pasta')]], [3,'grammat',[recipe('starter','Startrecept')]]]) {
    sqlite.prepare('INSERT INTO users (id,name,pin_hash,token) VALUES (?,?,?,?)').run(id,name,'','test-only-session-' + id);
    await worker.fetch(new Request('https://test.invalid/state', {method:'PUT',headers:{Authorization:'Bearer test-only-session-' + id},body:JSON.stringify({recipes,selections:[],extras:[],checked:[],struck:{}})}),{DB:db});
  }
  const html = fs.readFileSync('index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
  async function open(user, hash, desktop) {
    const console = new VirtualConsole();
    console.on('jsdomError', error => errors.push(error.message));
    const dom = new JSDOM(html, {url:'https://test.invalid/' + hash,runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:console});
    const w = dom.window;
    windows.push(w);
    let authCallback;
    w.confirm = () => true;
    w.alert = text => errors.push(text);
    if (desktop) w.matchMedia = () => ({matches:true,addEventListener() {}}); // jsdom saknar matchMedia: utan den ritas mobilvyn
    w.fetch = async (url, opts) => {
      if (url.startsWith('starter.json')) return Response.json([]);
      if (url === 'nutrients.json') return Response.json({});
      assert.ok(url.startsWith('https://recept-api.buildapp.se/'));
      return worker.fetch(new Request(url, opts),{DB:db});
    };
    w.fb = {auth:{},onAuthStateChanged(auth, cb) { authCallback=cb; void cb(user ? {email:'test@example.invalid',providerData:[{providerId:'password'}],getIdToken:async()=> 'test-only-session-' + user} : null); },signOut:async()=>authCallback(null)};
    await w.eval(fs.readFileSync('app.js','utf8'));
    await until(() => w.document.querySelector('#navUser').dataset.name === (user === 1 ? 'alice' : user === 2 ? 'bob' : ''), 'login');
    return w;
  }
  const text = w => w.document.querySelector('#view').textContent;
  const navigate = async (w, hash, selector) => {
    w.location.hash = hash;
    await tick(); // jsdom dispatches hashchange asynchronously.
    await until(() => w.document.querySelector(selector), 'navigate ' + hash);
  };
  const alice = await open(1, '#/allas');
  await until(() => text(alice).includes('Bob pasta'), 'public feed');
  assert.ok(!text(alice).includes('Alice pasta'), 'own recipe excluded from Allas');
  assert.ok(alice.document.querySelector('[data-add-allas="2|pasta"]'), 'same slug from another owner is addable');
  await navigate(alice, '#/recept/1%7Cpasta', '[data-rstep]');
  assert.ok(!alice.document.querySelector('[data-add-allas]'), 'public own link cannot add a duplicate');
  alice.document.querySelector('[data-rstep="1"]').click();
  assert.ok(text(alice).includes('3 port'), 'own composite URL supports portion controls');
  alice.document.querySelector('[data-ing]').click();
  await until(() => JSON.parse(alice.localStorage.getItem('state')).struck.pasta?.length === 1, 'ingredient uses local recipe id');
  await navigate(alice, '#/konto', '#logout');
  const logout = alice.document.querySelector('#logout');
  assert.ok(logout.parentElement.previousElementSibling.textContent.includes('Inloggad som'), 'logout directly below identity');
  assert.ok(!text(alice).includes('namn + PIN'));
  assert.ok(text(alice).includes('JSON-fil'));
  let blob, filename;
  alice.URL.createObjectURL = value => {blob = value; return 'blob:test';};
  alice.URL.revokeObjectURL = () => {};
  alice.HTMLAnchorElement.prototype.click = function () {filename=this.download;};
  alice.document.querySelector('#exportBackup').click();
  assert.match(filename,/^grammat-backup-\d{4}-\d{2}-\d{2}\.json$/);
  assert.equal(blob.type,'application/json');
  const reader = new alice.FileReader();
  const backupText = await new Promise(resolve => {reader.onload=()=>resolve(reader.result);reader.readAsText(blob);});
  assert.equal(JSON.parse(backupText).state.recipes[0].title,'Alice pasta');
  assert.equal(alice.document.querySelector('[data-match="#/lista"]').textContent.trim(),'Lista');
  await navigate(alice, '#/lista', '.extra-form');
  assert.equal(alice.document.querySelector('h1').textContent,'Lista');

  await navigate(alice, '#/vanner', '#addFriend');
  await until(() => text(alice).includes('Inga vänner ännu'), 'empty friends state');
  alice.document.querySelector('#addFriend').click();
  let input=alice.document.querySelector('#friendName'); input.value='alice'; input.dispatchEvent(new alice.Event('input'));
  alice.document.querySelector('#friendForm').dispatchEvent(new alice.Event('submit',{bubbles:true,cancelable:true}));
  await until(() => alice.document.querySelector('#friendError').textContent.includes('Du kan inte lägga till dig själv'), 'request error visible in sheet');
  assert.equal(alice.document.querySelector('#friendError').hidden, false);
  input=alice.document.querySelector('#friendName'); input.value='bob'; input.dispatchEvent(new alice.Event('input'));
  alice.document.querySelector('#friendForm').dispatchEvent(new alice.Event('submit',{bubbles:true,cancelable:true}));
  await until(() => text(alice).includes('Väntar på svar'),'request outgoing');
  assert.equal(alice.document.querySelector('#sheet').hidden, true, 'sheet closes after request');
  assert.ok(!text(alice).includes('Bob pasta'), 'pending does not show recipes');
  const bob=await open(2,'#/vanner');
  await until(() => bob.document.querySelector('[data-accept-friend]'),'request incoming');
  bob.document.querySelector('[data-accept-friend]').click();
  await until(() => text(bob).includes('Alice pasta'),'recipient feed after accept');
  await navigate(alice,'#/','.view-head');
  await navigate(alice,'#/vanner','#addFriend'); // fliken laddas om vid varje besök, ingen Uppdatera-knapp
  await until(() => text(alice).includes('Bob pasta'),'sender feed after revisit');
  assert.ok(text(alice).includes('bob · 1'), 'friends recipes grouped per friend');
  // Desktop (AP8): samma data som numrerade rader med register, inga mobilrader.
  const wide=await open(2,'#/vanner',true);
  await until(() => wide.document.querySelector('#toc-van-1 .toc-row'),'desktop friends section per friend');
  assert.ok(wide.document.querySelector('#toc-van-1').textContent.includes('Alice pasta'));
  assert.equal(wide.document.querySelector('[data-toc="van-1"]').textContent,'alice1','register row per friend with count');
  assert.ok(wide.document.querySelector('.toc-side #addFriend') && wide.document.querySelector('#toc-friends [data-remove-friend]'),'add friend in sidebar, friend list in main');
  assert.equal(wide.document.querySelectorAll('.prow, .rcard').length,0,'no mobile rows on desktop');
  await navigate(wide,'#/allas','.toc[data-filter]');
  await until(() => wide.document.querySelector('[data-toc="huvudratt"]'),'desktop Allas register');
  wide.document.querySelector('[data-toc="huvudratt"]').click();
  assert.deepEqual([...wide.document.querySelectorAll('.toc-h')].map(h => h.textContent),['Huvudrätt'],'register filters Allas to one section');
  assert.ok(wide.document.querySelector('[data-toc="huvudratt"]').classList.contains('is-on'));
  await navigate(wide,'#/','.toc-row [data-toggle-list]');
  wide.document.querySelector('[data-toggle-list]').click();
  assert.deepEqual([...wide.document.querySelectorAll('.toc-h')].map(h => h.textContent),['I listan'],'listed recipe moves to I listan, not duplicated');
  const add=alice.document.querySelector('[data-add-allas="2|pasta"]');
  add.click(); add.click();
  assert.equal(JSON.parse(alice.localStorage.getItem('state')).recipes.length,2,'double click saves only once');
  assert.equal(JSON.parse(alice.localStorage.getItem('state')).recipes[1].src.owner,2,'same slug retains correct provenance');
  await navigate(alice,'#/recept/2%7Cpasta','.rv-top');
  assert.ok(!alice.document.querySelector('[data-add-allas]'),'saved public detail cannot add twice');
  await navigate(alice,'#/vanner','#addFriend');
  await until(()=>alice.document.querySelector('[data-remove-friend]'),'friend ready');
  alice.document.querySelector('[data-remove-friend]').click();
  await until(()=>!text(alice).includes('Bob pasta') && text(alice).includes('Vännen har tagits bort.'),'remove friend');
  assert.equal(JSON.parse(alice.localStorage.getItem('state')).recipes.length,2,'friend removal retains saved copy');
  const invited=await open(null,'#/hej/bob');
  await until(() => text(invited).includes('bob bjöd in dig'), 'invite page');
  await until(() => text(invited).includes('Bob pasta'), 'inviter public recipes visible without account');
  assert.equal(invited.sessionStorage.getItem('grammat:invite'), 'bob', 'inviter remembered for after login');
  const guest=await open(null,'#/konto');
  assert.ok(!text(guest).includes('namn + PIN'));
  assert.ok(guest.document.querySelector('#emailForm'));
  await navigate(guest,'#/join/ABCD1234','a[href="#/vanner"]');
  assert.ok(text(guest).includes('gamla gruppinbjudan'));
  await navigate(guest,'#/vanner','a[href="#/konto"]');
  assert.ok(text(guest).includes('Logga in för att lägga till vänner'));
  await tick();
  assert.deepEqual(errors,[]);
  for (const w of windows) w.close();
  sqlite.close();
  console.log('PASS: DOM flows for two accounts, accept/remove, recipe ownership/collisions, duplicate guard, logout placement, JSON download, Handla and old-login removal');
})().catch(error => {console.error(error);process.exit(1);});
