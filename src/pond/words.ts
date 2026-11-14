// A Chinese title set word by word, so it breaks only between words (setHero() in engine.js). The words
// come from Intl.Segmenter; punctuation stays on the word before it, and a character the dictionary left
// standing alone (it splits 荷叶 into 荷 and 叶) joins the word after it.
export function titleWords(text: string, seg: { segment(t: string): Iterable<{ segment: string }> }): string[] {
  const words: string[] = [];
  let lone = '';
  for (const { segment } of seg.segment(text)) {
    if (words.length && /^[\s\p{P}]+$/u.test(segment)) {
      words[words.length - 1] += lone + segment;
      lone = '';
    } else if (segment.length === 1 && !lone) lone = segment;
    else {
      words.push(lone + segment);
      lone = '';
    }
  }
  if (lone) words.push(lone);
  return words;
}
