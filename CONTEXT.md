# Project context

## Product intent

Grammat är en receptsajt för privat bruk som också har ett publikt flöde. Den ska
göra det lätt att laga efter ett recept i köket och att handla efter det i butiken,
inte att vara en fullödig matportal.

## Architecture

- Statisk `index.html` med inline CSS och `app.js`, inget byggsteg. Serveras via
  GitHub Pages bakom Cloudflare på `buildapp.se/grammat/`.
- `worker/` är en Cloudflare Worker med D1 som backend. Den håller konton, state,
  publikt receptindex, sparningar, grupper och inbjudningar.
- Autentisering är Firebase ID-token som verifieras i workern mot Googles JWKS.
  En äldre PIN-inloggning finns kvar under avveckling.
- Hela användarens tillstånd sparas som en blob per konto. `recipes_index` är ett
  härlett index för det publika flödet och byggs om vid behov.

Full arkitektur står i `docs/PROJECT.md`, v2-planen i `docs/ARKITEKTUR.md`.

## Constraints

- Sista skrivning vinner vid synk. Det är acceptabelt eftersom varje lista har en ägare.
- Summering av ingredienser kräver identisk stavning mellan recept.
- Ingen e-post och ingen självservice för återställning av PIN.
- Cloudflares edgecache har lång `max-age`, så `app.js` kan serveras gammal i upp till
  fyra timmar. Höj alltid versionsfrågan i `index.html` vid frontend-deploy.

## Important decisions

- Inget hushållsbegrepp. Ett par delar konto, och Firebase kontolänkning ger både
  Google och lösenord på samma konto.
- Inga bilder på recept, och blob-modellen behålls i stället för normaliserade tabeller.
- Servern är förtroendegränsen. Allt som renderas för andra användare saneras
  serverside, inte bara i klienten.
- **Lanseringen är för en privat krets** (beslut 2026-08-04). Det publika flödet
  finns kvar, men sajten sprids inte utåt. Därför krävs inte moderationspaketet
  (rapportera-knapp, `hidden`-flagga, användarvillkor) som `docs/ARKITEKTUR.md`
  ställer som minimum före lansering utåt. Ändras beslutet till publik spridning
  blir den moderationen ett krav igen innan sajten marknadsförs.

## Environments and operations

Produktionen är en Worker plus D1-databasen `recept`. Ta alltid D1-export till
`backups/` före riskabla ändringar, migreringar och deploy. `backups/` är
git-ignorerad och får aldrig pushas. Den längre arbetsanteckningen med allt
avklarat står i `docs/TODO.md`.

`auth.buildapp.se` är sedan 2026-08-05 projektets `authDomain`: en custom domain på
Firebase Hosting (CNAME till `grammat-78450.web.app`, DNS only i Cloudflare, giltigt
certifikat), prodtestad med riktig Google-inloggning. Byte av `authDomain` kräver att
den nya domänens handler-URL står i **två skilda allowlists**: Authorized redirect URIs
på OAuth 2.0-klienten i Google Cloud Console, och authorized domains i Firebase Auth.
Saknas den första svarar Google `400 redirect_uri_mismatch` och ingen kan logga in.

## Audits
Read by the cockpit Audits tab. One `- Label: YYYY-MM-DD, result` per check; conventions in elwyn-dash `docs/security.md`.

- OWASP Top 10: 2026-07-25, stored XSS and auth fixed, see security repo
- Headers: 2026-09-16, pass, 6 of 6 on buildapp.se via a host-scoped Transform Rule on the zone, measured after the change
- Search Console: 2026-09-15, warn, unknown to Google, noindex removed and added to submitted sitemap
- TLS: 2026-09-16, pass, SSL Labs A+ on buildapp.se, TLS 1.2 minimum and HSTS since today
- Lighthouse: 2026-09-16, pass, a11y 100, best practices 100, SEO 100 (mobile, no perf)
- Markup: 2026-09-16, warn, W3C 3 CSS errors on ::view-transition rules the validator does not know, 0 broken links
- UX: 2026-09-16, pass, 0 targets under 44 px after the fix (logo and footer link), 5 of 6 script checks pass, no --interact
- npm audit: 2026-09-24, n/a, no package.json
- Secrets: 2026-09-24, pass, gitleaks 0 findings in 106 commits, 1 reviewed as public in .gitleaksignore
- Actions: 2026-09-24, n/a, no GitHub Actions workflows
