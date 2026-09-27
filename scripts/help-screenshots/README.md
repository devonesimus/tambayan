# Help page screenshots

The Help page (`/admin/help`) shows a computer and an iPhone screenshot for each screen. These scripts rebuild all of them from a demo copy of the app, so they can be refreshed whenever an admin screen changes.

Everything here runs against a **scratch local database** in `.wrangler/help-demo` with invented guests. It never touches your normal local data or production.

## Refresh the screenshots

Needs Node, Google Chrome, and Python 3 with Pillow (`pip3 install pillow`). Also copy `.dev.vars.example` to `.dev.vars` once if you have not.

```bash
npm install
npm run help:demo:setup      # builds the demo database and test logins
npm run help:demo            # leave this running: the demo app on http://127.0.0.1:43124
```

In a second terminal:

```bash
npm run help:shots                       # every screen
npm run help:shots -- events guest-add   # only screens whose name starts with these
```

Images are written to `public/help/<name>-desktop.webp` and `<name>-phone.webp`. Review them, then commit.

To look at several at once: `python3 scripts/help-screenshots/contact-sheet.py /tmp/sheet.jpg dashboard menu`.

## What is where

| File | Job |
| --- | --- |
| `demo-data.mjs` | Fake people, events, sign-ups and activity. Dates follow the day you run it, so there is always an open event still ahead. |
| `setup.mjs` | Migrates the demo database, loads the data, creates the test logins, makes stand-in photos. |
| `capture.mjs` | Drives Chrome as a desktop browser and as an iPhone, signs in, and takes each screenshot. Screen definitions are the `shots` list. |
| `make-photos.py` | Stand-in gathering photos and a video thumbnail. |
| `common.mjs` | Paths and helpers. |

Test logins are written to `seeds/help-demo-admin.local.sql`, which is gitignored. They only exist in the demo database.

## When you change the admin

1. Change the screen.
2. If a button label or step changed, update the matching answer in `src/help.ts`.
3. Re-run `npm run help:shots -- <screen>` for the screens that changed.

A new screen needs a new entry in `shots` in `capture.mjs`, then a `shots: [{ name: "…" }]` on its question in `src/help.ts`.
