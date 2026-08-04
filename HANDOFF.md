---
schemaVersion: 1
status: active
currentGoal: Hålla grammat i drift och stänga de sista punkterna före lansering
nextAction: Städa remote-indexet från sju gamla src-kopior enligt kommandot under Nästa steg, ta D1-backup först, och prodtesta sedan att Vänners recept bara visar skapade recept
blockers: []
reviewedAt: 2026-07-25
---

# Handoff

Senast uppdaterad: 2026-07-08 (natt). Läget för nästa session (människa eller agent). Arkitektur i PROJECT.md, v2-planen i ARKITEKTUR.md, öppna punkter i TODO.md.

## Läget just nu
- **Fas 3 grupper är deployad och prodtestad 2026-07-08 kväll.** Patrik verifierade i prod: skapa grupp, inbjudningslänk, Julia joinade och gruppen bildades. D1-backup togs först: `backups/recept-2026-07-08-203216.sql`, sen kördes `schema.sql` remote (6 tabeller). Funktion: D1-tabeller `groups`, `group_members`, `invites`; Worker-endpoints `GET /friends-feed`, `GET/POST /groups`, `DELETE /groups/:id` (bara skaparen), `POST /groups/:id/invite`, `POST /join/:code`; frontendflik `#/vanner`, inbjudningsroute `#/join/:code`, gruppsektion under Konto med ta bort-knapp och kopiera-ikon vid inbjudningslänken.
- **Fas 3-patch deployad 2026-07-08 sen kväll**: Worker-version `270557b8-c84e-4206-ab78-af08bd67c2c1`, cache-bust `app.js?v=groups2-20260708`. Tre fixar efter Patriks prodtest: (1) BUGG: `reindexStmts` indexerade även sparade kopior av andras recept (de har `src`-markering i state), så vänner såg ens sparade recept som ens egna; nu hoppas `r.src`-recept över vid indexering. (2) `DELETE /groups/:id`, bara skaparen (403 annars), tar bort grupp + medlemmar + inbjudningar, med confirm-dialog och knapp i UI:t. (3) Kopiera-ikon (⎘, blir ✓ i 1,5 s) bredvid inbjudningslänken, `navigator.clipboard` med fallback som markerar fältet. Verifierat: API-test mot lokal worker (friends-feed exkluderar src-kopior, delete-rättigheter) plus UI-flöde i Chrome via lokal server (grupp skapa/inbjudan/kopiera/ta bort, inga konsolfel). KVAR: 7 gamla felindexerade rader i remote `recipes_index` (räknade, bekräftade) måste städas: `DELETE FROM recipes_index WHERE data LIKE '%"src":{%'` mot remote, kräver Patriks uttryckliga godkännande.
- **Fas 2 (publik flik + sparräknare) är deployad till Worker + D1 2026-07-08.** Worker-version `559aa3c3-e410-4511-a45c-5ef02c81d9f3`. D1-backup togs först: `backups/recept-2026-07-08-171859.sql`. Schema, `grammat`-seed och engångs-reindex kördes remote; indexkontroll visade `grammat` 22 recept, `hans` 1, `julia` 1, `patrik` 1. Frontendfix: Allas-vyn slår nu ihop alla recept per kategori (ingen extra Huvudrätt längst ner), visar ägare som "från X" på andras recept, normaliserar trasig `course`, använder `ownerId|id` för spara/ta bort, och faller tillbaka till gamla `/allas-recept` om `/feed` inte kan laddas.
- **Codex smoke-test 2026-07-08 natt:** `node test.js` OK. Prod `index.html` laddar `app.js?v=a995dfa`. Chrome-browsern i Codex fungerar igen via Codex Chrome Extension (in-app browser `iab` saknas fortfarande i sessionen). Utloggad `#/allas` renderade 22 kort och aktiv nav "Allas recept". Remote D1-läskontroll: indexet matchar `grammat` 22, `hans` 1, `julia` 1, `patrik` 1; `saves` har 0 rader. `/feed` ger 401 med ogiltig token, som väntat.
- **Fas 2b ägarprofiler är deployad + prodverifierad 2026-07-08.** Worker-version `14cfc95f-ee69-4d49-8fc9-b50c68b4466a`, frontend-commit `74140f9`. D1-backup togs först: `backups/recept-2026-07-08-180527.sql`. Ägaretiketten "från X" länkar till `#/anvandare/:ownerId`; workern har `GET /users/:id/recipes`; publika receptlänkar använder `ownerId|id` för att tåla slug-krockar. `index.html` är cache-bustad till `app.js?v=ownerprofiles-20260708`. Verifierat med `node test.js`, `node --check app.js`, `node --check worker/worker.js`, `npx wrangler deploy --dry-run`; prod read-only: nya endpointen ger 401 med ogiltig token och cache-bustad `index.html` laddar nya app.js. Patrik verifierade inloggat att "från Julia" öppnar Julias offentliga recept och att spara/ta bort fungerar.
- **Fas 1 (Firebase Auth) + namnbyte är live sedan tidigare 2026-07-08.** Worker `7eb79d3c`, frontend `2b17923`.
- Auth-modellen: Firebase ID-token (JWT, verifieras i workern mot Googles JWKS) eller legacy uuid-token under övergången. julia + hans är ännu INTE uppgraderade. `SELECT name FROM users WHERE firebase_uid IS NULL` listar även systemkontot `grammat`, vilket är väntat.

## Nästa steg
1. Kvarvarande inloggat prodtest för fas 2: andra ägare syns i Allas-fliken, spara/ta bort, hemlig-toggle. Utloggad Allas och cache-bustad frontend är smoke-testade.
2. Julia loggar in på delade kontot: Patrik trycker "Skapa lösenord" under Konto (syns när kontot saknar lösenordsinloggning), sen loggar hon in med samma e-post + lösenordet.
3. Mobilverifieringen i butik (checklista i git-historiken för HANDOFF, förmiddagens version) står kvar.
4. Städa remote-indexet från gamla sparade kopior (7 rader): `cd worker` och kör `npx wrangler@4.108.0 d1 execute recept --remote --command "DELETE FROM recipes_index WHERE data LIKE '%\"src\":{%'"` (bash-citering; backup från 20:32 finns). Utan städningen ser gruppmedlemmar fortfarande de gamla sparade kopiorna i Vänners recept.
5. Prodtesta patchen: kopiera-ikonen, ta bort grupp, och att Julia bara ser Patriks egna skapade recept under Vänners recept (efter städningen i punkt 4).

## Bra att veta
- **Agentrutin**: D1-export till `backups/` FÖRE riskabla ändringar/D1-migreringar/deploy (kommando i PROJECT.md). Senast 2026-07-08 17:18 (`recept-2026-07-08-171859.sql`).
- **Deploy/push kräver Patriks godkännande** i det här permission-läget, planera inte in det som eget agentsteg.
- **Cloudflare-edgecache på frontenden**: orgutveckling.se ligger bakom Cloudflare med `max-age=14400`, app.js kan serveras GAMMAL i upp till 4 h efter push. `index.html` använder därför versionsquery (`app.js?v=...`); höj queryn vid frontend-deploy om purge inte görs. Alternativt purge i Cloudflare-dashboarden (exakt URL: `https://orgutveckling.se/recept/app.js`).
- **Google-consentskärmen** visar `grammat-78450.firebaseapp.com`: normalt för overifierad OAuth-branding, fixas i lanseringsfasen (se ARKITEKTUR.md risker).
- **Lokal verifiering**: `python -m http.server 8123` i REPO-ROTEN (cwd:t kan stå kvar i worker/ efter wrangler-kommandon) + `cd worker && npx wrangler dev --port 8787` + peka om `const API` i app.js tillfälligt (återställ före commit!). Hård omladdning (ignoreCache) efter app.js-ändringar. Lokal D1 seedas med `npx wrangler d1 execute recept --local --file schema.sql`.
- **Codex browserläge:** om browsern saknas, kontrollera `agent.browsers.list()`. 2026-07-08 natt fixades Chrome-kopplingen genom Codex Chrome Extension/native host; efter pluginuppdatering behövdes JS-runtime reset så nya pluginvägen `26.623.141536` användes. `iab` var fortfarande inte exponerad, men Chrome-backend fungerade.
- **PowerShell 5.1**: citattecken i `git commit -m`-here-strings mangalas till pathspecs, undvik `"` eller använd `-F fil`.
- **wrangler 4.107.1 är trasig på den här maskinen** (workerd kraschar direkt med `std::terminate`), och `npx wrangler` utan version resolvar dit just nu. Pinna: `npx wrangler@4.108.0 ...` för dev/deploy/d1 tills en nyare version verifierats.
- **Dataobservation 2026-07-08**: julia/hans state krympte mellan 2026-07-07 14:57 och 2026-07-08 (12→0 resp. 11→1 recept), troligen avsiktligt. Återställning vid behov: `backups/recept-2026-07-07-145724.sql`.
- Fyra recept saknar steg (salsiccia, räkpasta, chili con carne, gazpacho).
