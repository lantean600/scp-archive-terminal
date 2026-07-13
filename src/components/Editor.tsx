import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { ArrowLeft, Check, FileUp, GitPullRequest, LogIn, Plus, Save, Trash2 } from 'lucide-react'
import type { Archive, ArchiveSection } from '../types/archive'
import { archives } from '../data/archives'
import '../styles.css'

const apiBase = import.meta.env.VITE_API_BASE_URL ?? ''
const initial = archives[0]

function paragraphs(value: string) { return value.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean) }
function sectionText(section: ArchiveSection) { return section.paragraphs.join('\n\n') }

export function Editor() {
  const [draft, setDraft] = useState<Archive>(() => {
    try {
      const saved = localStorage.getItem('scp-editor-draft')
      if (saved) return { ...initial, ...JSON.parse(saved) }
    } catch { /* ignore malformed local drafts */ }
    return { ...initial, id: '', itemNumber: 'SCP-CN-', title: '', image: '' }
  })
  const [user, setUser] = useState<{ login: string } | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  const [loginStarting, setLoginStarting] = useState(false)
  const [image, setImage] = useState<{ filename: string; contentBase64: string; mimeType: string } | null>(null)
  const [imagePreviewUrl, setImagePreviewUrl] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!apiBase) { setAuthChecked(true); return }
    let active = true
    fetch(`${apiBase}/api/me`, { credentials: 'include', cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error(`auth status ${response.status}`)
        return response.json() as Promise<{ user?: { login: string } | null }>
      })
      .then((value) => { if (active) setUser(value?.user ?? null) })
      .catch(() => { if (active) setUser(null) })
      .finally(() => { if (active) setAuthChecked(true) })
    return () => { active = false }
  }, [])
  useEffect(() => { localStorage.setItem('scp-editor-draft', JSON.stringify(draft)) }, [draft])
  useEffect(() => { setImagePreviewUrl(image ? `data:${image.mimeType};base64,${image.contentBase64}` : '') }, [image])

  const apiConfigured = Boolean(apiBase)
  const preview = useMemo(() => ({ ...draft, image: imagePreviewUrl || draft.image }), [draft, imagePreviewUrl])
  const update = (field: keyof Archive, value: string) => setDraft((current) => ({ ...current, [field]: value }))
  const updateSection = (field: 'containmentProcedures' | 'description' | 'discoveryLog', value: string) => setDraft((current) => ({ ...current, [field]: { ...current[field], paragraphs: paragraphs(value) } }))
  const handleImage = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setMessage('图像必须是 PNG、JPG 或 WebP，且不超过 5 MB。'); return }
    const reader = new FileReader()
    reader.onload = () => setImage({ filename: file.name, contentBase64: String(reader.result).split(',')[1] ?? '', mimeType: file.type })
    reader.readAsDataURL(file)
  }
  const clearDraft = () => { setDraft({ ...initial, id: '', itemNumber: 'SCP-CN-', title: '', image: '' }); setImage(null); setMessage('草稿已清空。') }
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setMessage('')
    if (!apiConfigured) { setMessage('编辑 API 尚未配置。请设置 VITE_API_BASE_URL 后再提交。'); return }
    if (!authChecked) { setMessage('正在检查 GitHub 登录状态，请稍候。'); return }
    if (!user) { setMessage('请先点击 GitHub 登录并完成授权。'); return }
    if (!draft.id || !draft.title || !draft.itemNumber) { setMessage('请先填写编号、slug 和标题。'); return }
    setSubmitting(true)
    try {
      const response = await fetch(`${apiBase}/api/submissions`, { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ archive: { ...draft, image: image?.filename ?? draft.image, archiveStatus: 'draft' }, image }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error ?? '提交失败')
      setMessage(`提交成功：${result.pullRequestUrl}`)
    } catch (error) {
      setMessage(error instanceof TypeError ? '无法连接投稿 API?请刷新页面后重试。' : error instanceof Error ? error.message : '提交失败')
    } finally { setSubmitting(false) }
  }
  const sectionValue = (field: 'containmentProcedures' | 'description' | 'discoveryLog') => sectionText(draft[field])
  return <div className="editor-shell"><header className="editor-topbar"><a href={import.meta.env.BASE_URL} className="editor-back"><ArrowLeft size={16} /> 返回档案站</a><div><span className="editor-kicker">CONTRIBUTION TERMINAL</span><h1>提交一份新的档案</h1></div><div className={`editor-user${user ? ' editor-user--authenticated' : ''}`}>{user ? <><span className="status-dot" /> 已登录 @{user.login}</> : authChecked ? <a href={apiConfigured ? `${apiBase}/auth/github` : '#'} onClick={(event) => { if (!apiConfigured || loginStarting) event.preventDefault(); else setLoginStarting(true) }} aria-disabled={loginStarting}><LogIn size={15} /> {loginStarting ? '正在跳转 GitHub…' : 'GitHub 登录'}</a> : <span className="editor-auth-checking">检查登录状态…</span>}</div></header><form className="editor-layout" onSubmit={submit}>
    <section className="editor-card"><div className="editor-card-title"><span>01</span><h2>基础信息</h2></div><div className="form-grid"><label>档案 slug<input value={draft.id} onChange={(event) => update('id', event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="scp-cn-new-archive" /></label><label>项目编号<input value={draft.itemNumber} onChange={(event) => update('itemNumber', event.target.value)} /></label><label className="wide">标题<input value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="异常项目名称" /></label><label>收容等级<input value={draft.objectClass} onChange={(event) => update('objectClass', event.target.value)} /></label><label>威胁等级<input value={draft.threatLevel} onChange={(event) => update('threatLevel', event.target.value)} /></label><label>收容状态<input value={draft.status} onChange={(event) => update('status', event.target.value)} /></label><label>Site<input value={draft.site} onChange={(event) => update('site', event.target.value)} /></label><label>权限等级<input value={draft.clearanceLevel} onChange={(event) => update('clearanceLevel', event.target.value)} /></label><label>更新时间<input value={draft.lastUpdated} onChange={(event) => update('lastUpdated', event.target.value)} /></label></div></section>
    <section className="editor-card"><div className="editor-card-title"><span>02</span><h2>档案正文</h2></div><div className="form-stack"><label>特殊收容措施<textarea value={sectionValue('containmentProcedures')} onChange={(event) => updateSection('containmentProcedures', event.target.value)} /></label><label>描述<textarea value={sectionValue('description')} onChange={(event) => updateSection('description', event.target.value)} /></label><label>发现记录<textarea value={sectionValue('discoveryLog')} onChange={(event) => updateSection('discoveryLog', event.target.value)} /></label></div></section>
    <section className="editor-card"><div className="editor-card-title"><span>03</span><h2>特性与雷达图</h2></div><div className="editor-metric-list">{draft.radarMetrics.map((metric, index) => <label key={metric.label}>{metric.label}<input type="range" min="0" max="100" value={metric.value} onChange={(event) => setDraft((current) => ({ ...current, radarMetrics: current.radarMetrics.map((item, itemIndex) => itemIndex === index ? { ...item, value: Number(event.target.value) } : item) }))} /><output>{metric.value}</output></label>)}</div><div className="form-stack"><label>图像说明<textarea value={draft.imageCaption} onChange={(event) => update('imageCaption', event.target.value)} /></label></div></section>
    <section className="editor-card"><div className="editor-card-title"><span>04</span><h2>图像与提交</h2></div><label className="upload-box"><FileUp size={20} /><span>{image ? image.filename : '选择 PNG / JPG / WebP 主图（最大 5 MB）'}</span><input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImage} /></label>{imagePreviewUrl && <img className="editor-image-preview" src={imagePreviewUrl} alt="档案主图预览" />}<div className="editor-actions"><button type="button" className="ghost-button" onClick={clearDraft}><Trash2 size={15} /> 清空</button><button type="button" className="ghost-button" onClick={() => setMessage('草稿已保存到当前浏览器。')}><Save size={15} /> 保存草稿</button><button className="primary-button" disabled={submitting}><GitPullRequest size={16} /> {submitting ? '正在创建 PR…' : '提交并创建 PR'}</button></div>{message && <p className="editor-message"><Check size={15} /> {message}</p>}{!user && <p className="editor-hint">提交前需要使用 GitHub 登录。审批和合并由仓库维护者在 GitHub 完成。</p>}</section>
  </form><div className="editor-preview"><div><span className="editor-kicker">LIVE PREVIEW</span><h2>{preview.itemNumber || 'SCP-CN-███'} / {preview.title || '未命名档案'}</h2></div><span>{preview.objectClass} · {preview.status}</span></div></div>
}