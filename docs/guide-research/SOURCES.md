# Källor

Hämtat 2026-09-30. Serious Eats blockerar direkthämtning; lästes via web.archive.org.

## sousvide.json
- Baslinje: https://docs.google.com/spreadsheets/d/1xjKgH4qNDTMBjOQyrdTjKiEjzJcp0gpS2T7Ha0j3mWo
- Douglas Baldwin, A Practical Guide to Sous Vide Cooking: https://douglasbaldwin.com/sous-vide.html (uppvärmningstid per tjocklek, pastörisering fågel och fisk, sega bitar)
- ChefSteps referenstabell (PDF): https://s3.amazonaws.com/chefsteps/static/ChefSteps-SousVideReference.pdf
- Serious Eats (Kenji): steak, chicken breast, salmon, duck breast (2010), turkey breast (2014)
- Anova: egg, corn, pork shoulder, pork ribs, brisket, chicken guides
- Svenskt Kött: sous vide-sidan, temperaturer, samt styckdetaljsidor (innertemp per detalj)
- Livsmedelsverket Fråga oss: anka/campylobacter, vildsvin/trikiner vid sous vide; grilla säkert (färs 70 °C)
- ICA innertemperaturer

## ugn.json
- Svenskt Kött: temperaturer (ugnstabell, vilotid, varmluft minus 25 °C), styckdetaljsidor, julskinka-recept
- ICA: innertemperatur, kyckling innertemperatur, ugnsrostade rotfrukter
- Livsmedelsverket: färs 70 °C, anka

## cuts.json
- Svenskt Kött styckdetaljer (nöt, gris, lamm) och köpguide nötkött. Engelska namn från samma sidor där de fanns (bogrulle = chuck tender, flat iron, flank, flap, skirt, hanger/onglet, short ribs, brisket, picanha, teres major).

## matt.json
- Livsmedelsverkets vikttabell (2001), spegling: https://surdegsmakarn.wordpress.com/wp-content/uploads/2012/06/vikttabell.pdf
- Köket.se "Så mycket väger 1 dl av", Receptfavoriter mått och vikt (sekundära)
- King Arthur ingredient weight chart (kontroll av US-värden)
- Kronägg omvandlingsdata (äggklasser, 58/52 g, krm/tsk/msk/dl)
- Wikipedia: Cup (unit), Tablespoon, Gas Mark; sv: Kanna (mått), Stop (mått), Jungfru (mått), Skålpund
- Svenskt Kött (varmluft minus 25 °C)

## Oenigheter (vald väg)
- **Picanha ≠ rostas.** Svenskt Kött: picanha = rostlock med kappa (rumpstek). Uppgiften och baslinjen blandar ihop dem. Två separata poster.
- **Short ribs = revbensstek**, inte bringa. Baslinjens "Bringa med ben (short ribs)" delad i oxbringa och revbensstek.
- **Hamburgare 56,5 °C 30 min** (baslinje) bryter mot Livsmedelsverket (färs 70 °C). Standard 70 °C; 57 °C bara för egenmald färs, med varning.
- **Fransyska 2 kg 55 °C 4 h** (baslinje): för kort för att hinna mörna. Valde 8–16 h (ChefSteps roast, Svenskt Kött upp till 24 h).
- **Ankbröst:** baslinjen länkar Kenjis recept men anger 57 °C 2 h; receptet säger 54 °C 45 min–4 h. Valde 57 °C (nära pastörisering enligt Baldwin) plus 60 °C.
- **Kycklingfilé 60 °C 1,5 h**: räcker bara för ≤ 20 mm (Baldwin). Valde minst 2 h.
- **Revben tunna 72 °C 4 h / 57 °C 24 h**: Anova 74 °C 6–12 h; 57 °C saknar stöd. Valde Anova.
- **Sparris 85 °C 25 min**: ChefSteps 5–20 min (färgen mörknar efter 20). Valde 5–10 och 15–25.
- **Rostbiff 55 °C 27 h**: källor 6–14 h. Båda med.
- **Julskinka "65h 12h"**: skrivfel i baslinjen, tolkat som 65 °C 12 h.
- **Vildsvin:** ICA 72 °C vs Livsmedelsverket (52 °C i 3 h räcker mot trikiner). Sous vide följer LV, ugn följer ICA.
- **Fläskfilé ugn:** ICA 70 °C vs Svenskt Kött 60–62 medium, 65–68 hel filé. Valde Svenskt Kött (61/67).
- **Karré:** Svenskt Kött 68–70 (medium) och 85 (faller isär); ICA 80–85.
- **Vetemjöl/florsocker/dinkel:** King Arthur (sked-och-stryk) ger 15–30 % lägre g/dl än svenska tabeller. Svenska värden valda, intervall angivet.
- **Varmluft:** Svenskt Kött minus 25 °C; ofta anges 20 °C. Valde 25 °C (enda lästa källan).

## Osäkert
- Vilt sous vide (älg, hjort, rådjur, vildsvin): ingen högtrovärdig källa, bara baslinje plus ICA-innertemp.
- Julskinka sous vide, lammlägg sous vide, rabarber, omelett, ägg 70 °C 20 min: endast baslinje.
- Short ribs 55–57 °C 48–72 h: Anova/Serious Eats-sidor gick ej att läsa (404/blockerad); bygger på ChefSteps och Baldwin.
- ChefSteps-PDF:ens layout är trasig vid textutdrag; tider tolkade från kolumnordning.
- Baldwins brisket 80 °C 24–36 h citerat som det lästes; verkar högt men står i källan.
- Kyckling-styckning (cuts.json) saknar svensk styckningskälla; allmän anatomi.
- US/UK-motsvarigheter för rostas, tjocka/tunna revben och karré är ungefärliga.
- Alla ugnstider (timeHint) märkta "ungefärligt" utom där Svenskt Kött/ICA anger dem.
- Grönsaker i ugn: bara rotfrukter (ICA 225 °C 30 min) har källa; övriga är tumregler.
- matt.json: tekopp, nypa, skvätt, knippe, näve, buljongtärning, smörpaket, råsocker, panko, mark (vikt) saknar eller har svag källa. Äggvikt utan skal för S/L/XL beräknad (90 %).
- LV-vikttabellen lästes via spegling (surdegsmakarn), inte livsmedelsverket.se.
