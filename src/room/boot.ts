// What the page at /room runs (src/pages/room.astro): it asks the browser for WebGL 2, which
// three.js draws with, and only then starts the room. Without it the page says so in plain words.
//
// The room's code is imported here outright, not fetched on demand: a second chunk loaded with
// import() would make Vite share its loader with the home page's script, and the room must add
// nothing to what the home page downloads.
import { startRoom } from './main.js';

/** Whether this browser will draw with WebGL 2, asked of a canvas that is then given back. */
export function hasWebGL(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    gl?.getExtension('WEBGL_lose_context')?.loseContext(); // browsers keep only a few contexts alive
    return gl !== null;
  } catch {
    // some browsers throw rather than answer null when graphics are blocked
    return false;
  }
}

const note = document.getElementById('note');
const fail = (words: string) => {
  if (note) note.textContent = words;
  document.body.dataset.failed = '1';
};

if (!hasWebGL()) fail('This page draws a room in 3D, which needs WebGL. This browser has it turned off or cannot run it.');
else
  try {
    startRoom();
  } catch (error) {
    // WebGL was there a moment ago and the renderer still could not start (the card's driver, a lost context)
    console.error(error);
    fail('The room could not be drawn here. Reloading the page may help.');
  }
