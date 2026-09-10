# Enterprise Design System: Crextio Studio & Impeccable Standards

This document specifies the design tokens, visual hierarchy, and craftsmanship rules for the Employee Management System, uniting the **Option 3 Studio Crisp** aesthetic with **Impeccable.style** craft standards.

---

## 1. Palette & Surface Tints

### Slate Canvas & Surfaces
| Token | Light Value | Dark Value | Role |
| :--- | :--- | :--- | :--- |
| `--bg-app` | `#F8FAFC` (Slate 50) | `#0B0F19` (Obsidian) | Root canvas background |
| `--bg-surface` | `#FFFFFF` (Pure White) | `#131A29` (Deep Slate) | Primary card containers & tables |
| `--bg-surface-elevated` | `#F1F5F9` (Slate 100) | `#1E293B` (Slate 800) | Pill buttons, search inputs, active states |
| `--border-subtle` | `#E2E8F0` (Slate 200) | `rgba(255, 255, 255, 0.08)` | 1px hairline dividers |
| `--border-strong` | `#CBD5E1` (Slate 300) | `rgba(255, 255, 255, 0.16)` | Inputs & container boundaries |

### Brand & Functional Accents
| Token | Light Value | Dark Value | Role |
| :--- | :--- | :--- | :--- |
| **Accent Butter Yellow** | `#FEF08A` (`text: #713F12`) | `#423207` (`text: #FDE047`) | Ratio progress active pill & selected row glow |
| **Active Nav Capsule** | `#0F172A` (`text: #FFFFFF`) | `#F8FAFC` (`text: #0F172A`) | Topbar active navigation capsule pill |
| **Brand Primary Indigo**| `#4F46E5` | `#818CF8` | Primary CTA buttons & active highlights |
| **Status Emerald** | `#10B981` (`bg: rgba(16, 185, 129, 0.12)`) | `#34D399` | Active / Invited status dot |
| **Status Amber** | `#F59E0B` (`bg: rgba(245, 158, 11, 0.12)`) | `#FBBF24` | On Leave / Pending status dot |
| **Status Slate** | `#64748B` (`bg: rgba(100, 116, 139, 0.12)`) | `#94A3B8` | Inactive / Terminated status dot |

---

## 2. Typography & Impeccable Typesetting

- **Display & Headings**: `font-family: 'Inter', -apple-system, sans-serif;` with tight tracking `letter-spacing: -0.025em; font-weight: 700;`.
- **Tabular Figures**: Every numeric figure (salaries, timestamps, employee IDs, progress percentages) must specify:
  ```css
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1;
  ```
- **Microcopy & Metadata Labels**: `font-size: 0.72rem; font-weight: 700; letter-spacing: 0.025em; text-transform: uppercase; color: var(--text-muted);`.

---

## 3. Impeccable Browser Surface Overrides

The page details that define bespoke software:
```css
/* Branded Text Selection */
::selection {
  background: #fef08a;
  color: #713f12;
}

/* Custom Themed Caret */
input, textarea {
  caret-color: #4f46e5;
}

/* Crisp Accessible Focus Rings */
:focus-visible {
  outline: 2px solid #4f46e5;
  outline-offset: 2px;
}

/* Sleek Thin Scrollbars */
* {
  scrollbar-width: thin;
  scrollbar-color: var(--border-strong) transparent;
}
```

---

## 4. Key Components Anatomy

### A. Floating Capsule Navigation (`CapsuleNav`)
- Rounded capsule container (`border-radius: 9999px`) with soft floating shadow.
- Pill buttons with smooth slide/fade active indicator.
- Tabs: `Dashboard`, `People`, `Hiring`, `Attendance`, `Salary`, `Projects`, `Reviews`, `Settings`.

### B. Segmented Progress Ratio Tracker (`PillRatioBar`)
- Single horizontal track representing workforce health.
- Segments:
  - Total Directory (100%)
  - **Active Staff (X%)** in the **light butter-yellow pill** (`background: #FEF08A; color: #713F12;`)
  - **On Leave (Y%)**
  - **New Hires (Z%)**

### C. Curated Table Card with Canary Yellow Selection
- Floating card container (`border-radius: 16px; border: 1px solid var(--border-subtle)`).
- Selected row receives a smooth canary yellow background (`background: rgba(254, 240, 138, 0.45)` in light mode, `#2E2305` in dark mode) with rounded ends.
- Country flag emoji badges for office locations (🇺🇸 Miami, 🇮🇳 Bangalore, 🇸🇪 Stockholm, 🇬🇧 London, 🌐 Remote).
