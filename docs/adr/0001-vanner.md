# Vänner med ömsesidig acceptans

Status: implementerat och automatiskt testat lokalt 2026-09-11, publicerat 2026-09-16 (migration och Worker, ingen D1-export togs, migrationen är additiv).

## Beslut

Ersätt grupper med vänförfrågningar till ett exakt, unikt kontonamn. Mottagaren
måste acceptera innan vänskapen gäller åt båda håll. Vänner hanteras i fliken
Vänner, med inkommande, skickade och accepterade relationer. Konto länkar dit.
Uppdatera-knappen, återbesök till fliken och återgång till appen hämtar nytt läge.

Kontonamn finns redan, så detta kräver varken ny kontosökning, mejlutskick eller
inbjudningskoder. En öppen följ-funktion valdes bort eftersom den inte kräver
acceptans. Gamla gruppmedlemmar blir inte automatiskt vänner: det skulle ge en
acceptans som användaren aldrig gjort. Gamla tabeller behålls för återgång och
tas fortfarande med vid kontoradering; grupp-API och gamla inbjudningar ger 410.

Vänskap påverkar urvalet under Vänner. Allas recept är fortfarande publikt och
hemliga recept delas aldrig. Redan sparade recept behålls när vänskap upphör.

## Datamodell och behörighet

`friendships` har en unik rad per ordnat par av konto-id:n, avsändare och status
`pending` eller `accepted`. Namnbyte bryter därför inte relationen. Endast
mottagaren kan acceptera. Båda kan ta bort en väntande förfrågan eller vänskap.
Varje förnyad förfrågan får nytt id, så gamla acceptansanrop inte kan godkänna den.
SQL-villkor och unikhetskrav stoppar dubbla och korsande anrop utan implicit acceptans.
Högst 50 utgående obesvarade förfrågningar per konto. Kontoradering tar även bort
relationer och förfrågningar.

Alla SQL-parametrar binds och acceptansen sker i ett villkorat UPDATE-anrop.
Referenser: [D1 prepared statements](https://developers.cloudflare.com/d1/worker-api/prepared-statements/)
och [D1 batch och transaktioner](https://developers.cloudflare.com/d1/worker-api/d1-database/).

## Verifiering och drift

`node test-friends.cjs` kör hela Worker-routingen mot riktig SQLite med D1-adapter.
Täcker autentisering, behörighet, nekande/återkallande, accepterande, namnbyte,
privata och kopierade recept, gränsen för förfrågningar och kontoradering.
`node test-ui.cjs` kör två isolerade DOM-sessioner mot samma Worker och testdatabas.
Installera DOM-testberoendet med
`npm install --prefix backups/test-deps --no-save jsdom@29.1.1`.
DOM-test är inte visuell mobil- eller webbläsar-QA.

Migration `worker/migrations/0001_friendships.sql` skapar endast den nya tabellen
och dess index. Kör den efter backup men före Worker-publicering och frontend-push.
Återgång: föregående Worker/frontend kan använda bevarade grupptabeller; låt den
nya tabellen ligga kvar så att inga vänförfrågningar försvinner.
