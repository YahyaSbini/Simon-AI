---
name: brand-identity
description: Simon-AI's Stick & Twig Rabbit brand — colors, typography, logo usage, and art direction. Use whenever building UI, choosing colors or fonts, placing the logo, or creating any visual asset.
---

# Brand identity — Stick & Twig Rabbit

Full spec: `brand/BRAND.md` and `brand/brand_identity_guidelines_v3.pdf`.
Logo files: `brand/logo/rabbit-logo-sticker.jpg`, `brand/logo/rabbit-logo-parchment.jpg`.

## Use these values, never invent alternatives

| Token | Hex | Use |
| --- | --- | --- |
| Electric Azure | `#2979FF` | Only accent: links, focus rings, primary buttons, the logo's eye |
| Charcoal Ink | `#2B2926` | Text, headings, illustration lines |
| Natural Wood | `#8D6E63` | Secondary fills, borders, muted elements |
| Parchment | `#F4F1EA` | Page and card background |

Fonts: **Architects Daughter** (primary hand-drawn) and **Kalam Regular** (alternative).

## Rules

1. Parchment (`#F4F1EA`) is the page background — never pure white, never a saturated color.
2. Azure is the *only* accent. If a second accent seems necessary, use Natural Wood or a
   Charcoal tint instead.
3. Never recolor, outline, shadow, or box the logo; keep generous clear space around it.
4. Text is Charcoal Ink, not black. Backgrounds are warm, not grey.
5. Hand-drawn feel comes from the illustrations and fonts — do not fake it with textures,
   filters, or skewed elements on UI chrome.
6. Register brand colors as Tailwind theme tokens (`azure`, `ink`, `wood`, `parchment`)
   and reference the tokens in components rather than raw hex values.

## Checklist

- [ ] Background is parchment; text is charcoal ink.
- [ ] Azure appears only on interactive/focal elements.
- [ ] Logo is unmodified, well-spaced, on parchment.
- [ ] Fonts are Architects Daughter / Kalam, loaded once and used consistently.
- [ ] Colors come from Tailwind tokens, not hard-coded hex.
