# Extract the readable content of saved Wix pages into one Markdown-ish file per page.
# Keeps title, meta description, canonical, og:image, headings, paragraphs, list items,
# inline links ([[text|url]]), buttons and images, in document order, from <main> only.
import sys, os, re, json, html
from html.parser import HTMLParser

BLOCK = {'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote'}
SKIP = {'script', 'style', 'svg', 'noscript', 'template', 'button'}
SKIP_HOOKS = {'recent-posts', 'post-footer', 'post-stats', 'search-input', 'skeleton-loader'}
VOID = {'img', 'br', 'meta', 'link', 'input', 'hr', 'source', 'wbr', 'area', 'base', 'col', 'embed', 'param', 'track'}

def clean(t):
    return re.sub(r'\s+', ' ', t.replace('​', '')).strip()

class P(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.meta = {}; self.blocks = []
        self.in_main = 0; self.skip = 0; self.stack = []
        self.cur = None; self.link = None; self.in_title = False; self.title = ''
        self.li = 0; self.bold = 0; self.boldtxt = []
    def start(self, tag, a):
        self.stack.append((tag, a))
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == 'title': self.in_title = True
        if tag == 'meta':
            k = a.get('name') or a.get('property')
            if k in ('description', 'og:image', 'og:title', 'article:published_time', 'article:author', 'robots'):
                self.meta.setdefault(k, a.get('content', ''))
        if tag == 'link' and a.get('rel') == 'canonical': self.meta['canonical'] = a.get('href', '')
        if tag in VOID:
            if tag == 'img' and self.in_main and not self.skip:
                src = a.get('src', '') or ''
                m = re.search(r'static\.wixstatic\.com/media/([^/?#]+)', src)
                if m: self.flush(); self.blocks.append(('img', m.group(1), clean(a.get('alt', ''))))
            if tag == 'br' and self.cur is not None: self.cur.append(' ')
            return
        mainflag = tag == 'main'
        boldflag = tag in ('b', 'strong') or 'font-weight:bold' in (a.get('style') or '').replace(' ', '')
        liflag = tag == 'li'
        skipflag = tag in SKIP or a.get('data-hook') in SKIP_HOOKS or tag in ('header', 'footer', 'nav')
        self.stack.append((tag, mainflag, skipflag, boldflag, liflag))
        if mainflag: self.in_main += 1
        if skipflag: self.skip += 1
        if boldflag: self.bold += 1
        if liflag: self.li += 1
        if not self.in_main or self.skip: return
        if tag in BLOCK:
            self.flush(); self.cur = []; self.boldtxt = []
            self.curtag = 'li' if (tag == 'p' and self.li) else tag
        if tag == 'a' and a.get('href'):
            self.link = (a['href'], len(self.cur) if self.cur is not None else None, [])
    def handle_endtag(self, tag):
        if tag == 'title': self.in_title = False
        if tag in VOID: return
        while self.stack:
            t, mainflag, skipflag, boldflag, liflag = self.stack.pop()
            if mainflag: self.in_main -= 1
            if skipflag: self.skip -= 1
            if boldflag: self.bold -= 1
            if liflag: self.li -= 1
            if t == 'a' and self.link:
                href, pos, txt = self.link; text = clean(''.join(txt)); self.link = None
                if text and self.cur is None and self.in_main and not self.skip:
                    self.blocks.append(('button', text, href))
                elif text and self.cur is not None and pos is not None:
                    inner = ''.join(self.cur[pos:])
                    self.cur[pos:] = [f'[[{inner}|{href}]]']
            if t in BLOCK and self.cur is not None and (t == self.curtag or (t == 'p' and self.curtag == 'li')):
                self.flush()
            if t == tag: break
    def handle_data(self, d):
        if self.in_title: self.title += d
        if not self.in_main or self.skip: return
        if self.link is not None: self.link[2].append(d)
        if self.cur is not None:
            self.cur.append(d)
            if self.bold: self.boldtxt.append(d)
    def flush(self):
        if self.cur is not None:
            t = clean(''.join(self.cur))
            tag = self.curtag
            # Wix often styles subheadings as a fully bold paragraph
            plain = clean(re.sub(r'\[\[(.*?)\|[^\]]*\]\]', r'\1', t))
            if tag == 'p' and len(plain) < 120 and clean(''.join(self.boldtxt)) == plain and not plain.endswith('.'):
                tag = 'hb'
            if t: self.blocks.append((tag, t))
        self.cur = None

def render(p):
    out = []
    m = p.meta
    out.append(f"title: {clean(p.title)}")
    for k in ('description', 'canonical', 'og:image', 'article:published_time', 'robots'):
        if m.get(k): out.append(f"{k}: {m[k]}")
    out.append('---')
    prev = None
    for b in p.blocks:
        if b == prev: continue
        prev = b
        k = b[0]
        if k == 'img': out.append(f"![{b[2]}](wix:{b[1]})")
        elif k == 'button': out.append(f"[button] {b[1]} -> {b[2]}")
        elif k == 'hb': out.append('## ' + b[1] + '  {bold}')
        elif k[0] == 'h': out.append('#' * int(k[1]) + ' ' + b[1])
        elif k == 'li': out.append('- ' + b[1])
        elif k == 'blockquote': out.append('> ' + b[1])
        else: out.append(b[1])
    return '\n\n'.join(out) + '\n'

src, dst = sys.argv[1], sys.argv[2]
for f in sorted(os.listdir(src)):
    if not f.endswith('.html'): continue
    p = P(); p.feed(open(os.path.join(src, f), encoding='utf-8', errors='replace').read())
    open(os.path.join(dst, f[:-5] + '.md'), 'w').write(render(p))
print('done')
