'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

type LabResult = {
  id: string
  date: string
  panel_name: string | null
  exam_name: string
  value: number | null
  unit: string | null
  reference_min: number | null
  reference_max: number | null
  status: 'normal' | 'alto' | 'baixo' | 'critico_alto' | 'critico_baixo' | null
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  normal:        { label: 'Normal',       color: '#4ADE80', bg: 'rgba(74,222,128,0.1)',  icon: '✓' },
  alto:          { label: 'Elevado',      color: '#FCD34D', bg: 'rgba(252,211,77,0.1)',  icon: '↑' },
  baixo:         { label: 'Baixo',        color: '#93C5FD', bg: 'rgba(147,197,253,0.1)', icon: '↓' },
  critico_alto:  { label: 'Crítico ↑',   color: '#F87171', bg: 'rgba(248,113,113,0.12)',icon: '⚠' },
  critico_baixo: { label: 'Crítico ↓',   color: '#F87171', bg: 'rgba(248,113,113,0.12)',icon: '⚠' },
}

// Common exam panels with default reference ranges
const EXAM_TEMPLATES: { panel: string; exams: { name: string; unit: string; min?: number; max?: number }[] }[] = [
  {
    panel: 'Glicemia',
    exams: [
      { name: 'Glicose em jejum', unit: 'mg/dL', min: 70, max: 99 },
      { name: 'Hemoglobina Glicada (HbA1c)', unit: '%', max: 5.7 },
      { name: 'Insulina em jejum', unit: 'µUI/mL', min: 2, max: 25 },
      { name: 'HOMA-IR', unit: '', max: 2.7 },
    ],
  },
  {
    panel: 'Lipidograma',
    exams: [
      { name: 'Colesterol Total', unit: 'mg/dL', max: 200 },
      { name: 'LDL', unit: 'mg/dL', max: 130 },
      { name: 'HDL', unit: 'mg/dL', min: 40 },
      { name: 'VLDL', unit: 'mg/dL', max: 30 },
      { name: 'Triglicerídeos', unit: 'mg/dL', max: 150 },
      { name: 'Não-HDL', unit: 'mg/dL', max: 160 },
    ],
  },
  {
    panel: 'Função Hepática',
    exams: [
      { name: 'TGO (AST)', unit: 'U/L', max: 40 },
      { name: 'TGP (ALT)', unit: 'U/L', max: 41 },
      { name: 'GGT', unit: 'U/L', max: 61 },
      { name: 'Fosfatase Alcalina', unit: 'U/L', min: 44, max: 147 },
      { name: 'Bilirrubina Total', unit: 'mg/dL', max: 1.2 },
    ],
  },
  {
    panel: 'Função Renal',
    exams: [
      { name: 'Creatinina', unit: 'mg/dL', min: 0.6, max: 1.2 },
      { name: 'Ureia', unit: 'mg/dL', min: 15, max: 45 },
      { name: 'Ácido Úrico', unit: 'mg/dL', min: 3.4, max: 7 },
      { name: 'Taxa de Filtração Glomerular (TFG)', unit: 'mL/min', min: 60 },
    ],
  },
  {
    panel: 'Hemograma',
    exams: [
      { name: 'Hemoglobina', unit: 'g/dL', min: 12, max: 17 },
      { name: 'Hematócrito', unit: '%', min: 36, max: 50 },
      { name: 'Leucócitos', unit: '/mm³', min: 4000, max: 11000 },
      { name: 'Plaquetas', unit: '/mm³', min: 150000, max: 450000 },
      { name: 'Ferritina', unit: 'ng/mL', min: 12, max: 300 },
      { name: 'Ferro Sérico', unit: 'µg/dL', min: 60, max: 170 },
    ],
  },
  {
    panel: 'Tireoide',
    exams: [
      { name: 'TSH', unit: 'mUI/L', min: 0.4, max: 4 },
      { name: 'T4 Livre', unit: 'ng/dL', min: 0.8, max: 1.9 },
      { name: 'T3 Total', unit: 'ng/dL', min: 80, max: 200 },
      { name: 'Anti-TPO', unit: 'UI/mL', max: 35 },
    ],
  },
  {
    panel: 'Vitaminas e Minerais',
    exams: [
      { name: 'Vitamina D (25-OH)', unit: 'ng/mL', min: 30, max: 100 },
      { name: 'Vitamina B12', unit: 'pg/mL', min: 200, max: 900 },
      { name: 'Ácido Fólico', unit: 'ng/mL', min: 3.1, max: 17.5 },
      { name: 'Magnésio', unit: 'mg/dL', min: 1.6, max: 2.6 },
      { name: 'Zinco', unit: 'µg/dL', min: 70, max: 120 },
      { name: 'Cálcio', unit: 'mg/dL', min: 8.5, max: 10.5 },
      { name: 'Potássio', unit: 'mEq/L', min: 3.5, max: 5.0 },
      { name: 'Sódio', unit: 'mEq/L', min: 136, max: 145 },
    ],
  },
  {
    panel: 'Inflamação',
    exams: [
      { name: 'PCR (Proteína C Reativa)', unit: 'mg/L', max: 5 },
      { name: 'PCR Ultrassensível', unit: 'mg/L', max: 3 },
      { name: 'VHS', unit: 'mm/h', max: 20 },
      { name: 'Homocisteína', unit: 'µmol/L', max: 15 },
    ],
  },
  {
    panel: 'Hormônios',
    exams: [
      { name: 'Testosterona Total', unit: 'ng/dL', min: 240, max: 950 },
      { name: 'Testosterona Livre', unit: 'pg/mL', min: 5, max: 21 },
      { name: 'Cortisol matinal', unit: 'µg/dL', min: 6, max: 23 },
      { name: 'DHEA-S', unit: 'µg/dL', min: 80, max: 560 },
      { name: 'Estradiol', unit: 'pg/mL', min: 20, max: 400 },
      { name: 'IGF-1', unit: 'ng/mL', min: 100, max: 300 },
      { name: 'Prolactina', unit: 'ng/mL', max: 25 },
    ],
  },
]

function TrendSparkline({ values }: { values: { date: string; value: number }[] }) {
  const ref = useRef<SVGSVGElement>(null)
  if (values.length < 2) return null
  const sorted = [...values].sort((a, b) => a.date.localeCompare(b.date))
  const nums = sorted.map(v => v.value)
  const min = Math.min(...nums)
  const max = Math.max(...nums)
  const range = max - min || 1
  const W = 80, H = 28
  const pts = sorted.map((v, i) => {
    const x = (i / (sorted.length - 1)) * (W - 4) + 2
    const y = H - 4 - ((v.value - min) / range) * (H - 8)
    return `${x},${y}`
  }).join(' ')
  const lastVal = nums[nums.length - 1]
  const prevVal = nums[nums.length - 2]
  const trend = lastVal > prevVal ? '#F87171' : lastVal < prevVal ? '#4ADE80' : '#93C5FD'
  return (
    <svg ref={ref} width={W} height={H} style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={trend} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {sorted.map((v, i) => (
        <circle key={i} cx={parseFloat(pts.split(' ')[i].split(',')[0])} cy={parseFloat(pts.split(' ')[i].split(',')[1])} r="2" fill={trend} />
      ))}
    </svg>
  )
}

export default function ExamesPage() {
  const params = useParams()
  const patientId = params.id as string

  const [results, setResults] = useState<LabResult[]>([])
  const [loading, setLoading] = useState(true)
  const [patientName, setPatientName] = useState('')

  // Modal state
  const [showModal, setShowModal] = useState(false)
  const [modalMode, setModalMode] = useState<'single' | 'panel'>('panel')
  const [editingResult, setEditingResult] = useState<LabResult | null>(null)

  // Panel add form
  const [selectedTemplate, setSelectedTemplate] = useState<typeof EXAM_TEMPLATES[0] | null>(null)
  const [panelDate, setPanelDate] = useState(new Date().toISOString().split('T')[0])
  const [panelRows, setPanelRows] = useState<Array<{
    exam_name: string; value: string; unit: string; reference_min: string; reference_max: string; notes: string
  }>>([])

  // Single add/edit form
  const [form, setForm] = useState({
    date: new Date().toISOString().split('T')[0],
    panel_name: '',
    exam_name: '',
    value: '',
    unit: '',
    reference_min: '',
    reference_max: '',
    notes: '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filter
  const [filterPanel, setFilterPanel] = useState('todos')
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const [resResults, resPatient] = await Promise.all([
      fetch(`/api/lab-results?patient_id=${patientId}`),
      fetch(`/api/patients/${patientId}`),
    ])
    const d1 = await resResults.json()
    const d2 = await resPatient.json()
    setResults(d1.results ?? [])
    setPatientName(d2.patient?.full_name ?? '')
    setLoading(false)
    // Auto-expand the most recent date
    if (d1.results?.length > 0) {
      const latestDate = d1.results[0].date
      setExpandedDates(new Set([latestDate]))
    }
  }, [patientId])

  useEffect(() => { load() }, [load])

  // Group results by date
  const grouped: Record<string, LabResult[]> = {}
  for (const r of results) {
    if (filterPanel !== 'todos' && r.panel_name !== filterPanel) continue
    if (!grouped[r.date]) grouped[r.date] = []
    grouped[r.date].push(r)
  }
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  // Get unique panels
  const allPanels = Array.from(new Set(results.map(r => r.panel_name).filter(Boolean)))

  // Trend data: for each unique exam name, collect values over time
  const trendByExam: Record<string, { date: string; value: number }[]> = {}
  for (const r of results) {
    if (r.value == null) continue
    if (!trendByExam[r.exam_name]) trendByExam[r.exam_name] = []
    trendByExam[r.exam_name].push({ date: r.date, value: r.value })
  }

  function openAddPanel() {
    setModalMode('panel')
    setEditingResult(null)
    setSelectedTemplate(null)
    setPanelDate(new Date().toISOString().split('T')[0])
    setPanelRows([])
    setError('')
    setShowModal(true)
  }

  function openAddSingle() {
    setModalMode('single')
    setEditingResult(null)
    setForm({
      date: new Date().toISOString().split('T')[0],
      panel_name: '',
      exam_name: '',
      value: '',
      unit: '',
      reference_min: '',
      reference_max: '',
      notes: '',
    })
    setError('')
    setShowModal(true)
  }

  function openEdit(r: LabResult) {
    setModalMode('single')
    setEditingResult(r)
    setForm({
      date: r.date,
      panel_name: r.panel_name ?? '',
      exam_name: r.exam_name,
      value: r.value != null ? String(r.value) : '',
      unit: r.unit ?? '',
      reference_min: r.reference_min != null ? String(r.reference_min) : '',
      reference_max: r.reference_max != null ? String(r.reference_max) : '',
      notes: r.notes ?? '',
    })
    setError('')
    setShowModal(true)
  }

  function selectTemplate(t: typeof EXAM_TEMPLATES[0]) {
    setSelectedTemplate(t)
    setPanelRows(t.exams.map(e => ({
      exam_name: e.name,
      value: '',
      unit: e.unit,
      reference_min: e.min != null ? String(e.min) : '',
      reference_max: e.max != null ? String(e.max) : '',
      notes: '',
    })))
  }

  async function savePanel() {
    if (!selectedTemplate) { setError('Selecione um painel'); return }
    const filledRows = panelRows.filter(r => r.value.trim() !== '')
    if (filledRows.length === 0) { setError('Preencha ao menos um resultado'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/lab-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patient_id: patientId,
        date: panelDate,
        panel_name: selectedTemplate.panel,
        records: filledRows.map(r => ({
          exam_name: r.exam_name,
          value: parseFloat(r.value) || null,
          unit: r.unit || null,
          reference_min: r.reference_min ? parseFloat(r.reference_min) : null,
          reference_max: r.reference_max ? parseFloat(r.reference_max) : null,
          notes: r.notes || null,
        })),
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function saveSingle() {
    if (!form.exam_name.trim()) { setError('Nome do exame obrigatório'); return }
    setSaving(true)
    setError('')
    const url = editingResult ? `/api/lab-results/${editingResult.id}` : '/api/lab-results'
    const method = editingResult ? 'PATCH' : 'POST'
    const body = editingResult ? form : { ...form, patient_id: patientId }
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        value: form.value ? parseFloat(form.value) : null,
        reference_min: form.reference_min ? parseFloat(form.reference_min) : null,
        reference_max: form.reference_max ? parseFloat(form.reference_max) : null,
        panel_name: form.panel_name || null,
        unit: form.unit || null,
        notes: form.notes || null,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error); setSaving(false); return }
    setSaving(false)
    setShowModal(false)
    load()
  }

  async function deleteResult(id: string) {
    if (!confirm('Excluir este exame?')) return
    await fetch(`/api/lab-results/${id}`, { method: 'DELETE' })
    setResults(prev => prev.filter(r => r.id !== id))
  }

  function toggleDate(date: string) {
    setExpandedDates(prev => {
      const s = new Set(prev)
      if (s.has(date)) s.delete(date)
      else s.add(date)
      return s
    })
  }

  const statusCountByType = {
    normal: results.filter(r => r.status === 'normal').length,
    alto: results.filter(r => r.status === 'alto' || r.status === 'critico_alto').length,
    baixo: results.filter(r => r.status === 'baixo' || r.status === 'critico_baixo').length,
    critico: results.filter(r => r.status === 'critico_alto' || r.status === 'critico_baixo').length,
  }

  return (
    <div>
      {/* Breadcrumb */}
      <div className="sticky top-0 z-40 flex items-center gap-2 px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}>
        <Link href="/pro/pacientes" className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>Pacientes</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <Link href={`/pro/pacientes/${patientId}`} className="text-xs transition-colors hover:text-white" style={{ color: 'rgba(255,255,255,0.3)' }}>{patientName || 'Paciente'}</Link>
        <span style={{ color: 'rgba(255,255,255,0.15)' }}>›</span>
        <span className="text-xs font-semibold text-white">Exames Laboratoriais</span>
      </div>

      <div className="p-8 max-w-5xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="text-[10px] font-bold tracking-[2px] uppercase mb-1" style={{ color: 'rgba(255,255,255,0.2)' }}>Clínico</div>
            <h1 className="text-2xl font-black text-white tracking-tight">🔬 Exames Laboratoriais</h1>
            {results.length > 0 && (
              <div className="flex gap-4 mt-2 text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                <span>{results.length} exames registrados</span>
                {statusCountByType.critico > 0 && (
                  <span style={{ color: '#F87171' }}>⚠ {statusCountByType.critico} crítico{statusCountByType.critico !== 1 ? 's' : ''}</span>
                )}
                {statusCountByType.alto > 0 && (
                  <span style={{ color: '#FCD34D' }}>↑ {statusCountByType.alto} elevado{statusCountByType.alto !== 1 ? 's' : ''}</span>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={openAddSingle} className="btn btn-ghost btn-sm">+ Exame avulso</button>
            <button onClick={openAddPanel} className="px-4 py-2 rounded-xl text-sm font-bold text-white transition-all"
              style={{ background: 'var(--dark-accent)' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}>
              + Adicionar painel
            </button>
          </div>
        </div>

        {/* Panel filter tabs */}
        {allPanels.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-6">
            {['todos', ...allPanels].map(p => (
              <button key={p} onClick={() => setFilterPanel(p)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: filterPanel === p ? 'var(--dark-accent)' : 'var(--dark-surface)',
                  color: filterPanel === p ? '#fff' : 'rgba(255,255,255,0.45)',
                  border: `1px solid ${filterPanel === p ? 'transparent' : 'var(--dark-border)'}`,
                }}>
                {p === 'todos' ? 'Todos os painéis' : p}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="text-center py-16" style={{ color: 'rgba(255,255,255,0.2)' }}>Carregando...</div>
        ) : results.length === 0 ? (
          <div className="text-center py-20 rounded-2xl" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
            <div className="text-4xl mb-3">🔬</div>
            <div className="text-white font-semibold mb-1">Nenhum exame registrado</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Adicione um painel completo ou exames individuais para acompanhar a evolução clínica
            </div>
            <button onClick={openAddPanel} className="px-5 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: 'var(--dark-accent)' }}>
              + Adicionar primeiro exame
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedDates.map(date => {
              const dayResults = grouped[date]
              const isExpanded = expandedDates.has(date)
              const byPanel: Record<string, LabResult[]> = {}
              for (const r of dayResults) {
                const key = r.panel_name ?? 'Outros'
                if (!byPanel[key]) byPanel[key] = []
                byPanel[key].push(r)
              }
              const abnormal = dayResults.filter(r => r.status && r.status !== 'normal').length

              return (
                <div key={date} className="rounded-2xl overflow-hidden" style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                  {/* Date header */}
                  <button className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-white/[0.02] transition-colors"
                    onClick={() => toggleDate(date)}>
                    <div className="flex-1">
                      <div className="font-bold text-white text-sm">
                        {new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </div>
                      <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                        {dayResults.length} exame{dayResults.length !== 1 ? 's' : ''} · {Object.keys(byPanel).join(', ')}
                      </div>
                    </div>
                    {abnormal > 0 && (
                      <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(248,113,113,0.12)', color: '#F87171' }}>
                        {abnormal} alterado{abnormal !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs transition-transform" style={{ color: 'rgba(255,255,255,0.3)', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                  </button>

                  {isExpanded && (
                    <div className="border-t" style={{ borderColor: 'var(--dark-border)' }}>
                      {Object.entries(byPanel).map(([panel, panelResults]) => (
                        <div key={panel} className="border-b last:border-b-0" style={{ borderColor: 'var(--dark-border)' }}>
                          <div className="px-6 py-2" style={{ background: 'rgba(255,255,255,0.02)' }}>
                            <span className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>{panel}</span>
                          </div>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ borderBottom: '1px solid var(--dark-border)' }}>
                                <th className="text-left px-6 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', width: '35%' }}>Exame</th>
                                <th className="text-right px-4 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', width: '15%' }}>Resultado</th>
                                <th className="text-center px-4 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', width: '12%' }}>Status</th>
                                <th className="text-center px-4 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', width: '18%' }}>Tendência</th>
                                <th className="text-left px-4 py-2 text-[10px] font-bold tracking-widest uppercase" style={{ color: 'rgba(255,255,255,0.2)', width: '15%' }}>Referência</th>
                                <th className="px-4 py-2" style={{ width: '5%' }}></th>
                              </tr>
                            </thead>
                            <tbody>
                              {panelResults.map(r => {
                                const sc = r.status ? STATUS_CONFIG[r.status] : null
                                const trend = trendByExam[r.exam_name]
                                return (
                                  <tr key={r.id} className="border-t hover:bg-white/[0.015] transition-colors group" style={{ borderColor: 'var(--dark-border)' }}>
                                    <td className="px-6 py-3">
                                      <div className="text-white font-medium text-sm">{r.exam_name}</div>
                                      {r.notes && <div className="text-xs mt-0.5 italic" style={{ color: 'rgba(255,255,255,0.3)' }}>{r.notes}</div>}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      {r.value != null ? (
                                        <span className="font-bold text-base" style={{ color: sc ? sc.color : '#fff' }}>
                                          {r.value}
                                          {r.unit && <span className="text-xs font-normal ml-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{r.unit}</span>}
                                        </span>
                                      ) : (
                                        <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      {sc && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded-lg" style={{ background: sc.bg, color: sc.color }}>
                                          {sc.icon} {sc.label}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                      <div className="flex justify-center">
                                        <TrendSparkline values={trend ?? []} />
                                      </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                      {(r.reference_min != null || r.reference_max != null) && (
                                        <span>
                                          {r.reference_min != null && r.reference_max != null
                                            ? `${r.reference_min} – ${r.reference_max}`
                                            : r.reference_min != null
                                            ? `≥ ${r.reference_min}`
                                            : `≤ ${r.reference_max}`}
                                          {r.unit && <span className="ml-1">{r.unit}</span>}
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEdit(r)} className="text-xs px-2 py-1 rounded-lg hover:bg-white/10 transition-colors" style={{ color: 'rgba(255,255,255,0.4)' }}>✏</button>
                                        <button onClick={() => deleteResult(r.id)} className="text-xs px-2 py-1 rounded-lg hover:bg-red-500/10 transition-colors" style={{ color: 'rgba(248,113,113,0.5)' }}>✕</button>
                                      </div>
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.82)' }}
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="relative rounded-2xl w-full shadow-2xl flex flex-col"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.35)', maxWidth: modalMode === 'panel' ? '700px' : '480px', maxHeight: '88vh' }}>
            <div className="absolute top-0 left-8 right-8 h-px rounded-full"
              style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            {/* Modal header */}
            <div className="px-7 pt-7 pb-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--dark-border)' }}>
              <div>
                <div className="font-black text-white text-base tracking-tight">
                  {editingResult ? '✏️ Editar exame' : modalMode === 'panel' ? '🔬 Adicionar painel' : '🧪 Exame avulso'}
                </div>
                <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  {patientName}
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="text-lg" style={{ color: 'rgba(255,255,255,0.3)' }}>✕</button>
            </div>

            <div className="overflow-y-auto flex-1 px-7 py-5">
              {modalMode === 'panel' && !editingResult ? (
                <>
                  {/* Date */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Data da coleta</label>
                    <input type="date" value={panelDate} onChange={e => setPanelDate(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                  </div>

                  {/* Template selection */}
                  {!selectedTemplate ? (
                    <div>
                      <div className="text-[10px] font-bold tracking-[2px] uppercase mb-3" style={{ color: 'rgba(255,255,255,0.3)' }}>Selecione o painel</div>
                      <div className="grid grid-cols-2 gap-2">
                        {EXAM_TEMPLATES.map(t => (
                          <button key={t.panel} onClick={() => selectTemplate(t)}
                            className="text-left p-3 rounded-xl transition-all hover:border-blue-500/40"
                            style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border)' }}>
                            <div className="text-sm font-semibold text-white">{t.panel}</div>
                            <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>{t.exams.length} exames</div>
                          </button>
                        ))}
                        <button onClick={() => {
                          setModalMode('single')
                          setSelectedTemplate(null)
                        }} className="text-left p-3 rounded-xl transition-all hover:border-blue-500/40"
                          style={{ background: 'var(--dark-surface)', border: '1px dashed var(--dark-border)' }}>
                          <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>+ Personalizado</div>
                          <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>exame único</div>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <div className="text-[10px] font-bold tracking-[2px] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Painel selecionado</div>
                          <div className="text-white font-bold text-sm">{selectedTemplate.panel}</div>
                        </div>
                        <button onClick={() => setSelectedTemplate(null)} className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Trocar painel</button>
                      </div>
                      <div className="text-xs mb-2" style={{ color: 'rgba(255,255,255,0.3)' }}>Preencha os resultados disponíveis (deixe em branco para pular)</div>
                      <div className="space-y-2">
                        {panelRows.map((row, i) => (
                          <div key={i} className="grid grid-cols-12 gap-2 items-center p-3 rounded-xl" style={{ background: 'var(--dark-surface)' }}>
                            <div className="col-span-5 text-xs font-medium text-white">{row.exam_name}</div>
                            <div className="col-span-3">
                              <input
                                type="number"
                                step="any"
                                placeholder="valor"
                                value={row.value}
                                onChange={e => {
                                  const rows2 = [...panelRows]
                                  rows2[i] = { ...rows2[i], value: e.target.value }
                                  setPanelRows(rows2)
                                }}
                                className="w-full px-2 py-1.5 rounded-lg text-white text-xs outline-none text-right"
                                style={{ background: 'var(--dark-bg)', border: '1px solid var(--dark-border2)' }}
                              />
                            </div>
                            <div className="col-span-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.3)' }}>{row.unit}</div>
                            <div className="col-span-2 text-xs text-center" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {row.reference_min && row.reference_max ? `${row.reference_min}–${row.reference_max}`
                                : row.reference_min ? `≥${row.reference_min}`
                                : row.reference_max ? `≤${row.reference_max}`
                                : ''}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Single / edit form */
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Data</label>
                      <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Painel (opcional)</label>
                      <input type="text" placeholder="ex: Lipidograma" value={form.panel_name} onChange={e => setForm(f => ({ ...f, panel_name: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Nome do exame *</label>
                    <input type="text" placeholder="ex: Glicose em jejum" value={form.exam_name} onChange={e => setForm(f => ({ ...f, exam_name: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Resultado</label>
                      <input type="number" step="any" placeholder="0.0" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Unidade</label>
                      <input type="text" placeholder="mg/dL" value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Ref. mínima</label>
                      <input type="number" step="any" placeholder="0.0" value={form.reference_min} onChange={e => setForm(f => ({ ...f, reference_min: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Ref. máxima</label>
                      <input type="number" step="any" placeholder="0.0" value={form.reference_max} onChange={e => setForm(f => ({ ...f, reference_max: e.target.value }))}
                        className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm"
                        style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[2px] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Observações</label>
                    <textarea rows={2} placeholder="Notas clínicas..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-xl text-white outline-none text-sm resize-none"
                      style={{ background: 'var(--dark-surface)', border: '1px solid var(--dark-border2)' }} />
                  </div>
                </div>
              )}

              {error && <div className="mt-4 text-sm text-red-400">{error}</div>}
            </div>

            {/* Footer */}
            <div className="px-7 py-4 border-t flex justify-between gap-3" style={{ borderColor: 'var(--dark-border)' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-sm">Cancelar</button>
              <button
                onClick={modalMode === 'panel' && !editingResult ? savePanel : saveSingle}
                disabled={saving}
                className="px-5 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition-all"
                style={{ background: 'var(--dark-accent)' }}>
                {saving ? 'Salvando...' : editingResult ? 'Salvar alterações' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
