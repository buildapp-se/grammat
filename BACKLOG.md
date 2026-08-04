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
- [x] **Beslut 2026-08-04: lanseringen är för en privat krets.** Moderationspaketet
  (rapportera-knapp, `hidden`-flagga, användarvillkor) krävs alltså inte före
  lansering. Beslutet står i `CONTEXT.md` och gäller tills sajten sprids utåt.
- [ ] Slutför Google-consentskärmens branding. Deployen till Firebase Hosting är
  redan gjord (`grammat-78450.web.app` serverar `authhost/public/`, `/__/auth/handler`
  svarar 200). Kvar: OAuth-branding i Google Cloud Console, custom domain
  `auth.buildapp.se` i Firebase Console, DNS i Cloudflare, byte av `authDomain` i
  `index.html` rad 163. Allt kräver webbläsare, firebase-tools har inget domänkommando.
  Efter bytet måste en riktig Google-inloggning testas.
- [ ] Rensa legacy-PIN när sista kontot är kopplat till Firebase. Kontrollera med
  `SELECT name FROM users WHERE firebase_uid IS NULL`; systemkontot räknas inte.
  Läget 2026-08-04: julia och hans saknar fortfarande `firebase_uid`.
- [ ] Julia tar bort testreceptet "abc", det ligger i det publika flödet. Görs i appen
  av henne, inte med SQL: indexet skrivs tillbaka vid hennes nästa sparning.

## Innehåll

- [ ] Fyll på steg för salsiccia, räkpasta, chili con carne och gazpacho, som
  saknar tillagningsbeskrivning eftersom källan bara var video eller länk.

## Verifiering

- [ ] Riktig mobilverifiering i butik: logga in, wake lock, bocka ingredienser,
  ladda om mitt i och kontrollera synk på andra enheten.

## Kanske senare

- [ ] Service worker för offline, bara om täckningen i butiken visar sig vara dålig.
- [ ] Fler recept ur `recept 2.mht`. Pausad på begäran.
