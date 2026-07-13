import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const archiveDir = path.join(root, 'content', 'archives')
const files = fs.readdirSync(archiveDir).filter((file) => file.endsWith('.json'))
const ids = new Set()
const errors = []
const required = ['id', 'itemNumber', 'title', 'objectClass', 'threatLevel', 'status', 'site', 'clearanceLevel', 'lastUpdated', 'image', 'imageCaption', 'containmentProcedures', 'description', 'discoveryLog', 'appendices', 'characteristics', 'radarMetrics', 'relatedArchives']
const allowed = new Set([...required, 'archiveStatus', 'metadata'])

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)
const string = (value, name, min = 1, max = Infinity) => {
  if (typeof value !== 'string') return `${name}: must be a string`
  if (value.length < min) return `${name}: must not be empty`
  if (value.length > max) return `${name}: exceeds ${max} characters`
  return null
}
const section = (value, name) => {
  if (!isRecord(value)) return [`${name}: must be an object`]
  const result = []
  const titleError = string(value.title, `${name}.title`, 1, 100)
  if (titleError) result.push(titleError)
  if (!Array.isArray(value.paragraphs) || value.paragraphs.length < 1 || value.paragraphs.length > 30) result.push(`${name}.paragraphs: must contain 1-30 items`)
  else value.paragraphs.forEach((item, index) => { const error = string(item, `${name}.paragraphs[${index}]`, 1, 5000); if (error) result.push(error) })
  return result
}
const validate = (value, file) => {
  const result = []
  if (!isRecord(value)) return [`${file}: root must be an object`]
  for (const field of required) if (!(field in value)) result.push(`${file}: missing ${field}`)
  for (const field of Object.keys(value)) if (!allowed.has(field)) result.push(`${file}: unknown field ${field}`)
  const constraints = [['id', 1, 80], ['itemNumber', 1, 80], ['title', 1, 120], ['objectClass', 1, 40], ['threatLevel', 1, 40], ['status', 1, 80], ['site', 1, 120], ['clearanceLevel', 1, 40], ['lastUpdated', 1, 40], ['image', 0, Infinity], ['imageCaption', 0, 500]]
  for (const [field, min, max] of constraints) { const error = string(value[field], `${file}.${field}`, min, max); if (error) result.push(error) }
  if (typeof value.id === 'string' && !/^[a-z0-9-]{3,80}$/.test(value.id)) result.push(`${file}.id: must match ^[a-z0-9-]{3,80}$`)
  if (typeof value.image === 'string' && /[<>"']/.test(value.image)) result.push(`${file}.image: contains unsafe characters`)
  for (const field of ['containmentProcedures', 'description', 'discoveryLog']) result.push(...section(value[field], `${file}.${field}`))
  if (!Array.isArray(value.appendices) || value.appendices.length > 20) result.push(`${file}.appendices: must be an array with at most 20 items`)
  else value.appendices.forEach((item, index) => { if (!isRecord(item)) result.push(`${file}.appendices[${index}]: must be an object`); else for (const [field, max] of [['tag', 60], ['title', 160], ['body', 5000]]) { const error = string(item[field], `${file}.appendices[${index}].${field}`, 1, max); if (error) result.push(error) } })
  if (!Array.isArray(value.characteristics) || value.characteristics.length > 12) result.push(`${file}.characteristics: must be an array with at most 12 items`)
  else value.characteristics.forEach((item, index) => { if (!isRecord(item)) result.push(`${file}.characteristics[${index}]: must be an object`); else { for (const [field, max] of [['label', 60], ['value', 100]]) { const error = string(item[field], `${file}.characteristics[${index}].${field}`, 1, max); if (error) result.push(error) }; if (typeof item.level !== 'number' || item.level < 0 || item.level > 100) result.push(`${file}.characteristics[${index}].level: must be 0-100`); if (item.tone !== undefined && !['red', 'amber', 'cyan'].includes(item.tone)) result.push(`${file}.characteristics[${index}].tone: invalid tone`) } })
  if (!Array.isArray(value.radarMetrics) || value.radarMetrics.length !== 6) result.push(`${file}.radarMetrics: must contain exactly 6 values`)
  else value.radarMetrics.forEach((item, index) => { if (!isRecord(item)) result.push(`${file}.radarMetrics[${index}]: must be an object`); else { const error = string(item.label, `${file}.radarMetrics[${index}].label`, 1, 60); if (error) result.push(error); if (typeof item.value !== 'number' || item.value < 0 || item.value > 100) result.push(`${file}.radarMetrics[${index}].value: must be 0-100`) } })
  if (!Array.isArray(value.relatedArchives) || value.relatedArchives.length > 20) result.push(`${file}.relatedArchives: must be an array with at most 20 items`)
  else value.relatedArchives.forEach((item, index) => { const error = string(item, `${file}.relatedArchives[${index}]`, 1, 160); if (error) result.push(error) })
  if (value.archiveStatus !== undefined && !['draft', 'published'].includes(value.archiveStatus)) result.push(`${file}.archiveStatus: invalid status`)
  if (value.metadata !== undefined && !isRecord(value.metadata)) result.push(`${file}.metadata: must be an object`)
  return result
}

for (const file of files) {
  const full = path.join(archiveDir, file)
  let value
  try { value = JSON.parse(fs.readFileSync(full, 'utf8')) } catch { errors.push(`${file}: invalid JSON`); continue }
  const fileErrors = validate(value, file)
  errors.push(...fileErrors)
  if (value?.id && ids.has(value.id)) errors.push(`${file}: duplicate id ${value.id}`)
  if (value?.id) ids.add(value.id)
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1) }
console.log(`Validated ${files.length} archive file(s).`)