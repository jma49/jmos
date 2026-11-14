// What the pond says that the rest of the site doesn't: its words in
// Chinese and Japanese, and what it plays. The paragraphs may
// hold <i>; they are the owner's text, never a visitor's.

/**
 * The pond in Chinese, chosen with 中 apart from the look: the same words in plain, natural Chinese, set in the brush.
 * `{u}` is filled in by the script.
 */
export const ZH = {
  greetings: {
    night: ['这么晚，还没睡？', '夜深了，进来坐坐。'],
    morning: ['早上好。', '早，今天也来看鱼？'],
    afternoon: ['下午好。', '午后，坐一会儿吧。'],
    evening: ['晚上好。', '傍晚了，多待一会儿。'],
    any: ['欢迎来到池塘。', '你好呀。', '你找到这儿了。', '慢慢看，不着急。', '小心荷叶。', '来了就坐一会儿。', '水正好，进来吧。', '谢谢你来。']
  },
  say: '你是那条带红点的白色锦鲤。点一下水面，可以喂其他的鱼。',
  faces: '找找它别的样子',
  talk: '聊天',
  firstLine: '留下第一句话',
  clock: { yours: '你的时间' },
  chapters: {
    music: '音乐',
    notes: '留言',
    chat: '聊天',
    account: '账号'
  } as Record<string, string>,
  music: { title: '在听', lede: '坂本龙一，多是钢琴，安静的时候我就放这些。池塘的声音开关也管着它。', empty: '歌单正在来的路上。' },
  notes: {
    title: '纸船',
    lede: '这是留言簿。留一句话，每天几条，它会变成纸船漂过池塘，路过的人都能看到。',
    placeholder: '留一句话',
    empty: '还没有纸船。',
    why: '后就能留言'
  },
  chat: {
    title: '聊天',
    placeholder: '对大家说点什么',
    empty: '这里还没人说话。',
    anyone: '谁都可以看，登录后可以发言。',
    you: '你是 {u}。友善一点，大家都看得到。',
    why: '后就能发言'
  },
  account: {
    signIn: '登录',
    signUp: '注册',
    lede: '和旧桌面是同一个账号。',
    ledeUp: '用户名和密码就够了，找回邮箱可以不填。',
    signedIn: '已登录。你的锦鲤会带着你的名字，可以留言和聊天。',
    signOut: '退出登录',
    username: '用户名',
    password: '密码',
    recovery: '找回邮箱',
    optional: '（可选）',
    make: '注册',
    have: '已有账号',
    makeOne: '注册账号',
    closed: '这个版本的网站没有开放登录。'
  }
};

/**
 * The pond in Japanese, chosen with 日: the same words as ZH, in plain Japanese, set in Yuji Syuku and
 * Shippori Mincho (kana.css). Shaped like ZH so the script reads either the same way.
 */
export const JA: typeof ZH = {
  greetings: {
    night: ['夜更かしですね。', 'こんな時間に、ようこそ。'],
    morning: ['おはようございます。', 'おはよう。今日も鯉を見に？'],
    afternoon: ['こんにちは。', '午後のひととき、どうぞ。'],
    evening: ['こんばんは。', '夕方ですね。ゆっくりしていって。'],
    any: [
      'ようこそ、池へ。',
      'こんにちは。',
      'よく見つけましたね。',
      'ゆっくりどうぞ。',
      '睡蓮に気をつけて。',
      '少し座っていきませんか。',
      '水はちょうどいいですよ。',
      '来てくれてありがとう。'
    ]
  },
  say: 'あなたは赤い斑点のある白い鯉です。水面に触れると、ほかの鯉に餌をあげられます。',
  faces: 'ほかの姿を探す',
  talk: 'チャット',
  firstLine: '最初のひとことを',
  clock: { yours: 'あなたの時間' },
  chapters: {
    music: '音楽',
    notes: '伝言',
    chat: 'チャット',
    account: 'アカウント'
  },
  music: {
    title: 'いま聴いている曲',
    lede: 'くり返し聴いている曲です。前のデスクトップと同じプレイリストで、池の音のスイッチでまとめて消せます。',
    empty: 'プレイリストを読み込んでいます。'
  },
  notes: {
    title: '紙の舟',
    lede: 'ゲストブックです。ひとこと残すと紙の舟になって池を渡り、通りかかった人が読めます。一日に数件まで。',
    placeholder: 'ひとこと残す',
    empty: '紙の舟はまだありません。',
    why: 'すると書き込めます'
  },
  chat: {
    title: 'チャット',
    placeholder: 'みんなにひとこと',
    empty: 'まだ誰も話していません。',
    anyone: '誰でも読めます。話すにはサインインしてください。',
    you: 'あなたは {u} です。みんなに見えるので、やさしい言葉で。',
    why: 'すると話せます'
  },
  account: {
    signIn: 'サインイン',
    signUp: '新規登録',
    lede: '前のデスクトップと同じアカウントです。',
    ledeUp: 'ユーザー名とパスワードだけで作れます。復旧用のメールは任意です。',
    signedIn: 'サインインしています。あなたの鯉に名前がつき、伝言とチャットができます。',
    signOut: 'サインアウト',
    username: 'ユーザー名',
    password: 'パスワード',
    recovery: '復旧用のメール',
    optional: '（任意）',
    make: '登録する',
    have: 'アカウントを持っています',
    makeOne: 'アカウントを作る',
    closed: 'このサイトでは、いまサインインできません。'
  }
};

/**
 * What the pond plays: Ryuichi Sakamoto only, quiet piano for the water. The desktop's iPod keeps the
 * whole library. These come first, in this order; the songs not in the library (`/api/songs`, or
 * src/data/songs.json) are named here, all official uploads. After them, the rest of his songs the
 * library has. Sakamoto's songs are found by artist.
 */
// `lead` is the first song's name, shown in the contents before the library has loaded (it loads when
// the music is opened or played)
export const POND_MUSIC: {
  artist: RegExp;
  lead: { title: string; artist: string };
  first: string[];
  extra: { id: string; title: string; artist: string; album: string }[];
} = {
  artist: /sakamoto|坂本/i,
  lead: { title: 'aqua', artist: 'Ryuichi Sakamoto' },
  first: ['SJcbMTz2oNw', 'ELJf83TelA0', 'pygwK0sBUdM', 'n6OqLXvri3M', 'jHC_yMY9N0I', '__aJL8i1kL4', 'Se8cQsuBhaA', 'n59qeMSCAgA'],
  extra: [
    { id: 'ELJf83TelA0', title: 'Merry Christmas Mr. Lawrence', artist: 'Ryuichi Sakamoto', album: 'Playing the Piano 2022' },
    { id: 'pygwK0sBUdM', title: 'andata', artist: 'Ryuichi Sakamoto', album: 'async' },
    { id: 'n6OqLXvri3M', title: 'solari', artist: 'Ryuichi Sakamoto', album: 'async' },
    { id: '__aJL8i1kL4', title: 'The Sheltering Sky', artist: 'Ryuichi Sakamoto', album: 'The Sheltering Sky' },
    { id: 'Se8cQsuBhaA', title: '20220304', artist: 'Ryuichi Sakamoto', album: '12' }
  ]
};
