import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://empatheia.sinhaankur.com'

// The public, indexable surface of the app. The homepage is the product; the
// install guide is a genuine secondary page people may search for.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: siteUrl,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${siteUrl}/ollama-install`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ]
}
