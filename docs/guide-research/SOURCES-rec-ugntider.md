# SOURCES2: rekommenderat alternativ, ordning och ugnstider per stekgrad

Genererad av `build.py` (samma mapp), som också validerar: id finns i guide.json, index inom intervall, `times` lika långt som `coreC`, inget em-dash, ingen decimalpunkt.

## Ordning (`order`)
Beräknad maskinellt: sous vide efter `tempC`, vid lika temp kortast undre tid först; ugn efter `coreC`. Avvikelser från originalordningen: not-oxfile, not-rostbiff, not-fransyska, not-picanha, not-hamburgare, gris-bog, lamm-lagg, ovrigt-agg.

## Rekommendation (`rec`), sous vide
- Nöt, magra biffar (ryggbiff, oxfilé, rostas, flankstek, innanlår, rostbiff, fransyska): rosa/medium rare 54–56 °C. Källa: Serious Eats (Kenji, sous vide steak guide), ChefSteps referens, Svenskt Kött.
- Entrecôte och picanha: medium 57–58 °C, fettet behöver mer värme för att smälta (Serious Eats: fetare snitt vid högre temp).
- Högrev: 57 °C 36 h (Baldwin och baslinjen 55–58 °C 36 h). Bringa: 68 °C 24–36 h (Anova brisket guide). Revbensstek: 57 °C 48–72 h (ChefSteps tough cuts, Baldwin); posten var redan flaggad som ej fullt verifierad.
- Hamburgare: 70 °C, Livsmedelsverket (färs ska nå 70 °C).
- Gris: fläskfilé 60 °C (ChefSteps/Kenji), karré 60 °C 2,5 h (baslinje), kotlett 62 °C (Kenji anger 60 °C som favorit; 58 °C är ovanligt rosa för svensk smak, 62 °C valdes som närmaste alternativ). Revben 74 °C och bog 74 °C (Anova rib/shoulder guides, huvudvalet). Sidfläsk 74 °C (ChefSteps tough cuts). Julskinka 70 °C (Svenskt Kött anger 70 °C innertemp; inget sous vide-specifikt källstöd, osäker).
- Lamm: rosa 55 °C för racks och stek, lägg 63 °C 24 h (baslinje).
- Fågel, Livsmedelsverket-säkert: kycklingbröst 63 °C 1,5–4 h (pastöriserat med hålltid enligt Baldwin), kycklinglår 74 °C (Anova chicken guide), ankbröst 60 °C (Livsmedelsverket: fågel ska vara genomstekt; 60 °C ger pastörisering med tid), kalkonbröst 63 °C 2,5 h (Serious Eats).
- Vilt: rosa. Hjort och vildsvin har alternativ per styckdetalj, inte stekgrad; rec = filé/ytterfilé (index 0).
- Fisk: lax 50 °C (Serious Eats), torsk 48 °C, röding 50 °C, hälleflundra 55 °C (baslinjer). Ägg: 63-gradersägg. Grönsaker: baslinjens/ChefSteps huvudval.

## Rekommendation (`rec`), ugn
- Nöt: "Medium" (57–60 °C) för alla biffar och stekar. I ugnsdatan betyder "Rosa/blodig" 50–55 °C, medan svenskt "medium" 56–58 °C (Svenskt Kött, ICA) fortfarande är rosa. Högrev 80 °C och bringa 85 °C (ICA).
- Gris: fläskfilé 61 °C och karré 69 °C (Svenskt Kött medium), kotlettrad 65 °C, revben 90 °C (mör), julskinka 72 °C (ICA), bog pulled pork 92 °C (ugnstemp 110 °C pekar på pulled).
- Lamm: racks och sadel rosa 55–56 °C, stek medium 57 °C (stor bit, Svenskt Kött medium 56–58 °C).
- Anka: 70 °C (Livsmedelsverket). Vilt: rosa. Lax: 52 °C (ICA).
- Poster med ett enda alternativ: `rec: null`.

## Ugnstider (`times`, `refSize`)
Källor: Svenskt Kött "Temperaturer" (https://svensktkott.se/om-kott/kopa-laga-och-forvara/laga-kott/temperaturer/), som ger totaltider utan vikt: entrecôte 150 °C ca 1½–2 h, nötstek 125 °C 2–2¼ h, fransk rostbiff 125 °C ca 1½ h, karré 150 °C 1¾–2 h, kotlettrad 150 °C 1½–2 h, bogbladsstek 150 °C 1–1½ h, lammstek och lammsadel 150 °C 1½–2 h. ICA ryggbiff i ugn (600 g, 125 °C varmluft) ger ingen tid i receptet; kommentarer anger ca 30 min till 57 °C för 600–800 g. ICA kyckling innertemperatur: helkyckling 175–200 °C, bröst 150–175 °C, inga minuter. Övrigt från postens befintliga `timeHint`.

Interpolerat (alla poster i grunden, eftersom källorna bara ger en tid per styckdetalj):
- Källtiden har lagts på mittalternativet (medium); rosa ca 10–20 % kortare, genomstekt ca 25–40 % längre vid samma ugnstemp. Gäller entrecôte, ryggbiff, oxfilé, rostbiff, fransyska, picanha, rostas, lammstek, lammsadel, älgfilé, hjortstek, rådjurssadel, racks.
- Vikt i `refSize` är mitt antagande när källan saknar vikt (Svenskt Kött anger ingen). Rostbiff (1 kg, rund 9–10 cm) tar längre än ryggbiff (1 kg, 6–8 cm) för att den är tjockare; tjockleken styr mer än vikten.
- Lammsadel: Svenskt Kött 150 °C 1½–2 h, men posten har ovenC 175 och timeHint 45 min–1 h 15 min; tiderna följer posten.
- Flankstek: tid per sida under ugnsgrill, från timeHint 3–5 min/sida.
- Bräsering (högrev, bringa, revbensstek, lamm-lägg, älgstek "Bräserad"): tiden styrs av mörhet, inte innertemp; tiderna är timeHint.
- Julskinka: Svenskt Kött 1 h 15 min/kg och ICA 1,5–2 h/kg vid 125 °C, 4 kg ger 5–8 h; 80 °C lagd i övre delen.
- Gris-bog: alternativ 0 (fläskstek 70 °C) använder 150 °C (Svenskt Kött bogbladsstek), alternativ 1 (pulled 92 °C) 110 °C. Se avvikelse nedan.
- Kycklingbröst: 25–35 min vid 150 °C (timeHint säger 20–30 min vid 150–175 °C; vid den lägre temperaturen behövs övre delen).

## Befintliga värden jag skulle ändra
- gris-bog `timeHint` "pulled pork ca 1,5–2 h/kg vid 110–125 °C" verkar för kort. 92 °C kräver att bindväven passerat "stall"-fasen; 2 kg vid 110 °C tar snarare 6–8 h (ca 3–4 h/kg). Ingen myndighetskälla, tumregel från amerikansk BBQ-praxis (ca 1,5–2 h per pound vid 107 °C). Patchens tid är 6–8 h.
- not-ryggbiff/not-oxfile ugn: alternativet "Rosa/blodig" 50 °C är blodigt snarare än rosa; etiketten kunde vara "Blodig" och medium 57 °C heta "Rosa (medium rare)", som i sous vide-delen.

## Minst säkra
1. gris-julskinka sous vide rec (70 °C): inget sous vide-källstöd alls.
2. gris-bog ugn pulled pork-tid (6–8 h): egen bedömning, motsäger timeHint.
3. not-revbensstek sous vide rec (57 °C 48–72 h): källan redan flaggad som ej verifierad.

## Ändringar vid sammanslagning (2026-10-02)

- not-ryggbiff och not-oxfile, ugn: "Rosa/blodig" 50 °C döptes om till "Blodig" och "Medium" 57 °C till "Rosa", eftersom Svenskt Kött anger rare 54–56 och medium 58–60 °C.
- gris-bog: timeHint rättad till att stämma med tiderna ovan (pulled pork 6–8 h vid 110 °C för ca 2 kg). Den gamla "1,5–2 h/kg" var för kort för 92 °C inuti.
