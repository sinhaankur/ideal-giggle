import type { MetadataRoute } from 'next'

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://empatheia.sinhaankur.com'

// Allow search engines to crawl the public app. We disallow the API routes
// (no SEO value, and they shouldn't be indexed) and point crawlers at the
// sitemap so the homepage gets discovered quickly.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  }
}
