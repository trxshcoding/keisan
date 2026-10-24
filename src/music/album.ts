export function albumNameForDisplay(albumName: string): string {
  return albumName.replace(/\s+-\s+(?:single|ep)$/i, "").trim();
}

const infoIndicatorPatterns = [
  /\s*\(\s*(?:feat\.?|ft\.?|featuring|with)\b[^)]*\)/gi,
  /\s*\[\s*(?:feat\.?|ft\.?|featuring|with)\b[^\]]*\]/gi,
  /\s*-\s*(?:feat\.?|ft\.?|featuring)\b.*$/i,
  /\s+(?:feat\.?|ft\.?|featuring)\b.*$/i,
  /\s*\(\s*(?:remaster(?:ed)?|deluxe(?:\s+edition)?|(?:super\s|ultra\s)?(?:slow(?:ed)?|sped)|(?:night|day)core|live|official|radio\s+edit|single|ep)\b[^)]*\)/gi,
  /\s*\[\s*(?:remaster(?:ed)?|deluxe(?:\s+edition)?|(?:super\s|ultra\s)?(?:slow(?:ed)?|sped)|(?:night|day)core|live|official|radio\s+edit|single|ep)\b[^\]]*\]/gi,
  /\s+-\s+(?:remaster(?:ed)?|deluxe(?:\s+edition)?|(?:super\s|ultra\s)?(?:slow(?:ed)?|sped)|(?:night|day)core|live|official|radio\s+edit|single|ep)$/i,
];

export function albumNameForComparison(albumName: string): string {
  return infoIndicatorPatterns
    .reduce((name, pattern) => name.replace(pattern, ""), albumNameForDisplay(albumName))
    .trim();
}
