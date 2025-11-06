# Markdown Features Example

This document demonstrates all features supported (or planned) by the extension.

---

## Inline Formatting

- **Bold**: `**bold**` → **bold**
- **Bold** (alt): `__bold__` → **bold**
- _Italic_: `*italic*` → _italic_
- _Italic_ (alt): `_italic_` → _italic_
- **_Bold-Italic_**: `***bold italic***` → **_bold italic_**
- **_Bold-Italic_** (alt): `___bold italic___` → **_bold italic_**
- ~~Strikethrough~~: `~~strike~~` → ~~strike~~
- ==Highlighted== (not always supported): `==highlight==` → ==highlight==
- ==test==
-
- Escaped \*asterisk\*: `\*asterisk\*` → \*asterisk\*
- Escaped backticks: ``\`not code\``` → \`not code\`
- Nested formatting: **Bold inside _italic_**, \*Italic inside **bold\***, _\*\*Bold/italic \_nested_\*\* and `inline code`\_
- Formatting with punctuation: _italic!_, **bold?**, **_combo_**, _italic_, etc.

## Code

Inline code: `` This is `inline code` in text ``

```
Code block (fenced, no language)
```

```js
// Code block (javascript)
console.log("Hello, world!");
let x = 5;
let y = 10;
console.log("Sum:", x + y);
```

/_ End of Selection _/

```python
# Code block (tildes, python)
print("Hello with tildes")
```

## Links and Images

- Inline link: [Example](https://example.com)
- Link with title: [with title](https://example.com "title here")
- Reference link: [Google][g]
- Auto-link: <https://github.com>
- ![alt text for image](https://via.placeholder.com/80)
- Reference image: ![Ref image][img1]

[g]: https://google.com
[img1]: https://via.placeholder.com/40

## Block Elements

# H1 Heading

## H2 Heading

### H3 Heading

#### H4 Heading

##### H5 Heading

###### H6 Heading

# Heading with leading whitespace

# Heading with trailing whitespace

Unordered list:

- Item one

* Item two

- Item three

Ordered list:

1. First
2. Second
3. Third

Nested lists:

- Top
  - Nested
    - Deep nested

Task lists:

- [ ] Todo item
- [x] Done item

List item with multiple paragraphs:

- First paragraph.

  Second paragraph in the same item.

List item with code block:

- List + code:

      let x = 1;

List item with blockquote:

- List + quote:

  > Nested quote

Blockquotes:

> Just a quote



> Quote
>
> With two paragraphs

> Quote
>
> - With a list
> - More

> Quote with code block:
>
> console.log("Inside quote");


Horizontal rules:

---

---
