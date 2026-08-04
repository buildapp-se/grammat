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

Full arkitektur står i `PROJECT.md`, v2-planen i `ARKITEKTUR.md`.

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

## Environments and operations

Produktionen är en Worker plus D1-databasen `recept`. Ta alltid D1-export till
`backups/` före riskabla ändringar, migreringar och deploy. `backups/` är
git-ignorerad och får aldrig pushas. Öppna punkter står i `TODO.md`.
