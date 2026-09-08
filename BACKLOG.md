# Backlog

Kort lista över det som faktiskt är öppet. Den fullständiga historiken och alla
avklarade punkter står i `docs/TODO.md`, som är den längre arbetsanteckningen.

## Före lansering

- [ ] Patrik bekräftar inloggat i webbläsaren att Vänners recept bara visar skapade
  recept. Ska visa exakt ett recept från julia ("abc"). Data- och API-nivån är
  verifierad 2026-08-04.
- [ ] OAuth-branding i Google Cloud Console (appnamn "Grammat" m.m.). **Blockerad för
  agent:** konsolen kräver lösenordsinloggning och hoppade till fel Google-konto.
  Måste göras av Patrik som `patz.lofgren@gmail.com`, länk i `HANDOFF.md`.
- [ ] Rensa legacy-PIN när sista kontot är kopplat till Firebase. Kontrollera med
  `SELECT name FROM users WHERE firebase_uid IS NULL`; systemkontot räknas inte.
  Läget 2026-08-04: julia och hans saknar fortfarande `firebase_uid`.
- [ ] Julia tar bort testreceptet "abc", det ligger i det publika flödet. Görs i appen
  av henne, inte med SQL: indexet skrivs tillbaka vid hennes nästa sparning.

## Innehåll

- [ ] Rätta utkastsstegen (salsiccia, räkpasta, chili con carne, gazpacho, utkast
  skrivna 2026-08-04) så de stämmer med hur ni faktiskt lagar rätterna, och radera
  utkastraden längst ner i vart och ett. Kör om
  `node worker/seed-grammat.js > worker/seed-grammat.sql` + execute mot remote
  efteråt, annars ändras bara den utloggade vyn.

## Verifiering

- [ ] Timer på riktig telefon (byggd 2026-09-08): ljud och vibration vid noll, med
  skärmen på. Headless Chrome kan inte testa det.
- [ ] Riktig mobilverifiering i butik: logga in, wake lock, bocka ingredienser,
  ladda om mitt i och kontrollera synk på andra enheten.

## Kanske senare

- [ ] Service worker för offline, bara om täckningen i butiken visar sig vara dålig.
- [ ] Fler recept ur `recept 2.mht`. Pausad på begäran.
- [ ] Timer i bakgrundsflik: larmet kan dröja och vibration utebli när fliken inte
  är aktiv. Notification API via service worker om det visar sig störa i köket.
