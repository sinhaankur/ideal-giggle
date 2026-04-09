/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true"
const repository = process.env.GITHUB_REPOSITORY ?? ""
const repoName = repository.split("/")[1] ?? ""
const basePath = isStaticExport && repoName ? `/${repoName}` : ""

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
        basePath,
        assetPrefix: basePath,
      }
    : {}),
}

export default nextConfig
