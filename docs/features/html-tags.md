---
status: DONE
githubIssue: https://github.com/SeardnaSchmid/markdown-inline-editor-vscode/issues/29
updateDate: 2026-01-14
priority: Medium
---

# HTML Tags

## Overview

Detect and style HTML tags within markdown without rendering HTML or altering content.

## Implementation

- Parse inline and block HTML via remark AST (`html` nodes) to avoid full-document scans.
- Within each HTML node, detect tags (`<tag>`, `</tag>`, self-closing) using a lightweight regex and offset mapping.
- Apply a distinct decoration (e.g., `htmlTag`) to tag markers; content remains normal text.
- Skip parsing inside code blocks and inline code (remark already isolates these).
- Do not execute or render HTML; only style tag text.

### Affected Components

- `src/parser.ts` - detect `html` nodes and emit tag decorations
- `src/decorations.ts` - add an `htmlTag` decoration style
- `src/decorator.ts` - register and apply `htmlTag` decoration
- `src/parser/__tests__/` - add coverage for inline, block, and edge cases

## Acceptance Criteria

### Basic HTML Tags
```gherkin
Feature: HTML tag formatting

  Scenario: Opening tag
    When I type <strong>text</strong>
    Then the tags are detected
    And the tags are styled distinctly
    And the text content remains visible

  Scenario: Self-closing tag
    When I type <br/>
    Then the tag is detected
    And the tag is styled distinctly

  Scenario: Inline tag
    When I type <em>italic</em>
    Then the tag is detected
    And the content remains visible
```

### Nested Tags
```gherkin
Feature: Nested HTML tags

  Scenario: Nested tags
    When I type <div><strong>bold</strong></div>
    Then all tags are detected
    And nesting is handled correctly

  Scenario: Multiple levels
    When I type <div><p><span>text</span></p></div>
    Then all tags are detected correctly
```

### Edge Cases
```gherkin
Feature: HTML tag edge cases

  Scenario: Malformed HTML
    When I type <div>unclosed
    Then the malformed HTML is handled gracefully
    And no crash occurs

  Scenario: HTML in code
    When I type `<div>code</div>`
    Then the HTML is not processed
    And it remains as code
```

### Reveal Raw Markdown
```gherkin
Feature: Reveal HTML tags

  Scenario: Reveal on select
    Given <strong>text</strong> is in my file
    When I select the HTML
    Then the raw markdown is shown
    When I deselect
    Then the tags are styled again
```

## Notes

- Markdown allows inline HTML
- Useful for advanced formatting and interop with docs that embed HTML
- Competitive requirement (markless has it)
- Complex due to nested tags and edge cases
- Must handle malformed HTML gracefully
- Tags are styled only; no rendering or execution
- Feasibility: Moderate
- Usefulness: Moderate
- Risk: Medium (parsing complexity)
- Effort: 1-2 weeks
- Avoid full HTML parsing; keep a lightweight tag detector

## Examples

```markdown
<strong>Bold text</strong>
<em>Italic text</em>
<kbd>Ctrl+C</kbd>
<div class="note">Block content</div>
```

→ HTML tags are styled distinctly while content remains visible
