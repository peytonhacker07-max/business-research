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

# Pages built so far. Everything else still links to its real URL.
BUILT = ['/'] + [p for _, top, subs in MENU for p in [top] + [s for _, s in subs]
                 if p not in ('/', '/about', '/blog')]
BUILT = list(dict.fromkeys(BUILT))

# Jim's job photos, in site/images/work/. Each page gets a hero photo and
# photos placed through the text: by heading ('after') or spread out ('inline').
HERO = {
    'conventional': 'Bradford White gas water heater installed in an unfinished utility room',
    'heat-pump': 'Bradford White heat pump water heater installed in a garage',
    'tankless': 'Navien tankless water heater mounted on an outside brick wall',
    'filters': 'Whole-house water filters plumbed beside a water heater in a garage',
    'filters-closet': 'Three whole-house water filters installed in a utility closet',
    'ro': 'iSpring reverse osmosis system installed under a sink',
    'brass-shower': 'Antique-style brass rain shower trimmed out on patterned tile',
    'backflow': 'Backflow preventer on the outside wall of a brick building',
    'smart-valve': 'Smart water shut-off valve control panel showing the water on',
    'drain-vent': 'New PVC drain and vent piping under a floor',
    'repipe': 'New PEX water lines run through an open ceiling during a repipe',
    'sewer': 'New sewer line laid in an open trench beside a house',
    'shower-trim': 'Matte black shower trim on marble tile',
    'frozen-pipe': 'Water pipe in an attic that froze and ruptured',
    'commercial-repair': 'Commercial water heater after repair',
    'commercial-install': 'New commercial Bradford White water heater with copper piping',
    'hand-sink': 'Commercial stainless steel hand sink after repair',
    'tub': 'Freestanding tub with a floor-mounted brass filler',
    'electric-closet': 'Bradford White electric water heater installed in a closet',
    'tankless-flush': 'Tankless water heater being flushed during annual service',
}
INLINE = {
    'gas-flame': ('Gas water heater burner with a clean blue flame', 'Gas water heater with a proper flame'),
    'conventional': ('Bradford White electric water heater installed in a closet', 'Bradford White electric water heater install'),
    'heat-exchanger': ('Tankless water heater heat exchanger removed for repair', 'Tankless water heater repair'),
    'tankless-open': ('Tankless water heater opened up for service', 'Tankless water heater service'),
    'smart-valve': ('Smart shut-off valve on the main water line in a crawlspace', 'Smart shut-off valve install'),
    'drain-clog': ('Drain pipe cut open showing a blockage', 'Drain blockage repair'),
    'leaking-pipe': ('Repairing a leaking copper pipe in a crawlspace', 'Leaking pipe repair'),
    'burst-pipe': ('Burst copper pipe in a crawlspace, repaired with a new section', 'Burst pipe repair in a crawlspace'),
    'sewer-crawlspace': ('New sewer piping run through a crawlspace', 'Sewer pipe repair'),
    'vanity': ('Double vanity with brass faucets, installed', 'Double vanity install with fixtures'),
    'toilet': ('New toilet installed on a marble tile floor', 'Toilet replacement'),
    'tub': ('Freestanding tub with a floor-mounted brass filler', 'Freestanding tub install'),
    'commercial-heater': ('Commercial Bradford White water heater with new copper piping', 'Commercial water heater replacement'),
    'commercial-toilet': ('Commercial toilet flush valve after repair', 'Commercial toilet repair'),
    'filters': ('Whole-house water filters plumbed in a garage', 'Whole-house water filters'),
    'ro': ('iSpring reverse osmosis system under a sink', 'Reverse osmosis water filtration'),
    'slab-leak': ('Wall opened up to reach leaking water lines', 'Concrete slab leak repair'),
}


def photos(hero, *inline):
    return {'hero': (f'hero-{hero}.webp', HERO[hero]),
            'inline': [(f'in-{k}.webp',) + INLINE[k] for k in inline]}


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
    WH + '/conventional-tank-water-heater-murfreesboro-tn': photos('conventional', 'gas-flame', 'conventional'),
    WH + '/heat-pump-hybrid-water-heater-murfreesboro-tn': photos('heat-pump'),
    WH + '/tankless-water-heater-murfreesboro-tn': photos('tankless', 'heat-exchanger', 'tankless-open'),
    WF: photos('filters-closet', 'ro', 'filters'),
    WF + '/water-softener-services-murfreesboro-tn': photos('filters'),
    WF + '/reverse-osmosis-murfreesboro-tn': photos('ro'),
    WF + '/water-descaling-murfreesboro-tn': photos('filters'),
    WF + '/uv-water-filtration-murfreesboro-tn': photos('filters-closet'),
    WF + '/whole-house-water-filtration-murfreesboro-tn': photos('filters-closet', 'filters'),
    RES: photos('brass-shower', 'vanity', 'burst-pipe'),
    RES + '/residential-backflow-testing': photos('backflow'),
    RES + '/residential-backflow-repair': photos('backflow'),
    RES + '/smart-plumbing-valves-leak-detection-murfreesboro-tn': photos('smart-valve', 'smart-valve'),
    RES + '/drain-services-murfreesboro-tn': photos('drain-vent', 'drain-clog'),
    RES + '/water-pipe-repair-services-murfreesboro-tn': photos('repipe', 'leaking-pipe', 'burst-pipe', 'slab-leak'),
    RES + '/sewer-pipe-repair-services-murfreesboro-tn': photos('sewer', 'sewer-crawlspace'),
    RES + '/plumbing-fixture-services-murfreesboro-tn': photos('shower-trim', 'vanity', 'toilet', 'tub'),
    RES + '/emergency-plumbing-services-murfreesboro-tn': photos('frozen-pipe', 'burst-pipe'),
    COM: photos('commercial-repair', 'commercial-heater', 'commercial-toilet'),
    COM + '/commercial-water-heater-repair': photos('commercial-repair'),
    COM + '/commercial-water-heater-installation': photos('commercial-install'),
    COM + '/commercial-backflow-preventer-testing': photos('backflow'),
    COM + '/commercial-backflow-preventer-repair': photos('backflow'),
    COM + '/commercial-leak-repair': photos('hand-sink', 'slab-leak'),
    PAY: photos('tub'),
    PAY + '/plumbing-lease-options-murfreesboro-tn': photos('filters-closet'),
    PAY + '/plumbing-finance-options-murfreesboro-tn': photos('electric-closet'),
    MEM: photos('tankless-flush'),
    MEM + '/silver-pipe-membership-plan': photos('tankless-flush'),
    MEM + '/gold-pipe-membership-plan': photos('tankless-flush'),
    MEM + '/platinum-pipe-membership': photos('tankless-flush'),
}

# Real Google reviews (the same ones as on the homepage), shown beside the
# text on inner pages: (quote, name, what the job was).
REVIEWS = {
    'ochenkoski': ("Jim has completed two separate jobs for me at my house. On each occasion, he was very flexible with "
                   "scheduling and responsive to my needs. I've been very pleased with his work and his friendly, "
                   "professional manner. He's definitely my go-to guy for all things plumbing!",
                   'Jim Ochenkoski', 'Two jobs, same house'),
    'robbie': ("Jim from Angle Stop Plumbing was outstanding. He arrived early, diagnosed the issue quickly, and "
               "repaired my parents' hot water heater with a high level of professionalism. He took the time to "
               "explain every step to my Dad…", 'robbie smith', 'Water heater repair'),
    'kovacik': ("Got my new Bradford White AeroTherm Series G2 Hybrid Electric Heat Pump Water Heater installed today "
                "by Angle Stop Plumbing! Jim did an outstanding job and I look forward to getting my water conditioner "
                "and purifier installed soon as well! Thanks Jim for everything!", 'Michael Kovacik', 'Heat pump water heater'),
    'schmidt': ("We had Jim (Angle Stop) install a new Navien tankless water heater, upgrade our natural gas main line, "
                "install an iSpring whole filter and descaler and install an automated water shutoff that integrates "
                "with our home automation system…", 'Mark Schmidt', 'Tankless, gas line & filtration'),
    'jackson': ("Once again, Angle Stop Plumbing came to the rescue when our hybrid water heater failed prematurely. He "
                "also went above and beyond the call of duty to help us file our warranty reimbursement claim. "
                "Excellent in every way!", 'Gary Jackson', 'Hybrid water heater · repeat customer'),
    'kirby': ("I recently had Angle Stop Plumbing come out for a Water Heater service and to inspect a leak. Jim and "
              "Hunter showed up on time and once everything was inspected Jim explained and showed me what needed to "
              "be done…", 'E.J. Kirby', 'Water heater service & leak inspection'),
}
REVIEW_FOR = {
    WH: 'kirby',
    WH + '/conventional-tank-water-heater-murfreesboro-tn': 'robbie',
    WH + '/heat-pump-hybrid-water-heater-murfreesboro-tn': 'kovacik',
    WH + '/tankless-water-heater-murfreesboro-tn': 'schmidt',
    RES + '/smart-plumbing-valves-leak-detection-murfreesboro-tn': 'schmidt',
    PAY: 'jackson', MEM: 'jackson',
}
REVIEW_GROUP = {WF: 'schmidt', PAY: 'jackson', MEM: 'jackson'}
GOOGLE_REVIEWS = 'https://www.google.com/search?q=Angle+Stop+Plumbing+Murfreesboro'

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


TIER = re.compile(r'Membership [IV]+:?$')


def figure(src, alt, cap):
    return (f'<figure>\n  <img src="{{root}}images/work/{src}" width="960" height="720" '
            f'loading="lazy" alt="{esc(alt)}">\n  <figcaption>{esc(cap)}</figcaption>\n</figure>')


def render_body(blocks, photos):
    """Render content blocks into a dict: h1, lede, buttons above the h1, and body html."""
    h1, lede, out, items, top_buttons = None, None, [], [], []
    after = dict((photos or {}).get('after', {}))
    spread = list((photos or {}).get('inline', []))
    pending, pending_spread = None, False  # photo waiting for the paragraph after its heading
    h2s = 0
    tiers, tier = [], None  # membership plan levels, shown side by side

    def flush_list():
        if items:
            out.append('<ul>\n' + '\n'.join(f'  <li>{inline(i)}</li>' for i in items) + '\n</ul>')
            items.clear()

    def flush_tiers():
        if tiers:
            cards = []
            for t in tiers:
                body = (f'<p>{inline(t["text"])}</p>' if t['text'] else
                        '<ul>' + ''.join(f'<li>{inline(i)}</li>' for i in t['items']) + '</ul>')
                cards.append(f'  <div class="plan">\n    <h3>{esc(t["name"])}</h3>\n    {body}\n  </div>')
            out.append('<div class="plans">\n' + '\n'.join(cards) + '\n</div>')
            tiers.clear()

    for b in blocks:
        if tier is not None:
            if b.startswith('- '):
                tier['items'].append(b[2:])
                continue
            if not tier['items'] and not tier['text'] and not b.startswith(('#', '[', '!')):
                tier['text'] = b
                continue
            tier = None
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
        if m and TIER.search(plain(m.group(2))):
            tier = {'name': plain(m.group(2)).rstrip(':'), 'text': '', 'items': []}
            tiers.append(tier)
            continue
        flush_tiers()
        if m:
            text = m.group(2).replace('{bold}', '').strip()
            level = 3 if len(m.group(1)) >= 3 else 2
            out.append(f'<h{level}>{inline(text)}</h{level}>')
            hit = after.pop(plain(text), None)
            if pending and pending_spread:
                spread.insert(0, pending)  # not placed yet: try the next heading
            pending, pending_spread = hit, False
            if level == 2:
                h2s += 1
                if spread and pending is None and h2s % 3 == 1:
                    pending, pending_spread = spread.pop(0), True
            continue
        if b.startswith('[button] '):
            label, url = b[9:].rsplit(' -> ', 1)
            if h1 is None:
                top_buttons.append(a_tag(esc(label), url, 'pq'))
            else:
                out.append(f'<p class="btnrow">{a_tag(esc(label), url, "big-book")}</p>')
            continue
        if h1 and lede is None and not out:
            lede = inline(b)
            continue
        out.append(f'<p>{inline(b)}</p>')
        if pending:
            out.append(figure(*pending))
            pending = None
    flush_list()
    flush_tiers()
    if after:
        sys.exit(f'Photo headings not found: {list(after)}')
    for p in spread:  # pages with few headings: remaining photos go at the end
        out.append(figure(*p))
    return {'h1': h1, 'lede': lede, 'buttons': top_buttons, 'body': '\n\n'.join(out)}


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


def review_card(path, top):
    key = REVIEW_FOR.get(path) or REVIEW_GROUP.get(top) or 'ochenkoski'
    quote, name, job = REVIEWS[key]
    return (f'\n    <div class="side-rev">\n      <span class="stars">★★★★★</span>\n'
            f'      <q>{esc(quote)}</q>\n      <p class="who"><b>{esc(name)}</b> · {esc(job)}</p>\n'
            f'      <a href="{GOOGLE_REVIEWS}" target="_blank" rel="noopener">Read all 124 Google reviews →</a>\n    </div>')


def service_page(path):
    meta, blocks = read_page(path)
    photos = PHOTOS.get(path, {})
    page = render_body(blocks, photos)
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
    lede = f'\n      <p class="lede">{page["lede"]}</p>' if page['lede'] else ''
    prequal = ''
    if page['buttons']:
        prequal = '\n      <p class="prequal">' + ' '.join(page['buttons']) + '</p>'
    related = ''
    if subs:
        links = '\n'.join(f'      <a href="{p}"{current(p, path)}>{esc(l)}</a>'
                          for l, p in subs)
        related = f'\n    <div class="related">\n      <h3>{esc(group)}</h3>\n{links}\n    </div>'
    main = f'''<div class="hero phero{'' if hero_img else ' solo'}">
  <div class="wrap">
    <div>
      <p class="crumbs">{'<span>/</span>'.join(crumbs)}</p>
      <h1>{esc(page['h1'])}</h1>{lede}
      <div class="actions">
        <a class="big-call" href="{TEL}">
          <small>Call now — we answer</small>
          <b>{PHONE}</b>
        </a>
        <a class="big-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule online</a>
      </div>{prequal}
    </div>{hero_img}
  </div>
</div>

<div class="wrap page">
  <article class="prose">
{page['body']}
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
    </div>{review_card(path, top)}{related}
  </aside>
</div>'''
    og = photos.get('hero', ('card-water-heater.webp',))[0]
    return shell(path, meta, main, og)


def home_page():
    meta, _ = read_page('/')
    main = open(os.path.join(TEMPLATES, 'home.html'), encoding='utf-8').read().rstrip()
    return shell('/', meta, main, 'card-water-heater.webp')


def not_found_page():
    meta = {'title': 'Page not found | Angle Stop Plumbing', 'robots': 'noindex',
            'description': 'Angle Stop Plumbing, Murfreesboro and Middle Tennessee.', 'canonical': DOMAIN}
    main = f'''<div class="hero phero solo">
  <div class="wrap">
    <div>
      <h1>We can't find that page.</h1>
      <p class="lede">It may have moved. You can head to the <a href="/" style="color:#fff">homepage</a>, or call and we'll help you out.</p>
      <div class="actions">
        <a class="big-call" href="{TEL}">
          <small>Call now — we answer</small>
          <b>{PHONE}</b>
        </a>
        <a class="big-book" href="{WORKIZ}" target="_blank" rel="noopener">Schedule online</a>
      </div>
    </div>
  </div>
</div>'''
    # absolute asset paths: the 404 page is served at whatever URL was missing
    return shell('/', meta, main, 'card-water-heater.webp').replace('href="images/', 'href="/images/') \
        .replace('src="images/', 'src="/images/').replace('href="css/', 'href="/css/')


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
    open(os.path.join(SITE, '404.html'), 'w', encoding='utf-8').write(not_found_page())
    urls = '\n'.join(f'  <url><loc>{DOMAIN}{"" if p == "/" else p}</loc></url>' for p in pages)
    open(os.path.join(SITE, 'sitemap.xml'), 'w', encoding='utf-8').write(
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + '\n</urlset>\n')
    open(os.path.join(SITE, 'robots.txt'), 'w', encoding='utf-8').write(
        f'User-agent: *\nAllow: /\n\nSitemap: {DOMAIN}/sitemap.xml\n')
    print(f'built {len(pages)} pages, 404.html, sitemap.xml, robots.txt')


if __name__ == '__main__':
    main()
