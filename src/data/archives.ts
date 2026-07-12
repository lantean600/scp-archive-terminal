import archiveDocument from '../../content/archives/scp-cn-echo-well.json'
import echoWell from '../assets/echo-well.svg'
import type { Archive } from '../types/archive'

export const archives: Archive[] = [{
  ...archiveDocument,
  image: echoWell,
} as Archive]
