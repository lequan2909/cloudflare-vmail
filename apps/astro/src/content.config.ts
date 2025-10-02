import { defineCollection, z } from 'astro:content'
import { glob } from 'astro/loaders'

const docs = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/docs' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    lastUpdated: z.coerce.date().optional(),
    author: z.string().optional(),
    draft: z.boolean().default(false),
    featured: z.boolean().default(false),
    tags: z.array(z.string()).optional(),
  }),
})

const features = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/features' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    icon: z.string().optional(),
    order: z.number().default(0),
    featured: z.boolean().default(false),
    demo: z.boolean().default(false),
  }),
})

export const collections = {
  docs,
  features,
}
