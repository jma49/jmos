// GET /api/keepalive: one small read of the database, run each day by Vercel's
// cron (vercel.json). Supabase's free plan pauses a project after a week with
// no requests, and a paused project refuses every sign-in, note and chat
// message until it's restored by hand; a quiet week on the site was enough to
// pause it once (November 2026). The read is the cheapest the database
// serves: one song's id. Nothing is cached, so each run reaches the database.

const NO_STORE = { 'cache-control': 'no-store' };

export async function GET() {
  const url = process.env.PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return Response.json({ ok: false, why: 'no database configured' }, { status: 503, headers: NO_STORE });
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/rest/v1/songs?select=id&limit=1`, { headers: { apikey: key }, signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`Supabase answered ${res.status}`);
    return Response.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    // A failure here shows in the cron's log on Vercel: the project may already be paused.
    console.error('/api/keepalive: Supabase could not be reached:', error instanceof Error ? error.message : error);
    return Response.json({ ok: false }, { status: 502, headers: NO_STORE });
  }
}
