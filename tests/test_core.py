import unittest

from esoteric_library import mirror_text, sigil_hash, vowel_cipher


class CoreTests(unittest.TestCase):
    def test_mirror_text(self):
        self.assertEqual(mirror_text("arcane arts"), "enacra stra")
        self.assertEqual(mirror_text("a  b"), "a  b")

    def test_vowel_cipher(self):
        self.assertEqual(vowel_cipher("eldritch tome"), "ildrotch tumi")
        self.assertEqual(vowel_cipher("AEIOU"), "EIOUA")

    def test_sigil_hash_deterministic(self):
        self.assertEqual(sigil_hash("moon"), sigil_hash("moon"))
        self.assertNotEqual(sigil_hash("moon"), sigil_hash("sun"))


if __name__ == "__main__":
    unittest.main()
