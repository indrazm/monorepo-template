// Minimal profanity mask for rendered notification text (FR-NGS-07). Keeps a
// small word list; replaces the inner letters with asterisks.
const WORDS = ["damn", "shit", "fuck", "bitch", "asshole", "bastard", "crap"];
const PATTERN = new RegExp(`\\b(${WORDS.join("|")})\\b`, "gi");

export function maskProfanity(text: string): string {
  return text.replace(PATTERN, (word) =>
    word.length <= 2
      ? "*".repeat(word.length)
      : `${word[0]}${"*".repeat(word.length - 2)}${word.at(-1)}`,
  );
}
