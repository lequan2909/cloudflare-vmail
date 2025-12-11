
import { defineCollection, z } from 'astro:content';

const docs = defineCollection({
    schema: z.object({
        title: z.string(),
        description: z.string(),
        layout: z.string().optional(),
    }),
});

const features = defineCollection({
    type: 'content',
    schema: z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string().optional(),
        featured: z.boolean().default(false),
        order: z.number().default(0),
    }),
});

export const collections = {
    docs,
    features,
};
