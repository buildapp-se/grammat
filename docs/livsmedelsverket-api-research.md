# Livsmedelsverket API — research (2026-07-07)

## Verdict

**The live REST API is broken and not usable** (see below for why, kept for the record). **But there's a working alternative: the bulk Excel export from https://soknaringsinnehall.livsmedelsverket.se/ has real food names.** User downloaded `LivsmedelsDB_202607071233.xlsx` (their own "Livsmedelsverkets livsmedelsdatabas version 2026-07-01", 2606 rows, columns `Livsmedelsnamn`/`Livsmedelsnummer`/`Gruppering` + 59 nutrient columns including `Energi (kcal)`, `Fett, totalt (g)`, `Protein (g)`, `Kolhydrater, tillgängliga (g)`) — this is the real per-item database with actual names, something the API never delivered this session. Used it this session to update `nutrients.json`: **78 of 110 entries now carry real Livsmedelsverket values** (matched by name, mostly high-confidence exact or near-exact matches; `Gruppering` column used to disambiguate near-ties, e.g. picking the plain vegetable over a composite dish that happens to share a word). The other 32 entries are spice blends, brand condiments (bbq-sås, sambal oelek, texmexkrydda), or whole/ground spices/herbs (svartpeppar, torkad oregano, lagerblad, sesamfrön) genuinely absent from the database — left as the pre-existing generic estimates, correctly.

**Where to get this file again**: https://soknaringsinnehall.livsmedelsverket.se/ — a search UI over the same database, with an export/download option (exact download button not explored, user already had the file). Not the same host as the broken API (`dataportal.livsmedelsverket.se`). If nutrients.json needs new ingredients added later, get a fresh export from this URL — the search API below is not worth revisiting.

## Facts, with sources

### Access page (source 1)
- https://www.livsmedelsverket.se/om-oss/psidata/livsmedelsdatabasen/ — thin overview/nav page, no API details, no download links. Points to "Sök näringsinnehåll i Livsmedelsdatabasen" and related subpages, but the fetched content didn't surface API/license/download specifics directly on this page.
- Better source found via search: https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/ — confirms:
  - API at https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html
  - ~2 500 food items, 50+ nutrients each, plus FoodEx2 and LanguaL™ classifications
  - **License: CC BY 4.0** — attribution to Livsmedelsverket required
  - No auth or rate limits documented
  - No bulk export/download mentioned on this page — access appears to be API-only (see "bulk export" note below, unresolved)

### Swagger / OpenAPI spec (source 2)
- UI page https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html is a JS-rendered shell — WebFetch got nothing from it directly.
- **Raw spec fetched successfully at**: https://dataportal.livsmedelsverket.se/livsmedel/swagger/v1/swagger.json (valid OpenAPI 3.0.1 JSON). `v2` path returned 404 — v1 is current.
- `servers` in spec: `{"url": "/livsmedel"}` (relative) → full base is `https://dataportal.livsmedelsverket.se/livsmedel`.
- **No `securitySchemes`, no `security` requirement anywhere in the spec** → API is open, no key/token/OAuth.
- Endpoints (all under `/api/v{version}/...`, version = `v1`):
  - `GET /api/v{version}/api-info` — metadata
  - `GET /api/v{version}/livsmedel` — paginated list (`offset`, `limit`, `sprak` [1=sv, 2=en])
  - `GET /api/v{version}/livsmedel/{nummer}` — single food item
  - `GET /api/v{version}/livsmedel/{nummer}/naringsvarden` — **nutrient values (this is what we need)**
  - `GET /api/v{version}/livsmedel/{nummer}/klassificeringar` — LanguaL/FoodEx2 classification
  - `GET /api/v{version}/livsmedel/{nummer}/ravaror` — raw agricultural commodities
  - `GET /api/v{version}/livsmedel/{nummer}/ingredienser` — sub-ingredients
- **`naringsvarden` response shape is NOT flat kcal/protein/kolhydrater/fett fields.** It's an array of generic nutrient objects, one row per nutrient, e.g.:
  ```json
  { "namn": "Energi (kcal)", "euroFIRkod": "...", "varde": 123.4, "enhet": "kcal", "viktGram": 100, "metodtypkod": "..." }
  ```
  Fields per object: `namn` (nutrient name, e.g. "Energi (kcal)", "Protein", "Kolhydrater", "Fett"), `euroFIRkod` (stable EuroFIR nutrient code — better to match on than `namn` since names may vary/localize), `varde` (numeric value), `enhet` (unit), `viktGram` (always 100 = per 100g), `metodtypkod`. **To build a flat kcal/protein/kolhydrater/fett record you must fetch this array per food item and filter/map it yourself** by `euroFIRkod` (or `namn`) — there is no shortcut endpoint that returns just those four values.
- No rate limits or usage quotas documented in the spec.
- Live test: `GET https://dataportal.livsmedelsverket.se/livsmedel/api/v1/api-info` → 200, real JSON:
  ```json
  {"apiName":"LivsmedelData.API","apiVersion":"1.0.0","apiReleased":"2024-03-18","apiDocumentation":"https://www.livsmedelsverket.se/om-oss/psidata/livsmedelsdatabasen","apiStatus":"active"}
  ```
- Live test: `GET https://dataportal.livsmedelsverket.se/livsmedel/api/v1/livsmedel?offset=0&limit=5&sprak=1` and again without `sprak` → both returned HTTP 200 with valid HATEOAS envelope but **empty result**:
  ```json
  {"_meta":{"totalRecords":0,"offset":0,"limit":5,"count":0},
   "_links":[{"href":"/api/v1/livsmedel?offset=0&limit=5&sprak=1","rel":"self","method":"GET"},
             {"href":"/api/v1/livsmedel?offset=0&limit=5&sprak=1","rel":"first","method":"GET"},
             {"href":"/api/v1/livsmedel?offset=-5&limit=5&sprak=1","rel":"last","method":"GET"}],
   "livsmedel":[]}
  ```
  This is the one open question — see below.

### dataportal.se REST API profile (source 3)
- https://www.dataportal.se/rest-api-profil (page itself didn't render via WebFetch — JS app; summarized via search of the profile's sub-pages: versionhantering, filtrering-paginering-och-sokparametrar).
- Relevant conventions the Livsmedelsverket API actually follows (confirmed by the live response above, not just by the profile doc):
  - **Version in URL path** (`/api/v1/...`) — matches the profile's version-handling guidance.
  - **Pagination via `offset`/`limit` query params**, response includes `_meta` with `totalRecords`/`offset`/`limit`/`count` — matches the profile's filtering/pagination page.
  - **HATEOAS-style `_links`** (self/first/last with href+rel+method) in list responses — matches the profile's hypermedia guidance.
- Nothing in the profile explains required headers or auth beyond what the spec itself says (none) — profile is a style guide, not something that adds a hidden requirement here.

## Resolved (confirmed via plain `curl`, not a WebFetch artifact)

- `GET /api/v1/livsmedel` (list) genuinely returns `totalRecords: 0` for every param combo — reproduced with `curl -H "Accept: application/json"`, so it's a real server-side bug/decommission, not a tool artifact.
- `GET /api/v1/livsmedel/{nummer}` (single item metadata) **also 404s for every nummer tried** (1, 2, 100, 1000) — also broken.
- **But `GET /api/v1/livsmedel/{nummer}/naringsvarden` (the nutrient sub-resource) works fine** for real nummer values — confirmed 200 with full nutrient arrays at nummer 1, 2, 100, 1000; nummer 9999 returns 200 with an empty array (out of range, not an error) — so bounds can be found by probing.
- The nutrient array does **not** include the food's own display name. `GET /api/v1/livsmedel/{nummer}/ravaror` (raw-commodity breakdown) does return a `namn` (e.g. `"Fett ister och annat djurfett"` for nummer 1) that's usable as an identifying label, though it's the raw-ingredient name, not necessarily the food's official display name — the two endpoints that would give the canonical name are the ones that are broken.
- **`ravaror` label is NOT a usable identifier — tried it, disproved it.** Bulk-probed `nummer` 1–3500: 1856 have full nutrient data, only 317 distinct `ravaror` labels among them. Spot-checked several labels' nutrient spread across their sharing items:
  - `"Citron"` → 36 items, kcal 61–782/100g
  - `"Gurka"` → 14 items, kcal 13–333/100g
  - `"Smör"` → 8 items, kcal 188–729/100g
  - `"Avokado"` → 3 items, kcal 102–197/100g (this one's plausible range for real avocado, but no way to tell which of the 3 *is* plain avocado vs. a dish containing avocado)

  These are the raw agricultural commodity a composite food is made *from*, not the food's own name — a lemon cake and lemon curd and a fish dish with lemon garnish would all carry the `"Citron"` raw-commodity tag. Matching on this label would silently attach some other dish's nutrient profile to your ingredient.

## What was actually done (resolved, 2026-07-07)

Matched `nutrients.json`'s 110 ingredient keys against the 2606-row Excel export by name (normalized: lowercase, parentheticals stripped, tokenized), picked the best candidate by hand using the `Gruppering` column to break ties (e.g. for "riven ost" picked a plain `Ost hårdost fett 26%` [Pålägg] over unrelated dishes). 73 matched confidently in the first pass; 5 more (mjölk, smör, ris (gärna jasmin), röd chili, röda linser (torkade)) in a follow-up search; a third pass specifically targeted the ~7 remaining ingredients used at 100+ g per portion (real bulk food, not seasoning) and found 5 more: `kyckling` (→ `Kyckling kött rå u. skinn`), `färsk salsiccia` (→ `Korv salsiccia rå kött 73%`), `jubileumskaka (runt rågbröd)` (→ `Bröd rågsikt fibrer ca 4% typ rågkaka`, closest proxy — the specific branded bread wasn't in the database, generic round rye bread was used instead), `pasta (till servering)`, `blandad sallad`. Final: **83 updated, 27 left as generic estimates**.

Two bulk ingredients (100+ g/portion) were absent from Livsmedelsverket's database — **`mascarpone`** (250 g in `flaskfile`) and **`rödpesto`** (95 g in `loomisar`, the database only has green basil pesto, a different product). Resolved from the actual ICA products used, per product-page nutrition declarations:
- `mascarpone` ← https://handla.ica.se/produkt/1506726 ("Mascarpone 250g ICA"): 352 kcal, 4 g protein, 5.3 g kolhydrater, 35 g fett per 100 g.
- `rödpesto` ← https://handla.ica.se/produkt/1302239 ("Pesto Tomat 185g ICA", sundried-tomato pesto): 450 kcal, 4.7 g protein, 18 g kolhydrater, 38 g fett per 100 g.

These two are ICA product-label data, not Livsmedelsverket/CC BY — no attribution obligation, but also not the same authority level (a specific retail product's declared values, which can change if the product reformulates).

The remaining 25 generic estimates are all genuinely spice blends, small-quantity seasonings, or branded condiments confirmed absent from the database (bbq-sås, cayennepeppar, curry, fiskfond, fänkålsfrön, grönsaksbuljongtärning, ingefära (malen), kaftakrydda, lagerblad, ras el hanout, rökt paprikapulver, salladslök, salsa (texmex), sambal oelek, sesamfrön, silverlök, sumak, svartpeppar, texmexkrydda, torkad oregano, torkad timjan, torkade örter, chilisås) plus salt/vatten (already correctly 0/0/0/0, no sourcing needed).

Known approximations worth knowing about (real Livsmedelsverket data, but a specific variant was chosen where the ingredient name doesn't fully disambiguate):
- Fat %/variant picked where the recipe doesn't specify one: `crème fraiche` → 34% fett, `riven ost` → hårdost 26% fett, `smör` → 80% fett.
- Raw vs. cooked: ingredient weights in this repo are pre-cooking amounts (per `PROJECT.md`), so raw variants were picked throughout (`fläskfilé`, `kycklingfilé`, `nötfärs`, `ägg`, `sötpotatis`, etc.) — consistent with how the rest of the app measures ingredients.
- Canned tomato entries (`hela tomater (burk)`, `krossade tomater`) both point at the same `Tomat krossad konserv. m. lag` row — Livsmedelsverket doesn't split whole-peeled vs. crushed canned tomato, and the two are nutritionally near-identical anyway.
- `japansk soja` → shoyu-style soy sauce entry, `kinesisk soja` → generic soy sauce entry — the database happens to have both variants, used the closer regional match for each.
- Full mapping (which `nutrients.json` key ← which Livsmedelsverket row) lived in a scratch script during this session and wasn't persisted anywhere — if a value looks wrong later, the fix is to just re-derive it from the Excel export by name, not to hunt for a mapping file that doesn't exist.

## Not yet checked (lower priority, only matters if the live API route is revisited)
- The full parameter list for `/livsmedel` (search/filter params beyond offset/limit/sprak) on the (broken) `dataportal.livsmedelsverket.se` API — moot now that the Excel export works, not worth chasing further.
- Attribution required per CC BY 4.0 if this data is redistributed: credit Livsmedelsverket (contact: livsmedelsdatabasen@slv.se).
