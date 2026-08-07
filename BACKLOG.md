# Backlog

Kort lista över det som faktiskt är öppet. Den fullständiga historiken och alla
avklarade punkter står i `docs/TODO.md`, som är den längre arbetsanteckningen.

## Före lansering

- [x] Städa remote `recipes_index` från gamla src-kopior. Gjort 2026-08-04, det var
  fyra rader (inte sju), alla julias. Backup `backups/recept-2026-08-04-212213.sql`.
- [x] Verifiera på data- och API-nivå att Vänners recept bara visar skapade recept.
  Gjort 2026-08-04: `/friends-feed`-frågan mot remote D1 ger ett recept, utan `src`.
- [ ] Patrik bekräftar samma sak inloggat i webbläsaren. Ska visa exakt ett recept
  från julia ("abc"). Sista steget för att stänga punkten ovan.
- [x] UI-verifiera utkastsstegen utloggat i prod. Gjort 2026-08-05: gazpacho och
  salsiccia renderar stegen korrekt, inga konsolfel.
- [x] **Beslut 2026-08-04: lanseringen är för en privat krets.** Moderationspaketet
  (rapportera-knapp, `hidden`-flagga, användarvillkor) krävs alltså inte före
  lansering. Beslutet står i `CONTEXT.md` och gäller tills sajten sprids utåt.
- [x] Firebase Hosting-deploy av authhost. Var redan gjord 2026-07-21, upptäckt 2026-08-04.
- [x] Custom domain `auth.buildapp.se` tillagd i Firebase och CNAME skapad i Cloudflare
  (DNS only). Firebase svarade "setup successfully" 2026-08-04.
- [x] Certifikatet för `auth.buildapp.se`. Klart 2026-08-05, handlern svarar 200 över
  HTTPS. Delat Firebase-certifikat, vår domän ligger i SAN-listan.
- [x] `https://auth.buildapp.se/__/auth/handler` tillagd under Authorized redirect URIs
  på OAuth-klienten i Google Cloud Console. Det här fällde första försöket 2026-08-05
  (`400 redirect_uri_mismatch`). Annan lista än Firebase authorized domains, båda krävs.
- [x] `auth.buildapp.se` tillagd i Firebase authorized domains 2026-08-05.
- [x] Byt `authDomain` till `auth.buildapp.se`. Gjort 2026-08-05 (`ad2e0f3`), verifierat
  mot Googles auth-endpoint före deploy, med gamla domänen som kontrollgrupp.
- [x] Skarpt inloggningstest av bytet. Patrik verifierade i prod 2026-08-05 att
  Google-inloggningen fungerar med `auth.buildapp.se` som authDomain.
- [ ] OAuth-branding i Google Cloud Console (appnamn "Grammat" m.m.). **Blockerad för
  agent:** konsolen kräver lösenordsinloggning och hoppade till fel Google-konto.
  Måste göras av Patrik som `patz.lofgren@gmail.com`.
- [ ] Rensa legacy-PIN när sista kontot är kopplat till Firebase. Kontrollera med
  `SELECT name FROM users WHERE firebase_uid IS NULL`; systemkontot räknas inte.
  Läget 2026-08-04: julia och hans saknar fortfarande `firebase_uid`.
- [ ] Julia tar bort testreceptet "abc", det ligger i det publika flödet. Görs i appen
  av henne, inte med SQL: indexet skrivs tillbaka vid hennes nästa sparning.

## Innehåll

- [x] Fyll på steg för salsiccia, räkpasta, chili con carne och gazpacho. Gjort
  2026-08-04 som **utkast** skrivna utifrån ingredienslistan, live i `starter.json`
  och i D1-seeden. Alla 22 startrecept har nu steg.
- [ ] Rätta utkastsstegen så de stämmer med hur ni faktiskt lagar rätterna, och
  radera utkastraden längst ner i vart och ett av de fyra recepten. Kör om
  `node worker/seed-grammat.js > worker/seed-grammat.sql` + execute mot remote
  efteråt, annars ändras bara den utloggade vyn.

## Verifiering

- [ ] Riktig mobilverifiering i butik: logga in, wake lock, bocka ingredienser,
  ladda om mitt i och kontrollera synk på andra enheten.

## Kanske senare

- [ ] Service worker för offline, bara om täckningen i butiken visar sig vara dålig.
- [ ] Fler recept ur `recept 2.mht`. Pausad på begäran.
- [ ] Lägg till funktion för en timer med snygg design som sätter igång vibration och ljud när tiden har gått ut. Denna ska läggas in om det finns delar i receptet som specar någon slags tid. Annars ska det finnas redo som liten knapp eller bara där på ett snyggt och enkelt sätt.
