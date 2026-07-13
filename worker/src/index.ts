interface Env {
  DB: D1Database
  GITHUB_OWNER: string
  GITHUB_REPO: string
  GITHUB_DEFAULT_BRANCH: string
  PAGES_URL: string
  GITHUB_CLIENT_ID: string
  GITHUB_CLIENT_SECRET: string
  SESSION_ENCRYPTION_KEY: string
}

type Session = { userId: string; login: string; token: string; expiresAt: number }
type SessionRow = { github_user_id: string; github_login: string; access_token_ciphertext: string; expires_at: number }
type ExchangeTicketRow = { session_token_ciphertext: string }

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 14
const EXCHANGE_TICKET_TTL_SECONDS = 120
const json = (data: unknown, status = 200, origin = '*') => new Response(status === 204 ? null : JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': origin,
    'access-control-allow-credentials': 'true',
    'access-control-allow-headers': 'authorization, content-type',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
  },
})
const now = () => Math.floor(Date.now() / 1000)
const encode = (value: ArrayBuffer | Uint8Array) => { const bytes = ArrayBuffer.isView(value) ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength) : new Uint8Array(value); return btoa(String.fromCharCode(...bytes)) }
const decode = (value: string) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0))
function randomToken() { return encode(crypto.getRandomValues(new Uint8Array(32))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '') }
async function hash(value: string) { const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return encode(bytes) }
async function key(env: Env) { return crypto.subtle.importKey('raw', new TextEncoder().encode(env.SESSION_ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32)), 'AES-GCM', false, ['encrypt', 'decrypt']) }
async function encrypt(value: string, env: Env) { const iv = crypto.getRandomValues(new Uint8Array(12)); const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(env), new TextEncoder().encode(value)); return `${encode(iv)}.${encode(encrypted)}` }
async function decrypt(value: string, env: Env) { const [iv, body] = value.split('.'); const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(iv) }, await key(env), decode(body)); return new TextDecoder().decode(decrypted) }
function cookie(request: Request, name: string) { return request.headers.get('Cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) }
function requestSessionToken(request: Request) {
  const authorization = request.headers.get('Authorization')
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim()
  return bearer || cookie(request, 'scp_session') || null
}
async function sessionByToken(raw: string, env: Env): Promise<Session | null> {
  const row = await env.DB.prepare('SELECT github_user_id, github_login, access_token_ciphertext, expires_at FROM auth_sessions WHERE session_hash = ? AND expires_at > ?').bind(await hash(raw), now()).first<SessionRow>()
  if (!row) return null
  return { userId: row.github_user_id, login: row.github_login, token: await decrypt(row.access_token_ciphertext, env), expiresAt: row.expires_at }
}
async function session(request: Request, env: Env): Promise<Session | null> { const raw = requestSessionToken(request); return raw ? sessionByToken(raw, env) : null }
async function github(env: Env, token: string, endpoint: string, init: RequestInit = {}) { const response = await fetch(`https://api.github.com${endpoint}`, { ...init, headers: { accept: 'application/vnd.github+json', authorization: `Bearer ${token}`, 'user-agent': 'scp-archive-terminal', 'x-github-api-version': '2022-11-28', ...(init.headers ?? {}) } }); const rawBody = await response.text(); const body = JSON.parse(rawBody || '{}'); if (!response.ok) throw new Error(body.message ?? `GitHub API ${response.status}: ${rawBody.slice(0, 200)}`); return body }
function safeId(value: string) { return value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 70) }
function b64(value: string) { return btoa(unescape(encodeURIComponent(value))) }
const archiveRequired = ['id', 'itemNumber', 'title', 'objectClass', 'threatLevel', 'status', 'site', 'clearanceLevel', 'lastUpdated', 'image', 'imageCaption', 'containmentProcedures', 'description', 'discoveryLog', 'appendices', 'characteristics', 'radarMetrics', 'relatedArchives']
const archiveAllowed = new Set([...archiveRequired, 'archiveStatus', 'metadata'])
const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value)
const checkString = (value: unknown, name: string, min = 1, max = Infinity) => typeof value === 'string' && value.length >= min && value.length <= max ? null : `${name} must be a string with ${min}-${max} characters`
function validateArchive(value: Record<string, unknown>) {
  const errors: string[] = []
  for (const field of archiveRequired) if (!(field in value)) errors.push(`missing ${field}`)
  for (const field of Object.keys(value)) if (!archiveAllowed.has(field)) errors.push(`unknown field ${field}`)
  for (const [field, min, max] of [['id', 1, 80], ['itemNumber', 1, 80], ['title', 1, 120], ['objectClass', 1, 40], ['threatLevel', 1, 40], ['status', 1, 80], ['site', 1, 120], ['clearanceLevel', 1, 40], ['lastUpdated', 1, 40], ['image', 0, Infinity], ['imageCaption', 0, 500] ] as const) { const error = checkString(value[field], field, min, max); if (error) errors.push(error) }
  if (typeof value.id === 'string' && !/^[a-z0-9-]{3,80}$/.test(value.id)) errors.push('id has invalid format')
  for (const field of ['containmentProcedures', 'description', 'discoveryLog']) { const section = value[field]; if (!isRecord(section)) { errors.push(`${field} must be an object`); continue }; const titleError = checkString(section.title, `${field}.title`, 1, 100); if (titleError) errors.push(titleError); if (!Array.isArray(section.paragraphs) || section.paragraphs.length < 1 || section.paragraphs.length > 30) errors.push(`${field}.paragraphs must contain 1-30 items`); else section.paragraphs.forEach((item, index) => { const error = checkString(item, `${field}.paragraphs[${index}]`, 1, 5000); if (error) errors.push(error) }) }
  if (!Array.isArray(value.appendices) || value.appendices.length > 20) errors.push('appendices must contain at most 20 items')
  if (!Array.isArray(value.characteristics) || value.characteristics.length > 12) errors.push('characteristics must contain at most 12 items')
  if (!Array.isArray(value.radarMetrics) || value.radarMetrics.length !== 6) errors.push('radarMetrics must contain exactly 6 items')
  else value.radarMetrics.forEach((item, index) => { if (!isRecord(item)) { errors.push(`radarMetrics[${index}] must be an object`); return }; const labelError = checkString(item.label, `radarMetrics[${index}].label`, 1, 60); if (labelError) errors.push(labelError); if (typeof item.value !== 'number' || item.value < 0 || item.value > 100) errors.push(`radarMetrics[${index}].value must be 0-100`) })
  if (!Array.isArray(value.relatedArchives) || value.relatedArchives.length > 20) errors.push('relatedArchives must contain at most 20 items')
  if (value.archiveStatus !== undefined && !['draft', 'published'].includes(String(value.archiveStatus))) errors.push('archiveStatus is invalid')
  return errors
}
async function createSubmission(request: Request, env: Env, origin: string) {
  const current = await session(request, env); if (!current) return json({ error: '请先使用 GitHub 登录。' }, 401, origin)
  const payload = await request.json<{ archive?: Record<string, unknown>; image?: { filename: string; contentBase64: string; mimeType: string } }>()
  const archive = payload.archive; if (!archive || !isRecord(archive)) return json({ error: '档案数据不完整。' }, 400, origin)
  const archiveErrors = validateArchive(archive); if (archiveErrors.length) return json({ error: '档案数据校验失败。', details: archiveErrors }, 400, origin)
  const id = safeId(String(archive.id)); if (!id || id !== archive.id) return json({ error: '档案 slug 只允许小写字母、数字和短横线。' }, 400, origin)
  const image = payload.image; if (!image || !['image/png', 'image/jpeg', 'image/webp'].includes(image.mimeType) || image.contentBase64.length > 7_000_000) return json({ error: '图片格式或大小不符合要求。' }, 400, origin)
  const existing = await github(env, current.token, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/content/archives/${id}.json?ref=${env.GITHUB_DEFAULT_BRANCH}`, {} ).catch(() => null); if (existing) return json({ error: '该档案 slug 已存在，请换一个。' }, 409, origin)
  const branch = `contrib/archive-${id}-${current.userId.slice(-8)}`; const base = await github(env, current.token, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/ref/heads/${env.GITHUB_DEFAULT_BRANCH}`); await github(env, current.token, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/git/refs`, { method: 'POST', body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }) });
  const archiveContent = `${JSON.stringify({ ...archive, archiveStatus: 'draft', metadata: { authorGithubLogin: current.login, submittedAt: new Date().toISOString() } }, null, 2)}\n`; const root = `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents`;
  await github(env, current.token, `${root}/content/archives/${id}.json`, { method: 'PUT', body: JSON.stringify({ message: `Add archive: ${archive.itemNumber} / ${archive.title}`, content: b64(archiveContent), branch }) });
  const extension = image.mimeType === 'image/png' ? 'png' : image.mimeType === 'image/webp' ? 'webp' : 'jpg'; const imagePath = `content/assets/${id}.${extension}`; await github(env, current.token, `${root}/${imagePath}`, { method: 'PUT', body: JSON.stringify({ message: `Add asset: ${archive.itemNumber}`, content: image.contentBase64, branch }) });
  const pr = await github(env, current.token, `/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/pulls`, { method: 'POST', body: JSON.stringify({ title: `Add archive: ${archive.itemNumber} / ${archive.title}`, head: branch, base: env.GITHUB_DEFAULT_BRANCH, body: `## 档案贡献\n\n- 项目：${archive.itemNumber}\n- 标题：${archive.title}\n- 提交者：@${current.login}\n\n该 PR 由 SCP 档案站在线编辑器创建，请维护者审核内容后合并。` }) });
  const idValue = crypto.randomUUID(); const timestamp = now(); await env.DB.prepare('INSERT INTO submissions (id, github_user_id, github_login, archive_id, branch_name, pull_request_number, pull_request_url, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(idValue, current.userId, current.login, id, branch, pr.number, pr.html_url, 'open', timestamp, timestamp).run(); await env.DB.prepare('INSERT INTO audit_events (event_type, github_login, submission_id, result, created_at) VALUES (?, ?, ?, ?, ?)').bind('submission.created', current.login, idValue, 'success', timestamp).run(); return json({ id: idValue, status: 'open', pullRequestNumber: pr.number, pullRequestUrl: pr.html_url, archiveId: id, createdAt: new Date(timestamp * 1000).toISOString() }, 201, origin)
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = new URL(env.PAGES_URL).origin
    if (request.method === 'OPTIONS') return json({}, 204, origin)
    const url = new URL(request.url)

    try {
      if (url.pathname === '/auth/github') {
        const state = randomToken()
        await env.DB.prepare('INSERT INTO oauth_states (state_hash, redirect_uri, expires_at) VALUES (?, ?, ?)').bind(await hash(state), `${env.PAGES_URL}?view=editor`, now() + 600).run()
        const callback = `${url.origin}/auth/callback`
        return Response.redirect(`https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(env.GITHUB_CLIENT_ID)}&redirect_uri=${encodeURIComponent(callback)}&scope=read:user%20user:email%20public_repo&state=${encodeURIComponent(state)}`, 302)
      }

      if (url.pathname === '/auth/callback') {
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        if (!code || !state) return new Response('OAuth 参数不完整。', { status: 400 })

        const stateHash = await hash(state)
        const stateRow = await env.DB.prepare('SELECT redirect_uri FROM oauth_states WHERE state_hash = ? AND expires_at > ?').bind(stateHash, now()).first<{ redirect_uri: string }>()
        if (!stateRow) return new Response('OAuth state 无效或已过期。', { status: 400 })
        await env.DB.prepare('DELETE FROM oauth_states WHERE state_hash = ?').bind(stateHash).run()

        const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET, code }),
        })
        const tokenBody = await tokenResponse.json<{ access_token?: string }>()
        if (!tokenBody.access_token) return new Response('GitHub OAuth 失败。', { status: 502 })

        const profile = await github(env, tokenBody.access_token, '/user')
        const createdAt = now()
        const sessionExpiresAt = createdAt + SESSION_TTL_SECONDS
        const rawSession = randomToken()
        await env.DB.prepare('INSERT INTO auth_sessions (session_hash, github_user_id, github_login, access_token_ciphertext, created_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)').bind(await hash(rawSession), String(profile.id), profile.login, await encrypt(tokenBody.access_token, env), createdAt, sessionExpiresAt).run()

        const ticket = randomToken()
        await env.DB.prepare('INSERT INTO auth_exchange_tickets (ticket_hash, session_token_ciphertext, expires_at, consumed_at) VALUES (?, ?, ?, NULL)').bind(await hash(ticket), await encrypt(rawSession, env), createdAt + EXCHANGE_TICKET_TTL_SECONDS).run()
        const location = `${stateRow.redirect_uri}#oauth_ticket=${encodeURIComponent(ticket)}`
        return new Response(null, { status: 302, headers: { location, 'set-cookie': `scp_session=${rawSession}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${SESSION_TTL_SECONDS}` } })
      }

      if (url.pathname === '/auth/exchange' && request.method === 'POST') {
        const payload = await request.json<{ ticket?: unknown }>().catch(() => null)
        if (!payload || typeof payload.ticket !== 'string' || payload.ticket.length < 20 || payload.ticket.length > 200) return json({ error: '登录票据无效。' }, 400, origin)

        const ticketHash = await hash(payload.ticket)
        const ticketRow = await env.DB.prepare('SELECT session_token_ciphertext FROM auth_exchange_tickets WHERE ticket_hash = ?').bind(ticketHash).first<ExchangeTicketRow>()
        if (!ticketRow) return json({ error: '登录票据无效、已使用或已过期。' }, 401, origin)

        const consumedAt = now()
        const consumed = await env.DB.prepare('UPDATE auth_exchange_tickets SET consumed_at = ? WHERE ticket_hash = ? AND consumed_at IS NULL AND expires_at > ?').bind(consumedAt, ticketHash, consumedAt).run()
        if (consumed.meta.changes !== 1) return json({ error: '登录票据无效、已使用或已过期。' }, 401, origin)

        const rawSession = await decrypt(ticketRow.session_token_ciphertext, env)
        const current = await sessionByToken(rawSession, env)
        if (!current) return json({ error: '登录会话无效或已过期。' }, 401, origin)
        return json({ sessionToken: rawSession, user: { id: current.userId, login: current.login }, expiresAt: new Date(current.expiresAt * 1000).toISOString() }, 200, origin)
      }

      if (url.pathname === '/auth/logout' && request.method === 'POST') {
        const raw = requestSessionToken(request)
        if (raw) await env.DB.prepare('DELETE FROM auth_sessions WHERE session_hash = ?').bind(await hash(raw)).run()
        return new Response(null, { status: 204, headers: {
          'cache-control': 'no-store',
          'set-cookie': 'scp_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0',
          'access-control-allow-origin': origin,
          'access-control-allow-credentials': 'true',
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET,POST,OPTIONS',
        } })
      }

      if (url.pathname === '/api/me') {
        const raw = requestSessionToken(request)
        if (!raw) return json({ user: null }, 200, origin)
        const current = await sessionByToken(raw, env)
        return current ? json({ user: { id: current.userId, login: current.login } }, 200, origin) : json({ error: '登录会话无效或已过期。' }, 401, origin)
      }

      if (url.pathname === '/api/submissions' && request.method === 'POST') return createSubmission(request, env, origin)
      const match = url.pathname.match(/^\/api\/submissions\/([^/]+)$/)
      if (match && request.method === 'GET') {
        const current = await session(request, env)
        if (!current) return json({ error: '未登录。' }, 401, origin)
        const row = await env.DB.prepare('SELECT * FROM submissions WHERE id = ? AND github_user_id = ?').bind(match[1], current.userId).first()
        return row ? json(row, 200, origin) : json({ error: '提交不存在。' }, 404, origin)
      }
      return json({ error: 'Not found' }, 404, origin)
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : '服务器错误' }, 500, origin)
    }
  },
}
