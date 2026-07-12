import type { RadarMetric } from '../types/archive'

export function RadarChart({ metrics }: { metrics: RadarMetric[] }) {
  const center = 150, radius = 106
  const points = (scale: number) => metrics.map((_, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2 / metrics.length); return `${center + Math.cos(a) * radius * scale},${center + Math.sin(a) * radius * scale}` }).join(' ')
  const data = metrics.map((metric, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2 / metrics.length); return `${center + Math.cos(a) * radius * metric.value / 100},${center + Math.sin(a) * radius * metric.value / 100}` }).join(' ')
  return <div className="radar-wrap"><svg viewBox="0 0 300 300" role="img" aria-label="SCP异常特征雷达图">
    {[.25, .5, .75, 1].map(scale => <polygon key={scale} points={points(scale)} className="radar-grid" />)}
    {metrics.map((metric, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2 / metrics.length); return <line key={metric.label} x1={center} y1={center} x2={center + Math.cos(a) * radius} y2={center + Math.sin(a) * radius} className="radar-axis" /> })}
    <polygon points={data} className="radar-area" /><polyline points={`${data} ${data.split(' ')[0]}`} className="radar-line" />
    {metrics.map((metric, i) => { const a = -Math.PI / 2 + i * (Math.PI * 2 / metrics.length); return <text key={metric.label} x={center + Math.cos(a) * (radius + 24)} y={center + Math.sin(a) * (radius + 24)} className="radar-label" textAnchor="middle" dominantBaseline="middle">{metric.label}</text> })}
  </svg><div className="radar-legend">测量范围 <span>0</span><i /><span>100</span></div></div>
}
