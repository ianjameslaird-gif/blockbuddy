# BlockBuddy

Good finds, right around the block.

BlockBuddy is a neighbourly marketplace where residents buy, sell, give away or trade with people on the same block. This repository is a static prototype of the SkyPeak @ Bukit Batok pilot. It is built to be hosted on GitHub Pages.

**Expected site:** https://ianjameslaird-gif.github.io/blockbuddy/

There is no custom domain yet, so the project does not include a CNAME file. Links are relative and stay inside that project site.

## Try it locally

From this folder:

```bash
python3 -m http.server 8080
```

Open http://localhost:8080/

On the sign-in screen, continue as the demo neighbour (`demo@skypeak.example` / `neighbour`) or create an account. The top bar says **Prototype — demo data only**. **Reviewer tools** switches verification between Submitted, Under Review, Verified and Action Needed, and can reset the demo.

Everything is saved in this browser's `localStorage`. Choosing a document only draws a preview on the device. It is not uploaded.

## Screens

1. Home and sign-in
2. Registration
3. Residence verification, including redaction, retry and the four statuses
4. Community feed
5. Search results and filters
6. Listing details
7. Create or edit a listing
8. Private chat
9. Member profiles
10. Help, safety, reporting and blocking

The same pages cover loading, empty, error and success states. Filters use a bottom sheet on a phone and a sidebar on a wide screen.

## A real launch

GitHub Pages cannot run the services a public BlockBuddy would need: authentication, private document storage with retention, a database, realtime chat and moderation. Short notes are in [docs/index.html](docs/index.html).
