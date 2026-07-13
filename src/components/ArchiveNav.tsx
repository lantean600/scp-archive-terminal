import { Menu, ShieldAlert, X } from 'lucide-react'
import type { Archive } from '../types/archive'

export function ArchiveNav({ archives, activeId, open, onToggle }: { archives: Archive[]; activeId: string; open: boolean; onToggle: () => void }) {
  const active = archives.find((archive) => archive.id === activeId) ?? archives[0]
  return <><button className="mobile-nav-toggle" onClick={onToggle} aria-label="打开档案导航">{open ? <X /> : <Menu />}<span>档案索引</span></button><aside className={`archive-nav ${open ? 'is-open' : ''}`}>
    <div className="nav-seal"><ShieldAlert size={18} /><span>ARCHIVE<br /><b>INDEX</b></span></div>
    <div className="nav-label">CURRENT FILE</div><div className="nav-file"><span className="status-dot" />{active.itemNumber}<small>ACTIVE DOSSIER</small></div>
    <nav aria-label="档案章节"><a href="#overview">概览 <span>01</span></a><a href="#description">描述 <span>02</span></a><a href="#characteristics">特性分析 <span>03</span></a><a href="#timeline">事件记录 <span>04</span></a></nav>
    <div className="nav-divider" /><div className="nav-label">RELATED FILES</div>{archives.map((archive) => <a className={`related-link${archive.id === activeId ? ' archive-link-active' : ''}`} href={`${import.meta.env.BASE_URL}?archive=${encodeURIComponent(archive.id)}`} key={archive.id}><span>→</span>{archive.itemNumber}<small>{archive.title}</small></a>)}
    <div className="nav-footer"><span>端点状态</span><strong><i />已同步</strong></div>
  </aside></>
}
