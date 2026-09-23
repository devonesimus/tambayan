# OFW Tambayan SG — design handoff

Extracted from the Canva design **"OFWT 32x9 - Multi-design"**
(`canva.com/design/DAG-MAUycaM`) on 2026-09-23 for the web build.

The file is a **brand/logo kit**, not page mockups: 8 banner-format (32:9) pages
covering the logo, an event banner, the palette, and a hashtag series. Use it
for the header, hero, and social/event sections, and for overall look and feel.

## Contents

```
design/
├── README.md          ← you are here
├── tokens.json        ← colors, fonts, type scale, text effects (with usage notes)
├── tokens.css         ← same as CSS custom properties + Google Fonts import
├── content.md         ← all copy, per page
├── screens/           ← full-page renders, 2776×775 (page 3: 1787×1002)
│   ├── 01-banner-navy.png       primary logo on navy
│   ├── 02-event-banner.png      logo + event details panel
│   ├── 03-color-palette.png     5 brand swatches
│   ├── 04-banner-light.png      primary logo, light/transparent variant
│   ├── 05-hashtag-kkb.png       #KKB · Kamusta ka ba?
│   ├── 06-hashtag-skl.png       #SKL · Share Ko Lang
│   ├── 07-hashtag-sml.png       #SML · Share Mo Lang
│   └── 08-wordmark-ofwt.png     compact OFWT wordmark
└── assets/
    ├── logo/
    │   ├── logo-lockup-on-navy.png    cropped lockup, navy bg (1520×720)
    │   ├── logo-lockup-on-light.png   cropped lockup, light bg
    │   └── wordmark-ofwt-on-light.png cropped OFWT wordmark, light bg
    └── elements/                      vector illustration parts (SVG)
        ├── airplane.svg / airplane-red.svg
        ├── bridge.svg / bridge-red.svg
        ├── stadium-dome.svg / stadium-dome-orange.svg
        └── ground-shadow.png
```

## Brand at a glance

| Token | Hex | Where |
|---|---|---|
| Navy | `#27346B` | dark background |
| Orange | `#EAA12F` | sun, skyline, SG badge |
| Red | `#D33444` | airplane, bridge |
| Off-white | `#F5F4F4` | text on navy |
| Near-black | `#0B0B0B` | palette only |
| Royal blue | `#20419C` | text on light variants |
| Yellow + red stroke | `#F9D21D` / `#CE2029` | script text on light variants |

**Fonts:** League Gothic (display) · Anton (headings/badge) · Montserrat (body) ·
Open Sans Italic (tagline): all on Google Fonts. The "Tambayan" script face is
**Canva Shadow Stream**, which is Canva-only and can't be licensed for web. Keep it inside
logo images. For live script text, test *Caveat Brush* or *Kalam* 700.

## Layout notes (for building components)

- **Logo lockup:** giant condensed "OFW" (League Gothic, ~0.07em tracking). The
  "W" doubles as the Marina Bay Sands towers, with the orange sun behind it.
  "Tambayan" in script overlaps the W's right leg. A Singapore skyline (bridge,
  Sports Hub dome, Supertrees, Singapore Flyer) sits along the baseline, with a
  red airplane top-right, an orange "SG" circle badge, and the italic tagline right-aligned below.
- **Event banner (p2):** logo on the left ~60%. On the right, a skewed parallelogram
  panel (`rgba(255,255,255,.14)`) with an Anton heading, Montserrat 700 details,
  and Montserrat 400 fine print.
- **Hashtag cards (p5–7):** huge royal-blue League Gothic hashtag, with a small
  skyline strip at the bottom-left and the yellow/red script phrase overlapping
  the bottom-right. A red airplane accent sits top-right. Good template for social cards or a section header.
- **Light pages (4–8)** have a transparent background in Canva. The `#F6F7F9`
  you see in the renders is Canva's editor gray, not a brand color.

## Known gaps / next steps

1. **No transparent-background logo yet.** The renders are screen captures, so the
   light variants sit on gray. For production, sign in to Canva and use
   **Share → Download → PNG (transparent background) or SVG** on pages 4 and 8.
   The Canva session used here was a guest one and can't export.
2. **Skyline, Marina Bay Sands and Merlion rasters** are signed Canva media and
   weren't reachable directly. They're visible in the renders. The SVG export
   from step 1 would include them as vectors.
3. Canva elements are licensed for use inside your Canva designs. Using the
   exported logo is fine; reusing the individual stock illustrations elsewhere
   may be restricted by Canva's content license.
