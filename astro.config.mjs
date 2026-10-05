// @ts-check
import { defineConfig, envField } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  integrations: [react()],
  env: {
    schema: {
      // Base de las imágenes. En local: /images. En producción: https://covers.swogvex.dev
      PUBLIC_IMAGES_BASE_URL: envField.string({
        context: 'client',
        access: 'public',
        default: '/images',
      }),
    },
  },
});