import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

/** @type {import('next').NextConfig} */
const isStaticExport = process.env.STATIC_EXPORT === "true"
const isElectronBuild = process.env.ELECTRON_BUILD === "true"
const repository = process.env.GITHUB_REPOSITORY ?? ""
const repoName = repository.split("/")[1] ?? ""
// Electron loads the export via file://, where a leading "/" resolves to the
// filesystem root. Use relative URLs ("./") for that target; otherwise mirror
// the GitHub Pages basePath behavior.
const basePath = isStaticExport && !isElectronBuild && repoName ? `/${repoName}` : ""
const assetPrefix = isElectronBuild ? "./" : basePath
const projectRoot = dirname(fileURLToPath(import.meta.url))

const nextConfig = {
  turbopack: {
    root: projectRoot,
  },
  // Surface basePath to client code so /public assets fetched directly
  // (face-api weights, etc.) resolve correctly under GitHub Pages.
  env: {
    NEXT_PUBLIC_BASE_PATH: isElectronBuild ? "" : basePath,
    NEXT_PUBLIC_STATIC_EXPORT: isStaticExport ? "true" : "false",
    NEXT_PUBLIC_ELECTRON_BUILD: isElectronBuild ? "true" : "false",
  },
  ...(isStaticExport
    ? {
        output: "export",
        trailingSlash: true,
        images: {
          unoptimized: true,
        },
        basePath,
        assetPrefix,
      }
    : {}),
}

export default nextConfig
