"""Core transformations for the esoteric library."""

from __future__ import annotations


VOWEL_CYCLE = {
    "a": "e",
    "e": "i",
    "i": "o",
    "o": "u",
    "u": "a",
    "A": "E",
    "E": "I",
    "I": "O",
    "O": "U",
    "U": "A",
}

SIGILS = "☉☽☿♀♂♃♄⚚⚝"


def mirror_text(text: str) -> str:
    """Reverse each word's characters but keep word positions intact."""
    return " ".join(word[::-1] for word in text.split(" "))


def vowel_cipher(text: str) -> str:
    """Rotate vowels through a mystical cycle (a→e→i→o→u→a)."""
    return "".join(VOWEL_CYCLE.get(ch, ch) for ch in text)


def sigil_hash(seed: str) -> str:
    """Create a deterministic symbolic digest from input text."""
    total = 0
    for idx, char in enumerate(seed, start=1):
        total += idx * ord(char)

    glyphs = []
    base = len(SIGILS)
    value = total or 1
    while value:
        value, rem = divmod(value, base)
        glyphs.append(SIGILS[rem])

    return "".join(reversed(glyphs))
