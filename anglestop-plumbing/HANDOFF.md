# Angle Stop Plumbing site: where things stand

Read this first when picking the project up in a new session.

## The job

Peyton is rebuilding anglestopplumbing.com for Angle Stop Plumbing, Inc. (owner Jim Nephew, Murfreesboro TN, (615) 398-3048). The site moves off Wix to plain HTML/CSS on Cloudflare Pages. Price: $1,000 for the site, plus $250/month for 4 Facebook posts, cross-posted to his Google Business Profile.

Peyton is new to freelancing and wants blunt, honest advice. Jim is older: texts to him should be short, plain, and written for an iPhone (no hard line breaks).

## Decisions already made

- **Keep every page.** The site has 39 pages and 124 blog posts. Google organic traffic is up 166% year over year, so do not merge or rename pages. Keep each URL, title tag and meta description exactly as they are on Wix.
- **Carry text over as-is.** The $1,000 covers moving his existing wording, not rewriting it. Never invent page copy.
- **Hosting: Cloudflare Pages.** Vercel's free plan bans commercial use, and Netlify's free plan has a credit cap.
- **The DNS moves in two steps,** each one only with Jim's OK ("one step at a time"). The plan and the full Wix DNS backup are in `dns/`.
- **Email** is Google Workspace (billed through Wix). The MX records must survive the move. Mailchimp DKIM records are in the backup.
- **Booking** uses Workiz, which works with any site. Every booking button links to `https://online-booking.workiz.com/?ac=fb4a367aaef910833ab1ecc026d212793c52c4b6d2f4066a884b0f0392bd01de`.
- **Photos** come from Jim's Google Drive "Job Photos" folder. See `photos.md` for what is used where. Never use a photo showing a face, a reflection of a person, a house number or a license plate. Never use customers' Google review photos.

## How the site is built

- `content/pages/` and `content/posts/` hold the text of all 39 pages and 124 blog posts, pulled from the live Wix site on Oct 21, 2026 (see `content/README.md`). This is the source of truth for Jim's wording.
- `build.py` renders pages into `site/` with one shared layout: header, the menu (which mirrors the Wix menu), sidebar and footer. `templates/home.html` is the homepage body. `site/css/site.css` is the stylesheet.
- `BUILT` in `build.py` lists the pages generated so far. `PHOTOS` places Jim's job photos on each page.
- `python3 build.py` writes `site/`. `python3 build.py --preview DIR` writes a flat copy for the artifact preview, where links between built pages work and other links show a "not built yet" notice.

## Done

- The homepage, with real Google reviews, job photos, Jim's vector logo, and his exact title and meta description.
- All 33 service, membership and payment pages, with Jim's photos and a matching Google review beside the text. `tools/check_pages.py` confirms every line of his text and every title, description and canonical URL match the Wix site.
- About, Careers, Privacy Policy, Request a Bible, the blog index, the Water Heater category page and all 124 blog posts (`/post/<slug>`, with Jim's images converted to WebP), plus `blog-feed.xml`.
- `sitemap.xml`, `robots.txt`, a `404.html` page, and business details for Google (Plumber structured data with hours and service area) on the homepage.
- `tools/check_pages.py` (every line of text, title, description and canonical URL) and `tools/check_links.py` (no broken internal links or images) both pass.
- `dns/`: the Wix DNS export and the migration and rollback plan.
- Preview: https://claude.ai/artifact/XrkThiBJ5T1Yb4FYbjhhb1 (private to Peyton).

## Next

1. **Request a Bible form:** set `BIBLE_FORM_ENDPOINT` in `build.py` to a form service (for example Web3Forms, signed up with Jim's email) before launch. Until then the form opens the visitor's email app with the request filled in.
2. **The blog runs on autopilot.** A new post has gone up every two days at about 10 PM Central since September 2026. That is an automated service, probably an SEO company or a Wix tool. Leaving Wix would cut it off, so Jim has to say who runs it before the move. It may also be behind the 166% traffic growth.
3. **The agreement** is ready to send (a Claude Doc: https://claude.ai/code/artifact/35193b0d-bf97-4caf-b634-9a91cdb29bfa). Terms: $500 when Jim approves the new site, $500 when it is live, launch within 2 weeks of signing. Call with Jim set for Wed Oct 28, 5 pm Central, on Google Meet: show the site, get the agreement signed, find out who runs the blog.
4. **Waiting on Jim:** who posts his blog; a photo of himself and of his truck; confirming the service-area towns on the homepage.
5. **Later:** DNS step 1; clean up Workiz (services listed at $0.00 and truncated service names).

## Gotchas

- Tested with `wrangler pages dev site` (Oct 26, 2026): every page serves at its Wix URL with a 200, including parent pages whose sub-pages sit in a folder of the same name. Trailing slashes and `.html` redirect (308) to the clean URL. `site/_redirects` (from `REDIRECTS` in `build.py`) forwards the old addresses Wix still forwards.
- Wix serves any made-up sub-path under a page (like `/residential-plumbing-services/anything`) as that page, which is why the Wix dashboard can show pages the sitemap doesn't. Before launch, screenshot Wix's URL Redirect Manager (Settings > SEO) and add anything missing to `REDIRECTS`.
- `content/media.json` maps each Wix image id to its converted file in `site/images/` (blog, plans, about). Blog index cards use 600x400 thumbnails in `site/images/blog/thumbs/`.
- Fixes to Jim's content: one post linked to `/plumbing-services`, which is dead on Wix too; it now points to Residential Plumbing Services (`LINK_FIX` in `build.py`). Wix hashtag links in posts are kept as plain text. Blog posts had no meta description on Wix; theirs is now the start of the post.
- The Wix pages use stock photos (for example, "a skilled plumber in uniform"). The build drops them and uses Jim's own job photos instead.

- The Google Drive connector drops the connection on files over about 6 MB, because it returns the whole file as base64. Many of Jim's photos are larger, so pick from the smaller ones.
- `drive.google.com` and Jim's site are blocked by the network policy unless they are allowed in the environment settings.
