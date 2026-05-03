export class TextSimilarity {
  static normalizeText(s) {
    if (!s) return '';
    return s.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  static levenshtein(a, b) {
    const na = a.length, nb = b.length;
    if (na === 0) return nb;
    if (nb === 0) return na;
    const v0 = new Array(nb + 1).fill(0);
    const v1 = new Array(nb + 1).fill(0);
    for (let j = 0; j <= nb; j++) v0[j] = j;
    for (let i = 0; i < na; i++) {
      v1[0] = i + 1;
      for (let j = 0; j < nb; j++) {
        const cost = a[i] === b[j] ? 0 : 1;
        v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
      }
      for (let j = 0; j <= nb; j++) v0[j] = v1[j];
    }
    return v1[nb];
  }

  static similarityScore(a, b) {
    const na = this.normalizeText(a);
    const nb = this.normalizeText(b);
    if (!na && !nb) return 1;
    if (!na || !nb) return 0;
    const dist = this.levenshtein(na, nb);
    return Math.max(0, 1 - dist / Math.max(na.length, nb.length));
  }
}
