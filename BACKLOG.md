# Backlog

Kort lista över det som faktiskt är öppet. Den fullständiga historiken och alla
avklarade punkter står i `docs/TODO.md`, som är den längre arbetsanteckningen.

## Före lansering

- [ ] Städa remote `recipes_index` från sju gamla src-kopior. Kommandot står i
  `HANDOFF.md` under Nästa steg och kräver uttryckligt godkännande. Ta D1-backup först.
- [ ] Prodtesta efter städningen att Vänners recept bara visar skapade recept.
- [ ] Slutför Google-consentskärmens branding. Firebase Hosting-config ligger
  förberedd i `authhost/` riktad mot `auth.buildapp.se`. Kvar är deploy via CLI,
  custom domain i Firebase Console, DNS i Cloudflare och byte av `authDomain`.
- [ ] Rensa legacy-PIN när sista kontot är kopplat till Firebase. Kontrollera med
  `SELECT name FROM users WHERE firebase_uid IS NULL`; systemkontot räknas inte.

## Innehåll

- [ ] Fyll på steg för salsiccia, räkpasta, chili con carne och gazpacho, som
  saknar tillagningsbeskrivning eftersom källan bara var video eller länk.

## Verifiering

- [ ] Riktig mobilverifiering i butik: logga in, wake lock, bocka ingredienser,
  ladda om mitt i och kontrollera synk på andra enheten.

## Kanske senare

- [ ] Service worker för offline, bara om täckningen i butiken visar sig vara dålig.
- [ ] Fler recept ur `recept 2.mht`. Pausad på begäran.
