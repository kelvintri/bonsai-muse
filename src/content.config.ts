import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const journal = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/journal" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    image: z.string(),
    imageAlt: z.string(),
  }),
});

const trees = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/trees" }),
  schema: z.object({
    name: z.string(),
    latin: z.string(),
    origin: z.string(),
    size: z.string(),
    style: z.string(),
    status: z.string(),
    image: z.string(),
  }),
});

export const collections = { journal, trees };
