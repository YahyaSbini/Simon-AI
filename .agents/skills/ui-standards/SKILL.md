---
name: ui-standards
description: Baseline UI standards for this platform — consistency, minimalism, responsiveness, Tailwind components, and transitions. Use whenever building or changing any user-facing screen or component.
---

# UI standards

Baseline rules for every screen. For rules about not looking AI-generated, see
`.agents/skills/anti-ai-ui/SKILL.md`.

## Rules

1. **Consistent across the platform.** One design language everywhere: same palette, type
   scale, spacing, radii, and component variants. No screen should be identifiable as
   "the one built later".
2. **Minimalist, clear, eye-care.** Simple over dense; comfortable contrast; no pure
   black on pure white, no saturated backgrounds. Dark mode is dark grey, not `#000`.
3. **Responsive.** Mobile and desktop are distinct layouts. Removing, collapsing, or
   replacing components on phone view is expected, not a compromise.
4. **Tailwind for standard components.** Tables, buttons, forms, lists, modals, menus
   come from Tailwind utilities or the Tailwind component set already in the repo.
   Don't reinvent primitives.
5. **Smooth transitions.** Page navigation, modals, drawers, tabs, and accordions animate
   in and out. Nothing pops, jumps, or shifts layout mid-render.

## Details

### Consistency
- Define colors, spacing, radii, and type in tokens (Tailwind theme) and use only those.
- Keep component variants centralized (a `cva`/variant map or shared classes) instead of
  copy-pasted class strings that drift between pages.
- Reuse existing page layouts and headers rather than inventing a new shell per route.

### Minimalism & readability
- One primary action per view; secondary actions are visually quieter.
- Body text ≥ 15px, reading width ~60–75 characters, generous line-height.
- Meet WCAG AA contrast, including placeholder and disabled text.
- Elevation via subtle borders and small shadows, not glow or heavy drop shadows.

### Responsiveness
- Build mobile-first with Tailwind breakpoints; check 360px, 768px, and 1440px.
- On phones, drop non-essential columns and secondary panels rather than shrinking them;
  turn wide tables into stacked cards, or scroll horizontally with a sticky first column.
- Touch targets ≥ 44px; keep primary actions within thumb reach.
- Never cause horizontal page scroll or clipped content at 360px.

### Transitions & states
- 120–200ms, ease-out. Animate enter *and* exit; reserve space so nothing reflows.
- Every interactive element has hover, focus-visible, active, disabled, and loading states.
- Loading uses skeletons matching the final layout, not a full-page spinner.
- Respect `prefers-reduced-motion` by making transitions instant, not broken.

## Checklist

- [ ] Colors, type, spacing, and components match the rest of the platform.
- [ ] One primary action per view; nothing competing for attention.
- [ ] Phone layout is purpose-built and works at 360px with real data.
- [ ] Standard components are Tailwind-based, not hand-rolled.
- [ ] Navigation, modals, and expanding sections animate smoothly both ways.
- [ ] Hover / focus / disabled / empty / error / loading states all exist.
