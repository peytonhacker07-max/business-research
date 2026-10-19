# Angle Stop Plumbing site: where things stand

Read this first when picking the project up in a new session.

## The job

Peyton is rebuilding anglestopplumbing.com for Angle Stop Plumbing, Inc. (owner Jim Nephew, Murfreesboro TN, (615) 398-3048). The site moves off Wix to plain HTML/CSS on Cloudflare Pages. Price: $1,000 for the site, plus $250/month for 4 Facebook posts, cross-posted to his Google Business Profile.

Peyton is new to freelancing and wants blunt, honest advice. Jim is older: texts to him should be short, plain, and written for an iPhone (no hard line breaks).

## Decisions already made

- **Keep every page.** The site has 40 main pages plus blog posts. Google organic traffic is up 166% year over year, so do not merge or rename pages. Keep each URL, title tag and meta description exactly as they are on Wix.
- **Carry text over as-is.** The $1,000 covers moving his existing wording, not rewriting it. Never invent page copy.
- **Hosting: Cloudflare Pages.** Vercel's free plan bans commercial use, and Netlify's free plan has a credit cap.
- **The DNS moves in two steps,** each one only with Jim's OK ("one step at a time"). The plan and the full Wix DNS backup are in `dns/`.
- **Email** is Google Workspace (billed through Wix). The MX records must survive the move. Mailchimp DKIM records are in the backup.
- **Booking** uses Workiz, which works with any site. Every booking button links to `https://online-booking.workiz.com/?ac=fb4a367aaef910833ab1ecc026d212793c52c4b6d2f4066a884b0f0392bd01de`.
- **Photos** come from Jim's Google Drive "Job Photos" folder. See `photos.md` for what is used where. Never use a photo showing a face, a reflection of a person, a house number or a license plate. Never use customers' Google review photos.

## Done

- `site/index.html`: the homepage, with real Google reviews, job photos and Jim's vector logo (`site/images/seal.svg`).
- `dns/`: the Wix DNS export and the migration and rollback plan.
- Preview: https://claude.ai/artifact/XrkThiBJ5T1Yb4FYbjhhb1 (private to Peyton). It is built from `site/index.html` by stripping the document shell. Links to unbuilt pages show a "not built yet" notice in the preview only.

## Next

1. **Pull the text of all 40 pages from the live site.** The cloud environment must allow `anglestopplumbing.com` and `www.anglestopplumbing.com` under Network access. Start from `https://www.anglestopplumbing.com/sitemap.xml`.
2. **Build the Water Heater page first** (`/water-heater-service-repair-installation-murfreesboro-tn`) as the template for service pages, and get Peyton's approval. Then build the other pages and the blog posts.
3. **Waiting on Peyton:** the blog post count; their full name, the timeline (4 weeks suggested) and the payment terms for the agreement. The agreement is a Claude Doc: https://claude.ai/code/artifact/35193b0d-bf97-4caf-b634-9a91cdb29bfa.
4. **Waiting on Jim:** a photo of himself and of his truck; whether he still offers a membership plan (the nav link is a placeholder); confirming the service-area towns on the homepage.
5. **Later:** DNS step 1; clean up Workiz (services listed at $0.00 and truncated service names).

## Gotchas

- The Google Drive connector drops the connection on files over about 6 MB, because it returns the whole file as base64. Many of Jim's photos are larger, so pick from the smaller ones.
- `drive.google.com` and Jim's site are blocked by the network policy unless they are allowed in the environment settings.
