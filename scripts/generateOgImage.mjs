// Generates the social-sharing (Open Graph) image for the site.
// Renders a branded 1200x630 SVG card and rasterizes it to PNG with @resvg/resvg-js.
// Run: node scripts/generateOgImage.mjs
import { writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const W = 1200
const H = 630

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#a35f7b"/>
      <stop offset="0.55" stop-color="#c07a93"/>
      <stop offset="1" stop-color="#c9a86a"/>
    </linearGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <circle cx="600" cy="655" r="320" fill="#ffffff" opacity="0.08"/>
  <circle cx="600" cy="-60" r="240" fill="#ffffff" opacity="0.07"/>

  <g font-family="Georgia, 'Times New Roman', serif" text-anchor="middle">
    <text x="${W/2}" y="160" font-size="24" fill="#ffffff" opacity="0.85">MAKEUP &amp; LASH STUDIO</text>
    <text x="${W/2}" y="330" font-size="94" font-weight="bold" fill="#ffffff">Shawty Beauty</text>
    <text x="${W/2}" y="424" font-size="50" font-weight="bold" fill="#ffffff">STUDIO</text>
    <text x="${W/2}" y="500" font-size="36" font-style="italic" fill="#ffffff" opacity="0.92">Look stunning, feel unstoppable.</text>
    <text x="${W/2}" y="562" font-size="24" fill="#ffffff" opacity="0.85">Makeup &#8226; Lash Extensions &#8226; Bridal Glam &#8226; Training</text>
  </g>
</svg>`

const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: W },
  font: { loadSystemFonts: true },
})
const png = resvg.render().asPng()
writeFileSync('frontend/public/og-image.png', png)
console.log('Wrote frontend/public/og-image.png', png.length, 'bytes')