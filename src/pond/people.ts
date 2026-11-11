// Who else is in the pond, and what they leave: accounts, presence, the
// guestbook's notes and the chat room, through the same backend the desktop
// uses (src/os/social; its rules are the database's, docs/agents/supabase.md).
//
// The backend isn't part of a first visit (docs/decisions/0009): it loads
// at once only for someone with a stored session, otherwise once the pond
// has settled, or when something asks for it (signing in, the guestbook,
// the chat). Presence says only a colour and, for members, a username;
// nobody's pointer or city is sent.

import { report } from '../os/core/report';
import { onStored } from '../os/core/storage';
import { getSocial, HAS_BACKEND, hasStoredSession, SESSION_KEY } from '../os/social/social';
import { type Account, type ChatMessage, type ChatRoom, CURSOR_COLORS, LOBBY, type Note, type Presence, type Social, type Visitor } from '../os/social/types';

export type { Account, ChatMessage, ChatRoom, Note, Visitor };

export interface PeopleHooks {
  /** Whoever is signed in in this browser, or null; called again on every change. */
  onAccount: (account: Account | null) => void;
  /** Everyone else in the pond (or on the desktop) right now. */
  onVisitors: (others: Visitor[]) => void;
  /** The guestbook's newest notes, when they're read. */
  onNotes: (notes: Note[]) => void;
  /** Whether there is a backend at all to sign in to. */
  onAvailable: (available: boolean) => void;
}

let hooks: PeopleHooks | null = null;
let social: Social | null = null;
let presence: Presence | null = null;
let account: Account | null = null;
const color = CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)];

/** The backend, loaded on first use; null when this build has none. */
export async function backend(): Promise<Social | null> {
  if (social) return social;
  const s = await getSocial();
  if (!s || social) return social ?? s;
  social = s;
  s.onAccount((a) => {
    account = a;
    presence?.update(info());
    hooks?.onAccount(a);
  });
  presence = s.joinPresence(info(), {
    onVisitors: (all) => hooks?.onVisitors(all.filter((v) => !v.self)),
    onCursor: () => {},
    onLeave: () => {},
    onSignal: () => {}
  });
  addEventListener('pagehide', () => presence?.leave());
  void readNotes();
  return s;
}

const info = () => ({ color, ...(account ? { username: account.username } : {}) });

/** Starts the social side: now for a member, otherwise once the pond has settled. */
export function startPeople(h: PeopleHooks, settled: Promise<void>) {
  hooks = h;
  h.onAvailable(HAS_BACKEND);
  if (!HAS_BACKEND) return;
  if (hasStoredSession()) void backend();
  else void settled.then(backend);
  // Signed in from another tab: this one follows.
  onStored(SESSION_KEY, () => void (hasStoredSession() && backend()));
}

export const currentAccount = () => account;

export async function readNotes(): Promise<Note[]> {
  const s = await backend();
  if (!s) return [];
  try {
    const notes = await s.listNotes();
    hooks?.onNotes(notes);
    return notes;
  } catch (error) {
    report(error, 'pond notes');
    return [];
  }
}

export async function signIn(username: string, password: string) {
  const s = await backend();
  if (!s) throw new Error('There is nowhere to sign in to here.');
  return s.signIn(username.trim().toLowerCase(), password);
}

export async function signUp(username: string, password: string, recovery?: string) {
  const s = await backend();
  if (!s) throw new Error('There is nowhere to sign up here.');
  return s.signUp(username.trim().toLowerCase(), password, recovery || undefined);
}

export async function signOut() {
  await (await backend())?.signOut();
}

export async function notesLeft(): Promise<number> {
  const s = await backend();
  return s && account ? s.notesLeft() : 0;
}

export async function postNote(body: string) {
  const s = await backend();
  if (!s) throw new Error('The guestbook is closed here.');
  await s.postNote({ body, color: 'blue' });
  await readNotes();
}

export async function rooms(): Promise<ChatRoom[]> {
  const s = await backend();
  if (!s) return [LOBBY];
  return s.listRooms().catch((error) => {
    report(error, 'pond chat rooms');
    return [LOBBY];
  });
}

export async function readChat(room: string): Promise<ChatMessage[]> {
  const s = await backend();
  return s ? s.listChat(room) : [];
}

export async function sendChat(room: string, body: string) {
  const s = await backend();
  if (!s) throw new Error('The chat is closed here.');
  await s.sendChat(room, body);
}

/** Live messages and takedowns, while the chat is open. */
export async function watchChat(onMessage: (m: ChatMessage) => void, onRemove: (id: string) => void): Promise<() => void> {
  const s = await backend();
  return s ? s.watchChat({ onMessage, onRemove }) : () => {};
}
