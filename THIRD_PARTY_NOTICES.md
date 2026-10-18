# Hinweise zu Fremdcode

## Bencho (bencho.dev)

Mehrere Bausteine in `src/components/ui/` und `src/features/start/components/` sind Nachbauten für React Native nach Blöcken aus Bencho (https://github.com/cabralorenzo/bencho). Verwendet wurden nur die frei lizenzierten Blöcke (MIT), keine Pro-Blöcke:

| Baustein in der App                                      | Bencho-Block (`blocks/…`) |
| -------------------------------------------------------- | ------------------------- |
| `slide-to-confirm.tsx`                                   | `slide-confirm`           |
| `switch.tsx`                                             | `liq-toggle`              |
| `checkbox.tsx`                                           | `checklist`               |
| `text-field.tsx`                                         | `label-input`             |
| `code-input.tsx`                                         | `one-time-code`           |
| `search-toggle.tsx`                                      | `seek`                    |
| `create-morph.tsx`                                       | `liq-create`              |
| `toast.tsx`                                              | `toast-stack`             |
| `avatar-stack.tsx`                                       | `picker` (Assignees)      |
| `features/start/components/live-island.tsx`              | `dynamic-island`          |
| `features/start/components/revenue-card.tsx` (Scrubbing) | `stacked-bars`            |

```
MIT License

Copyright (c) 2026 Lorenzo Cabra

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

---

Not covered by this licence: the Bencho name and the goat mark, and the
photographs shown on bencho.dev (none are included here). Third-party
material keeps its own licence; see THIRD_PARTY.md.
```
