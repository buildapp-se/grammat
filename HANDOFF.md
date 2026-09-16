---
schemaVersion: 1
status: active
currentGoal: Hålla grammat i drift och stänga de sista punkterna före lansering i privat krets
nextAction: Ägaren provar vänförfrågan mellan två riktiga konton på buildapp.se/grammat och byter namn under Inställningar; sedan mobil-QA av kontovyn. Se sessionen 2026-09-16 nedan
blockers:
  - OAuth-branding kräver Google Cloud Console med lösenordsinloggning, en agent kan inte göra det steget
  - Legacy-PIN kan inte rensas förrän julia och hans loggat in via Firebase
reviewedAt: 2026-09-16
---

# Handoff

## 2026-09-16: vänskapsmigrationen och workern publicerade, kontonamnet ur mejlen borta

Extern granskning av policytexter: `createFirebaseUser` tog mejlens lokaldel som
publikt kontonamn när Google-namn saknades. Nu bara Google-namnet, annars `kock`
med siffra; namnet byts under Inställningar (`PUT /name`). Policyn 1.3 säger det,
plus GitHub Pages som webbhotell och Firebase-koden från Googles CDN. Commit
`2b9f3ed`, pushad, policyn verifierad live.

**Publicerat samma eftermiddag på ägarens order** ("gör deploy på grammat"):
`wrangler d1 migrations apply recept --remote` (0001_friendships.sql, rent
additiv, `IF NOT EXISTS`) och `wrangler deploy`, version
`05baaae3-97bb-4bdd-ac07-e6d586631fbf`. Verifierat: `GET /friends` svarar 401
(fanns inte i den gamla workern, gav 404). **Ingen D1-export togs**: den
nekades 2026-09-11 och migrationen är additiv; D1 Time Travel är
återställningsvägen om något ändå gått fel. Konton som redan skapats med
mejlens lokaldel som namn rättas inte automatiskt; ägaren avgör om de ska ses
över för hand.

**Fynd på vägen:** frontend med vänner (`app.js?v=recept-konto-20260911`) var
live sedan tidigare mot ett API utan vänendpoints, trots att grinden sa
"pusha frontend sist". Stängt av deployen ovan.

## 2026-09-11: lokalt verifierat, publicerat 2026-09-16

Användarens beställning: rätta egna recept i Allas, flytta Logga ut direkt under
identiteten, ta bort namn/PIN-formulären från inloggning och Konto, förklara
JSON-backupen, döp Lista till Handla och ersätt grupper med ömsesidiga vänförfrågningar.
Allt är implementerat. Befintliga PIN-sessioner och serverns återställningsmöjlighet
finns kvar; användaren accepterar manuell hjälp för pappa vid behov.

Vänskapens beslut och datamodell finns i `docs/adr/0001-vanner.md`. Inga gamla
grupper omvandlas automatiskt till vänner. Inga produktionskonton har använts för
tester och inga riktiga vänförfrågningar har skickats.

Verifierat: `node --check app.js`, `node test.js`, `node test-friends.cjs`,
`node test-ui.cjs`, samt `npx --yes wrangler@4.108.0 deploy --dry-run`.
DOM-testet använder jsdom 29.1.1 i ignorerade `backups/test-deps`; installationen
står i testfilen. Verklig webbläsare och visuell mobil-QA saknas, CUA gav tom
webbläsarlista även efter återinitialisering.

**Publiceringsgrind:** D1-export till `backups/recept-before-friends-20260911.sql`
nekades av automatisk godkännandegranskning. Filen är inte en verifierad backup.
Be om uttryckligt tillstånd till den privata lokala exporten innan nytt försök.
Sedan, från `worker/`: export, `npx --yes wrangler@4.108.0 d1 migrations apply recept --remote`,
`npx --yes wrangler@4.108.0 deploy`, därefter git push och live-verifiering.
Frontend kräver nya Worker-API:t, så pusha den sist. Versionsquery är
`app.js?v=recept-konto-20260911`. Uppdatera status här och ADR efter publicering.

Tidigare driftanteckningar nedan beskriver den publicerade versionen före denna ändring.

## Läget just nu, tillägg samma kväll

**2026-09-08 kväll: timern larmar på iPhone, och nedräkningen sitter vid sitt steg.**

- **Ljudet på iPhone.** Safari är helt tyst så fort ringklockan står på ljudlöst, om
  sidan inte sätter `navigator.audioSession.type = 'playback'`. Det görs nu i samma
  knapptryck som skapar `AudioContext` (iOS 17+). `alarm()` väcker dessutom en
  suspenderad kontext innan tonerna spelas, annars blir larmet tyst efter en stund i
  bakgrunden. Chrome saknar `audioSession`, koden hoppar över den utan fel.
  **Vibration går inte att rädda:** Safari har ingen `navigator.vibrate` alls, en
  iPhone får ljudet och den röda brickan.
- **Nedräkningen ritas i steget** den startades från, i stället för i en klump under
  portionsraden. Varje steg-timer får en nyckel `receptId|stegindex|minuter`, och medan
  den går ersätter chippet knappen på raden. Stoppar man den kommer knappen tillbaka.
  Timers startade i det fria fältet saknar nyckel och ligger kvar i toppraden.
- **Minutfältet är förifyllt** med receptets första tid, i stället för att vara tomt.
- Versionsquery `app.js?v=timer-steg-20260908`. `node test.js` grönt, verifierat i
  Chrome: fältet visar 20 för köttfärssåsen, chippet hamnar på rätt rad, egen timer
  hamnar i toppraden, stopp återställer knappen, larmet går till "Klar!".

Läget för nästa session (människa eller agent). Arkitektur i `docs/PROJECT.md`, v2-planen i `docs/ARKITEKTUR.md`, historiken i `docs/TODO.md`. Öppna punkter står i `BACKLOG.md`.

## Läget just nu

**2026-09-08: sök, timer, Google-knapp. Pushat till main, ingen worker-ändring.**

- **Sökfält** överst i Mina recept, Allas recept och Vänners recept. Filtrerar på titel och ingrediensnamn medan man skriver (`matchesQuery` i app.js, ren funktion, testad). Söktexten delas mellan flikarna och överlever omrendering; tomma kursrubriker döljs, noll träffar ger "Inget recept matchar". Hela vyn ritas om per tangenttryck och fokus återställs, så tangentbordet på mobil tappas inte.
- **Timer i receptvyn.** Steg som nämner tid ("20 min", "1 tim", `stepTimers` i app.js) får en ⏱-knapp, plus ett eget fält "minuter" under stegen. Aktiva timers visas som chips under portionsraden, räknar ner varje sekund, blir röda med "Klar!" och kan tas bort med ✕. Vid noll: `navigator.vibrate` och tre toner via Web Audio (AudioContext skapas i själva trycket, annars vägrar mobilen ljud). Timers lever i minnet, inte i state: synkas inte, överlever inte omladdning. Känd gräns: i bakgrundsflik kan larmet dröja och vibration utebli.
- **Google-knappen** följer nu Googles branding-riktlinjer (ljust tema): vit, 1 px `#747775`, den färgade G-loggan som inline-SVG, Roboto 500 14 px (tillagd i Google Fonts-länken). Tidigare var det en röd lingonknapp med bara text, vilket såg oseriöst ut. "Koppla Google-inloggning" under Konto är oförändrad ghost-knapp, den är ingen inloggning.
- **`worker/package.json` med `"type": "module"`** tillagd: `node test.js` importerar `worker/worker.js` som ES-modul och Node 24 kräver deklarationen. Testet hade fallit tyst sedan Node uppgraderades. wrangler bryr sig inte om filen.
- Versionsquery höjd till `app.js?v=sok-timer-20260908`. Verifierat lokalt i Chrome (mobilbredd, alla tre flikar, timer till "Klar!", inga konsolfel utöver väntad 401 på `/friends-feed` utloggad). **Ej verifierat:** ljud och vibration på riktig telefon, headless Chrome saknar båda.

**Sedan 2026-08-27:** `integritet.html` (informationsplikt, länk i sidfoten) och Cloudflare Web Analytics på zonen. **Sedan 2026-08-05:** `authDomain` är `auth.buildapp.se`, prodtestad Google-inloggning. Detaljer och dead ends i `docs/TODO.md`.

## Nästa steg
1. **Patrik:** OAuth-branding (appnamn "Grammat", supportmail) på `https://console.cloud.google.com/auth/branding?project=grammat-78450&authuser=patz.lofgren@gmail.com`. Sista steget för consentskärmen.
2. **Patrik, på telefonen:** starta en timer på 1 min, lås inte skärmen, kontrollera ljud och vibration. Prova sökfältet med tangentbordet uppe.
3. **Patrik, inloggat:** bekräfta att Vänners recept bara visar julias "abc". Samtidigt: andra ägare i Allas, spara/ta bort, hemlig-toggle, kopiera-ikon, ta bort grupp.
4. Julia loggar in på delade kontot ("Skapa lösenord" under Konto), sen hans. Först då kan legacy-PIN rensas.
5. Julia tar bort "abc" i appen. Patrik rättar utkastsstegen (salsiccia, räkpasta, chili con carne, gazpacho) och kör om seeden, se `BACKLOG.md`.
6. Mobilverifiering i butik: logga in, wake lock, bocka ingredienser, ladda om mitt i, synk på andra enheten.

## Bra att veta
- **Agentrutin**: D1-export till `backups/` FÖRE riskabla ändringar/D1-migreringar/worker-deploy (kommando i `docs/PROJECT.md`). Senast 2026-08-04 21:22 (`recept-2026-08-04-212213.sql`).
- **Push = frontend-deploy** (GH Pages, ca 30 s). Privat krets (Patrik, Julia, hans), så pusha verifierat arbete utan att fråga, enligt regel 1 i `C:\dev\CLAUDE.md`. Worker-deploy är ett separat steg och kräver backup först.
- **Cloudflare-edgecache**: `max-age=14400`, `app.js` kan serveras gammal upp till 4 h efter push. Höj `app.js?v=...` i `index.html` vid varje frontend-ändring i app.js (`index.html` cachas 10 min). Alternativt purge exakt URL `https://buildapp.se/grammat/app.js` i Cloudflare.
- **Lokal verifiering**: `python -m http.server 8123 --bind 127.0.0.1` i repo-roten, öppna `http://127.0.0.1:8123/#/allas` i Chrome DevTools MCP. `/feed` går mot prod-API:t utan inloggning, så Allas fungerar direkt; Mina recept fylls genom "Lägg till i mina recept". Worker lokalt: `cd worker && npx wrangler@4.108.0 dev --port 8787` + peka om `const API` tillfälligt (återställ före commit).
- **Kontroller**: `node --check app.js`, `node test.js` (kräver `worker/package.json`, se ovan).
- **Två allowlists för authDomain**: Authorized redirect URIs på OAuth-klienten `266950913438-cvl3in8ropsic8hp6sf07e466df3i63j` i Cloud Console, och Authorized domains i Firebase Auth. Båda har `auth.buildapp.se` sedan 2026-08-05. Revert vid problem: `authDomain: 'grammat-78450.firebaseapp.com'` i `index.html`.
- **Certifikatet för `auth.buildapp.se`** går ut 2026-11-02, Firebase förnyar själv. CN är en främmande domän (delat certifikat), vår ligger i SAN-listan, det är normalt.
- **PowerShell 5.1**: citattecken i `git commit -m` mangalas, använd Bash-verktyget eller `-F fil`. `app.js` och `index.html` är CRLF på disk, `test.js` LF.
- **wrangler 4.107.1 är trasig på den här maskinen** (workerd kraschar med `std::terminate`). Pinna `npx wrangler@4.108.0`.
- **Dataobservation 2026-07-08**: julia/hans state krympte (12→0 resp. 11→1 recept), troligen avsiktligt. Återställning: `backups/recept-2026-07-07-145724.sql`.

## Granskning 2026-09-16

Cross-project audit run from elwyn-dash (session 5 in the daily note). Results written to `## Audits` in CONTEXT.md, findings appended to BACKLOG.md under `## Granskning 2026-09-16`. Headers on buildapp.se and the TLS grade are zone-level and are fixed once in Cloudflare, not here.
