import type { MouseEvent } from 'react';
import { useOSData } from '../../core/context';
import { launch, openProject, rectOf } from '../../core/registry';
import type { AppId } from '../../core/types';

// About Me is Jincheng's profile, the window /profile opens. It reads like a
// status rather than a CV: one large sentence on what Jincheng is doing now
// (its project opens from it), a few lines on who they are, then short lists
// in small capitals: things to open on this desktop, past work (each opens
// the Résumé) and where to find them. The projects follow as cards, each
// opening its own window. All of it comes from OSData; nothing is fetched.

const STATUS = { live: 'Live', wip: 'In progress', archived: 'Archived' } as const;

const OPEN: { app: AppId; label: string }[] = [
  { app: 'resume', label: 'Résumé' },
  { app: 'soapbox', label: 'Read Soapbox' },
  { app: 'photos', label: 'See photos' }
];

/** "Carrefour China (Suning.com)" reads as "Carrefour China" in a short list. */
const shortName = (company: string) => company.replace(/\s*\(.*\)$/, '');

export default function About() {
  const data = useOSData();
  const { summary } = data;
  const current = data.projects.find((p) => p.slug === summary.project);
  const open = (app: AppId) => (e: MouseEvent<HTMLElement>) => launch(app, { origin: rectOf(e.currentTarget) });

  return (
    <div className="os-app os-about">
      <article className="os-scroll os-document">
        <h1 className="os-about-now">
          {summary.now}{' '}
          {current ? (
            <button type="button" onClick={(e) => openProject(current, e.currentTarget)}>
              {current.title}
            </button>
          ) : (
            summary.project
          )}{' '}
          {summary.place}
        </h1>

        <div className="os-about-text">
          {summary.text.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        <div className="os-about-lists">
          <ul aria-label="On this desktop">
            {OPEN.map(({ app, label }) => (
              <li key={app}>
                <button type="button" onClick={open(app)}>
                  {label}
                </button>
              </li>
            ))}
          </ul>
          <ul aria-labelledby="os-about-past">
            <li id="os-about-past" className="os-about-label">
              Past work
            </li>
            {data.jobs.map((job) => (
              <li key={job.company}>
                <button type="button" onClick={open('resume')}>
                  {shortName(job.company)}
                </button>
              </li>
            ))}
          </ul>
          <ul aria-label="Elsewhere" className="os-about-elsewhere">
            <li>
              <a href={`mailto:${data.email}`}>Email</a>
            </li>
            <li>
              <a href={data.links.github} target="_blank" rel="noopener">
                GitHub
              </a>
            </li>
            <li>
              <a href={data.links.linkedin} target="_blank" rel="noopener">
                LinkedIn
              </a>
            </li>
            <li>
              <a href={data.links.photography} target="_blank" rel="noopener">
                Unsplash
              </a>
            </li>
          </ul>
        </div>

        <section className="os-about-projects" aria-labelledby="os-about-projects">
          <div className="os-about-projects-head">
            <h2 id="os-about-projects">Projects</h2>
            <button type="button" className="os-about-all" onClick={open('projects')}>
              Show in Finder
            </button>
          </div>
          <ul>
            {data.projects.map((p) => (
              <li key={p.slug}>
                <button type="button" className="os-about-project" onClick={(e) => openProject(p, e.currentTarget)}>
                  <span className="os-about-cover">{p.cover ? <img src={p.cover} alt="" loading="lazy" /> : null}</span>
                  <span className="os-about-project-text">
                    <span className="os-about-project-title">
                      <b>{p.title}</b>
                      <span className="os-about-status" data-status={p.status}>
                        {STATUS[p.status]}
                      </span>
                    </span>
                    <span className="os-about-project-desc">{p.description}</span>
                    <span className="os-about-project-stack">{p.stack.join(' · ')}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </article>
    </div>
  );
}
