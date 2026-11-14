import { describe, expect, it } from 'vitest';
import { titleWords } from './words';

const seg = new Intl.Segmenter('zh', { granularity: 'word' });

describe('a title word by word', () => {
  it('keeps every character, in order', () => {
    for (const t of ['小心荷叶。', '你找到这儿了。', '慢慢看，不着急。', '来了就坐一会儿。', '谢谢你来。', '你好呀。'])
      expect(titleWords(t, seg).join('')).toBe(t);
  });
  it('keeps punctuation on the word before and a lone character with the word after', () => {
    expect(titleWords('小心荷叶。', seg)).toEqual(['小心', '荷叶。']);
    expect(titleWords('慢慢看，不着急。', seg)).toEqual(['慢慢看，', '不着急。']);
    expect(titleWords('你找到这儿了。', seg)).toEqual(['你找到', '这儿了。']);
  });
});
