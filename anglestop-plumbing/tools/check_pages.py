# Check built pages and blog posts against the pulled Wix content: every line of
# Jim's text is present, and the title, meta description and canonical URL match exactly.
# Blog posts had no meta description on Wix; theirs is the start of the post.
import html, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import build  # noqa: E402

def norm(t):
    return re.sub(r'\s+', ' ', html.unescape(t)).strip()

problems = 0
posts = {p['path']: p for p in build.load_posts()}
for path in build.BUILT + list(posts):
    if path == '/':
        continue  # the homepage body is hand-written in templates/home.html
    if path in posts:
        meta, blocks = posts[path]['meta'], posts[path]['blocks']
        meta = dict(meta, description=meta.get('description', posts[path]['excerpt']))
    else:
        meta, blocks = build.read_page(path)
    doc = open(os.path.join(build.SITE, build.out_name(path)), encoding='utf-8').read()
    text = norm(re.sub(r'<[^>]+>', ' ', re.sub(r'</?a\b[^>]*>', '', doc)))
    head = {
        'title': re.search(r'<title>(.*?)</title>', doc).group(1),
        'description': re.search(r'<meta name="description" content="([^"]*)"', doc).group(1),
        'canonical': re.search(r'<link rel="canonical" href="([^"]*)"', doc).group(1),
    }
    for k, v in head.items():
        if norm(v) != norm(meta.get(k, '')):
            print(f'{path}: {k} differs\n  wix: {meta.get(k)}\n  new: {norm(v)}'); problems += 1
    for b in blocks:
        if b.startswith('!['):
            continue
        t = b
        if t.startswith('[button] '):
            t = t[9:].rsplit(' -> ', 1)[0]
        t = re.sub(r'^(#{1,6}|-) ', '', t).replace('{bold}', '')
        t = norm(build.LINK.sub(r'\1', t)).rstrip(':')  # plan cards drop the trailing colon
        if t and t not in text:
            print(f'{path}: missing: {t[:90]}'); problems += 1
print(f'{len(build.BUILT) - 1 + len(posts)} pages checked, {problems} problems')
