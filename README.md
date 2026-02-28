# Esoteric Library

A tiny Python library with playful "esoteric" text transformations:

- `mirror_text`: reverses text while preserving word order boundaries.
- `vowel_cipher`: rotates vowels through a custom cycle.
- `sigil_hash`: deterministic symbolic digest for short identifiers.

## Quick start

```python
from esoteric_library import mirror_text, vowel_cipher, sigil_hash

print(mirror_text("arcane arts"))
print(vowel_cipher("eldritch tome"))
print(sigil_hash("moon"))
```

## Run tests

```bash
python -m unittest -v
```
