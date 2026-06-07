'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  taken_at: string
  category: string
  weight_kg: number | null
  storage_path: string
}

const CATEGORIES = [
  { id: 'frente',    label: 'Frente',    icon: '👤' },
  { id: 'costas',    label: 'Costas',    icon: '🔄' },
  { id: 'lateral_d', label: 'Lat. D',   icon: '▶' },
  { id: 'lateral_e', label: 'Lat. E',   icon: '◀' },
  { id: 'livre',     label: 'Livre',    icon: '📷' },
]

function fmtDate(d: string) {
  return new Date(d + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: '2-digit' })
}

export default function AlunoCompararPage() {
  const supabase = createClient()
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [leftId, setLeftId] = useState<string | null>(null)
  const [rightId, setRightId] = useState<string | null>(null)
  const [leftUrl, setLeftUrl] = useState<string | null>(null)
  const [rightUrl, setRightUrl] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('frente')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: patient } = await supabase
        .from('patients')
        .select('id')
        .eq('auth_user_id', user.id)
        .single()
      if (!patient) return

      const { data } = await supabase
        .from('progress_photos')
        .select('id, taken_at, category, weight_kg, storage_path')
        .eq('patient_id', patient.id)
        .order('taken_at', { ascending: true })

      setPhotos(data ?? [])
      setLoading(false)

      // Auto-select oldest and newest in "frente" category
      const catPhotos = (data ?? []).filter(p => p.category === 'frente')
      if (catPhotos.length >= 2) {
        setLeftId(catPhotos[0].id)
        setRightId(catPhotos[catPhotos.length - 1].id)
      } else if (data && data.length >= 2) {
        setLeftId(data[0].id)
        setRightId(data[data.length - 1].id)
      }
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Load signed URLs
  useEffect(() => {
    if (!leftId) { setLeftUrl(null); return }
    const photo = photos.find(p => p.id === leftId)
    if (!photo) return
    setLeftUrl(null)
    supabase.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600)
      .then(({ data }) => setLeftUrl(data?.signedUrl ?? null))
  }, [leftId, photos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rightId) { setRightUrl(null); return }
    const photo = photos.find(p => p.id === rightId)
    if (!photo) return
    setRightUrl(null)
    supabase.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600)
      .then(({ data }) => setRightUrl(data?.signedUrl ?? null))
  }, [rightId, photos]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleCategoryChange(cat: string) {
    setFilterCategory(cat)
    const catPhotos = photos.filter(p => p.category === cat)
    if (catPhotos.length >= 2) {
      setLeftId(catPhotos[0].id)
      setRightId(catPhotos[catPhotos.length - 1].id)
    } else if (catPhotos.length === 1) {
      setLeftId(catPhotos[0].id)
      setRightId(null)
    } else {
      setLeftId(null)
      setRightId(null)
    }
  }

  const filteredPhotos = photos.filter(p => filterCategory === 'all' || p.category === filterCategory)
  const leftPhoto = photos.find(p => p.id === leftId)
  const rightPhoto = photos.find(p => p.id === rightId)

  const weightDelta = leftPhoto?.weight_kg != null && rightPhoto?.weight_kg != null
    ? Math.round((rightPhoto.weight_kg - leftPhoto.weight_kg) * 10) / 10
    : null

  const daysBetween = leftPhoto && rightPhoto
    ? Math.floor((new Date(rightPhoto.taken_at + 'T12:00').getTime() - new Date(leftPhoto.taken_at + 'T12:00').getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="min-h-screen pb-12" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div
        className="sticky top-0 z-40 px-5 h-14 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/aluno/fotos" className="text-2xl" style={{ color: 'rgba(255,255,255,0.5)' }}>←</Link>
        <div>
          <h1 className="font-black text-white text-base leading-none">📸 Comparar Fotos</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Antes e depois</p>
        </div>
      </div>

      <div className="px-5 py-5 max-w-lg mx-auto">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.3)' }}>
            <div className="text-3xl mb-2 animate-pulse">📸</div>
            <div>Carregando fotos...</div>
          </div>
        ) : photos.length < 2 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📸</div>
            <p className="font-bold text-white mb-2">Fotos insuficientes</p>
            <p className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.4)' }}>
              Você precisa de pelo menos 2 fotos para comparar sua evolução.
            </p>
            <Link href="/aluno/fotos" className="btn btn-primary">← Ver minhas fotos</Link>
          </div>
        ) : (
          <>
            {/* Category chips */}
            <div className="flex gap-2 flex-wrap mb-4">
              {CATEGORIES.map(cat => {
                const count = photos.filter(p => p.category === cat.id).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    disabled={count < 1}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: filterCategory === cat.id ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                      color: filterCategory === cat.id ? '#fff' : count < 1 ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.55)',
                      border: `1px solid ${filterCategory === cat.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                      opacity: count < 1 ? 0.4 : 1,
                    }}
                  >
                    {cat.icon} {cat.label}
                    {count > 0 && <span className="ml-1" style={{ color: 'rgba(255,255,255,0.4)' }}>({count})</span>}
                  </button>
                )
              })}
            </div>

            {/* Stats strip */}
            {leftPhoto && rightPhoto && (
              <div className="rounded-2xl p-4 mb-4 flex items-center gap-4 flex-wrap"
                style={{ background: 'rgba(37,99,235,0.08)', border: '1px solid rgba(37,99,235,0.2)' }}>
                <div className="text-center">
                  <div className="text-lg font-black text-white">{daysBetween}d</div>
                  <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Período</div>
                </div>
                {weightDelta !== null && (
                  <div className="text-center">
                    <div className={`text-lg font-black ${weightDelta < 0 ? 'text-emerald-400' : weightDelta > 0 ? 'text-red-400' : 'text-gray-400'}`}>
                      {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                    </div>
                    <div className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
                      {weightDelta < 0 ? 'Perda de peso 🎉' : weightDelta > 0 ? 'Ganho de peso' : 'Peso estável'}
                    </div>
                  </div>
                )}
                <div className="ml-auto text-[11px]" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  {fmtDate(leftPhoto.taken_at)} → {fmtDate(rightPhoto.taken_at)}
                </div>
              </div>
            )}

            {/* Side-by-side photos */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {/* Left (ANTES) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(37,99,235,0.2)', color: '#93C5FD' }}>ANTES</span>
                  {leftPhoto?.weight_kg && (
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>⚖️ {leftPhoto.weight_kg}kg</span>
                  )}
                </div>
                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {leftUrl ? (
                    <img src={leftUrl} alt="Antes" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {leftId
                        ? <div className="w-6 h-6 border-2 border-white/20 border-t-blue-400 rounded-full animate-spin" />
                        : <><span className="text-2xl">📸</span><span className="text-xs">Selecione</span></>
                      }
                    </div>
                  )}
                  {leftPhoto && (
                    <div className="absolute bottom-0 left-0 right-0 p-2"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                      <p className="text-white text-[10px] font-semibold text-center">
                        {fmtDate(leftPhoto.taken_at)}
                      </p>
                    </div>
                  )}
                </div>
                {/* Picker */}
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {filteredPhotos.map(p => (
                    <button key={p.id} onClick={() => setLeftId(p.id)}
                      className="text-[9px] px-2 py-0.5 rounded-lg transition-all"
                      style={{
                        background: leftId === p.id ? 'rgba(37,99,235,0.4)' : 'rgba(255,255,255,0.05)',
                        color: leftId === p.id ? '#93C5FD' : 'rgba(255,255,255,0.35)',
                        border: `1px solid ${leftId === p.id ? 'rgba(37,99,235,0.5)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      {fmtDate(p.taken_at)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right (DEPOIS) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                    style={{ background: 'rgba(34,197,94,0.2)', color: '#4ade80' }}>DEPOIS</span>
                  {rightPhoto?.weight_kg && (
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>⚖️ {rightPhoto.weight_kg}kg</span>
                  )}
                </div>
                <div className="aspect-[3/4] rounded-2xl overflow-hidden relative"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {rightUrl ? (
                    <img src={rightUrl} alt="Depois" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2"
                      style={{ color: 'rgba(255,255,255,0.2)' }}>
                      {rightId
                        ? <div className="w-6 h-6 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
                        : <><span className="text-2xl">📸</span><span className="text-xs">Selecione</span></>
                      }
                    </div>
                  )}
                  {rightPhoto && (
                    <div className="absolute bottom-0 left-0 right-0 p-2"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }}>
                      <p className="text-white text-[10px] font-semibold text-center">
                        {fmtDate(rightPhoto.taken_at)}
                      </p>
                    </div>
                  )}
                </div>
                {/* Picker */}
                <div className="mt-1.5 flex gap-1 flex-wrap">
                  {filteredPhotos.map(p => (
                    <button key={p.id} onClick={() => setRightId(p.id)}
                      className="text-[9px] px-2 py-0.5 rounded-lg transition-all"
                      style={{
                        background: rightId === p.id ? 'rgba(34,197,94,0.3)' : 'rgba(255,255,255,0.05)',
                        color: rightId === p.id ? '#4ade80' : 'rgba(255,255,255,0.35)',
                        border: `1px solid ${rightId === p.id ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      }}>
                      {fmtDate(p.taken_at)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Motivational message if weight loss */}
            {weightDelta !== null && weightDelta < -1 && (
              <div className="rounded-2xl p-4 text-center mb-4"
                style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <div className="text-2xl mb-1">🎉</div>
                <div className="text-sm font-bold" style={{ color: '#4ade80' }}>
                  Incrível! {Math.abs(weightDelta)} kg em {daysBetween} dias!
                </div>
                <div className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Continue assim — cada foto conta sua história!
                </div>
              </div>
            )}

            <Link href="/aluno/fotos"
              className="w-full py-3 rounded-xl text-sm font-semibold text-center block transition-all"
              style={{ background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.4)', border: '1px solid rgba(255,255,255,0.07)' }}>
              ← Voltar para galeria
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
