"""Captures stores (DA Fondant, net + éclats) : fond nuit, légende blanche en Climate Crisis, vrai écran de l'app en téléphone, un autocollant citron ou framboise."""
import base64, os
from fontTools.ttLib import TTFont
from playwright.sync_api import sync_playwright

S = '/tmp/claude-0/-home-claude/49da3fef-077c-57b4-b399-71724950e36e/scratchpad/'
OUT = '/home/claude/sweetin/store/captures/'
FONT = '/home/claude/sweetin/assets/fonts/SweetinDisplay.ttf'
CAP = {
    'fr': [('s1', 'gratte la photo,\nlis le mot.'), ('s2', 'cache un mot\nsous ta photo.'), ('s3', 'lu une fois,\npuis ça fond.'),
           ('s4', 'des sweets\nt’attendent.'), ('s5', 'une série avec\nchaque meilleur ami.'), ('s6', 'à tes amis,\nmême sans l’app.')],
    'en': [('s1', 'scratch the photo,\nread the word.'), ('s2', 'hide a word\nunder your photo.'), ('s3', 'read once,\nthen it melts.'),
           ('s4', 'sweets are\nwaiting for you.'), ('s5', 'a streak with\nevery best friend.'), ('s6', 'to your friends,\neven without the app.')],
}
STICK = {'fr': ['gratte-moi', 'mot caché', 'je fonds', '3 à gratter', '41j', 'sans l’app'],
         'en': ['scratch me', 'hidden word', 'i’m melting', '3 to scratch', '41d', 'no app needed']}
tt = TTFont(FONT); cmap = tt.getBestCmap(); hm = tt['hmtx']; upm = tt['head'].unitsPerEm
def width(s, size): return sum(hm[cmap.get(ord(c), cmap[ord(' ')])][0] for c in s) * size / upm

def page(W, H, shot, cap, stick, i):
    k = W / 1320
    b64 = base64.b64encode(open(f'{S}store6/{shot}_light.png', 'rb').read()).decode()
    lines = cap.split('\n')
    # taille de légende : la plus grande qui tient sur la largeur
    avail = W - 2 * int(90 * k)
    size = min(96 * k, min(avail / (width(l, 1) * 1.02) for l in lines))
    pw = int(W * (0.74 if H / W > 2 else 0.6)); ph = int(pw * 844 / 390)
    top = int(H * 0.215)
    rot = [-4, 3, -3, 4, -3, 3][i]
    bg = ['#E8FF5A', '#FF2E5B', '#FFFFFF', '#E8FF5A', '#FF2E5B', '#FFFFFF'][i]
    fg = '#160F12'  # nuit partout, y compris sur la framboise (5,2:1)
    return f'''<html><head><meta charset="utf-8"><style>
@font-face{{font-family:D;src:url(file://{FONT})}}
@font-face{{font-family:T;src:url(file:///home/claude/sweetin/assets/fonts/SweetinText-ExtraBold.ttf)}}
body{{margin:0;width:{W}px;height:{H}px;overflow:hidden;background:#160F12;position:relative}}
  .cap{{position:absolute;left:0;right:0;top:{int(150 * k)}px;font-family:D;color:#FFFFFF;font-size:{size:.1f}px;line-height:1.1;text-align:center}}
.ph{{position:absolute;left:{(W - pw) // 2}px;top:{top}px;width:{pw}px;height:{ph}px;border-radius:{int(70 * k)}px;overflow:hidden;
  box-shadow:0 0 0 {int(14 * k)}px #2B2427,0 {int(50 * k)}px {int(120 * k)}px rgba(0,0,0,.55)}}
.ph img{{width:100%;height:100%;display:block}}
.st{{position:absolute;right:{int(70 * k)}px;top:{top - int(40 * k)}px;transform:rotate({rot}deg);font-family:D;font-size:{int(46 * k)}px;
  padding:{int(18 * k)}px {int(32 * k)}px;border-radius:999px;background:{bg};color:{fg};box-shadow:0 0 0 {int(7 * k)}px #fff,0 {int(14 * k)}px {int(30 * k)}px rgba(22,15,18,.25)}}
</style></head><body>
<div class="ph"><img src="data:image/png;base64,{b64}"></div>
<div class="st">{stick}</div>
<div class="cap">{'<br>'.join(lines)}</div></body></html>'''

with sync_playwright() as p:
    b = p.chromium.launch(args=['--allow-file-access-from-files'])
    for lang, caps in CAP.items():
        for i, (shot, cap) in enumerate(caps):
            name = shot + ('' if lang == 'fr' else '_en')
            for kind, (W, H) in {'appstore': (1320, 2868), 'play': (1080, 1920)}.items():
                html = page(W, H, name, cap, STICK[lang][i], i)
                tmp = f'{S}store4/tmp.html'
                open(tmp, 'w').write(html)
                pg = b.new_page(viewport={'width': W, 'height': H})
                pg.goto('file://' + tmp); pg.wait_for_timeout(300)
                pg.screenshot(path=f'{OUT}{kind}-{lang}-{i + 1}.png'); pg.close()
    b.close()
print('ok')
