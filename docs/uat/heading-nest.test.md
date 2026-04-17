---
title: UAT — Heading outline indent (issue #82)
---

# Heading nest — manual UAT

**Prerequisite:** In Settings, enable **Markdown Inline Editor › Headings › Nest: Enabled** (`markdownInlineEditor.headings.nest.enabled`).

Optional toggles to exercise while testing:

| Setting | Purpose |
| --- | --- |
| `headings.nest.indentPerLevelCh` | Width per level (default `1.25`) |
| `headings.nest.nestContent` | Indent body under each heading until the next peer-or-higher heading (default on) |
| `headings.nest.showIndentGuides` | Subtle **vertical** line at the gutter’s left edge (default **off**; avoids old full-border rendering that looked like horizontal dashes) |
| `headings.nest.maxLevel` | Cap depth (e.g. `4` = no extra indent past `####`) |

---

## Checklist (global)

With **nest enabled**, away from any decorated line:

- [ ] H1 lines have **no** extra left indent (baseline).
- [ ] H2+ heading lines step in per level; deeper headings indent more than shallower ones.
- [ ] With **nest content** on, paragraphs and lists under a heading align with that heading’s indent until the next same-or-higher-level heading.
- [ ] **Fenced code blocks** (and their lines) are **not** outline-indented.
- [ ] **Frontmatter** lines are not outline-indented.
- [ ] With **show indent guides** on, a **vertical** cue appears at the left of the gutter (not horizontal “underscore” segments across the indent).

With **nest enabled**, **cursor on a heading line** (active line):

- [ ] Heading **syntax** behaves as today (raw/ghost per extension rules).
- [ ] **Outline indent** for that line is **off** (no fake indent while editing the line).

**Disabled** (`headings.nest.enabled` = false):

- [ ] No outline indent or guide; document looks as before the feature.

UAT-CHECK()

---

## Sample outline (H1 → H4 + body)

Use this block with nest enabled. Visually confirm nesting increases down the outline and body text follows the owning heading.

# Chapter title

Introduction paragraph under H1. Should match H1 indent (none beyond normal margin).

## Section A

Body under H2. Should align with **Section A** indent, not stay flush like the H1 intro if nest content is on.

### Subsection A.1

Body under H3. Deeper indent than Section A body.

#### Detail A.1.i

Short body under H4.

Back to ### level: this line is still under **Subsection A.1** until the next `##` or `#`.

## Section B

This paragraph resets to **H2** section indent (peer `##` closed the H3 subtree).

UAT-CHECK()

---

## Nested headings without extra “double” indent on the child heading line

The `###` line below must be indented **only** as an H3 heading, not stacked as H2-section-body **and** H3.

## Parent

Bridge paragraph.

### Child heading

This line is the H3 title only (verify single step from document left, not “double” indent).

UAT-CHECK()

---

## Code block must not get outline indent

```text
This fenced block should not receive heading-nest gutter indent.
Even though it sits under a heading.
```

UAT-CHECK()

---Í

## maxLevel quick check (optional)

Set `headings.nest.maxLevel` to **2**, reload / reopen file:

# Only H1

## H2

### H3

#### H4

Expect: **H3** and **H4** lines use the **same** indent as **H2** (capped at level 2). Reset `maxLevel` to `6` after.

UAT-CHECK()
