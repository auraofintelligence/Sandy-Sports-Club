"""Build image-gallery.html: the owner's review page for every site image.

Section 1 lists the originals from commit b1964e4. Section 2 lists every image added
since. Each image shows its filename, where it is or was used, and its status.
Where a newer image replaced an original in the same slot, the two sit side by side.
The page is noindex, outside the main navigation, linked only from the Webmaster page,
and exempt from the zero-reuse and card image tests by design.
Run after any image or page change: python3 tools/build-gallery.py
"""
import json, os, re, subprocess
from html import escape

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
BASE = 'b1964e4'
OUT = 'image-gallery.html'
IMG = re.compile(r'\.(webp|png|jpe?g|gif|avif)$', re.I)
BRAND = {'sandy-original-logo.png', 'sandy-original-icon.png', 'mozzie.webp'}


def git(*a):
    return subprocess.run(['git', *a], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def slots(html):
    """Yield (image, slot key, slot label) for every <img> in a page."""
    out = []
    for si, sec in enumerate(re.split(r'(?=<section\b)', html)):
        hero = sec.startswith('<section class="page-hero')
        fig_n = 0
        for m in re.finditer(r'<img\b[^>]*src="/?assets/([\w.-]+)"[^>]*>', sec):
            img = m.group(1)
            before = sec[:m.start()]
            if hero:
                out.append((img, 'hero', 'page banner'))
                continue
            art = before.rfind('<article')
            if art != -1 and before.rfind('</article>') < art:
                end = sec.find('</article>', m.end())
                after = sec[m.end():end if end != -1 else m.end() + 1500]
                t = re.search(r'<h3>(?:<a [^>]*>)?([^<]*)', after)
                h = re.search(r'<a href="([^"]*)"', after)
                title = t.group(1).strip() if t else ''
                out.append((img, 'card:' + title + '|' + (h.group(1) if h else ''), f'card "{title}"'))
                continue
            fig_n += 1
            cap = re.search(r'<figcaption>([^<]{0,70})', sec[m.end():m.end() + 600])
            label = 'figure' + (f' "{cap.group(1).strip()}"' if cap else '')
            out.append((img, 'fig:%d:%d' % (si, fig_n), label))
    return out


def page_usage(read, pages):
    use = {}
    for p in pages:
        if p == OUT:
            continue
        try:
            html = read(p)
        except Exception:
            continue
        for img, key, label in slots(html):
            use.setdefault(img, []).append((p, key, label))
    return use


def pages_at(rev):
    return [f for f in git('ls-tree', '--name-only', rev).split() if f.endswith('.html')]


def main():
    os.chdir(ROOT)
    originals = sorted(f[7:] for f in git('ls-tree', '--name-only', BASE, 'assets/').split() if IMG.search(f))
    now_files = sorted(f for f in os.listdir('assets') if IMG.search(f) and not re.search(r'-\d+w\.', f))
    # The balanced club set is proposed only: shown in its own section, not on any page.
    balanced = json.load(open(os.path.join('tools', 'balanced-set.json')))
    balanced_files = {f'balanced-{n}-{slug}.webp' for n, slug, *_ in balanced}
    new = [f for f in now_files if f not in originals and f not in balanced_files]
    cur_pages = sorted(f for f in os.listdir('.') if f.endswith('.html'))
    current = page_usage(lambda p: open(p).read(), cur_pages)
    # Brand marks are drawn by site.js in the header and footer.
    site_js = open('site.js').read()
    for b in BRAND:
        if b in site_js:
            current.setdefault(b, []).append(('every page', 'brand', 'site header or footer mark'))
    revs = [BASE] + git('rev-list', '--reverse', BASE + '..HEAD').split()
    history = {}
    for rev in revs:
        use = page_usage(lambda p, r=rev: git('show', f'{r}:{p}'), pages_at(rev))
        for img, places in use.items():
            for pl in places:
                history.setdefault(img, set()).add(pl)
    orig_use = page_usage(lambda p: git('show', f'{BASE}:{p}'), pages_at(BASE))

    def where(img):
        now = current.get(img, [])
        was = sorted(history.get(img, set()) - set(now))
        if now:
            status = 'Live now'
        elif was:
            status = 'Removed from the site'
        else:
            status = 'Unused'
        lines = [f'{escape(p)}: {escape(l)}' for p, _, l in now]
        old = [f'{escape(p)}: {escape(l)}' for p, _, l in was]
        return status, lines, old

    def figure(img, extra=''):
        status, now, was = where(img)
        cls = {'Live now': 'live', 'Removed from the site': 'removed', 'Unused': 'unused'}[status]
        parts = [f'<figure class="gallery-item"><img src="/assets/{img}" alt="{escape(img)}" loading="lazy">',
                 f'<figcaption><strong>{escape(img)}</strong> <span class="gallery-status {cls}">{status}</span>']
        if now:
            parts.append('<span>Used now: ' + '; '.join(now) + '</span>')
        if was:
            parts.append('<span>Used before: ' + '; '.join(was) + '</span>')
        if not now and not was:
            parts.append('<span>Not placed on any page yet.</span>')
        if extra:
            parts.append(f'<span>{extra}</span>')
        parts.append('</figcaption></figure>')
        return ''.join(parts)

    # Side by side pairs: an original slot now showing a different image.
    cur_by_slot = {}
    for img, places in current.items():
        for p, key, label in places:
            cur_by_slot[(p, key)] = img
            if key.startswith('card:'):
                t, h = key[5:].split('|', 1)
                cur_by_slot[(p, 'title:' + t)] = img
                if h:
                    cur_by_slot[(p, 'href:' + h)] = img

    def now_in(p, key):
        if not key.startswith('card:'):
            return cur_by_slot.get((p, key))
        t, h = key[5:].split('|', 1)
        return cur_by_slot.get((p, 'title:' + t)) or (cur_by_slot.get((p, 'href:' + h)) if h else None)
    pairs = []
    for img, places in sorted(orig_use.items()):
        for p, key, label in places:
            if key.startswith('fig:'):
                continue
            now = now_in(p, key)
            if now != img:
                pairs.append((p, label, img, now))
    pair_html = []
    for p, label, old, now in pairs:
        right = figure(now) if now else '<figure class="gallery-item gallery-empty"><figcaption>This slot has no image now, or the card was renamed or removed.</figcaption></figure>'
        pair_html.append(f'<div class="gallery-pair"><h3>{escape(p)}: {escape(label)}</h3><div class="gallery-pair-grid"><div><p class="eyebrow">ORIGINAL</p>{figure(old)}</div><div><p class="eyebrow">IN THAT SLOT NOW</p>{right}</div></div></div>')

    def count(files):
        c = {'Live now': 0, 'Removed from the site': 0, 'Unused': 0}
        for f in files:
            c[where(f)[0]] += 1
        return ', '.join(f'{v} {k.lower()}' for k, v in c.items())

    body = (
        '<section class="page-section gallery-intro"><p class="eyebrow">OWNER REVIEW</p><h1>Image gallery</h1>'
        '<p class="lead">Every image on the Sandy Sports proposal site, for comparing the originals with the newer images. '
        'Each image shows its filename, the page and slot where it is used or was used, and whether it is live now, removed from the site or unused. '
        'This review page is not in the main navigation and asks search engines not to index it. Concept images are concepts, not approved designs.</p>'
        f'<p>{len(originals)} originals ({count(originals)}). {len(new)} newer images ({count(new)}).</p>'
        '<p><a class="button outline" href="#originals">Originals</a> <a class="button outline" href="#side-by-side">Side by side</a> <a class="button outline" href="#new">New images</a> <a class="button outline" href="#balanced">Balanced club set (proposed)</a></p></section>'
        f'<section class="page-section alt" id="originals"><p class="eyebrow">SECTION 1</p><h2>Originals</h2><p class="lead">The {len(originals)} images in the site as of commit {BASE}, including the ones that were later deleted and have been restored as files so they display here.</p>'
        '<div class="gallery-grid">' + ''.join(figure(f) for f in originals) + '</div></section>'
        '<section class="page-section" id="side-by-side"><p class="eyebrow">COMPARE</p><h2>Originals and their replacements</h2><p class="lead">Each pair shows an original next to the image that sits in the same slot now.</p>'
        + (''.join(pair_html) or '<p>No original slot shows a different image now.</p>') + '</section>'
        f'<section class="page-section alt" id="new"><p class="eyebrow">SECTION 2</p><h2>New images</h2><p class="lead">Every image added since commit {BASE}.</p>'
        '<div class="gallery-grid">' + ''.join(figure(f) for f in new) + '</div></section>'
    )
    ages = {}
    for _, _, age, _, _ in balanced:
        ages[age] = ages.get(age, 0) + 1
    bal = []
    for n, slug, age, desc, slot in balanced:
        f = f'balanced-{n}-{slug}.webp'
        assert os.path.exists(os.path.join('assets', f)), f
        assert f not in current, f + ' is proposed only and must not be on a page'
        bal.append(f'<figure class="gallery-item"><img src="/assets/{f}" alt="Concept image of {escape(desc[0].lower() + desc[1:])}" loading="lazy">'
                   f'<figcaption><strong>{escape(f)}</strong> <span class="gallery-status unused">Proposed, not on any page</span>'
                   f'<span>Ages shown: {escape(age)}</span><span>{escape(desc)}</span><span>Could suit: {escape(slot)}</span></figcaption></figure>')
    body += (
        '<section class="page-section" id="balanced"><p class="eyebrow">SECTION 3</p><h2>Balanced club set (proposed)</h2>'
        f'<p class="lead">{len(balanced)} new concept images showing a natural mix of ages across the club: '
        + ', '.join(f'{v} {k.lower()}' for k, v in ages.items()) +
        '. Every junior and teen scene shows coaches or adults supervising and everyone in sportswear. '
        'None of these are on the live pages; each caption names a slot it could suit, and the owner chooses.</p>'
        '<div class="gallery-grid">' + ''.join(bal) + '</div></section>')
    html = ('<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">'
            '<meta name="robots" content="noindex, nofollow"><meta name="theme-color" content="#102d40">'
            '<meta name="description" content="Owner review gallery of every Sandy Sports image.">'
            '<title>Image gallery | Sandy Sports Club proposal</title><link rel="icon" href="/favicon.png" type="image/png">'
            '<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/pages.css"><script src="/site.js" defer></script></head>'
            f'<body><div data-site-header></div><main id="main">{body}</main><div data-site-footer></div></body></html>')
    open(OUT, 'w').write(html)
    print(OUT, len(originals), 'originals,', len(new), 'new,', len(pairs), 'pairs,', len(balanced), 'proposed')


if __name__ == '__main__':
    main()
