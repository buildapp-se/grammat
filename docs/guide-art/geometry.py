"""Snitt, etiketter och streck ovanpå Codex-bilderna, i bildens pixlar (960 px bredd).
Skriver in svg-blocket per djur i guide.json. Kör efter prepare.py:
  python docs/guide-art/geometry.py
Polygonerna får gå utanför djuret: de klipps mot konturen från prepare.py. Huvudet är ingen del."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
GUIDE = os.path.join(HERE, '..', '..', 'guide.json')
S, M = 'start', 'middle'
FS = 32  # textstorlek i bildpixlar; ca 9–10 px på mobil, 15–18 px på dator
CH = FS * 0.56

A = {
  'not': {
    'regions': {
      'not-hals': '215,0 300,0 300,200 230,270 150,235 205,120',
      'not-hogrev': '300,0 430,0 430,180 300,200',
      'not-fjaderbladsbog': '300,200 430,180 430,235 300,258 230,270',
      'not-bog': '230,270 300,258 430,235 430,420 228,420',
      'not-bringa': '150,235 230,270 228,420 140,440 100,300',
      'not-entrecote': '430,0 560,0 560,195 430,180',
      'not-revbensstek': '430,180 560,195 560,420 430,420',
      'not-ryggbiff': '560,0 700,0 700,185 560,195',
      'not-oxfile': '560,195 700,185 720,210 580,222',
      'not-mellangarde': '560,195 580,222 600,420 560,420',
      'not-flankstek': '580,222 720,210 720,400 600,420',
      'not-rostbiff': '700,0 790,0 790,190 720,210 700,185',
      'not-rostlock': '790,0 905,0 905,110 790,118',
      'not-rostas': '790,118 860,114 860,190 790,190',
      'not-fransyska': '720,210 790,190 790,380 720,400',
      'not-innanlar': '790,190 860,190 860,380 790,380',
      'not-ytterlar': '860,114 905,110 910,400 860,380',
      'not-lagg': 'M140 420 H430 V640 H140 Z M690 380 H960 V640 H690 Z M905 0 H960 V400 H910 Z',
    },
    'labels': {'not-hals': (252, 150), 'not-hogrev': (365, 100), 'not-bog': (345, 340), 'not-bringa': (180, 330),
               'not-ryggbiff': (632, 95), 'not-flankstek': (660, 340), 'not-lagg': (300, 500)},
    'short': {'not-flankstek': 'Flank', 'not-lagg': 'Lägg'},
    'callouts': {
      'not-entrecote': ((495, 110), (420, -22), M, 'Entrecôte'),
      'not-rostbiff': ((745, 100), (712, -22), M, 'Rostbiff'),
      'not-oxfile': ((590, 205), (560, -22), M, 'Oxfilé'),
      'not-rostlock': ((850, 70), (880, -22), M, 'Rostlock'),
      'not-rostas': ((825, 152), (978, 150), S, 'Rostas'),
      'not-ytterlar': ((885, 250), (978, 236), S, 'Ytterlår'),
      'not-innanlar': ((825, 290), (978, 316), S, 'Innanlår'),
      'not-fransyska': ((755, 310), (978, 396), S, 'Fransyska'),
      'not-fjaderbladsbog': ((330, 230), (175, 705), M, 'Fjäderbladsbog'),
      'not-revbensstek': ((495, 330), (430, 705), M, 'Revbensstek'),
      'not-mellangarde': ((578, 340), (705, 705), M, 'Mellangärde'),
    },
  },
  'gris': {
    'regions': {
      'gris-karre': '220,0 400,0 400,165 228,178',
      'gris-pluma-sekreto': '400,105 455,105 455,185 400,165',
      'gris-kotlettrad': '400,0 760,0 760,150 455,150 455,105 400,105',
      'gris-kamben': '455,150 760,150 760,185 455,185',
      'gris-file': '620,185 760,185 760,214 620,214',
      'gris-bog': '228,178 400,165 455,185 455,420 228,420',
      'gris-revben': '455,185 620,185 620,300 455,300',
      'gris-sida': '455,300 620,300 620,214 700,214 700,420 455,420',
      'gris-skinka': '760,0 960,0 960,420 790,420 790,214 760,214',
      'gris-flintastek': '700,214 790,214 790,420 700,420',
      'gris-lagg': 'M220 420 H460 V560 H220 Z M690 420 H960 V560 H690 Z',
    },
    'labels': {'gris-karre': (310, 110), 'gris-kotlettrad': (600, 100), 'gris-bog': (330, 300), 'gris-revben': (538, 255),
               'gris-sida': (560, 365), 'gris-skinka': (870, 260), 'gris-lagg': (330, 470)},
    'short': {'gris-lagg': 'Lägg'},
    'callouts': {
      'gris-pluma-sekreto': ((428, 140), (300, -22), M, 'Pluma/sekreto'),
      'gris-kamben': ((540, 168), (520, -22), M, 'Kamben'),
      'gris-file': ((690, 200), (720, -22), M, 'Fläskfilé'),
      'gris-flintastek': ((745, 330), (745, 600), M, 'Flintastek'),
    },
  },
  'lamm': {
    'regions': {
      'lamm-hals': '275,0 340,0 340,320 240,340 140,205 230,120',
      'lamm-bog': '340,0 460,0 460,420 250,440 240,340 340,320',
      'lamm-entrecote': '460,0 560,0 560,270 460,270',
      'lamm-racks': '560,0 650,0 650,270 560,270',
      'lamm-sadel': '650,0 780,0 780,250 650,250',
      'lamm-file': '650,250 780,250 780,280 650,280',
      'lamm-bringa': '250,440 460,420 460,270 650,270 650,280 780,280 780,400 700,470 250,470',
      'lamm-stek': '780,0 960,0 960,520 690,520 700,470 780,400',
      'lamm-lagg': 'M230 470 H420 V700 H230 Z M680 520 H960 V700 H680 Z',
    },
    'labels': {'lamm-hals': (262, 250), 'lamm-bog': (395, 330), 'lamm-racks': (605, 215),
               'lamm-sadel': (715, 205), 'lamm-bringa': (560, 390), 'lamm-stek': (860, 380), 'lamm-lagg': (325, 590)},
    'short': {'lamm-lagg': 'Lägg'},
    'callouts': {
      'lamm-file': ((715, 265), (760, 760), M, 'Innerfilé'),
      'lamm-entrecote': ((510, 200), (500, -22), M, 'Entrecôte'),
    },
  },
  'kyckling': {
    'regions': {
      'kyckling-brost': '0,200 90,200 180,190 300,230 280,290 300,410 420,460 330,560 330,780 0,780',
      'kyckling-innerfile': '165,505 320,545 315,578 160,538',
      'kyckling-overlar': '520,440 720,420 820,470 960,560 960,780 560,780 600,600',
      'kyckling-klubba': '420,460 520,440 600,600 560,780 330,780 330,560',
      'kyckling-vinge': '280,290 470,260 650,290 740,380 720,420 520,440 420,460 300,410',
      'kyckling-skrov': '180,0 960,0 960,560 820,470 720,420 740,380 650,290 470,260 280,290 300,230 180,190',
    },
    'labels': {'kyckling-brost': (190, 420), 'kyckling-vinge': (520, 365), 'kyckling-overlar': (700, 540),
               'kyckling-klubba': (460, 560), 'kyckling-skrov': (600, 230)},
    'short': {},
    'callouts': {
      'kyckling-innerfile': ((240, 545), (130, 830), M, 'Innerfilé'),
    },
  },
}

def path(poly):
    if poly.startswith('M'): return poly
    return 'M' + ' L'.join(p.replace(',', ' ') for p in poly.split()) + ' Z'

g = json.load(open(GUIDE, encoding='utf-8'))
for a in g['cuts']['animals']:
    spec, art = A[a['id']], json.load(open(os.path.join(HERE, a['id'] + '.json')))
    ids = {r['id'] for r in a['regions']}
    assert set(spec['regions']) == ids, (a['id'], ids ^ set(spec['regions']))
    assert set(spec['labels']) | set(spec['callouts']) == ids and not set(spec['labels']) & set(spec['callouts']), a['id']
    for r in a['regions']:
        if r['id'] in spec['short']: r['short'] = spec['short'][r['id']]
        elif r['id'] in spec['labels']: r['short'] = r.get('short') or r['sv'].split(' (')[0]
    boxes = [(0, 0, art['w'], art['h'])]
    calls = {}
    for rid, ((ax, ay), (tx, ty), anc, text) in spec['callouts'].items():
        end = (tx - 6, ty - 8) if anc == S else (tx, ty + 8) if ty < ay else (tx, ty - FS)
        calls[rid] = {'a': [ax, ay], 'e': list(end), 't': [tx, ty], 'anchor': anc, 'text': text}
        w = len(text) * CH
        x0 = tx if anc == S else tx - w / 2
        boxes.append((x0, ty - FS, x0 + w, ty + 6))
    x0, y0 = min(b[0] for b in boxes) - 8, min(b[1] for b in boxes) - 8
    x1, y1 = max(b[2] for b in boxes) + 8, max(b[3] for b in boxes) + 8
    a['svg'] = {'image': f'guide-img/{a["id"]}.webp', 'w': art['w'], 'h': art['h'], 'fs': FS,
                'viewBox': f'{x0:g} {y0:g} {x1 - x0:g} {y1 - y0:g}', 'body': art['body'],
                'regions': {k: path(v) for k, v in spec['regions'].items()},
                'labels': {k: list(v) for k, v in spec['labels'].items()}, 'callouts': calls}
    print(a['id'], a['svg']['viewBox'])
json.dump(g, open(GUIDE, 'w', encoding='utf-8', newline='\n'), ensure_ascii=False, separators=(',', ':'))
