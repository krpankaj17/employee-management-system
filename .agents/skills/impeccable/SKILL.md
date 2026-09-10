---
name: impeccable
description: "Use when designing, building, or refining frontend interfaces to enforce professional design standards, eliminate AI slop, establish visual hierarchy, craft typography, and apply purposeful motion and responsive states. Integrates principles from impeccable.style."
---

# Impeccable Design System & Craft Laws

Impeccable turns generic AI frontend outputs into production-grade, human-crafted interfaces by applying strict craftsmanship laws, typography precision, and anti-pattern bans.

## Core Craft Floor (The Impeccable Laws)

### 1. Browser Surfaces (The Hallmark of Custom Craft)
The surfaces you didn't draw still carry the design:
- **Text Selection**: Custom `::selection` tinted to the brand palette (e.g. `background: #FEF08A; color: #713F12;`).
- **Caret Color**: Set `caret-color: var(--color-primary-500);` on all inputs.
- **Tabular Numerals**: Always enable `font-variant-numeric: tabular-nums; font-feature-settings: "tnum" 1;` for salaries, stats, employee codes, and timestamps so columns align perfectly.
- **Focus States**: Clean, high-contrast `:focus-visible` outlines (`outline: 2px solid var(--border-focus); outline-offset: 2px;`) rather than default blurry halos.
- **Custom Scrollbars**: Thin, themed scrollbar track and thumb (`scrollbar-width: thin; scrollbar-color: var(--border-subtle) transparent;`).

### 2. Elimination of AI Slop & Tells
- **No Status-Chip Soup**: Don't wrap every single cell or field in a badge or chip. Reserve badges only for true operational states (Active, On Leave, Inactive).
- **No Cards Inside Cards Inside Cards**: Break out of the box-in-a-box syndrome. Use subtle hairline dividers (`1px solid var(--border-subtle)`), whitespace rhythm, and typography hierarchy instead of infinite borders.
- **No Muddy "AI Beige" or Flat Grays**: Use tinted neutrals (slate with soft blue/charcoal undertones, warm ivory with luminous butter-yellow accents).
- **No Generic Button Copy**: Replace "Submit", "Continue", or "Click Here" with precise, contextual verbs: "Onboard Employee", "Download Roster", "View Full Record", "Adjust Compensation".

### 3. Typography & Hierarchy
- **Tracking**: Headings receive tight, confident letter spacing (`letter-spacing: -0.025em; font-weight: 700;`). Small labels receive deliberate micro-tracking (`letter-spacing: 0.02em; text-transform: uppercase; font-size: 0.72rem;`).
- **Scale Steps**: Clear typographic hierarchy where primary numbers and section titles dominate, while metadata recedes gracefully.
- **Line Length**: Paragraph measures kept between 55ch and 75ch.

### 4. Intentional Motion & Depth
- **Soft Layered Shadows**: Multi-layered natural drop shadows with y-offset and blur (`box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px -4px rgba(0,0,0,0.06);`) instead of zero-offset harsh neon halos.
- **Smooth Micro-transitions**: Use cubic-bezier easing (`transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);`) for hover lifts, pill tabs, and selection glows.

### 5. Edge Cases & Resilience (Harden)
- **Text Truncation**: Graceful handling of long names and emails with `text-overflow: ellipsis; white-space: nowrap; overflow: hidden;` plus full text tooltips.
- **Complete States**: Every view must gracefully handle `loading`, `empty`, `error`, and `selected` states.
