import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
export default defineConfig({ site: 'https://junyiyan.com', base: '/projects/promptbook', output: 'static', trailingSlash: 'always', integrations: [react()] });
