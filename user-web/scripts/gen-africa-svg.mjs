/**
 * One-off: download Africa GeoJSON → public/africa-countries.svg (real country outlines).
 * Uganda filled green; others mint.
 *
 * Usage: node scripts/gen-africa-svg.mjs
 * Requires: d3-geo (npm i d3-geo --no-save)
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { geoMercator, geoPath } from 'd3-geo'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const GEO_URL =
  'https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/africa.geojson'

const res = await fetch(GEO_URL)
if (!res.ok) throw new Error(`Failed to download GeoJSON: ${res.status}`)
const geo = await res.json()

const W = 200
const H = 220
const PAD = 6

const projection = geoMercator().fitExtent(
  [
    [PAD, PAD],
    [W - PAD, H - PAD],
  ],
  geo,
)
const pathGen = geoPath(projection)

const parts = geo.features.map((f) => {
  const name = f.properties?.name || ''
  const isUg = name === 'Uganda'
  const d = pathGen(f)
  if (!d) return ''
  const fill = isUg ? '#12B81A' : '#EAF8EE'
  const stroke = isUg ? '#087A12' : '#C5D4C8'
  const sw = isUg ? 1.1 : 0.45
  const id = name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '')
  return `<path id="${id}" data-name="${name.replace(/"/g, '')}" d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`
})

const ug = geo.features.find((f) => f.properties?.name === 'Uganda')
const [ugX, ugY] = ug ? pathGen.centroid(ug) : [118, 112]

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" fill="none">
  <rect width="${W}" height="${H}" fill="#F7F9F7"/>
  <g id="africa-countries">
${parts.filter(Boolean).join('\n')}
  </g>
  <circle id="uganda-center" cx="${ugX.toFixed(2)}" cy="${ugY.toFixed(2)}" r="0" fill="none"/>
</svg>
`

const out = path.join(__dirname, '..', 'public', 'africa-countries.svg')
fs.writeFileSync(out, svg)
console.log('Wrote', out, 'uganda center', ugX.toFixed(2), ugY.toFixed(2))
