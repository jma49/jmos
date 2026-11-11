// The pond's music: Ryuichi Sakamoto's songs (POND_MUSIC in content.ts) from the
// library the desktop's iPod plays (/api/songs, or the repository's snapshot
// when it can't be read), and a few more named there, played with YouTube's
// player. YouTube's own chrome never shows: the player plays in a frame
// clipped to nothing, and the Music chapter shows the album cover. (It is
// never moved: moving an iframe reloads it.) The pond's sound switch governs it,
// as it does every other sound (docs/agents/media.md).

import type { Library, Song } from '../lib/library';
import { report } from '../os/core/report';
import { ENDED, PAUSED, PLAYING, type YTNamespace, type YTPlayer } from '../os/media/player';
import { POND_MUSIC } from './content';

export type { Song };

/** A song as the pond shows it: title and artist in simplified forms, `original` as the library has them. */
export type PondSong = Song & { original?: string };

export interface MusicState {
  songs: PondSong[];
  index: number;
  playing: boolean;
  /** False until the library has been read. */
  ready: boolean;
}

const state: MusicState = { songs: [], index: 0, playing: false, ready: false };
const listeners = new Set<(s: MusicState) => void>();
const tell = () => {
  for (const fn of listeners) fn(state);
};

/** Calls back whenever the song, the library or playing changes (and once, now). */
export function onMusic(fn: (s: MusicState) => void) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}

export const music = () => state;

/** The cover to show for a song: its own, or YouTube's still. */
export const coverOf = (song: Song) => song.cover ?? `https://i.ytimg.com/vi/${song.id}/mqdefault.jpg`;

async function fromApi(): Promise<Library> {
  const res = await fetch('/api/songs', { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`/api/songs answered ${res.status}`);
  const library = (await res.json()) as Partial<Library>;
  if (!Array.isArray(library.songs) || !library.songs.length) throw new Error('/api/songs sent no library');
  return library as Library;
}

let loading: Promise<void> | null = null;

/** Reads the library once a visit. */
export function loadSongs(): Promise<void> {
  loading ??= (async () => {
    let library: Library | null = null;
    try {
      library = await fromApi();
    } catch (error) {
      // Offline, or `astro dev` without the function: the snapshot plays the same songs.
      if (!import.meta.env.DEV) report(error, 'pond music library');
    }
    library ??= (await import('../data/songs.json')).default as Library;
    // The pond writes Chinese in a brush hand that has only simplified forms; a traditional character
    // would fall back to another font in the middle of a title. So titles and artists are shown
    // simplified (the library itself is untouched), and `original` keeps them as written, for search.
    const { Converter } = await import('opencc-js/t2cn');
    const toCn = Converter({ from: 'tw', to: 'cn' });
    // the pond plays only Sakamoto (POND_MUSIC): its chosen songs first, in order, then the rest of his
    const his = [...POND_MUSIC.extra, ...library.songs.filter((s) => POND_MUSIC.artist.test(s.artist))].filter(
      (s, i, all) => all.findIndex((t) => t.id === s.id) === i
    );
    const at = (s: Song) => (POND_MUSIC.first.includes(s.id) ? POND_MUSIC.first.indexOf(s.id) : POND_MUSIC.first.length);
    his.sort((a, b) => at(a) - at(b));
    state.songs = his.map((s) => ({ ...s, title: toCn(s.title), artist: toCn(s.artist), original: `${s.title} ${s.artist}` }));
    state.ready = true;
    tell();
  })();
  return loading;
}

let api: Promise<YTNamespace> | null = null;
function loadYouTube(): Promise<YTNamespace> {
  api ??= new Promise((resolve, reject) => {
    if (window.YT?.Player) return resolve(window.YT);
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => {
      api = null;
      reject(new Error('YouTube is unreachable'));
    };
    document.head.append(script);
  });
  return api;
}

let player: YTPlayer | null = null;
let ready: Promise<YTPlayer> | null = null;
let loaded = '';
let muted = false;

/** Where the player lives: a frame clipped to nothing (pond.css). */
function frame(): HTMLElement {
  let el = document.getElementById('pond-player');
  if (!el) {
    el = document.createElement('div');
    el.id = 'pond-player';
    el.className = 'pond-player';
    el.setAttribute('aria-hidden', 'true');
    document.body.append(el);
  }
  return el;
}

function makePlayer(): Promise<YTPlayer> {
  ready ??= loadYouTube().then(
    (YT) =>
      new Promise<YTPlayer>((resolve) => {
        const mount = document.createElement('div');
        frame().append(mount);
        loaded = state.songs[state.index].id;
        const p = new YT.Player(mount, {
          width: '100%',
          height: '100%',
          videoId: loaded,
          playerVars: { playsinline: 1, controls: 0, disablekb: 1, fs: 0, rel: 0, iv_load_policy: 3, origin: window.location.origin },
          events: {
            onReady: () => {
              player = p;
              if (muted) p.mute();
              else p.unMute();
              resolve(p);
            },
            onStateChange: ({ data }) => {
              // Played or paused from outside the pond, e.g. the browser's media keys.
              if (data === PLAYING && !state.playing) set({ playing: true });
              if (data === PAUSED && state.playing) set({ playing: false });
              if (data === ENDED) play((state.index + 1) % state.songs.length);
            },
            onError: () => {
              // A video taken down or not embeddable: the next song, rather than silence.
              if (state.playing) play((state.index + 1) % state.songs.length);
            }
          }
        });
      })
  );
  return ready;
}

function set(next: Partial<MusicState>) {
  Object.assign(state, next);
  tell();
}

/** Plays a song from the library (the current one without an index). */
export async function play(index = state.index) {
  await loadSongs();
  if (!state.songs.length) return;
  set({ index: ((index % state.songs.length) + state.songs.length) % state.songs.length, playing: true });
  try {
    const p = await makePlayer();
    const id = state.songs[state.index].id;
    if (id !== loaded) {
      loaded = id;
      p.loadVideoById({ videoId: id });
    } else p.playVideo();
  } catch (error) {
    report(error, 'pond music');
    set({ playing: false });
  }
}

export function pause() {
  set({ playing: false });
  player?.pauseVideo();
}

export const toggle = () => (state.playing ? pause() : play());

/** The pond's one sound switch reaches the music too. */
export function setMusicMuted(on: boolean) {
  muted = on;
  if (!player) return;
  if (on) player.mute();
  else player.unMute();
}
