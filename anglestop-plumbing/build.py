#!/usr/bin/env python3
"""Build the Angle Stop Plumbing site into site/.

Every page shares one layout (header, menu, footer). Inner pages are rendered
from content/pages/, which holds Jim's wording pulled from the Wix site, so the
text, title tags, meta descriptions and URLs stay exactly as they are now.

    python3 build.py                 # write the site into site/
    python3 build.py --preview DIR   # write a flat copy for the artifact preview
"""
import html
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SITE = os.path.join(ROOT, 'site')
CONTENT = os.path.join(ROOT, 'content', 'pages')
TEMPLATES = os.path.join(ROOT, 'templates')

DOMAIN = 'https://www.anglestopplumbing.com'
WORKIZ = 'https://online-booking.workiz.com/?ac=fb4a367aaef910833ab1ecc026d212793c52c4b6d2f4066a884b0f0392bd01de'
PHONE = '(615) 398-3048'
TEL = 'tel:+16153983048'

WH = '/water-heater-service-repair-installation-murfreesboro-tn'
WF = '/water-filtration-services-murfreesboro-tn'
RES = '/residential-plumbing-services'
COM = '/commercial-plumbing-services'
PAY = '/flexible-plumbing-payment-solutions-murfreesboro-tn'
MEM = '/angle-stop-plumbing-membership-plan'

# The menu mirrors the one on the Wix site. Sub-page labels are Jim's.
MENU = [
    ('Home', '/', []),
    ('About', '/about', []),
    ('Water Heaters', WH, [
        ('Water Heater Services', WH),
        ('Conventional or Traditional Water Heater', WH + '/conventional-tank-water-heater-murfreesboro-tn'),
        ('Heat or Hybrid Pump Water Heaters', WH + '/heat-pump-hybrid-water-heater-murfreesboro-tn'),
        ('Tankless Water Heater Service', WH + '/tankless-water-heater-murfreesboro-tn'),
    ]),
    ('Water Filtration', WF, [
        ('Water Filtration Services', WF),
        ('Water Softener Services', WF + '/water-softener-services-murfreesboro-tn'),
        ('Reverse Osmosis Filtration', WF + '/reverse-osmosis-murfreesboro-tn'),
        ('Water Descaling System', WF + '/water-descaling-murfreesboro-tn'),
        ('UV Water Filtration', WF + '/uv-water-filtration-murfreesboro-tn'),
        ('Whole House Filtration', WF + '/whole-house-water-filtration-murfreesboro-tn'),
    ]),
    ('Residential', RES, [
        ('Residential Plumbing Services', RES),
        ('Residential Backflow Testing', RES + '/residential-backflow-testing'),
        ('Residential Backflow Repair Services', RES + '/residential-backflow-repair'),
        ('Smart Valves', RES + '/smart-plumbing-valves-leak-detection-murfreesboro-tn'),
        ('Drain Services', RES + '/drain-services-murfreesboro-tn'),
        ('Water Pipe Repair Services', RES + '/water-pipe-repair-services-murfreesboro-tn'),
        ('Sewer Pipe Repair Services', RES + '/sewer-pipe-repair-services-murfreesboro-tn'),
        ('Plumbing Fixture Services', RES + '/plumbing-fixture-services-murfreesboro-tn'),
        ('Inground Pool Plumbing', RES + '/inground-pool-plumbing-murfreesboro-tn'),
        ('Emergency Plumbing Services', RES + '/emergency-plumbing-services-murfreesboro-tn'),
    ]),
    ('Commercial', COM, [
        ('Commercial Plumbing Services', COM),
        ('Commercial Water Heater Repair', COM + '/commercial-water-heater-repair'),
        ('Commercial Water Heater Installation', COM + '/commercial-water-heater-installation'),
        ('Commercial Backflow Testing', COM + '/commercial-backflow-preventer-testing'),
        ('Commercial Backflow Repair', COM + '/commercial-backflow-preventer-repair'),
        ('Commercial Business Leak Repair', COM + '/commercial-leak-repair'),
    ]),
    ('Payment Options', PAY, [
        ('Flexible Plumbing Payment Solutions', PAY),
        ('Plumbing Lease Options', PAY + '/plumbing-lease-options-murfreesboro-tn'),
        ('Plumbing Finance Options', PAY + '/plumbing-finance-options-murfreesboro-tn'),
    ]),
    ('Membership', MEM, [
        ('Plumbing Membership', MEM),
        ('Silver Pipe Plumbing Membership', MEM + '/silver-pipe-membership-plan'),
        ('Gold Pipe Plumbing Membership', MEM + '/gold-pipe-membership-plan'),
        ('Platinum Pipe Plumbing Membership', MEM + '/platinum-pipe-membership'),
    ]),
    ('Blog', '/blog', []),
]

# Pages built so far. Everything else in the menu still links to its real URL.
BUILT = ['/', WH]

# Jim's job photos placed on each page: a hero photo, and photos placed after
# the paragraph that follows a given heading. Files are in site/images/work/.
PHOTOS = {
    WH: {
        'hero': ('wh-hero.webp', 'New Bradford White gas water heater installed in a laundry closet'),
        'after': {
            'Conventional Electric & Gas Water Heater Services':
                ('wh-conventional.webp', 'Bradford White electric water heater installed in a closet',
                 'Bradford White electric water heater install'),
            'Heat Pump Water Heater Service, Repair & Installation':
                ('wh-heat-pump.webp', 'Bradford White heat pump water heater installed in a garage',
                 'Bradford White heat pump water heater install'),
            'Tankless Water Heater Service, Repair & Installation':
                ('wh-tankless.webp', 'Navien tankless water heater mounted on an outside brick wall',
                 'Navien tankless water heater install'),
        },
    },
}

LINK = re.compile(r'\[\[(.*?)\|([^\]]+)\]\]')


def esc(t):
    return html.escape(t, quote=True)


def local(url):
    """Turn a full anglestopplumbing.com URL into a site path."""
    if url.rstrip('/') == DOMAIN:
        return '/'
    if url.startswith(DOMAIN + '/'):
        return url[len(DOMAIN):]
    return url


def a_tag(text, url, cls=''):
    url = local(url)
    attrs = f' class="{cls}"' if cls else ''
    if url.startswith('http'):
        attrs += ' target="_blank" rel="noopener"'
    return f'<a href="{esc(url)}"{attrs}>{text}</a>'


def inline(t):
    out, pos = [], 0
    for m in LINK.finditer(t):
        out.append(esc(t[pos:m.start()]))
        out.append(a_tag(esc(m.group(1)), m.group(2)))
        pos = m.end()
    out.append(esc(t[pos:]))
    return ''.join(out)


def plain(t):
    return LINK.sub(r'\1', t).replace('{bold}', '').strip()


def read_page(path):
    name = 'index.md' if path == '/' else path.strip('/') + '.md'
    text = open(os.path.join(CONTENT, name), encoding='utf-8').read()
    head, body = text.split('\n---\n', 1)
    meta = {}
    for line in head.strip().split('\n'):
        if ': ' in line:
            k, v = line.split(': ', 1)
            meta[k] = v
    return meta, [b.strip() for b in body.split('\n\n') if b.strip()]


def render_body(blocks, photos):
    """Render content blocks. Returns (h1, lede, html)."""
    h1, lede, out, items = None, None, [], []
    after = dict((photos or {}).get('after', {}))
    pending = None  # photo waiting for the paragraph after its heading

    def flush_list():
        if items:
            out.append('<ul>\n' + '\n'.join(f'  <li>{inline(i)}</li>' for i in items) + '\n</ul>')
            items.clear()

    for b in blocks:
        if b.startswith('- '):
            items.append(b[2:])
            continue
        flush_list()
        if b.startswith('!['):
            continue  # Wix stock images are replaced by Jim's own photos
        if b.startswith('# ') and h1 is None:
            h1 = plain(b[2:])
            continue
        m = re.match(r'(#{1,6}) (.*)', b)
        if m:
            text = m.group(2).replace('{bold}', '').strip()
            level = 3 if len(m.group(1)) >= 3 else 2
            out.append(f'<h{level}>{inline(text)}</h{level}>')
            pending = after.pop(plain(text), None)
            continue
        if b.startswith('[button] '):
            label, url = b[9:].rsplit(' -> ', 1)
            out.append(f'<p class="btnrow">{a_tag(esc(label), url, "big-book")}</p>')
            continue
        if h1 and lede is None and not out:
            lede = inline(b)
            continue
        out.append(f'<p>{inline(b)}</p>')
        if pending:
            src, alt, cap = pending
            out.append(f'<figure>\n  <img src="{{root}}images/work/{src}" width="960" height="720" '
                       f'loading="lazy" alt="{esc(alt)}">\n  <figcaption>{esc(cap)}</figcaption>\n</figure>')
            pending = None
    flush_list()
    if after:
        sys.exit(f'Photo headings not found: {list(after)}')
    return h1, lede, '\n\n'.join(out)


def current(p, path):
    return ' aria-current="page"' if p == path else ''


def group_of(path):
    for label, top, subs in MENU:
        if path == top or any(path == p for _, p in subs):
            return label, top, subs
    return None, None, []


def menu_html(path):
    top_here = group_of(path)[1]
    bar, phone = [], []
    for label, top, subs in MENU:
        cur = current(top, path)
        if subs:
            children = [(l, p) for l, p in subs if p != top]
            here = ' here' if top == top_here else ''
            sub = '\n'.join(f'          <li><a href="{p}"{current(p, path)}>{esc(l)}</a></li>'
                            for l, p in children)
            bar.append(f'      <li class="has-sub{here}"><a href="{top}"{cur}>{label}</a>\n'
                       f'        <ul class="sub">\n{sub}\n        </ul>\n      </li>')
            phone.append(f'        <li><a href="{top}"{cur}>{label}</a>\n          <ul class="sub">\n'
                         + '\n'.join(f'            <li><a href="{p}"{current(p, path)}>{esc(l)}</a></li>'
                                     for l, p in children)
                         + '\n          </ul>\n        </li>')
        else:
            bar.append(f'      <li><a href="{top}"{cur}>{label}</a></li>')
            phone.append(f'        <li><a href="{top}"{cur}>{label}</a></li>')
    return ('  <nav aria-label="Main">\n    <div class="wrap">\n'
            '    <ul class="menu">\n' + '\n'.join(bar) + '\n    </ul>\n'
            '    <details class="mnav">\n      <summary>Menu</summary>\n      <ul>\n'
            + '\n'.join(phone) + '\n      </ul>\n    </details>\n    </div>\n  </nav>')


def shell(path, meta, main, og_image):
    root = '../' * (path.strip('/').count('/')) if path != '/' else ''
    title = meta['title']
    desc = meta.get('description', '')
    canonical = meta.get('canonical', DOMAIN + (path if path != '/' else ''))
    robots = f'\n<meta name="robots" content="{esc(meta["robots"])}">' if meta.get('robots') else ''
    doc = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">{robots}
<link rel="canonical" href="{esc(canonical)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{esc(canonical)}">
<meta property="og:image" content="{DOMAIN}/images/work/{og_image}">
<link rel="icon" href="{{root}}images/mark-32.png" type="image/png">
<link rel="apple-touch-icon" href="{{root}}images/mark-180.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=Source+Sans+3:ital,wght@0,400;0,500;0,600;1,400&family=Source+Serif+4:ital,wght@1,400;1,500&display=swap">
<link rel="stylesheet" href="{{root}}css/site.css">
</head>
<body>

<div class="strip">
  <div class="wrap">
    <span><b>Licensed Tennessee LLP 4747</b></span>
    <span class="sep">|</span>
    <span>Veteran &amp; family owned</span>
    <span class="sep">|</span>
    <span>Murfreesboro &amp; Middle Tennessee</span>
    <span class="sep">|</span>
    <span>Mon–Fri 6:30a–7p · Sat 6:30a–2p</span>
  </div>
</div>

<header>
  <div class="wrap bar">
    <a class="mark" href="/">
      <img class="badge" src="{{root}}images/seal.svg" width="60" height="60" alt="">
      <span>
        <span class="name">Angle Stop Plumbing</span>
        <span class="tag">Stop leaking pipes, it's our life</span>
      </span>
    </a>
    <a class="callbtn" href="{TEL}">
      <span>{PHONE}<small>Call us now</small></span>
    </a>
    <a class="bookbtn" href="{WORKIZ}" target="_blank" rel="noopener">Schedule Here!</a>
  </div>
{menu_html(path)}
</header>

{main}

<div class="cta" id="schedule">
  <div class="wrap">
    <p class="kicker" style="color:#7FC8EE">Book in about a minute</p>
    <h2>Pick a time that works for you.</h2>
    <p class="sub">Schedule online any time of day, or call and talk it through with us. Either way, you're on the book.</p>
    <div class="actions">
      <a class="big-call" href="{TEL}">
        <small>Call now — we answer</small>
        <b>{PHONE}</b>
      </a>
      <a class="big-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule online</a>
    </div>
  </div>
</div>

<footer>
  <div class="wrap">
    <div class="guarantee">
      <h4>The Angle Stop Plumbing Guarantee</h4>
      <p>Our team is passionate about delivering satisfaction to you, your family, or your business. We bring years of experience and knowledge to provide a lasting resolution designed to keep your plumbing system operating smoothly for years to come. We're delivering peace of mind to you, your family, or business whenever the need arises!</p>
    </div>
    <div>
      <h4>Angle Stop Plumbing, Inc.</h4>
      <p>2222 General Raines Dr.</p>
      <p>Murfreesboro, TN 37129</p>
      <p><a href="{TEL}">{PHONE}</a></p>
      <p><a href="mailto:Sales@AngleStopPlumbing.com">Sales@AngleStopPlumbing.com</a></p>
      <h4 style="margin-top:22px">Hours</h4>
      <p>Mon–Fri &nbsp;6:30am – 7:00pm</p>
      <p>Saturday &nbsp;6:30am – 2:00pm</p>
      <p>Sunday &nbsp;Closed</p>
      <p style="margin-top:9px; color:#fff">Emergency service available</p>
    </div>
    <div>
      <h4>Services</h4>
      <p><a href="{WH}">Water heater services</a></p>
      <p><a href="{WF}">Water filtration services</a></p>
      <p><a href="{RES}">Residential plumbing services</a></p>
      <p><a href="{COM}">Commercial plumbing services</a></p>
      <p><a href="{RES}/emergency-plumbing-services-murfreesboro-tn">Emergency plumbing services</a></p>
    </div>
    <div>
      <h4>Company</h4>
      <p><a href="/about">About us</a></p>
      <p><a href="{MEM}">Plumbing membership</a></p>
      <p><a href="{PAY}">Payment options</a></p>
      <p><a href="/blog">Blog</a></p>
      <p><a href="/careers-plumbers-assistant">Careers</a></p>
      <p><a href="/request-bible">Request a free Bible</a></p>
      <p><a href="https://www.facebook.com/anglestopplumbing" target="_blank" rel="noopener">Facebook</a> · <a href="https://www.instagram.com/anglestopplumbing/" target="_blank" rel="noopener">Instagram</a></p>
    </div>
  </div>
  <div class="legal">
    <div class="wrap">
      Licensed Tennessee LLP 4747 · Veteran owned · Christian owned · © 2026 Angle Stop Plumbing, Inc. · <a href="/privacy-policy">Privacy Policy</a>
      <p class="disclaimer">Disclaimer: any tips or suggestions made within the content of this site serve as informational purposes only, anyone completing mentioned tips, suggestions acknowledge they have completed appropriate training, anyone completing tips, suggestions accept responsibility and risk of performing task, further indemnifying Angle Stop Plumbing, Inc., its ownership group, employees and affiliates.</p>
    </div>
  </div>
</footer>

<div class="mobile-bar">
  <a class="mb-call" href="{TEL}">Call now</a>
  <a class="mb-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule</a>
</div>

</body>
</html>
'''
    return doc.replace('{root}', root)


def service_page(path):
    meta, blocks = read_page(path)
    photos = PHOTOS.get(path, {})
    h1, lede, body = render_body(blocks, photos)
    group, top, subs = group_of(path)
    page_label = next((l for l, p in subs if p == path), meta['title'].split(' | ')[0])
    crumbs = ['<a href="/">Home</a>']
    if top and top != path:
        crumbs.append(f'<a href="{top}">{esc(subs[0][0])}</a>')
    crumbs.append(esc(page_label))
    hero_img = ''
    if 'hero' in photos:
        src, alt = photos['hero']
        hero_img = (f'\n    <img class="phero-img" src="{{root}}images/work/{src}" width="880" height="1100" '
                    f'alt="{esc(alt)}">')
    related = ''
    if subs:
        links = '\n'.join(f'      <a href="{p}"{current(p, path)}>{esc(l)}</a>'
                          for l, p in subs)
        related = f'\n    <div class="related">\n      <h3>{esc(group)}</h3>\n{links}\n    </div>'
    main = f'''<div class="hero phero">
  <div class="wrap">
    <div>
      <p class="crumbs">{'<span>/</span>'.join(crumbs)}</p>
      <h1>{esc(h1)}</h1>
      <p class="lede">{lede or ''}</p>
      <div class="actions">
        <a class="big-call" href="{TEL}">
          <small>Call now — we answer</small>
          <b>{PHONE}</b>
        </a>
        <a class="big-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule online</a>
      </div>
    </div>{hero_img}
  </div>
</div>

<div class="wrap page">
  <article class="prose">
{body}
  </article>
  <aside class="aside">
    <div class="help">
      <h3>Talk to a real person</h3>
      <p>Mon–Fri 6:30a–7p · Sat 6:30a–2p</p>
      <a class="big-call" href="{TEL}">
        <small>Call now — we answer</small>
        <b>{PHONE}</b>
      </a>
      <a class="big-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule online</a>
    </div>{related}
  </aside>
</div>'''
    og = photos.get('hero', ('card-water-heater.webp',))[0]
    return shell(path, meta, main, og)


def home_page():
    meta, _ = read_page('/')
    main = open(os.path.join(TEMPLATES, 'home.html'), encoding='utf-8').read().rstrip()
    return shell('/', meta, main, 'card-water-heater.webp')


def out_name(path):
    return 'index.html' if path == '/' else path.strip('/') + '.html'


PREVIEW_JS = '''<div id="soon" role="status" aria-live="polite" style="position:fixed;left:50%;bottom:84px;transform:translateX(-50%);
  max-width:min(92vw,420px);background:var(--navy);color:#fff;padding:12px 18px;border-radius:9px;font-size:15.5px;
  box-shadow:0 6px 20px rgba(7,29,55,.3);z-index:99;display:none;text-align:center"></div>
<script>
  (function () {
    var box = document.getElementById('soon'), t;
    document.addEventListener('click', function (e) {
      var a = e.target.closest('a[href^="/"]');
      if (!a) return;
      e.preventDefault();
      box.textContent = 'That page isn\\u2019t built yet. It\\u2019s on the list.';
      box.style.display = 'block';
      clearTimeout(t); t = setTimeout(function () { box.style.display = 'none'; }, 3200);
    });
  })();
</script>'''


def preview(doc, path):
    """Flatten a page for the artifact preview: assets at the root, links between
    built pages made relative, everything else caught by a notice."""
    depth = path.strip('/').count('/') if path != '/' else 0
    doc = doc.replace('href="' + '../' * depth, 'href="').replace('src="' + '../' * depth, 'src="') if depth else doc
    for p in BUILT:
        flat = 'index.html' if p == '/' else p.strip('/').replace('/', '__') + '.html'
        doc = doc.replace(f'href="{p}"', f'href="{flat}"')
    return doc.replace('</body>', PREVIEW_JS + '\n</body>')


def main():
    pages = {p: (home_page() if p == '/' else service_page(p)) for p in BUILT}
    if len(sys.argv) > 2 and sys.argv[1] == '--preview':
        out = sys.argv[2]
        os.makedirs(out, exist_ok=True)
        for p, doc in pages.items():
            flat = 'index.html' if p == '/' else p.strip('/').replace('/', '__') + '.html'
            open(os.path.join(out, flat), 'w', encoding='utf-8').write(preview(doc, p))
        print(f'preview: {len(pages)} pages in {out}')
        return
    for p, doc in pages.items():
        f = os.path.join(SITE, out_name(p))
        os.makedirs(os.path.dirname(f), exist_ok=True)
        open(f, 'w', encoding='utf-8').write(doc)
    print(f'built {len(pages)} pages')


if __name__ == '__main__':
    main()
