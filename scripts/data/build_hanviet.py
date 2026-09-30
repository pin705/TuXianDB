# Rebuilds data/hanviet.json: char -> [Hán Việt, pinyin].
# Sources (download into one folder, pass it as the only argument):
#   hanviet.csv  from https://github.com/ph0ngp/hanviet-pinyin-wordlist (MIT; traditional chars, reading chosen by pinyin)
#   unihan/      unzipped https://www.unicode.org/Public/UCD/latest/ucd/Unihan.zip (simplified->traditional, kMandarin, kVietnamese fallback)
# Usage: python3 scripts/data/build_hanviet.py /path/to/sources
import csv, json, ast, sys
U = sys.argv[1].rstrip('/') + '/'
tones = {'ā':'a1','á':'a2','ǎ':'a3','à':'a4','ē':'e1','é':'e2','ě':'e3','è':'e4','ī':'i1','í':'i2','ǐ':'i3','ì':'i4',
         'ō':'o1','ó':'o2','ǒ':'o3','ò':'o4','ū':'u1','ú':'u2','ǔ':'u3','ù':'u4','ǖ':'v1','ǘ':'v2','ǚ':'v3','ǜ':'v4','ü':'v'}
def num(p):
    t, s = '5', ''
    for c in p:
        if c in tones: v = tones[c]; s += v[0]; t = v[1] if len(v) > 1 else t
        else: s += c
    return s + t
hv = {}
for row in csv.DictReader(open(U + 'hanviet.csv', encoding='utf-8')):
    readings = ast.literal_eval(row['hanviet'])
    if readings: hv.setdefault(row['char'], []).append((readings[0], row['pinyin'].lower()))
py, vi, trad = {}, {}, {}
for line in open(U + 'unihan/Unihan_Readings.txt', encoding='utf-8'):
    if line[0] == '#' or not line.strip(): continue
    cp, k, v = line.rstrip('\n').split('\t'); ch = chr(int(cp[2:], 16))
    if k == 'kMandarin': py[ch] = v.split()[0]
    elif k == 'kVietnamese': vi[ch] = v.split()[0]
for line in open(U + 'unihan/Unihan_Variants.txt', encoding='utf-8'):
    if line[0] == '#' or not line.strip(): continue
    cp, k, v = line.rstrip('\n').split('\t')
    if k == 'kTraditionalVariant': trad[chr(int(cp[2:], 16))] = [chr(int(x[2:].split('<')[0], 16)) for x in v.split()]
def reading(ch):
    n = num(py[ch]) if ch in py else ''
    for c in [ch] + trad.get(ch, []):
        rows = hv.get(c)
        if rows:
            return next((r for r, rp in rows if rp in ('*', n)), rows[0][0])
    return vi.get(ch) or next((vi[t] for t in trad.get(ch, []) if t in vi), '')
out = {ch: [reading(ch), py.get(ch, '')] for ch in set(py) | set(hv)}
out = {k: v for k, v in out.items() if v[0] or v[1]}
json.dump(out, open('data/hanviet.json', 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'), sort_keys=True)
print('entries', len(out), 'with Hán Việt', sum(1 for v in out.values() if v[0]))
