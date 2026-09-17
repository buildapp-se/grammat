---
schemaVersion: 1
status: active
currentGoal: Hålla grammat i drift och stänga de sista punkterna före lansering i privat krets
nextAction: Ägaren provar vänförfrågan mellan två riktiga konton på buildapp.se/grammat och byter namn under Inställningar; sedan mobil-QA av kontovyn. Se sessionen 2026-09-16 nedan
blockers:
  - OAuth-branding kräver Google Cloud Console med lösenordsinloggning, en agent kan inte göra det steget
  - Legacy-PIN kan inte rensas förrän julia och hans loggat in via Firebase
reviewedAt: 2026-09-17
---

# Handoff

## 2026-09-17: AP8, listorna som innehållsförteckning från 700 px

Mockup H och arbetspaket AP8 ur Claude Design-projektet
`c84b2c87-41f3-4778-9843-cb3370ee625d`. Från 700 px ritas Mina recept, Allas recept,
Vänner och användarsidan som numrerade rader (serif 24 px, 68 px höga) med klistrad
vänsterspalt: rubrik 44 px, antal, sök, register. Sidhuvudet blir en rad: logga, flikarna,
"+ Nytt recept" och kontoinitial. Under 700 px är AP1 till AP7 orörda.

Hur: `desk = matchMedia('(min-width:700px)')` i `app.js` väljer `tocLayout()` i de fyra
vyerna och ritar om när brytpunkten passeras. Knapparna är de befintliga (`listBtn`,
`saveBtn`, utbrutna ur kortet och raden), så toast och ångra följer med. Löpnumren är en
CSS-räknare, inte text i DOM. Registret är knappar, inte `#`-länkar: hashen är appens
router och ett ankare hade bytt vy. Sidhuvudet görs med `display:contents` på
`.brand-row`, ingen ny markup utom ` recept` i "+ Nytt" (visas från 860 px).
Versionsfrågan `app.js?v=ap8-20260917`.

Val tagna åt Patrik:
- Recept i listan står bara under "I listan", som på mobilen (AP3). Mockupens antal
  (2+18+3=23) tyder på dubblering, men då får samma recept två löpnummer.
- Registret: Mina recept rullar till avsnittet, Allas filtrerar (enligt AP8), Vänner har
  en rad per vän (följer AP6:s gruppering) plus Förfrågningar i burgundy och Dina vänner.
- Mellan 700 och 859 px hamnar metaraden under titeln. Vid 700 px rann långa titlar annars
  in i den, mätt.
- "Klistra in från AI" nås som förut via "+ Nytt". "+ Nytt" visas som förut bara på
  Mina recept, inte i alla vyer som mockupens sidhuvud antyder.
- Inte byggt: "… 13 till". AP8-texten nämner det inte, registret sköter navigeringen.
- Övriga vyer (recept, lista, konto) behåller bredden 640 px, 920 px från 1000 px.

Verifierat: `node --check app.js`, `node test.js`, `node test-friends.cjs` och
`node test-ui.cjs`, som nu har en desktopkörning (jsdom saknar `matchMedia`, testet
sätter den): Vänner per vän, filtret i Allas, I listan utan dubblett. Lokalt i Chrome:
mått mot AP8 (960 px innehåll, 220 px spalt, 48 px lucka, rad 68 px, knapp 44×44),
sex bredder 375 till 1280 i Mina och Allas utan överlapp, sidscroll eller ytor under
44 px, sök med bibehållet fokus, ingen rad byter höjd vid hovring, inga konsolfel.
**Inte verifierat:** Vänner och användarsidan inloggat i riktig webbläsare (bara jsdom).

**Fynd, rättat samma dag på Patriks order:** ✓ i Allas och Vänner (`data-remove-allas` i
`bind()`) tog bort det sparade receptet med ett klick, utan ångra, och en redigerad kopia
var då borta. Nu: toast "Borttaget ur mina recept" med Ångra i 4 s, som lägger tillbaka
receptet på sin plats med listval och strukna rader. Sparräknaren på servern (`unsave`)
rörs först när ångra-fönstret gått ut. Prövat i `test-ui.cjs`. Versionsfrågan
`app.js?v=angra-20260917`. Bra att veta: ett sparat recept är en fullständig kopia i ens
egen state, det finns kvar även om ägaren tar bort originalet eller sitt konto.

**Fälla:** sessionen började på en lokal `main` som låg tio commits efter fjärren, och
AP8 byggdes först mot koden före AP1 till AP7. Kör `git fetch` innan arbete i det här
repot, grenar slås ihop på GitHub från andra sessioner. Det kasserade försöket ligger
kvar lokalt som grenen `ap8-stale`.

## 2026-09-16 kväll: designgenomlysningen AP1 till AP7 byggd på branchen `design-genomlysning`

Claude Designs genomlysning (15 fynd, sju arbetspaket, mockups A till G) är
implementerad som ett paket per commit i byggordningen AP1 → AP2 → AP3 → AP5 →
AP4 → AP7 → AP6. Allt under "Fungerar redan, lämnas ifred" är orört: gram med
styckmängd i parentes, avdelningarna i listan, siffran i fliken, summering,
sök, egna rader, kopiera listan, wake lock, timer med ljud, vänförfrågningar,
hemliga recept, stryk-på-tryck, timerchips, näringsrad, AI-import, backup,
paletten och logotypen. Inga ändringar i `worker/`.

**Avvikelser från underlaget, medvetna:**

- Underlaget antar Firestore (`enableIndexedDbPersistence`). Backend är D1 via
  workern, så synkpillen i Lista bygger på appens egen kö (localStorage först,
  `PUT /state` 800 ms senare), `navigator.onLine` och online/offline-händelser.
  Misslyckad skrivning görs om när nätet kommer tillbaka. Service worker för
  själva appskalet offline är fortfarande "kanske senare" i BACKLOG.
- Enheten "st" i ingrediensformuläret är inte med: datamodellen räknar i g/ml
  (lämnas ifred) och styckantal finns som tredje raden "Ungefär N st".
- Google Fonts-länken är borta (systemtypsnitt enligt AP1). `integritet.html`
  laddar dem fortfarande själv, så policytexten stämmer, men den sidan är inte
  omstylad.
- Källraden per vara i listan (vilka recept som bidrar) försvann när hela raden
  blev tryckyta. Summeringen finns kvar, bara inte uppdelningen.
- Google-knappen har appens ram (AP7) i stället för Googles vita branding.

Verifierat: `node --check app.js`, `node test.js`, `node test-ui.cjs` gröna
efter varje paket (DOM-testet uppdaterat för ny nav, Lista, sheet och
#/hej-sidan). Skärmbilder i Playwright 375 px av alla vyer mot stubbat API.
**Inte verifierat:** riktig telefon (vibration, wake lock-texten, svep i
köksläget, navigator.share), Firebase-inloggning via #/hej-sidan i produktion.

Versionsfrågan är `app.js?v=ap6-20260916`. Nästa steg: merge till main
(= deploy), öppna appen på mobilen, ta skärmbilder och skicka till Claude
Design för andra genomgången.

## 2026-09-16: manuella timrar ritas vid sitt fält

Manuella timrar (fältet under stegen) ritades av `timerBar()` högst upp i receptvyn,
ovanför Ingredienser, medan stegtimrar ritas i sitt steg. Patrik: ser konstigt ut.
`timerBar()` flyttad till raden ovanför `timerForm`; stegtimrarna stannar i steget
(beslut Brain, "avgör du"). Versionsfrågan `app.js?v=timer-20260916`. `node --check`,
`node test.js`, `node test-ui.cjs` gröna, mätt lokalt i Playwright på 375 px: brickan
55 px ovanför fältet, under stegen.

Skärmbilder för Claude Design-genomlysningen ligger i
`backups/design-review-20260916/` (11 vyer, 375 px, utan rullningslist). Vänner och
Konto inloggat saknas, kräver Patriks konto.

## 2026-09-16: tryckytor 44 px

Loggan (31 px) och sidfotens Integritetspolicy (15 px) fick `min-height: 44px`
i `390c807`, pushad till main (Pages), mätt live med ux-checks: 0 ytor under
44 px. `node test.js` grönt.

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
