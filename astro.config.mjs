import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import { SITE_URL } from './src/config/site';

// https://astro.build/config
export default defineConfig({
  site: SITE_URL,
  // The dev toolbar sits where the JM/OS Dock is. It never ships to production.
  devToolbar: { enabled: false },
  integrations: [react(), sitemap()],
  vite: {
    // NEXT_PUBLIC_ too: the Supabase integration for Vercel names its
    // variables for Next.js (see src/os/social/social.ts).
    envPrefix: ['PUBLIC_', 'NEXT_PUBLIC_'],
    // Fonts stay files, however small: the Content Security Policy's font-src allows only 'self', not
    // data: URLs, and a font inlined into the CSS is downloaded with it whether its characters show or not.
    build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
    // The commit being built, for About This Mac. Vercel sets it; local builds say "dev".
    define: {
      __JMOS_BUILD__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? '').slice(0, 7) || 'dev')
    }
  }
});
