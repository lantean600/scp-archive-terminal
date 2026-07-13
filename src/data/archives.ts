import type { Archive } from '../types/archive'

type ArchiveDocument = Omit<Archive, 'image'> & { image: string }

const archiveDocuments = import.meta.glob('../../content/archives/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, ArchiveDocument>

const archiveAssets = import.meta.glob('../../content/assets/*', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function filename(path: string) {
  return path.split('/').pop()?.toLowerCase() ?? ''
}

function assetFor(document: ArchiveDocument) {
  const id = document.id.toLowerCase()
  const requested = filename(document.image)
  const candidates = Object.entries(archiveAssets)
  return candidates.find(([path]) => filename(path).replace(/\.[^.]+$/, '') === id)?.[1]
    ?? candidates.find(([path]) => filename(path) === requested)?.[1]
    ?? ''
}

export const archives: Archive[] = Object.entries(archiveDocuments)
  .map(([documentPath, document]) => ({
    ...document,
    image: assetFor(document),
  }))
  .sort((a, b) => Number((b.archiveStatus ?? 'published') === 'published') - Number((a.archiveStatus ?? 'published') === 'published') || a.itemNumber.localeCompare(b.itemNumber))
