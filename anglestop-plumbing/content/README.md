# Content pulled from the Wix site

The text of every page (`pages/`, laid out like the site's URLs) and every blog post (`posts/`) on anglestopplumbing.com, pulled on Oct 21, 2026. This is Jim's wording, and it is carried over to the new site as-is.

Each file starts with the page's title tag, meta description and canonical URL, then the page content in order:

- `#` and `##` are headings. `{bold}` marks a line Wix styled as a bold paragraph, which reads as a heading.
- `- ` is a list item.
- `<<url>>` follows text that links somewhere.
- `[button] Label -> url` is a button.
- `![alt](wix:media-id)` is an image on the Wix page.

To pull a fresh copy: `tools/fetch_wix.sh urls.txt raw/` downloads the pages, and `python3 -I tools/extract_wix.py raw/ text/` turns them into these files.
