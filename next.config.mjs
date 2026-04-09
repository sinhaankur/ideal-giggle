import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true"
const repository = process.env.GITHUB_REPOSITORY ?? ""
const repoName = repository.split("/")[1] ?? ""
const basePath = isStaticExport && repoName ? `/${repoName}` : ""
const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  turbopack: {
    root: projectRoot,
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
