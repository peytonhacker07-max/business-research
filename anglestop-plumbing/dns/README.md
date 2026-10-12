# anglestopplumbing.com DNS

`wix-export-2026-10-12.zone` is the full DNS for the domain, exported from Wix on Oct 12, 2026, before anything was changed. It is the rollback copy: if anything breaks, every record goes back to what this file says.

The domain is registered at Wix in Jim's name and is paid through May 28, 2028. Registration stays at Wix; only the DNS moves.

## What each record does

| Record | Points to | What it does |
| --- | --- | --- |
| `@` A ×3 | 185.230.63.171, .186, .107 | Website (anglestopplumbing.com) → Wix |
| `www` CNAME | cdn3.wixdns.net | Website (www.) → Wix |
| `@` MX ×5 | aspmx.l.google.com, alt1–alt4 | Email → Google Workspace |
| `@` TXT | `v=spf1 include:_spf.google.com ~all` | Lets Google send mail for the domain |
| `_dmarc` TXT | `v=DMARC1; p=none;` | Email authentication policy (monitor only) |
| `@` TXT | `google-site-verification=…` | Proves domain ownership to Google |
| `k2._domainkey`, `k3._domainkey` CNAME | dkim2/dkim3.mcsv.net | Mailchimp email signing |
| `@` NS | ns2/ns3.wixdns.net | Who answers for the domain (Wix today) |

## Why the DNS has to move

Cloudflare Pages can only serve a root domain (no `www`) when the domain uses Cloudflare's nameservers. With the DNS left at Wix, only `www` could point at Pages.

## Migration plan

Nothing below has been done yet. Step 1 needs Jim's OK first.

**Step 1: move the DNS and change nothing else**

1. Add anglestopplumbing.com to a Cloudflare account in Jim's name and import this zone file.
2. Compare every imported record with this file, line by line. The NS records become Cloudflare's; everything else must match exactly.
3. Set the A records and the `www` CNAME to **DNS only (grey cloud)**, so the Wix site keeps working exactly as it does now.
4. In Wix: Domains → Manage DNS Records → Use custom nameservers → enter Cloudflare's two nameservers.
5. Within a few hours, send and receive a test email, open the site, and check the domain in Mailchimp. Wix may show the Google Workspace mailbox as disconnected; mail keeps flowing as long as the MX records are at Cloudflare. Wait a few days before step 2.

Rollback: set the nameservers in Wix back to ns2.wixdns.net and ns3.wixdns.net, and restore any record Wix no longer shows from this file.

**Step 2: switch the website (after Jim approves the new site)**

1. In the Cloudflare Pages project, add anglestopplumbing.com and www.anglestopplumbing.com as custom domains. This replaces the three Wix A records and the `www` CNAME.
2. Leave the MX, TXT and Mailchimp records alone.
3. Test every page, the Workiz booking buttons, and email again.
4. Keep Wix Premium for 30 days. Rollback: put the A and `www` records back to the values in this file.
