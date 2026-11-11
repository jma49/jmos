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
