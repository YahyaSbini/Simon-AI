# Brand identity — Stick & Twig Rabbit

Source of truth for Simon-AI's visual identity. Full spec: `brand_identity_guidelines_v3.pdf`.

## Concept

Rustic craftsmanship meets organic illustration: a rabbit constructed entirely from twigs,
forest debris, and binding ties. Tactile and handmade, with a clean wide silhouette that
works in modern digital layouts. A single luminous blue eye is the only color accent —
intelligence and clarity inside a monochrome rustic frame.

## Logo

| File | Use |
| --- | --- |
| `logo/rabbit-logo-sticker.jpg` | Cutout sticker version, transparent-style edge, for app headers, favicons, avatars |
| `logo/rabbit-logo-parchment.jpg` | Full scene on parchment with sketched ground, for hero sections and print |

Rules:
- Always place on the parchment background (`#F4F1EA`); never on pure white or saturated color.
- Keep generous clear space so the twig detail and crosshatching stay legible.
- Never recolor the illustration. The eye stays Electric Azure (`#2979FF`).
- Do not add drop shadows, glows, gradients, or containers behind the logo.

## Color palette

| Token | Hex | Use |
| --- | --- | --- |
| Electric Azure | `#2979FF` | Sole accent: the eye, links, focus rings, primary buttons |
| Charcoal Ink | `#2B2926` | Illustration lines, headings, body text |
| Natural Wood | `#8D6E63` | Secondary fills, borders, muted UI elements |
| Parchment | `#F4F1EA` | Page background, card canvas |

Tailwind theme:

```js
// tailwind.config.js — theme.extend.colors
colors: {
  azure: '#2979FF',
  ink: '#2B2926',
  wood: '#8D6E63',
  parchment: '#F4F1EA',
}
```

## Typography

- **Architects Daughter** — primary. Clean, wide, hand-drawn; headings and brand lettering.
- **Kalam Regular** — alternative hand font; friendly pencil-sketched look for headings
  and descriptions where Architects Daughter is too narrow.
- Keep body copy at a comfortable size and line-height; hand fonts lose legibility when small.

## Art direction

- Hand-drawn pen-and-ink crosshatching, high-contrast charcoal on paper.
- Organic timber texture and natural irregularity — no vector-perfect shapes.
- Seamless cutouts, no heavy background boxes.
- Wide, balanced compositions for both web and print.
- Binding knots at twig joints are a signature detail; keep them visible in crops.
