// What the pond says that the rest of the site doesn't: the timeline's
// wording, each project's colour, mark and highlights, and the About
// chapter. Dates, titles, stacks and links come from the project pages
// (src/content/projects) and the profile (src/content/site.ts); this is
// the pond's telling of them. Highlights may hold <b> for figures; they
// are the owner's text, never a visitor's.

/** An entry on the timeline: a job, a school or a project. */
export interface LogEntry {
  kind: 'role' | 'school' | 'project';
  id: string;
  title: string;
  /** A logo in public/pond/marks/, by name. */
  mark: string;
  /** Beside the title, small: a project's tagline, a company's other name. */
  tag?: string;
  /** The job or the degree. */
  role?: string;
  place?: string;
  /** When, as it is read: 'Jul 2025 – Sep 2026', '2024', 'Sep 2026'. */
  when: string;
  /** When it began, as a year with a fraction: where it sits on the timeline. */
  s: number;
  text?: string;
  pts?: string[];
  /** A pointer to another entry: its id and what the link says. */
  ref?: [string, string];
  /** A project's picture, its site and its source. */
  cover?: string;
  visit?: string;
  source?: string;
  stack?: string;
  /** A project's colour. */
  c?: string;
}

/** The jobs and schools, newest first; the projects join them from their own pages. */
export const PATH: LogEntry[] = [
  {
    kind: 'role',
    id: 'tiktok',
    mark: 'tiktok',
    title: 'TikTok',
    role: 'Software Engineer',
    place: 'San Jose, CA',
    when: 'Jul 2025 – Sep 2026',
    s: 2025.5,
    text: "Built a multi-agent code review system that ran in GitLab CI on every merge request, and the automation behind Trust & Safety's release gates.",
    pts: [
      'Code review by agents on <b>1,000+</b> merge requests across <b>30+</b> repositories; developers accepted <b>62%</b> of its findings',
      'A coordinator fans out to <b>7</b> specialist agents and merges their output into one schema-validated review, de-duplicated and with the speculative findings filtered out',
      'Token spend cut by <b>30%+</b> with risk-based routing and prompt caching; runs hardened with model failover and prompt-injection sanitization',
      'Release-gate automation in Python and TypeScript, wired into CI/CD: P0/P1 regression coverage from <b>80%</b> to <b>96%</b>, gate time down <b>50%</b>',
      'Scheduled production checks from <b>94%</b> to <b>99.99%</b> reliable; production incidents down <b>30%</b>'
    ]
  },
  {
    kind: 'role',
    id: 'infi',
    mark: 'infi',
    title: 'INFI.US',
    role: 'Software Engineer in Test',
    place: 'Chicago, IL',
    when: 'Jan 2025 – Jun 2025',
    s: 2025.0,
    text: 'Built an internal data-quality monitoring platform on my own, and the end-to-end tests for a self-checkout POS system.',
    pts: [
      '<b>150+</b> scheduled SQL checks a day over <b>50+</b> PostgreSQL tables, with dashboards and webhook alerts',
      'A Playwright framework and device tests for kiosk, Android and iOS, running in CI'
    ],
    ref: ['assay', 'Later rebuilt in the open as Assay']
  },
  {
    kind: 'school',
    id: 'iit',
    mark: 'iit',
    title: 'Illinois Institute of Technology',
    role: 'M.S., Information Technology & Management',
    when: '2024',
    s: 2024.4,
    text: 'GPA 4.0. Teaching assistant for Advanced Software Programming.'
  },
  {
    kind: 'role',
    id: 'carrefour',
    mark: 'carrefour',
    title: 'Carrefour China',
    tag: 'Suning.com',
    role: 'Backend Software Engineer, Management Trainee Program',
    place: 'Shanghai',
    when: 'Jul 2021 – Mar 2022',
    s: 2021.5,
    text: 'Go backend services for a retail data platform.',
    pts: [
      'REST query APIs in Go: <b>80 ms</b> average response, <b>35%</b> higher throughput',
      'OAuth 2.0 / JWT role-based access, and Redis caching with an <b>85%</b> hit rate',
      'GitLab CI/CD that cut release cycle time by <b>30%</b>'
    ]
  },
  {
    kind: 'school',
    id: 'njtech',
    mark: 'njtech',
    title: 'Nanjing University of Technology',
    role: 'B.E., Materials Science and Engineering',
    when: '2021',
    s: 2021.45,
    text: 'Double major in Human Resource Management.'
  }
];

/** What the pond adds to a project page's own front matter, by the page's slug. */
export const PROJECT_EXTRAS: Record<string, { tag: string; c: string; pts: string[] }> = {
  ocra: {
    tag: 'code review engine',
    c: '#e7603a',
    pts: [
      'Ordinary, tested code chooses the files, assigns each a risk tier, matches the rules and anchors every comment to its lines',
      'A verifier drops findings the diff disproves; a judge de-duplicates the rest and calibrates severity',
      'Any model per tier, with failback; every call reports its tokens and dollars',
      'On npm as <b>@open-cr-agent/cli</b>, with a GitHub Action that reviews pull requests from forks'
    ]
  },
  devot: {
    tag: 'notes for Mac and iPhone',
    c: '#5cae6e',
    pts: [
      'Markdown on one side, the finished page on the other; code, maths and Mermaid diagrams render as you write',
      'Nested notebooks, coloured tags, and a status on every note',
      'Search every word, narrowed with <b>book:</b>, <b>tag:</b> or <b>status:</b>; <b>[[</b> links with backlinks',
      'macOS 26+ on Apple Silicon and iOS 26+, synced through your own iCloud'
    ]
  },
  assay: {
    tag: 'SQL data checks',
    c: '#e6b144',
    pts: [
      'A check is a read-only query whose rows are the problems; each run ends Clean, Issues or Broken',
      'Alerts to Slack, Discord, Telegram, Feishu, WeCom or a signed webhook',
      'An MCP server, so agents can list checks, read runs and run them',
      'Changes from non-admins can wait for review, and every edit is recorded'
    ]
  }
};

/** This site, as the pond tells it (its project page is the desktop's). */
export const THIS_POND = {
  id: 'pond',
  title: 'This pond',
  tag: 'the site you are in',
  c: '#6fb9cc',
  when: 'Nov 2026',
  s: 2026.84,
  text: 'A pond where everyone who visits is a koi, with accounts, chat and notes on Supabase.',
  pts: [
    'The water is a ripple simulation, and the glass is drawn in the same shader, so what swims under a pane bends and blurs',
    'It follows the 24 solar terms: petals, lotus and dragonflies, falling leaves, ice that cracks',
    "Devot's dove and ocra's jumping spider were modelled in Blender and are drawn from sprite sheets"
  ],
  stack: 'Astro · TypeScript · WebGL · Supabase',
  source: 'https://github.com/jma49/jmos'
};

/**
 * The About chapter, a paragraph each. A chip opens another chapter:
 * `{work:ocra}` becomes a button with ocra's mark, `{photos}` one to the photos.
 */
export const ABOUT = [
  "I'm a software engineer in the Bay Area. I like handing the tedious parts of shipping software to AI agents, <i>review, tests and release</i>, and building the tools that let a small team move fast.",
  "Most recently I was at TikTok, where I built a multi-agent code review system that runs in CI across 30+ repositories, and the automation and quality gates that Trust &amp; Safety releases pass through. These days I'm building {work:ocra}, an open-source code review engine. I also made {work:devot}, local-first Markdown notes for Mac and iPhone, and {work:assay}, SQL data checks for PostgreSQL.",
  "Away from the keyboard I boulder (V6 for now), take {photos} and keep an eye on the markets. I'm looking for my next role.",
  'This site is a pond. Everyone who visits is a koi, and that includes you: the white one with the red spot. The gold one is me.'
];

/**
 * The pond in Chinese, chosen with 中 apart from the look: the same words in plain, natural Chinese, set in the brush.
 * Timeline entries are keyed by id and override only what they name. Chips work as in ABOUT;
 * `{n}` and `{u}` are filled in by the script.
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
  more: '关于我',
  toc: ['履历', '照片', '音乐', '留言'],
  search: ['搜索，或输入 / 使用命令', '搜索'],
  talk: '聊天',
  firstLine: '留下第一句话',
  clock: { yours: '你的时间', mine: '我在圣何塞', now: '你那里现在是' },
  chapters: {
    about: '关于',
    career: '履历',
    resume: '履历',
    work: '履历',
    photos: '照片',
    music: '音乐',
    notes: '留言',
    chat: '聊天',
    account: '账号'
  } as Record<string, string>,
  career: {
    title: '一路走来',
    lede: '工作、项目和学业都在这一条线上，越新的越靠近水面。往下翻，池塘的焦点也会跟着沉到底。',
    kinds: { all: '全部', role: '工作', project: '项目', school: '学业' } as Record<string, string>,
    bed: '池底。上面的一切，都从这里开始。',
    visit: '访问',
    source: '源码'
  },
  about: {
    title: '你好，我是马锦程。',
    paragraphs: [
      '我是一名在湾区的软件工程师。喜欢把软件交付里那些繁琐的事交给 AI 智能体，<i>代码审查、测试和发布</i>，也喜欢做让小团队跑得更快的工具。',
      '最近在 TikTok，我做了一套在 CI 里运行的多智能体代码审查系统，覆盖 30 多个代码库；也搭了信任与安全团队发布时要经过的自动化和质量门禁。现在在做 {work:ocra}，一个开源的代码审查引擎。我还做了 {work:devot}，一款本地优先的 Mac 和 iPhone Markdown 笔记；以及 {work:assay}，PostgreSQL 的 SQL 数据检查工具。',
      '离开键盘的时候，我攀岩（目前 V6），拍{photos}，也关注市场。正在找下一份工作。',
      '这个网站是一方池塘。每个来访的人都是一条锦鲤，你也是：那条带红点的白鱼。金色的那条是我。'
    ],
    photos: '照片',
    desktop: '旧桌面'
  },
  music: { title: '在听', lede: '坂本龙一，多是钢琴，安静的时候我就放这些。池塘的声音开关也管着它。', empty: '歌单正在来的路上。' },
  photos: { title: '{n} 张照片', lede: '最新的在前，来自', after: '。点开看大图，用方向键翻页。', open: '在 Unsplash 查看原图 ↗' },
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
  },
  log: {
    tiktok: {
      role: '软件工程师',
      place: '圣何塞',
      text: '做了一套在 GitLab CI 里审查每个合并请求的多智能体代码审查系统，也负责信任与安全团队发布门禁的自动化。',
      pts: [
        '智能体审查了 <b>1,000+</b> 个合并请求，覆盖 <b>30+</b> 个代码库；开发者采纳了 <b>62%</b> 的意见',
        '一个调度器把任务分给 <b>7</b> 个专职智能体，再把结果合并成一份结构化的审查，去掉重复和没有根据的意见',
        '用按风险分流和提示缓存，把 token 开销降低 <b>30%+</b>；支持模型故障切换，防范提示注入',
        '用 Python 和 TypeScript 做发布门禁自动化并接入 CI/CD：P0/P1 回归覆盖率从 <b>80%</b> 提升到 <b>96%</b>，门禁耗时减少 <b>50%</b>',
        '定时线上巡检的可靠性从 <b>94%</b> 提升到 <b>99.99%</b>；线上事故减少 <b>30%</b>'
      ]
    },
    infi: {
      role: '软件测试工程师',
      place: '芝加哥',
      text: '独立搭建了内部的数据质量监控平台，并为自助点餐收银系统做端到端测试。',
      pts: [
        '每天定时运行 <b>150+</b> 项 SQL 检查，覆盖 <b>50+</b> 张 PostgreSQL 表，带看板和 webhook 告警',
        '用 Playwright 搭了测试框架，覆盖 kiosk、Android 和 iOS 设备，在 CI 中运行'
      ],
      ref: '后来开源重写成了 Assay'
    },
    iit: { title: '伊利诺伊理工学院', role: '信息技术与管理硕士', text: 'GPA 4.0。《高级软件编程》课程助教。' },
    carrefour: {
      title: '家乐福中国',
      tag: '苏宁',
      role: '后端软件工程师（管理培训生）',
      place: '上海',
      text: '为零售数据平台开发 Go 后端服务。',
      pts: [
        '用 Go 开发 REST 查询接口：平均响应 <b>80 ms</b>，吞吐量提升 <b>35%</b>',
        'OAuth 2.0 / JWT 角色权限，Redis 缓存命中率 <b>85%</b>',
        '搭建 GitLab CI/CD，发布周期缩短 <b>30%</b>'
      ]
    },
    njtech: { title: '南京工业大学', role: '材料科学与工程学士', text: '辅修人力资源管理，双学位。' },
    ocra: {
      tag: '代码审查引擎',
      text: 'Open-CR-Agent，一个开源的代码审查引擎。审查哪些代码、评论落在哪一行，都由确定性的代码决定；只有需要判断的地方才交给 LLM 智能体。',
      pts: [
        '挑选文件、划分风险等级、匹配规则、把评论锚定到具体行，都是普通且经过测试的代码',
        '校验器剔除被代码改动推翻的意见，裁判去重并校准严重程度',
        '每一层都可以配置任意模型并逐级回退，每次调用都会报告 token 和费用',
        '已发布到 npm（<b>@open-cr-agent/cli</b>），并提供可以审查 fork PR 的 GitHub Action'
      ]
    },
    devot: {
      tag: 'Mac 和 iPhone 上的笔记',
      text: '本地优先的 Markdown 笔记，不联网、不用账号也能写，通过你自己的 iCloud 同步。',
      pts: [
        '左边写 Markdown，右边即时成文；代码、公式和 Mermaid 图边写边渲染',
        '笔记本可以层层嵌套，标签有颜色，每篇笔记都有状态',
        '全文搜索，可以用 <b>book:</b>、<b>tag:</b>、<b>status:</b> 缩小范围；<b>[[</b> 双向链接',
        '支持 Apple 芯片的 macOS 26+ 和 iOS 26+，通过你自己的 iCloud 同步'
      ]
    },
    assay: {
      tag: 'SQL 数据检查',
      text: 'PostgreSQL 的开源 SQL 数据检查工具：写只读查询，返回的行就是问题；定时运行，结果一变就告警。',
      pts: [
        '每项检查就是一条只读查询，每次运行的结果是 Clean、Issues 或 Broken',
        '告警可以发到 Slack、Discord、Telegram、飞书、企业微信或签名 webhook',
        '提供 MCP 服务，智能体可以列出检查、读取结果、直接运行',
        '非管理员的修改可以先审核，每次编辑都有记录'
      ]
    },
    pond: {
      title: '这个池塘',
      tag: '你所在的网站',
      text: '一方池塘，每个来访的人都是一条锦鲤；账号、聊天和留言都在 Supabase 上。',
      pts: [
        '水面是涟漪模拟，玻璃和水在同一个着色器里绘制，所以玻璃下游过的东西会折射、变模糊',
        '跟着二十四节气变化：春天有落花，夏天有荷花和蜻蜓，秋天有落叶，冬天有冰裂',
        'Devot 的鸽子和 ocra 的跳蛛，是在 Blender 里建模、渲染成序列帧再画上去的'
      ]
    }
  } as Record<string, { title?: string; tag?: string; role?: string; place?: string; text?: string; pts?: string[]; ref?: string }>
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
  more: '自己紹介',
  toc: ['経歴', '写真', '音楽', '伝言'],
  search: ['検索、または / でコマンド', '検索'],
  talk: 'チャット',
  firstLine: '最初のひとことを',
  clock: { yours: 'あなたの時間', mine: 'サンノゼの私', now: 'そちらはいま' },
  chapters: {
    about: '自己紹介',
    career: '経歴',
    resume: '経歴',
    work: '経歴',
    photos: '写真',
    music: '音楽',
    notes: '伝言',
    chat: 'チャット',
    account: 'アカウント'
  },
  career: {
    title: 'これまで',
    lede: '仕事、作ったもの、学校をひとつの線に。新しいものほど水面の近くにあります。スクロールすると、池のピントも底へ沈んでいきます。',
    kinds: { all: 'すべて', role: '仕事', project: '作品', school: '学校' },
    bed: '池の底。上にあるものは、すべてここから始まりました。',
    visit: 'サイトへ',
    source: 'ソース'
  },
  about: {
    title: 'こんにちは、馬錦程です。',
    paragraphs: [
      'ベイエリアのソフトウェアエンジニアです。ソフトウェアを届けるまでの手間、<i>コードレビュー、テスト、リリース</i>を AI エージェントに任せること、そして小さなチームを速くする道具を作ることが好きです。',
      '直近は TikTok で、CI で動くマルチエージェントのコードレビューを作り、30 以上のリポジトリに入れました。Trust &amp; Safety チームのリリースが通る自動化と品質ゲートも作りました。いまはオープンソースのコードレビューエンジン {work:ocra} を作っています。ほかに、Mac と iPhone のローカルファーストな Markdown ノート {work:devot} と、PostgreSQL の SQL データチェック {work:assay} も作りました。',
      'キーボードを離れると、ボルダリング（いまは V6）をして、{photos}を撮り、マーケットを眺めています。次の仕事を探しています。',
      'このサイトはひとつの池です。訪れた人はみな鯉になります。あなたもそう、赤い斑点の白い鯉です。金色の鯉が私です。'
    ],
    photos: '写真',
    desktop: '前のデスクトップ'
  },
  music: {
    title: 'いま聴いている曲',
    lede: 'くり返し聴いている曲です。前のデスクトップと同じプレイリストで、池の音のスイッチでまとめて消せます。',
    empty: 'プレイリストを読み込んでいます。'
  },
  photos: { title: '写真 {n} 枚', lede: '新しいものから。', after: ' より。クリックで大きく、矢印キーで次へ。', open: 'Unsplash で元の写真を見る ↗' },
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
  },
  log: {
    tiktok: {
      role: 'ソフトウェアエンジニア',
      place: 'サンノゼ',
      text: 'GitLab CI ですべてのマージリクエストをレビューするマルチエージェントのコードレビューを作り、Trust & Safety チームのリリースゲートの自動化を担当しました。',
      pts: [
        'エージェントが <b>1,000+</b> 件のマージリクエストを <b>30+</b> のリポジトリでレビューし、指摘の <b>62%</b> が開発者に採用されました',
        'オーケストレーターが <b>7</b> つの専門エージェントに仕事を振り分け、結果をひとつの構造化されたレビューにまとめます。重複や根拠のない指摘は落とします',
        'リスクに応じた振り分けとプロンプトキャッシュでトークンを <b>30%+</b> 削減。モデルのフェイルオーバーとプロンプトインジェクション対策も入れました',
        'Python と TypeScript でリリースゲートを自動化し CI/CD に組み込みました。P0/P1 の回帰カバレッジは <b>80%</b> から <b>96%</b> に、ゲートの時間は <b>50%</b> 短縮',
        '定期的な本番巡回の信頼性を <b>94%</b> から <b>99.99%</b> に。本番障害は <b>30%</b> 減りました'
      ]
    },
    infi: {
      role: 'ソフトウェアテストエンジニア',
      place: 'シカゴ',
      text: '社内のデータ品質モニタリング基盤をひとりで作り、セルフオーダーのキオスク POS をエンドツーエンドでテストしました。',
      pts: [
        '毎日 <b>150+</b> の SQL チェックを <b>50+</b> の PostgreSQL テーブルに対して実行。ダッシュボードと webhook のアラート付き',
        'Playwright でキオスク、Android、iOS 端末をまたぐテストの仕組みを作り、CI で動かしました'
      ],
      ref: 'のちに Assay としてオープンソースで作り直しました'
    },
    iit: { title: 'イリノイ工科大学', role: '情報技術・経営 修士', text: 'GPA 4.0。「Advanced Software Programming」のティーチングアシスタント。' },
    carrefour: {
      title: 'カルフール中国',
      tag: '蘇寧',
      role: 'バックエンドエンジニア（幹部候補生）',
      place: '上海',
      text: '小売データ基盤の Go バックエンドを開発しました。',
      pts: [
        'Go で REST の照会 API を開発：平均応答 <b>80 ms</b>、スループット <b>35%</b> 向上',
        'OAuth 2.0 / JWT のロール権限、Redis キャッシュのヒット率 <b>85%</b>',
        'GitLab CI/CD を整え、リリースのサイクルを <b>30%</b> 短縮'
      ]
    },
    njtech: { title: '南京工業大学', role: '材料科学・工学 学士', text: '人的資源管理を副専攻、二つの学位。' },
    ocra: {
      tag: 'コードレビューエンジン',
      text: 'Open-CR-Agent、オープンソースのコードレビューエンジン。どのコードを見るか、コメントをどの行に置くかは決定的なコードが決め、判断が要るところだけを LLM エージェントに任せます。',
      pts: [
        'ファイルの選択、リスクの段階分け、ルールの照合、コメントの行への固定は、ふつうのテスト済みのコードです',
        '検証役が変更で覆された指摘を落とし、審査役が重複をまとめて重大度をそろえます',
        '各層に好きなモデルを設定でき、段階的にフォールバックします。呼び出しごとにトークンと費用を報告します',
        'npm で公開（<b>@open-cr-agent/cli</b>）。フォークからの PR もレビューできる GitHub Action 付き'
      ]
    },
    devot: {
      tag: 'Mac と iPhone のノート',
      text: 'ローカルファーストの Markdown ノート。オフラインでもアカウントなしでも書けて、あなた自身の iCloud で同期します。',
      pts: [
        '左に Markdown、右に仕上がり。コード、数式、Mermaid の図も書いたそばから表示されます',
        'ノートブックは入れ子にでき、タグには色、ノートにはステータス',
        '全文検索は <b>book:</b>、<b>tag:</b>、<b>status:</b> で絞り込めます。<b>[[</b> でバックリンク',
        'Apple シリコンの macOS 26+ と iOS 26+。あなたの iCloud で同期'
      ]
    },
    assay: {
      tag: 'SQL データチェック',
      text: 'PostgreSQL のためのオープンソースの SQL データチェック。読み取り専用のクエリを書けば、返ってきた行が問題です。定期的に走らせ、結果が変われば知らせます。',
      pts: [
        'チェックはひとつの読み取り専用クエリ。実行のたびに Clean、Issues、Broken のどれかになります',
        'アラートは Slack、Discord、Telegram、Lark、WeCom、署名付き webhook へ',
        'MCP サーバーがあり、エージェントがチェックの一覧、結果の読み取り、実行をできます',
        '管理者以外の変更は承認待ちにでき、編集はすべて記録されます'
      ]
    },
    pond: {
      title: 'この池',
      tag: 'いまいるサイト',
      text: '訪れた人がみな鯉になる池。アカウント、チャット、伝言は Supabase の上にあります。',
      pts: [
        '水面は波紋のシミュレーション。ガラスと水を同じシェーダーで描くので、ガラスの下を泳ぐものは屈折してぼやけます',
        '二十四節気で移ろいます。春は花びら、夏は蓮とトンボ、秋は落ち葉、冬は氷が割れます',
        'Devot の鳩と ocra のハエトリグモは、Blender で作ったモデルを連番の絵にして描いています'
      ]
    }
  }
};

/**
 * What the pond plays: Ryuichi Sakamoto only, quiet piano for the water. The desktop's iPod keeps the
 * whole library. These come first, in this order; the songs not in the library (`/api/songs`, or
 * src/data/songs.json) are named here, all official uploads. After them, the rest of his songs the
 * library has. Sakamoto's songs are found by artist.
 */
export const POND_MUSIC: { artist: RegExp; first: string[]; extra: { id: string; title: string; artist: string; album: string }[] } = {
  artist: /sakamoto|坂本/i,
  first: ['SJcbMTz2oNw', 'ELJf83TelA0', 'pygwK0sBUdM', 'n6OqLXvri3M', 'jHC_yMY9N0I', '__aJL8i1kL4', 'Se8cQsuBhaA', 'n59qeMSCAgA'],
  extra: [
    { id: 'ELJf83TelA0', title: 'Merry Christmas Mr. Lawrence', artist: 'Ryuichi Sakamoto', album: 'Playing the Piano 2022' },
    { id: 'pygwK0sBUdM', title: 'andata', artist: 'Ryuichi Sakamoto', album: 'async' },
    { id: 'n6OqLXvri3M', title: 'solari', artist: 'Ryuichi Sakamoto', album: 'async' },
    { id: '__aJL8i1kL4', title: 'The Sheltering Sky', artist: 'Ryuichi Sakamoto', album: 'The Sheltering Sky' },
    { id: 'Se8cQsuBhaA', title: '20220304', artist: 'Ryuichi Sakamoto', album: '12' }
  ]
};
