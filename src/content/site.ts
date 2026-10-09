// The site's copy: the profile, bio, experience and the few words the
// project pages use. The desktop gets it through OSData (src/pages/index.astro).
export const profile = {
  name: 'Jincheng Ma',
  // Their name in Chinese, for search engines (schema.org alternateName).
  alternateName: '马锦程',
  handle: 'jma49',
  email: 'majincheng990128@gmail.com',
  github: 'https://github.com/jma49',
  linkedin: 'https://www.linkedin.com/in/jincheng-ma-professional',
  photography: 'https://unsplash.com/@jincheng_1999',
  location: 'San Jose, California'
};

// Bio paragraphs support inline links written as [text](url).
export const content = {
  meta: {
    title: 'Jincheng Ma — Software Engineer',
    description: 'Jincheng Ma is a software engineer in the Bay Area who builds developer tooling and brings AI agents into code review, testing and release.'
  },
  ui: {
    theme: 'Toggle color theme',
    details: 'Details',
    copy: 'Copy',
    copied: 'Copied',
    illustrationAlt: 'An illustration of the Golden Gate Bridge with the San Francisco skyline behind it and a sailboat on the bay.',
    illustrationCredit: 'Illustration redrawn with AI from a photo I took.'
  },
  role: 'Software Engineer',
  // About Me opens with this, the way a status reads: what Jincheng is up to
  // now (`project` is a project's slug, opened from the sentence), then a few
  // lines on who they are rather than their work history.
  summary: {
    now: 'Jincheng is building',
    project: 'ocra',
    place: 'in San Jose.',
    text: [
      "I'm a software engineer in the Bay Area. I like handing the tedious parts of shipping software to AI agents, review, tests and release, and building the tools that let a small team move fast. I'm looking for my next role.",
      'Away from the keyboard I boulder (V6 for now), take photos and keep an eye on the markets. This desktop is where I keep my things; look around.'
    ]
  },
  bio: {
    label: 'Bio',
    short: 'Default',
    long: 'Long',
    shortParagraphs: [
      "I'm a software engineer in the Bay Area. I build developer tooling, and I'm good at bringing AI agents into each stage of quality control: requirements, test design, code review and release.",
      "Most recently I was at TikTok, where I owned test automation and release quality gates for Trust & Safety, and built a multi-agent code review system that runs in CI across 30+ repositories. Before that I built an internal data-quality platform at INFI.US in Chicago, and got my master's at Illinois Tech. I'm currently looking for software engineering roles.",
      'Outside of work I boulder, currently at V6, and take photos. Some of my photos are on [Unsplash](https://unsplash.com/@jincheng_1999).'
    ],
    longParagraphs: [
      "I'm a software engineer in the Bay Area. Most recently I was at TikTok, working on developer tools and agent infrastructure.",
      'Most of my work sits in two places: putting AI agents to use at each stage of quality control, from requirements and test design to code review and release, and building the tools that make a team faster.',
      'My main project at TikTok was a multi-agent code review system in CI. Each merge request gets several specialist reviewers running in parallel, and a coordinator merges their findings into one review and blocks the merge on critical issues. Most of the effort went into making it cheap and predictable enough to run on every merge request: a smaller shared context, fallbacks between models, timeouts, and tracking the cost of each review.',
      'I also owned test automation and release testing for Trust & Safety: the API and UI suites, the quality gates each release has to pass, and making those gates fast and trustworthy. Gate time halved, false positives fell under 10%, and P0/P1 regression automation went from 80% to 96%.',
      'Before TikTok I spent six months at INFI.US in Chicago, where I built an internal data-quality platform on my own, from product design to deployment and operations, and later rebuilt it as the open-source Assay. I finished my M.S. at Illinois Tech in 2024.',
      "I'm currently looking for software engineering roles. Outside of work I boulder (currently V6), take photos, some of which are on [Unsplash](https://unsplash.com/@jincheng_1999), and follow the markets."
    ]
  },
  projects: {
    title: 'Projects',
    status: { live: 'Live', wip: 'In progress', archived: 'Archived' },
    visit: 'Visit',
    source: 'Source',
    back: 'Back to home',
    preview: 'Preview of'
  },
  work: {
    title: 'Experience'
  },
  // The Résumé's own header and summary, and the project it lists; the rest
  // of it is the jobs, skills and education below.
  resume: {
    headline: 'Software Engineer in Test · AI Quality & Test Infrastructure',
    summary:
      'SDET focused on test infrastructure and AI quality: owned API and UI test automation and release sign-off for TikTok Trust & Safety, built a multi-agent code review system in CI across 30+ repositories, and maintain the open-source quality tools ocra and Assay.',
    projects: [
      {
        name: 'Open-CR-Agent (ocra)',
        focus: 'Evaluation design, adversarial testing, test-first engineering',
        link: 'https://app.ocracloud.com/',
        bullets: [
          'An open-source AI code review engine that works with any Git platform through pluggable VCS adapters, built for precision: unit-tested code decides what gets reviewed, LLMs only make judgment calls, and every finding is fact-checked.',
          'Created ocra-eval on AACR-Bench (200 pull requests, 1,505 expert comments) and prompt-injection cases. After finding a 20-point precision swing between identical runs, made repeated runs with 95% confidence intervals the bar for accepting a prompt change.',
          "Test-first throughout: 170+ test files against fake model runtimes (no LLM or network calls in CI), negative security tests, a check that each bug fix's test fails on the old code, and ocra reviewing its own pull requests."
        ]
      }
    ]
  },
  jobs: [
    {
      company: 'TikTok',
      role: 'Software Engineer in Test',
      location: 'San Jose, CA',
      period: 'Jul 2025 – Sep 2026',
      summary:
        'Owned test automation, quality gates and release sign-off for Trust & Safety, and built a multi-agent code review system in CI across 30+ repositories.',
      sections: [
        {
          title: 'Quality engineering: test automation, quality gates, release readiness',
          bullets: [
            'Owned test automation for Trust & Safety: backend API and integration suites in Python (pytest) and UI suites in TypeScript (Puppeteer), wired into CI/CD release gates. P0/P1 regression automation coverage went from 80% to 96%.',
            'Took over release testing and defined entry and exit criteria for the test and release stages, each needing a passing quality gate to exit, and maintained those gates.',
            'Cut gate time at both stages by 50% by running in parallel and replacing per-test UI login with scripted auth and session reuse.',
            'Brought gate false positives under 10% by fixing flaky tests and adding AI screenshot checks where DOM assertions fall short. The same fixes raised scheduled production-check reliability from 94% to 99.99%.',
            'Published daily and weekly quality reports (pass rate, coverage, flaky-test trends), and used production metrics and on-call trends to drive reliability fixes, cutting production incidents by 30%.',
            'Led a cross-region test-gap analysis across code, runtime config, middleware and dependencies, turning 19 region-specific scenarios and 60 config sets into snapshot diffs, API/RPC assertions and targeted E2E tests.'
          ]
        },
        {
          title: 'Multi-agent code review in CI: LLM evaluation, agent reliability, cost control',
          bullets: [
            'Built a multi-agent AI code review system that ran in GitLab CI on every merge request, reviewing 1,000+ merge requests across 30+ repositories. Developers accepted 62% of its findings.',
            'Designed a coordinator that fans out to 7 specialist agents and merges their output into one schema-validated review, de-duplicating findings and filtering out speculative ones.',
            'Calibrated severity against human reviewers and benchmarked model tiers with per-agent telemetry. Cut token spend by 30%+ with risk-based routing and prompt caching, and hardened runs with model failover and prompt-injection sanitization.'
          ]
        }
      ]
    },
    {
      company: 'INFI.US',
      role: 'Software Engineer in Test',
      location: 'Chicago, IL',
      period: 'Jan 2025 – Jun 2025',
      summary: 'Built an internal data-quality monitoring platform, later rebuilt as the open-source Assay, and the E2E tests for a self-checkout system.',
      sections: [
        {
          bullets: [
            'Built an internal data-quality monitoring platform: 150+ scheduled SQL checks a day over 50+ PostgreSQL tables, with dashboards and webhook alerts. Later rebuilt it on my own as the open-source Assay (assay.majincheng.com).',
            'Created a Playwright E2E framework and device tests for a self-checkout POS system (kiosk, Android, iOS), running in CI.'
          ]
        }
      ]
    },
    {
      company: 'Carrefour China (Suning.com)',
      role: 'Backend Software Engineer, Management Trainee Program',
      location: 'Shanghai, China',
      period: 'Jul 2021 – Mar 2022',
      summary: 'Go backend services for a retail data platform.',
      sections: [
        {
          bullets: [
            'Built REST query APIs in Go for a retail data platform (80 ms average response, 35% higher throughput) with OAuth 2.0/JWT role-based access and Redis caching (85% hit rate). Set up GitLab CI/CD that cut release cycle time by 30%.'
          ]
        }
      ]
    }
  ],
  skills: {
    title: 'Skills',
    groups: [
      {
        name: 'Testing & quality',
        items: [
          'Test strategy & planning',
          'Test automation',
          'API, E2E & regression testing',
          'Flaky test management',
          'CI/CD quality gates',
          'Release readiness',
          'Defect triage',
          'Quality reporting',
          'Pytest',
          'Puppeteer',
          'Playwright'
        ]
      },
      {
        name: 'AI quality',
        items: [
          'LLM evaluation & benchmarking',
          'AI-assisted test automation',
          'Agent testing',
          'Multi-agent systems',
          'Prompt-injection testing',
          'LLM observability',
          'MCP',
          'Claude Code'
        ]
      },
      { name: 'Languages', items: ['TypeScript', 'Python', 'Go', 'SQL'] },
      {
        name: 'Backend & DevOps',
        items: ['REST APIs', 'Redis', 'PostgreSQL', 'Linux', 'GitLab CI', 'GitHub Actions', 'AWS', 'GCP']
      }
    ]
  },
  education: {
    title: 'Education',
    items: [
      {
        school: 'Illinois Institute of Technology',
        degree: 'M.S., Information Technology & Management · GPA 4.0 · Teaching Assistant, Advanced Software Programming',
        period: '2024'
      },
      {
        school: 'Nanjing University of Technology',
        degree: 'B.E., Materials Science and Engineering · Double major in Human Resource Management',
        period: '2021'
      }
    ]
  },
  links: {
    title: 'Links',
    email: 'Email',
    github: 'GitHub',
    linkedin: 'LinkedIn',
    resume: 'Résumé',
    resumeHref: '/?open=resume',
    photography: 'Photography'
  },
  footer: {
    source: 'Source'
  }
} as const;
