import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const archiveDir = path.join(root, 'content', 'archives')
const files = fs.readdirSync(archiveDir).filter((file) => file.endsWith('.json'))
const ids = new Set()
const errors = []
const required = ['id', 'itemNumber', 'title', 'objectClass', 'threatLevel', 'status', 'site', 'clearanceLevel', 'lastUpdated', 'image', 'imageCaption', 'containmentProcedures', 'description', 'discoveryLog', 'appendices', 'characteristics', 'radarMetrics', 'relatedArchives']
for (const file of files) {
  const full = path.join(archiveDir, file)
  let value
  try { value = JSON.parse(fs.readFileSync(full, 'utf8')) } catch (error) { errors.push(`${file}: invalid JSON`); continue }
  for (const field of required) if (!(field in value)) errors.push(`${file}: missing ${field}`)
  if (value.id && ids.has(value.id)) errors.push(`${file}: duplicate id ${value.id}`)
  if (value.id) ids.add(value.id)
  if (value.radarMetrics?.length !== 6) errors.push(`${file}: radarMetrics must contain exactly 6 values`)
  if (value.image && !/^[^<>"']+$/.test(value.image)) errors.push(`${file}: unsafe image path`)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`Validated ${files.length} archive file(s).`)
