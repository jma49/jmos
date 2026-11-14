// The seal album (集印册): each look has a seal, stamped the first time a visitor reaches it, kept in
// volumes. What's here is the album's own state and words, apart from the pond that shows them
// (engine.js): which seals there are, what has been found and when, what counts as a full volume.
// It is kept in this browser only; nothing about it is sent anywhere.

/** How a seal is cut: its characters, its outline, and whether they are white in red (白文) or red in paper (朱文). */
export interface Seal {
  id: string;
  chars: string;
  shape: 'square' | 'round' | 'tall';
  cut: 'white' | 'red';
  /** Only in a preview build: a look visitors can't reach yet (none is, as it stands). */
  preview?: boolean;
  /** A place kept in the album for a look that isn't chosen yet: shown as coming, never stamped. */
  soon?: boolean;
}
export interface Volume {
  id: string;
  seals: Seal[];
  /** places kept for looks still to come */
  soon?: number;
  /** a volume apart from the album proper (play, or what only the weather brings): the album is full without it */
  extra?: boolean;
}
/** The volumes in order. A new look's seal is added to a volume, or a volume added, here and nowhere else. */
export const VOLUMES: Volume[] = [
  {
    id: 'painted',
    seals: [
      { id: 'ink', chars: '墨', shape: 'square', cut: 'white' },
      { id: 'ukiyo', chars: '浮世', shape: 'tall', cut: 'red' },
      { id: 'monet', chars: '莲', shape: 'round', cut: 'white' },
      { id: 'qinghua', chars: '青花', shape: 'tall', cut: 'white' },
      { id: 'dunhuang', chars: '敦煌', shape: 'tall', cut: 'red' }
    ]
  },
  {
    id: 'drawn',
    seals: [
      { id: 'glow', chars: '光', shape: 'round', cut: 'red' },
      { id: 'blueprint', chars: '图', shape: 'square', cut: 'white' },
      { id: 'ascii', chars: '字', shape: 'square', cut: 'red' },
      { id: 'stars', chars: '星', shape: 'round', cut: 'white' },
      { id: 'relief', chars: '刻', shape: 'square', cut: 'white' }
    ]
  },
  // Seals for an occasion and not a look: each is stamped when the pond is in that state while someone
  // is there (the rain, snow, the full moon, a festival, the dawn). Nobody can call the weather, so the
  // album is full without them.
  {
    id: 'hours',
    extra: true,
    seals: [
      { id: 'rain', chars: '雨', shape: 'square', cut: 'white' },
      { id: 'snow', chars: '雪', shape: 'round', cut: 'white' },
      { id: 'moon', chars: '月', shape: 'round', cut: 'red' },
      { id: 'fest', chars: '节', shape: 'square', cut: 'red' },
      { id: 'dawn', chars: '晨', shape: 'square', cut: 'white' }
    ]
  },
  // The end: the pond as a rubbing taken from the carved stone. It has no gesture: once the two volumes
  // of looks are full, their seals are pressed in the album in the order they are kept (WAY).
  {
    id: 'end',
    seals: [{ id: 'rubbing', chars: '拓', shape: 'square', cut: 'white' }]
  },
  // Idle seals (闲章), for the pond's small games. Nothing depends on them.
  {
    id: 'idle',
    extra: true,
    seals: [
      { id: 'skip', chars: '漂', shape: 'round', cut: 'red' },
      { id: 'leap', chars: '跃', shape: 'square', cut: 'white' },
      { id: 'catch', chars: '捕', shape: 'square', cut: 'red' },
      { id: 'race', chars: '舟', shape: 'round', cut: 'white' }
    ]
  }
];
/** The way back through the album that opens the end: the looks' seals in the order the volumes keep them. */
export const WAY: string[] = VOLUMES.slice(0, 2).flatMap((v) => v.seals.map((x) => x.id));
/** The steps taken so far with one more seal pressed: the next on the way goes on, anything else starts again. */
export const walked = (steps: string[], id: string): string[] => (id === WAY[steps.length] ? [...steps, id] : id === WAY[0] ? [id] : []);

/**
 * The looks as two chains, a volume each: a look on show carries a clue to the next one's gesture, until
 * that one's seal is found. The last of each chain points nowhere.
 */
export const NEXT: Record<string, string> = {
  ink: 'ukiyo',
  ukiyo: 'monet',
  monet: 'qinghua',
  qinghua: 'dunhuang',
  glow: 'blueprint',
  blueprint: 'ascii',
  ascii: 'stars',
  stars: 'relief'
};
/** The look a clue should point to while this one is on show, or '' when there is none to give. */
export const clueFor = (look: string, a: Album): string => (NEXT[look] && !has(a, NEXT[look]) ? NEXT[look] : '');

/** The volumes as this build has them: without the looks that are only previews, unless it is one. */
export const volumes = (preview: boolean): Volume[] =>
  VOLUMES.map((v) => ({
    ...v,
    seals: v.seals.filter((s) => !s.soon && (preview || !s.preview)),
    soon: preview ? v.seals.filter((s) => s.soon).length : 0
  })).filter((v) => v.seals.length);

export interface Album {
  /** seal id → the day it was found (YYYY-MM-DD, the visitor's own date) */
  found: Record<string, string>;
  /** volumes whose large seal has been shown stamping */
  sealed: string[];
  /** the day the line on the water was shown, once */
  hinted: string;
  /** how many times the pond has been opened */
  visits: number;
}
export const emptyAlbum = (): Album => ({ found: {}, sealed: [], hinted: '', visits: 0 });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The album as stored, whatever is there: anything missing or mangled is left out. */
export function readAlbum(raw: string | null): Album {
  const a = emptyAlbum();
  if (!raw) return a;
  try {
    const o = JSON.parse(raw) as Partial<Album> | null;
    if (!o || typeof o !== 'object') return a;
    if (o.found && typeof o.found === 'object') for (const [k, v] of Object.entries(o.found)) if (typeof v === 'string' && DAY.test(v)) a.found[k] = v;
    if (Array.isArray(o.sealed)) a.sealed = o.sealed.filter((x) => typeof x === 'string');
    if (typeof o.hinted === 'string' && DAY.test(o.hinted)) a.hinted = o.hinted;
    if (typeof o.visits === 'number' && o.visits > 0) a.visits = Math.floor(o.visits);
  } catch {
    /* not JSON: an empty album */
  }
  return a;
}
export const writeAlbum = (a: Album): string => JSON.stringify(a);

/** YYYY-MM-DD where the visitor is. */
export const dayOf = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const has = (a: Album, id: string): boolean => id in a.found;
export const count = (a: Album): number => Object.keys(a.found).length;
/** A volume is full when every seal this build has for it is found. */
export const full = (a: Album, v: Volume): boolean => v.seals.length > 0 && v.seals.every((s) => has(a, s.id));
export const allFull = (a: Album, vols: Volume[]): boolean => vols.length > 0 && vols.filter((v) => !v.extra).every((v) => full(a, v));

/**
 * Stamps a seal: the album with it, whether it is new (a seal is stamped once, and keeps its first day),
 * and the volume it has just filled, if it has.
 */
export function stamp(a: Album, id: string, day: string, vols: Volume[]): { album: Album; fresh: boolean; filled: Volume | null } {
  const vol = vols.find((v) => v.seals.some((s) => s.id === id));
  if (!vol || has(a, id)) return { album: a, fresh: false, filled: null };
  const album = { ...a, found: { ...a.found, [id]: day } };
  return { album, fresh: true, filled: full(album, vol) ? vol : null };
}
/** The seals cleared, to find them again; that the line on the water was once shown, and the visits, stay. */
export const clearSeals = (a: Album): Album => ({ ...a, found: {}, sealed: [] });
/** A volume's large seal has been shown. */
export const markSealed = (a: Album, vol: string): Album => (a.sealed.includes(vol) ? a : { ...a, sealed: [...a.sealed, vol] });

/** Whether the album's small mark shows: once a seal is found, or on a later visit by someone the line didn't reach. */
export const entryShows = (a: Album): boolean => count(a) > 0 || (a.hinted !== '' && a.visits > 1);
/** Whether the line on the water may still be shown: once, and never after a seal. */
export const mayHint = (a: Album): boolean => count(a) === 0 && a.hinted === '';

export type Lang = 'en' | 'zh' | 'ja';
/** The day a seal was found, as each language writes a date. */
export function dayText(day: string, lang: Lang): string {
  const [y, m, d] = day.split('-').map(Number);
  if (lang === 'zh') return `${y}.${m}.${d}`;
  if (lang === 'ja') return `${y}年${m}月${d}日`;
  return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
}

/** The album's words. A hint points at how a look is found without saying it outright. */
export interface SealWords {
  title: string;
  lede: string;
  volumes: Record<string, string>;
  names: Record<string, string>;
  hints: Record<string, string>;
  thanks: Record<string, string>;
  koi: string;
  both: string;
  soon: string;
  line: string;
  /** The album's button that starts it again, and what it asks before it does. */
  clear: string;
  clearAsk: string;
}
export const SEAL_WORDS: Record<Lang, SealWords> = {
  en: {
    title: 'Seals',
    lede: 'The pond can look more than one way. Each look has a seal, stamped the first time you find it.',
    volumes: { painted: 'Painted', drawn: 'Drawn', hours: 'Occasions', end: 'The end', idle: 'Idle hours' },
    names: {
      ink: 'Ink',
      ukiyo: 'Ukiyo-e',
      monet: 'Water lilies',
      qinghua: 'Blue and white',
      dunhuang: 'Dunhuang',
      glow: 'Glow',
      blueprint: 'Blueprint',
      ascii: 'ASCII',
      stars: 'Star chart',
      relief: 'Relief',
      rain: 'Rain',
      snow: 'Snow',
      moon: 'Full moon',
      fest: 'Festival',
      dawn: 'Dawn',
      rubbing: 'Rubbing',
      skip: 'Skipping stones',
      leap: 'The leap',
      catch: 'The catch',
      race: 'The race'
    },
    hints: {
      ink: 'Stillness leaves a mark.',
      ukiyo: 'A full turn raises a wave.',
      monet: 'A painter dabs, and dabs again.',
      qinghua: 'Run a finger round the rim.',
      dunhuang: 'Brush the dust from the wall.',
      glow: 'The moon is nearer than it looks.',
      blueprint: 'Every drawing starts with one straight line.',
      ascii: 'Say something.',
      stars: 'Three stars, far apart, make a figure.',
      relief: 'Water is written as a zigzag.',
      rain: 'Come by when it rains where you are.',
      snow: 'Some days the pond freezes over.',
      moon: 'Once a month the night is bright.',
      fest: 'A few days a year, the pond dresses up.',
      dawn: 'Be here before the sun is.',
      rubbing: 'Fill the first two volumes. Then, here in the album, go back the way you came.',
      skip: 'A flat stone, thrown low and fast. Five skips.',
      leap: 'Feed them in one place, and keep feeding until they all come.',
      catch: 'Tap a lily pad while the spider is about.',
      race: 'At Dragon Boat a boat crosses, far off. Paddle with it: press the water beside it.'
    },
    thanks: {
      painted: 'Every painted one. Thank you for looking so closely.',
      drawn: 'Every drawn one. Thank you for trying things.',
      hours: 'Every occasion. Thank you for coming back.',
      end: 'That is all of it. Thank you for finding everything.',
      idle: 'Time well wasted.'
    },
    koi: 'Your koi wears a seal from now on.',
    both: 'The album is full. The gold koi wears one too, to match.',
    soon: 'Still to come.',
    line: 'The water answers more than a tap.',
    clear: 'Clear my seals',
    clearAsk: 'Clear them all?'
  },
  zh: {
    title: '集印册',
    lede: '池塘不止一种样子。每一种都有一方印，第一次遇见时盖上。',
    volumes: { painted: '画', drawn: '线', hours: '时', end: '终', idle: '闲' },
    names: {
      ink: '水墨',
      ukiyo: '浮世绘',
      monet: '睡莲',
      qinghua: '青花',
      dunhuang: '敦煌',
      glow: '夜光',
      blueprint: '蓝图',
      ascii: '字符',
      stars: '星图',
      relief: '浮雕',
      rain: '雨',
      snow: '雪',
      moon: '满月',
      fest: '节日',
      dawn: '清晨',
      rubbing: '拓片',
      skip: '打水漂',
      leap: '鱼跃',
      catch: '捕虫',
      race: '竞渡'
    },
    hints: {
      ink: '停一停，会留下痕迹。',
      ukiyo: '转满一圈，起一道浪。',
      monet: '画家总是点了又点。',
      qinghua: '沿着碗沿，走一圈。',
      dunhuang: '拂一拂墙上的尘。',
      glow: '月亮比看上去近。',
      blueprint: '每张图纸，都从一条直线开始。',
      ascii: '说点什么。',
      stars: '隔得远远的三颗星，连成一个形。',
      relief: '古人画水，画成一道折线。',
      rain: '你那里下雨的时候，来看看。',
      snow: '有些日子，池塘会结冰。',
      moon: '每个月有一夜，特别亮。',
      fest: '一年里有几天，池塘会打扮。',
      dawn: '比太阳早一点到。',
      rubbing: '集满前两册，再在这册子里，按来路走一遍。',
      skip: '一块扁石头，低低地、快快地甩出去。跳五下。',
      leap: '在同一处一直喂，喂到鱼都来。',
      catch: '跳蛛在的时候，点一片荷叶。',
      race: '端午那天，远处有龙舟划过。在船边点水，帮它划到对岸。'
    },
    thanks: {
      painted: '画的这一册集齐了。谢谢你看得这么仔细。',
      drawn: '线的这一册集齐了。谢谢你什么都试一试。',
      hours: '时的这一册集齐了。谢谢你一次次回来。',
      end: '到这里就是全部了。谢谢你把它们都找到。',
      idle: '偷得浮生半日闲。'
    },
    koi: '你的锦鲤，从此带着一方印。',
    both: '册子集齐了。金色的那条也盖了一方，和你作伴。',
    soon: '还没画好。',
    line: '水面不只会回应点击。',
    clear: '清空我的印',
    clearAsk: '全部清空？'
  },
  ja: {
    title: '集印帳',
    lede: '池の姿はひとつではありません。姿ごとに印がひとつあり、初めて出会ったときに押されます。',
    volumes: { painted: '絵', drawn: '線', hours: '時', end: '終', idle: '閑' },
    names: {
      ink: '水墨',
      ukiyo: '浮世絵',
      monet: '睡蓮',
      qinghua: '染付',
      dunhuang: '敦煌',
      glow: '夜光',
      blueprint: '青写真',
      ascii: '文字',
      stars: '星図',
      relief: 'レリーフ',
      rain: '雨',
      snow: '雪',
      moon: '満月',
      fest: '祭り',
      dawn: '夜明け',
      rubbing: '拓本',
      skip: '水切り',
      leap: '跳ねる',
      catch: '捕まえる',
      race: '競渡'
    },
    hints: {
      ink: 'じっとしていると、跡が残る。',
      ukiyo: 'ひとまわりで、波が立つ。',
      monet: '画家は、何度も筆を置く。',
      qinghua: '器のふちを、ぐるりとなぞる。',
      dunhuang: '壁のほこりを、はらってみる。',
      glow: '月は、見た目より近い。',
      blueprint: 'どの図面も、まっすぐな一本から。',
      ascii: 'なにか言ってみて。',
      stars: '離れた星みっつで、かたちになる。',
      relief: '水は、ぎざぎざの線で書く。',
      rain: 'そちらが雨の日に、どうぞ。',
      snow: '池が凍る日があります。',
      moon: '月に一度、夜が明るい。',
      fest: '年に数日、池は着飾ります。',
      dawn: '日の出より先に。',
      rubbing: '二冊をそろえたら、この帳の中で、来た道をもう一度。',
      skip: '平たい石を、低く、速く。五回はねたら。',
      leap: '同じところで餌をやりつづけて、みんなが来るまで。',
      catch: '蜘蛛がいるとき、蓮の葉をたたく。',
      race: '端午の日、遠くを竜舟が渡る。そばの水をたたいて、いっしょに漕ぐ。'
    },
    thanks: {
      painted: '絵の一冊がそろいました。じっくり見てくれて、ありがとう。',
      drawn: '線の一冊がそろいました。いろいろ試してくれて、ありがとう。',
      hours: '時の一冊がそろいました。何度も来てくれて、ありがとう。',
      end: 'これで全部です。すべて見つけてくれて、ありがとう。',
      idle: 'よい暇つぶしでした。'
    },
    koi: 'あなたの鯉に、印がひとつ付きました。',
    both: '印譜がそろいました。金の鯉にも、おそろいの印を。',
    soon: 'まだ準備中。',
    line: '水面は、タップのほかにも応えます。',
    clear: '印を消す',
    clearAsk: 'すべて消しますか？'
  }
};

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
/**
 * Where a seal is cut in the sheet of seals in seal script (public/pond/ink/seals.webp: cells four
 * across, the looks' seals in order, then Jincheng's own), as [column, row].
 */
export const OWN = 'own';
const CUT = ['ink', 'ukiyo', 'monet', 'qinghua', 'dunhuang', 'glow', 'blueprint', 'ascii', 'stars', 'relief', OWN];
/** A seal's cell in the sheet, or null for one the sheet doesn't have (it stays in the brush). */
export function sealCell(id: string): [number, number] | null {
  const i = CUT.indexOf(id);
  return i < 0 ? null : [i % 4, Math.floor(i / 4)];
}
// (data-p marks a seal the sheet has: the styles put the cut picture only on those)
const cellStyle = (id: string): string => {
  const at = sealCell(id);
  return at ? `data-p style="--c:${at[0]};--r:${at[1]}"` : '';
};
/** A seal's markup: its characters, each in its own cell (pond.css cuts and colours it). */
export const sealMark = (s: Seal, cls = ''): string =>
  `<b class="seal-m${cls ? ' ' + cls : ''}" data-shape="${s.shape}" data-cut="${s.cut}" data-n="${[...s.chars].length}" ${cellStyle(s.id)} lang="zh" aria-hidden="true">${[...s.chars].map((c) => `<span>${esc(c)}</span>`).join('')}</b>`;
/** An empty place: the seal's outline and nothing in it. */
export const sealBlank = (s: Seal): string => `<b class="seal-m blank" data-shape="${s.shape}" aria-hidden="true"></b>`;

/**
 * The album as a sheet: a leaf of paper for each volume, its seals in a row, found ones in vermilion with
 * their day, the rest an outline and a hint; a full volume carries the large seal and a line of thanks.
 * `fresh` names the volumes whose large seal is shown for the first time (it stamps as the sheet opens).
 */
export function albumHTML(a: Album, vols: Volume[], lang: Lang, fresh: string[] = []): string {
  const w = SEAL_WORDS[lang],
    roman = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  // the last volume the album proper counts: the word for a full album is said under it
  const last = vols.filter((x) => !x.extra).at(-1)?.id;
  const leaf = (v: Volume, i: number) => {
    const n = v.seals.filter((s) => has(a, s.id)).length,
      done = full(a, v);
    return `<section class="vol"${done ? ' data-done' : ''}><header><i>${lang === 'en' ? roman[i] : `第${'一二三四五六'[i]}${lang === 'ja' ? '冊' : '册'}`}</i><b>${esc(w.volumes[v.id])}</b><em>${n} / ${v.seals.length}</em></header><div class="leaf"><ol class="slots">${v.seals
      .map((s) =>
        has(a, s.id)
          ? `<li data-found data-id="${s.id}">${sealMark(s)}<span class="nm">${esc(w.names[s.id])}</span><time datetime="${a.found[s.id]}">${dayText(a.found[s.id], lang)}</time></li>`
          : `<li>${sealBlank(s)}<span class="hint">${esc(w.hints[s.id])}</span></li>`
      )
      .join(
        ''
      )}${`<li class="soon"><b class="seal-m blank" data-shape="square" aria-hidden="true"></b><span class="hint">${esc(w.soon)}</span></li>`.repeat(v.soon ?? 0)}</ol>${
      done
        ? `<p class="grand"${fresh.includes(v.id) ? ' data-fresh' : ''}><span>${esc(w.thanks[v.id])}${v.id === 'painted' ? `<br>${esc(w.koi)}` : ''}${allFull(a, vols) && v.id === last && vols.length > 1 ? `<br>${esc(w.both)}` : ''}</span><b class="seal-m own" data-shape="tall" data-cut="white" data-n="2" ${cellStyle(OWN)} lang="zh" aria-hidden="true"><span>锦</span><span>程</span></b></p>`
        : ''
    }</div></section>`;
  };
  return `<h1>${esc(w.title)}</h1><p class="lede">${esc(w.lede)}</p>${vols.map(leaf).join('')}`;
}
