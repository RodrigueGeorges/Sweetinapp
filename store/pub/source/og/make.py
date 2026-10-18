import asyncio, re
from playwright.async_api import async_playwright
O='/tmp/claude-0/-home-claude/49da3fef-077c-57b4-b399-71724950e36e/scratchpad/og/'
W='/home/claude/sweetin/web/'
logo=open(O+'logo.svg.html').read().replace('height="26"','height="52"')
CARDS={
 'og':  dict(title='le mot<br>qui <em>fond.</em>', sub='cache un mot sous une photo.<br>10 s pour le lire, puis ça fond.', pill='gratuit sur android', s1='gratte-moi', s2='mot caché'),
 'og-f':dict(title='quelqu’un<br>t’a caché<br>un mot.', sub='gratte la photo pour le lire.<br>après, il fond.', pill='ça s’ouvre une seule fois', s1='gratte-moi', s2='mot caché'),
 'og-u':dict(title='on t’attend<br>sur sweetin.', sub='une photo, un mot caché dessous.<br>tu grattes, tu lis, ça fond.', pill='gratuit sur android', s1='rejoins-moi', s2='mot caché'),
}
def html(c):
  return f'''<!doctype html><meta charset=utf-8><style>
@font-face{{font-family:SD;src:url(file://{W}fonts/SweetinDisplay.woff2)}}
@font-face{{font-family:ST;src:url(file://{W}fonts/SweetinText-ExtraBold.woff2);font-weight:800}}
@font-face{{font-family:ST;src:url(file://{W}fonts/SweetinText-Bold.woff2);font-weight:700}}
html,body{{margin:0}} body{{width:1200px;height:630px;background:#fff;position:relative;overflow:hidden;font-family:ST;color:#160F12}}
.l{{position:absolute;left:72px;top:64px}} .l svg{{color:#160F12}}
h1{{position:absolute;left:72px;top:140px;margin:0;font:400 92px/1 SD;white-space:nowrap}} h1 em{{font-style:normal;color:#FF2E5B}}
p{{position:absolute;left:76px;top:392px;margin:0;font:700 30px/1.4 ST;color:#6F6468}}
.pill{{position:absolute;left:72px;top:510px;height:64px;padding:0 30px;border-radius:32px;background:#160F12;color:#fff;font:800 28px ST;display:flex;align-items:center}}
.card{{position:absolute;right:80px;top:50px;width:350px;height:500px;border-radius:40px;overflow:hidden;transform:rotate(-3deg);box-shadow:0 30px 60px rgba(22,15,18,.18);background:#160F12}}
.card i{{position:absolute;inset:-30px;background:url(file://{W}img/coeur.jpg) center/cover;filter:blur(18px) saturate(1.15)}}
.card b{{position:absolute;inset:0;background:url(file://{W}sucre-givre.png);background-size:200px;opacity:.6}}
.card span{{position:absolute;left:0;right:0;top:205px;text-align:center;font:400 54px SD;color:#fff;text-shadow:0 4px 30px rgba(22,15,18,.35)}}
.stk{{position:absolute;font:400 30px SD;padding:14px 26px;border-radius:999px;border:6px solid #fff;box-shadow:0 6px 16px rgba(22,15,18,.2);white-space:nowrap}}
.s1{{right:50px;top:40px;background:#E8FF5A;transform:rotate(7deg)}} .s2{{right:350px;top:420px;background:#FF2E5B;transform:rotate(-6deg)}}
</style><div class=l>{logo}</div><h1>{c["title"]}</h1><p>{c["sub"]}</p><div class=pill>{c["pill"]}</div>
<div class=card><i></i><b></b><span>gratte.</span></div><div class="stk s1">{c["s1"]}</div><div class="stk s2">{c["s2"]}</div>'''
async def m():
  async with async_playwright() as p:
    b=await p.chromium.launch(); pg=await b.new_page(viewport={'width':1200,'height':630})
    for k,c in CARDS.items():
      open(O+k+'.html','w').write(html(c)); await pg.goto('file://'+O+k+'.html'); await pg.wait_for_timeout(300)
      await pg.evaluate('''() => { const h = document.querySelector('h1'); let f = 92; h.style.fontSize = f + 'px'; while ((h.scrollWidth > 640 || h.offsetHeight > 235) && f > 40) { f -= 2; h.style.fontSize = f + 'px'; } const p = document.querySelector('p'); p.style.top = (140 + h.offsetHeight + 26) + 'px'; }''')
      await pg.screenshot(path=W+k+'.png')
    await b.close()
asyncio.run(m())
