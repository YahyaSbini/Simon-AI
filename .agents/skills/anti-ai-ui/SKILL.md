---
name: anti-ai-ui
description: Rules for building UI that does not look AI-generated. Use whenever creating or restyling any user-facing screen, page, component, landing page, or dashboard.
---

# Anti-AI UI

Default LLM output has a recognizable look: purple-to-blue gradients, emoji headings,
three identical feature cards, padded filler copy, and a hero that says nothing. Ship
interfaces that read as deliberate human design work.

## Non-negotiables

1. **The design must not look naive.** Every screen is intentional: a clear focal point,
   a real visual hierarchy, aligned optical edges, and no element placed "because the
   layout felt empty".
2. **No clutter.** One primary action per view. If a screen has two things competing for
   attention, one of them is wrong. Cut, group, or move to a secondary surface.
3. **No filler text.** Never pad with repetitive descriptions, restated headings, or
   generic marketing lines. If a label communicates it, delete the paragraph under it.
4. **No lorem ipsum, no placeholder imagery.** Use real, domain-specific content — real
   product names, real numbers, real empty states. Fake content hides real layout bugs.
5. **Avoid the AI-default aesthetic**: purple/indigo gradient hero, glassmorphism on
   everything, emoji as section icons, rainbow-tinted cards, `✨`/`🚀` in headings,
   centered everything, "Powered by AI" badges.
6. **Be consistent platform-wide.** One design language across every page: the same
   palette, type scale, spacing, radii, and component variants. A screen must not be
   identifiable as "the one built later".
7. **Minimalist, calm, easy on the eyes.** Simple and clear over dense and clever;
   comfortable contrast, no harsh pure-black-on-pure-white or saturated backgrounds,
   and a dark mode that is dark grey rather than `#000`.
8. **Responsive by default.** Design mobile and desktop as distinct layouts — removing,
   collapsing, or replacing components on small screens is expected, not a compromise.
9. **Use Tailwind (and its component conventions) for standard UI.** Tables, buttons,
   forms, lists, modals, and menus come from Tailwind utilities / an existing Tailwind
   component library already in the repo. Do not hand-roll or reinvent primitives.
10. **Transitions must be smooth and complete.** Page navigation, modals, drawers, tabs,
    and accordions animate in and out; nothing pops, jumps, or shifts layout mid-render.

## Concrete rules

### Layout & spacing
- Use one spacing scale (e.g. 4/8/12/16/24/32/48) and never off-scale values.
- Constrain reading width to ~60–75 characters. Full-bleed body text looks machine-made.
- Prefer left-aligned content over center-aligned; center only short hero blocks.
- Whitespace is not emptiness — resist filling gaps with badges, stats, or extra cards.
- Grids need a reason. Don't produce a 3-card row unless there are genuinely three
  peer items; two or four peers is fine, and one is often correct.

### Typography
- Two font families maximum, ideally one plus a mono for code/numbers.
- Set a real type scale with consistent line-heights; body ≥ 15px, don't ship 10px labels.
- Sentence case for headings and buttons. Avoid Title Case Everywhere and ALL-CAPS blocks.
- Headings describe content, not vibes: "Monthly spend" beats "Unlock your insights".

### Color & surfaces
- Pick one accent color and use it only for interactive/primary elements.
- Neutral backgrounds; convey elevation with subtle borders and small shadows, not glow.
- Meet WCAG AA contrast, including for placeholder and disabled text.
- Rounded corners: pick one radius token and stick to it. Nested pills inside pills look
  generated.

### Copy
- Short, specific, in the product's voice. Cut adjectives and superlatives.
- Buttons state the outcome: "Create workspace", not "Get started now!".
- Empty states say what to do next in one line, with the action next to it.
- Error messages name the cause and the fix; no apologies, no "Oops!".

### Responsiveness
- Build mobile-first with Tailwind breakpoints; verify each breakpoint you use.
- On phones, drop non-essential columns and secondary panels rather than shrinking them;
  turn wide tables into stacked cards or a horizontally scrollable region with a sticky
  first column.
- Touch targets ≥ 44px; move primary actions within thumb reach.
- Never trigger horizontal page scroll or clip content at 360px.

### Components
- Reach for Tailwind utilities and the repo's existing Tailwind component set first;
  add a custom component only when nothing existing fits, and match its API and styling.
- Keep variants centralized (a `cva`/variant map or shared classes), not copy-pasted
  class strings that drift between pages.

### Interaction & polish
- Motion is functional and fast (120–200ms, ease-out). No looping decorative animation.
- Animate both enter and exit: modals and drawers fade/slide out, route changes
  cross-fade, expanding sections animate height. Reserve space so nothing reflows.
- Respect `prefers-reduced-motion` by reducing to instant, not broken, transitions.
- Every interactive element has hover, focus-visible, active, disabled, and loading states.
- Loading uses skeletons matching final layout, or nothing — not a centered spinner page.
- Keyboard: visible focus ring, logical tab order, Escape closes overlays.
- Test at 360px, 768px, and 1440px before calling it done. Fix truncation and reflow.

## Review checklist

Before finishing any UI work, confirm:

- [ ] Could a designer defend every element on the screen? Delete what they couldn't.
- [ ] Is there exactly one primary action per view?
- [ ] Is all copy specific to this product, with no repeated or filler sentences?
- [ ] Are spacing, radius, and color values from tokens rather than ad hoc?
- [ ] Do hover/focus/empty/error/loading states all exist?
- [ ] Does it hold up at 360px width and with real (long) data?
- [ ] Are there zero decorative emoji, gradients, or "AI" badges?
- [ ] Does this screen match the rest of the platform's colors, type, and components?
- [ ] Is the phone layout purpose-built, not a squeezed desktop layout?
- [ ] Are standard components Tailwind-based rather than hand-rolled?
- [ ] Do navigation, modals, and expanding sections animate smoothly both ways?
