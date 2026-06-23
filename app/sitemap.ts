import type { MetadataRoute } from 'next'

// Required so the static export (GitHub Pages build with output: "export")
// can emit this as a static sitemap.xml instead of a server route.
export const dynamic = 'force-static'

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
