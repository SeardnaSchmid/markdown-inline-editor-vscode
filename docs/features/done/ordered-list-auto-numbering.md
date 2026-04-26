---
status: DONE
updateDate: 2026-03-23
priority: Low Priority
---

# Ordered List Auto-Numbering

## Overview

Ordered list markers are hidden and replaced with auto-calculated sequential numbers based on position in the list.

## Implementation

- Syntax: `1.`, `2.`, etc. (dot) or `1)`, `2)`, etc. (parentheses)
- Original markers are hidden via `display: none`
- Numbers are auto-calculated from position in the parent list
- Supports custom start numbers (e.g., `5. item` starts at 5)
- Supports lazy numbering (all `1.`) — numbers are calculated by position
- Supports nested ordered lists (each level numbered independently)
- Both `.` and `)` delimiters are preserved in the replacement
- Uses per-range `renderOptions.before.contentText` for dynamic replacement text
- Cursor on a list item reveals the raw markdown marker
- Ghost-faint rendering on active lines (consistent with other markers)

## Acceptance Criteria

### Basic Auto-Numbering
```gherkin
Feature: Ordered list auto-numbering

  Scenario: Sequential markers
    When I type 1. First\n2. Second\n3. Third
    Then markers are hidden
    And numbers 1, 2, 3 are displayed

  Scenario: Lazy numbering (all ones)
    When I type 1. First\n1. Second\n1. Third
    Then markers are hidden
    And numbers 1, 2, 3 are displayed based on position

  Scenario: Parentheses syntax
    When I type 1) First\n1) Second
    Then markers are hidden
    And numbers 1), 2) are displayed
```

### Nested Lists
```gherkin
Feature: Nested ordered list auto-numbering

  Scenario: Single nesting level
    When I type 1. Outer\n   1. Inner\n   1. Inner
    Then outer items are numbered 1, 2
    And inner items are numbered 1, 2 independently

  Scenario: Multiple nesting levels
    When I type 1. Outer\n   1. Middle\n      1. Inner
    Then all levels are numbered correctly and independently
```

### Reveal Raw Markdown
```gherkin
Feature: Reveal ordered list raw markdown

  Scenario: Reveal on select
    Given 1. item is in my file
    When I select the list item
    Then the raw markdown marker is shown
    When I deselect
    Then the auto-numbered replacement is displayed again
```

### Edge Cases
```gherkin
Feature: Ordered list edge cases

  Scenario: Out-of-order numbering
    When I type 3. First\n1. Second\n2. Third
    Then numbers are auto-calculated based on position (3, 4, 5)

  Scenario: Custom start number
    When a list starts with 5. Item
    Then numbering begins at 5

  Scenario: Ordered list with checkboxes
    When I type 1. [ ] Task\n2. [x] Done
    Then the numbers are auto-calculated
    And checkboxes are displayed correctly
```

## Notes

- Uses remark's `List.start` property for custom start numbers
- Uses `List.children.indexOf(node)` to determine position
- The `replacement` field on `DecorationRange` is set per-item by the parser
- Added to `selectionOnlyMarkerTypes` for cursor-reveal behavior
- Added to `markerDecorationTypes` for ghost-faint rendering
- Added to `renderOptionsTypes` for per-range `DecorationOptions` handling

## Examples

**Lazy numbering (all `1.`) → auto-numbered by position:**
```
1. First    →  1. First
1. Second   →  2. Second
1. Third    →  3. Third
```

**Parentheses delimiter:**
```
1) A   →  1) A
1) B   →  2) B
```

**Custom start number:**
```
5. Start here   →  5. Start here
1. Next item    →  6. Next item
```

**With checkboxes:**
```
1. [ ] Task 1   →  1. ☐ Task 1
2. [x] Task 2   →  2. ☑ Task 2
```
