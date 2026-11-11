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
    "Devot's dove and ocra's jumping spider are three.js models built in code"
  ],
  stack: 'Astro · TypeScript · WebGL · three.js · Supabase',
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
 * The pond in Chinese, for the ink mode: the same words, rewritten with a classical turn, set in the
 * brush. Timeline entries are keyed by id and override only what they name. Chips work as in ABOUT.
 */
export const ZH = {
  greetings: {
    night: ['夜深矣，尚未眠乎？', '更深露重，且坐。'],
    morning: ['晨光正好。', '早，见字如面。'],
    afternoon: ['日长人倦，且坐。', '午后闲，来得正好。'],
    evening: ['晚来无事，且住。', '晚来天欲雪，能饮一杯无？'],
    any: ['有朋自远方来。', '君自何处来？', '来者是客，请。', '偷得浮生半日闲。', '一池清水，与君共赏。', '池边小坐，且慢行。', '幸会。', '君既来之，则安之。']
  },
  say: '君乃那尾白身红斑之鲤。轻点水面，可饲群鱼。',
  more: '其人其事',
  toc: ['行迹', '光影', '清音', '尺素'],
  search: ['寻物，或键入 / 发令', '寻'],
  talk: '茶话',
  firstLine: '留下第一句',
  chapters: {
    about: '其人',
    career: '行迹',
    resume: '行迹',
    work: '行迹',
    photos: '光影',
    music: '清音',
    notes: '尺素',
    chat: '茶话',
    account: '名号'
  } as Record<string, string>,
  career: {
    title: '水深几许',
    lede: '所历所作，皆在此处。愈新者愈浅，愈旧者愈深；向下翻阅，池中焦点亦随之沉底。',
    kinds: { all: '全部', role: '任职', project: '所作', school: '求学' } as Record<string, string>,
    bed: '池底。上所积者，皆沉于此。',
    visit: '往观',
    source: '源码'
  },
  about: {
    title: '吾乃马锦程。',
    paragraphs: [
      '余为湾区之软件工程师。好以 AI 代劳软件交付中之繁琐，<i>审阅、测试、发布</i>，亦好造器，使小队行之以速。',
      '前于 TikTok，作多智能体代码审阅之系统，行于 CI 之中，遍及三十余库；又立信任与安全团队发布所经之关卡与自动化。今方作 {work:ocra}，开源之代码审阅引擎。亦曾作 {work:devot}，Mac 与 iPhone 上本地为先之 Markdown 笔记；及 {work:assay}，PostgreSQL 之 SQL 数据校验。',
      '键盘之外，好攀岩（今至 V6），摄{photos}，亦观市况。今觅新职。',
      '此站一池也。来者皆为锦鲤，君亦在其中：白身红斑者是也。金色者，余也。'
    ],
    photos: '光影',
    desktop: '旧桌面'
  },
  music: { title: '耳边曲', lede: '常听之曲。此处所放，与旧桌面同；池塘之声闸，亦管其音。', empty: '曲目将至。' },
  photos: { title: '光影 {n} 帧', lede: '新作在前，皆出自', after: '。点之可观大图，左右键翻阅。', open: '往 Unsplash 观原图 ↗' },
  notes: { title: '纸船', lede: '此为留言簿。留一言，日不过三，化作纸船漂于池上，过者皆可读之。', placeholder: '留一言', empty: '尚无纸船。', why: '方可留言' },
  chat: {
    title: '茶话',
    placeholder: '与众人言',
    empty: '此处尚无人言。',
    anyone: '人皆可观，会友可言。',
    you: '君为 {u}。善言之，人皆可见。',
    why: '方可入席'
  },
  account: {
    signIn: '登入',
    signUp: '新立名号',
    lede: '与旧桌面同一名号。',
    ledeUp: '名号与口令即可；找回之邮箱，可留可不留。',
    signedIn: '已登入。君之锦鲤已书君名，可留言，可茶话。',
    signOut: '登出',
    username: '名号',
    password: '口令',
    recovery: '找回之邮箱',
    optional: '（可不填）',
    make: '立此名号',
    have: '已有名号',
    makeOne: '新立名号',
    closed: '此处未开登入。'
  },
  log: {
    tiktok: {
      role: '软件工程师',
      place: '圣何塞',
      text: '作多智能体代码审阅之系统，于 GitLab CI 中逐一审阅合并请求；并造信任与安全团队发布关卡之自动化。',
      pts: [
        '智能体审阅逾 <b>1,000</b> 合并请求，遍及 <b>30</b> 余库；开发者采纳其所见 <b>62%</b>',
        '一总调度分派 <b>7</b> 专职智能体，合其所得为一份合乎结构之审阅，去其重复，去其臆测',
        '按风险分流、缓存提示，token 之费减 <b>30%</b> 余；模型故障可转，提示注入可防',
        '发布关卡之自动化以 Python、TypeScript 成之，接入 CI/CD：P0/P1 回归覆盖由 <b>80%</b> 至 <b>96%</b>，关卡耗时减 <b>50%</b>',
        '定时线上巡检之可靠，由 <b>94%</b> 至 <b>99.99%</b>；线上事故减 <b>30%</b>'
      ]
    },
    infi: {
      role: '软件测试工程师',
      place: '芝加哥',
      text: '独力造内部数据质量监控之平台，并为自助点餐收银系统作端到端测试。',
      pts: [
        '每日定时 SQL 校验 <b>150</b> 余项，覆盖 PostgreSQL 表 <b>50</b> 余张，附看板与 webhook 告警',
        '以 Playwright 成测试框架，兼测 kiosk、Android、iOS 诸端，行于 CI'
      ],
      ref: '后开源重写，即 Assay'
    },
    iit: { title: '伊利诺伊理工学院', role: '信息技术与管理硕士', text: '绩点 4.0。任《高级软件编程》助教。' },
    carrefour: {
      title: '家乐福中国',
      tag: '苏宁',
      role: '后端软件工程师，管理培训生',
      place: '上海',
      text: '为零售数据平台作 Go 后端服务。',
      pts: [
        '以 Go 成 REST 查询接口：均响应 <b>80 ms</b>，吞吐增 <b>35%</b>',
        'OAuth 2.0 / JWT 分角色授权；Redis 缓存命中 <b>85%</b>',
        'GitLab CI/CD 使发布周期缩 <b>30%</b>'
      ]
    },
    njtech: { title: '南京工业大学', role: '材料科学与工程学士', text: '辅修人力资源管理，双学位。' },
    ocra: {
      tag: '代码审阅引擎',
      text: 'Open-CR-Agent，开源之代码审阅引擎。审何处、评落何行，皆由确定之代码定之；唯须判断处，方交 LLM 智能体。',
      pts: [
        '择文件、定风险、配规则、锚评语于行，皆寻常且经测之代码',
        '校验者弃其为改动所驳之所见；裁断者去重并定轻重',
        '每层可配任意模型，可逐级回退；每次调用皆报 token 与费用',
        '已发布于 npm（<b>@open-cr-agent/cli</b>），并有 GitHub Action 可审 fork 之 PR'
      ]
    },
    devot: {
      tag: 'Mac 与 iPhone 之笔记',
      text: '本地为先之 Markdown 笔记，可离线、无须账号书写，经自家 iCloud 同步。',
      pts: [
        '一侧书 Markdown，一侧即成文；代码、公式、Mermaid 图随写随现',
        '笔记本可层层相套，标签有色，每篇皆有其状态',
        '全文可搜，以 <b>book:</b>、<b>tag:</b>、<b>status:</b> 收窄；<b>[[</b> 互链，自有反向链接',
        'macOS 26+（Apple 芯片）与 iOS 26+，经自家 iCloud 同步'
      ]
    },
    assay: {
      tag: 'SQL 数据校验',
      text: 'PostgreSQL 之开源 SQL 数据校验：书只读之查询，所返之行即为问题；定时而行，结果有变则告。',
      pts: [
        '一校验即一只读查询；每次运行，或 Clean，或 Issues，或 Broken',
        '告警可达 Slack、Discord、Telegram、飞书、企业微信，或签名之 webhook',
        '有 MCP 服务，智能体可列校验、读结果、执行之',
        '非管理者之改动可待审，每次修改皆有记录'
      ]
    },
    pond: {
      title: '此池',
      tag: '君所在之站',
      text: '一方池塘，来者皆为锦鲤；名号、茶话、留言皆在 Supabase。',
      pts: [
        '水面乃涟漪之模拟；玻璃与水同出一着色器，故游于其下者皆折而朦胧',
        '随二十四节气而变：春有落英，夏有荷与蜻蜓，秋有落叶，冬有冰裂',
        'Devot 之鸽、ocra 之跳蛛，皆以代码构建之 three.js 模型'
      ]
    }
  } as Record<string, { title?: string; tag?: string; role?: string; place?: string; text?: string; pts?: string[]; ref?: string }>
};
