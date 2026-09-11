// Where the parts live. The 389 WebP (~10 MB) are served from GitHub Pages rather than out of the
// Vercel deploy: Pages does not meter bandwidth and Vercel's free tier does. Imported by the build
// tooling too, so nothing in here may touch `import.meta.env`.
export const PARTS_CDN = 'https://fvitas.github.io/minifig-assets'
