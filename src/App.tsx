import { useState } from 'react'
import { ArrowUpRight, ChevronDown, CircleAlert, LockKeyhole, Maximize2, Radio, ScanLine } from 'lucide-react'
import { archives } from './data/archives'
import { ArchiveNav } from './components/ArchiveNav'
import { MetricCard } from './components/MetricCard'
import { RadarChart } from './components/RadarChart'
import './styles.css'
import { Editor } from './components/Editor'

const requestedArchiveId = new URLSearchParams(window.location.search).get('archive')
const archive = archives.find((item) => item.id === requestedArchiveId) ?? archives[0]
const isEditorRoute = new URLSearchParams(window.location.search).get('view') === 'editor' || window.location.pathname.endsWith('/editor') || window.location.pathname.endsWith('/editor/')

export default function App() {
  if (isEditorRoute) return <Editor />
  const [navOpen, setNavOpen] = useState(false)
  const [lightbox, setLightbox] = useState(false)
  const [openAppendix, setOpenAppendix] = useState(0)
  return <div className="terminal-shell">
    <div className="grain" /><header className="topbar"><div className="brand-mark"><span className="brand-symbol">S</span><span><b>SCP FOUNDATION</b><small>SECURE · CONTAIN · PROTECT</small></span></div><div className="topbar-status"><span><Radio size={13} /> LIVE FEED</span><span className="topbar-clock">12 JUL 2026 // 03:17:42 CST</span><button aria-label="访问权限"><LockKeyhole size={15} /> LEVEL 3</button></div></header>
    <div className="layout"><ArchiveNav archives={archives} activeId={archive.id} open={navOpen} onToggle={() => setNavOpen(v => !v)} /><main className="archive-main">
      <section className="archive-hero" id="overview"><div className="eyebrow"><span>ARCHIVE / ANOMALOUS OBJECT</span><span className="eyebrow-line" /><span>FILE 001 / 001</span></div><div className="hero-title"><div><p className="item-number">{archive.itemNumber}</p><h1>{archive.title}<sup>EUCLID</sup></h1><p className="subtitle">一口拒绝保持沉默的井。</p></div><div className="stamp">SECURE<br /><b>CONTAINED</b><br />2026—07—12</div></div><div className="hero-meta"><div><span>OBJECT CLASS</span><b>{archive.objectClass}</b></div><div><span>THREAT INDEX</span><b className="red-text">{archive.threatLevel}</b></div><div><span>CONTAINMENT</span><b className="cyan-text">{archive.status}</b></div></div></section>
      <section className="image-panel"><div className="image-topline"><span><ScanLine size={15} /> VISUAL RECORD / 01</span><span>CAM-04 / LIVE CAPTURE</span></div><button className="image-button" onClick={() => setLightbox(true)} aria-label="放大查看收容物图像"><img src={archive.image} alt="Site-19 地下层收容单元中的回声井" /><span className="scan-corner tl" /><span className="scan-corner tr" /><span className="scan-corner bl" /><span className="scan-corner br" /><span className="image-expand"><Maximize2 size={15} /> EXPAND</span></button><p className="image-caption"><span>图像说明</span>{archive.imageCaption}</p></section>
      <section className="content-grid"><article className="dossier-copy" id="description"><div className="section-heading"><span>01</span><h2>档案正文</h2><i /></div><section className="copy-block"><h3>{archive.containmentProcedures.title}</h3>{archive.containmentProcedures.paragraphs.map(p => <p key={p}>{p}</p>)}</section><section className="copy-block"><h3>{archive.description.title}</h3>{archive.description.paragraphs.map(p => <p key={p}>{p}</p>)}</section><section className="copy-block discovery"><h3>{archive.discoveryLog.title}<small>RECOVERY LOG / 2024.11.08</small></h3>{archive.discoveryLog.paragraphs.map(p => <p key={p}>{p}</p>)}</section></article><aside className="analysis-panel" id="characteristics"><div className="section-heading"><span>02</span><h2>特性分析</h2><i /></div><div className="metrics">{archive.characteristics.map(item => <MetricCard item={item} key={item.label} />)}</div><div className="radar-card"><div className="card-kicker">异常轮廓 <span>LIVE MODEL</span></div><RadarChart metrics={archive.radarMetrics} /></div></aside></section>
      <section className="timeline-section" id="timeline"><div className="section-heading"><span>03</span><h2>附录与事件记录</h2><i /><b>SECURITY LEVEL / 3</b></div><div className="appendices">{archive.appendices.map((item, i) => <div className={`appendix ${openAppendix === i ? 'open' : ''}`} key={item.tag}><button onClick={() => setOpenAppendix(openAppendix === i ? -1 : i)} aria-expanded={openAppendix === i}><span className="appendix-tag">{item.tag}</span><strong>{item.title}</strong><ChevronDown size={17} /></button>{openAppendix === i && <p>{item.body}</p>}</div>)}</div></section>
      <section className="related-strip"><div><span className="eyebrow">NEXT AVAILABLE RECORD</span><h3>声源索引 <small>SCP-CN-███-A</small></h3></div><a className="editor-entry" href={`${import.meta.env.BASE_URL}?view=editor`}>OPEN CONTRIBUTION TERMINAL <ArrowUpRight size={16} /></a></section>
      <footer className="terminal-footer"><span>ARCHIVE INTEGRITY <b>98.4%</b></span><span>LAST SYNC <b>{archive.lastUpdated} / 03:16:00</b></span><span className="footer-alert"><CircleAlert size={14} /> 1 项警示待复核</span></footer>
    </main></div>
    {lightbox && <div className="lightbox" role="dialog" aria-modal="true" aria-label="收容物图像预览" onClick={() => setLightbox(false)}><button aria-label="关闭图像预览">×</button><img src={archive.image} alt={archive.imageCaption} onClick={e => e.stopPropagation()} /></div>}
  </div>
}
