export type ArchiveSection = { title: string; paragraphs: string[] }
export type Characteristic = { label: string; value: string; level: number; tone?: 'red' | 'amber' | 'cyan' }
export type RadarMetric = { label: string; value: number }
export type ArchiveStatus = 'draft' | 'published'
export type ArchiveMetadata = { authorGithubLogin?: string; submittedAt?: string; sourcePullRequest?: number }
export type Archive = {
  id: string; itemNumber: string; title: string; objectClass: string; threatLevel: string; status: string
  site: string; clearanceLevel: string; lastUpdated: string; image: string; imageCaption: string
  containmentProcedures: ArchiveSection; description: ArchiveSection; discoveryLog: ArchiveSection
  appendices: { title: string; body: string; tag: string }[]; characteristics: Characteristic[]
  radarMetrics: RadarMetric[]; relatedArchives: string[]
  metadata?: ArchiveMetadata; archiveStatus?: ArchiveStatus
}
