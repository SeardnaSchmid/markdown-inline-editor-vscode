# Mentions and References Feature Test

Use this file in the Extension Development Host to verify mention and issue-reference rendering and navigation.

## Setup

1. Open this repository as your workspace.
2. Ensure this workspace has a git origin remote (GitHub, GitLab, Gitea, or self-hosted).
3. Open this file while the extension is active.
4. Optional: test with these settings:
   - markdownInlineEditor.mentions.enabled: true
   - markdownInlineEditor.mentions.linksEnabled: undefined, then false, then true

## Basic Patterns

- User mention: @alice
- User mention with hyphen: @user-name
- Org/team mention: @org/team
- Repo-scoped issue: @owner/repo#42
- Issue references: #1, #123, #999

## Mixed Paragraph

Please review with @alice and @org/team, then see #42 and @microsoft/vscode#12345 for details.

## Should Not Match

- Email addresses: user@example.com, foo.bar+baz@company.dev
- Invalid username (leading hyphen): @-invalid
- Invalid username (underscore): @user_name
- Invalid org/team (missing segment): @org/ and @/team

## Code Exclusion

Inline code should not style mentions: `@inline-user` and `#777`.

```md
@code-block-user
#888
@owner/repo#999
```

## Selection Behavior

Select each styled mention/reference and verify raw syntax stays visible while selected, then returns to styled rendering when deselected.

## Link Behavior Checks

If links are enabled in remote context:

- Clicking @alice should open <remote-web-base>/alice
- Clicking @org/team should open <remote-web-base>/org/team
- Clicking #123 should open <remote-web-base>/<workspace-owner>/<workspace-repo>/<issues-path>/123
- Clicking @owner/repo#42 should open <remote-web-base>/owner/repo/<issues-path>/42

If markdownInlineEditor.mentions.linksEnabled is false:

- Mentions/references remain styled
- Clicking mention/reference should not open remote links
