# Check every built page: each internal link goes to a page that exists, and each
# image, stylesheet or icon it loads is in site/.
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, 'site')
pages, bad = 0, 0
for dirpath, _, files in os.walk(SITE):
    for f in files:
        if not f.endswith('.html'):
            continue
        file = os.path.join(dirpath, f)
        doc = open(file, encoding='utf-8').read()
        pages += 1
        for kind, url in re.findall(r'\b(href|src)="([^"]+)"', doc):
            if url.startswith(('http', 'tel:', 'mailto:', '#', 'data:')):
                continue
            url = url.split('#')[0].split('?')[0]
            if url.startswith('/'):
                target = os.path.join(SITE, 'index.html' if url == '/' else url.strip('/'))
                ok = os.path.exists(target) or os.path.exists(target + '.html')
            else:
                ok = os.path.exists(os.path.normpath(os.path.join(dirpath, url)))
            if not ok:
                bad += 1
                print(f'{os.path.relpath(file, SITE)}: {kind} {url}')
print(f'{pages} pages checked, {bad} broken')
