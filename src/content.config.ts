import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const artworks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/artworks' }),
  schema: z.object({
    title: z.string().optional(),
    author: z.string().optional(),
    // Texto libre para admitir "1903", "1903-05", "1903-05-12" o "c. 1977"
    date: z.string().optional(),
    // Fecha de alta: define el orden y el número (001, 002...)
    added: z.coerce.date(),
    // Nombre del archivo en el bucket / carpeta de imágenes
    image: z.string().min(1),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  }),
});

export const collections = { artworks };