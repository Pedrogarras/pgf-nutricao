'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
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
  { id: 'frente',    label: 'Frente',     icon: '👤' },
  { id: 'costas',    label: 'Costas',     icon: '🔄' },
  { id: 'lateral_d', label: 'Lateral D',  icon: '▶️' },
  { id: 'lateral_e', label: 'Lateral E',  icon: '◀️' },
  { id: 'livre',     label: 'Livre',      icon: '📷' },
]

export default function CompararPage() {
  const params = useParams()
  const patientId = params.id as string
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
      const { data } = await supabase
        .from('progress_photos')
        .select('id, taken_at, category, weight_kg, storage_path')
        .eq('patient_id', patientId)
        .order('taken_at', { ascending: true })
      setPhotos(data ?? [])
      setLoading(false)

      // Auto-select first and last of same category
      const catPhotos = (data ?? []).filter(p => p.category === 'frente')
      if (catPhotos.length >= 2) {
        setLeftId(catPhotos[0].id)
        setRightId(catPhotos[catPhotos.length - 1].id)
      }
    }
    load()
  }, [patientId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!leftId) { setLeftUrl(null); return }
    const photo = photos.find(p => p.id === leftId)
    if (!photo) return
    supabase.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600)
      .then(({ data }) => setLeftUrl(data?.signedUrl ?? null))
  }, [leftId, photos]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!rightId) { setRightUrl(null); return }
    const photo = photos.find(p => p.id === rightId)
    if (!photo) return
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

  const filteredPhotos = photos.filter(p => p.category === filterCategory)
  const leftPhoto = photos.find(p => p.id === leftId)
  const rightPhoto = photos.find(p => p.id === rightId)

  // Weight delta
  const weightDelta = leftPhoto?.weight_kg && rightPhoto?.weight_kg
    ? Math.round((rightPhoto.weight_kg - leftPhoto.weight_kg) * 10) / 10
    : null

  // Days between
  const daysBetween = leftPhoto && rightPhoto
    ? Math.floor((new Date(rightPhoto.taken_at).getTime() - new Date(leftPhoto.taken_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}/fotos`} className="text-pgf-400 hover:text-pgf-300 text-sm">
            ← Fotos
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">Comparar Fotos</h1>
        </div>
      </div>

      <div className="p-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Carregando...</div>
        ) : photos.length < 2 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-3">📸</div>
            <p className="text-gray-500">Você precisa de pelo menos 2 fotos para comparar.</p>
          </div>
        ) : (
          <>
            {/* Category filter */}
            <div className="flex gap-2 mb-6 flex-wrap">
              {CATEGORIES.map(cat => {
                const count = photos.filter(p => p.category === cat.id).length
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCategoryChange(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCategory === cat.id ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'} ${count < 1 ? 'opacity-40 cursor-not-allowed' : ''}`}
                    disabled={count < 1}
                  >
                    {cat.icon} {cat.label} ({count})
                  </button>
                )
              })}
            </div>

            {/* Stats bar */}
            {leftPhoto && rightPhoto && (
              <div className="card p-4 mb-6 flex items-center gap-6 flex-wrap">
                <div className="text-sm text-gray-600">
                  📅 Período: <strong>{daysBetween} dias</strong> de diferença
                </div>
                {weightDelta !== null && (
                  <div className={`text-sm font-semibold ${weightDelta < 0 ? 'text-emerald-600' : weightDelta > 0 ? 'text-red-500' : 'text-gray-500'}`}>
                    ⚖️ Variação de peso: {weightDelta > 0 ? '+' : ''}{weightDelta} kg
                  </div>
                )}
                <div className="text-xs text-gray-400 ml-auto">
                  {leftPhoto.taken_at} → {rightPhoto.taken_at}
                </div>
              </div>
            )}

            {/* Side-by-side comparison */}
            <div className="grid grid-cols-2 gap-6 mb-6">
              {/* Left (ANTES) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="badge badge-blue text-xs">ANTES</span>
                  {leftPhoto?.weight_kg && <span className="text-xs text-gray-500">⚖️ {leftPhoto.weight_kg} kg</span>}
                </div>
                <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
                  {leftUrl ? (
                    <img src={leftUrl} alt="Antes" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {leftId ? <div className="w-6 h-6 border-2 border-gray-300 border-t-pgf-500 rounded-full animate-spin" /> : 'Selecione'}
                    </div>
                  )}
                  {leftPhoto && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-white text-xs font-semibold">
                        {new Date(leftPhoto.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                {/* Photo picker for left */}
                <div className="mt-2 flex gap-1 flex-wrap">
                  {filteredPhotos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setLeftId(p.id)}
                      className={`text-[10px] px-2 py-1 rounded transition-all ${leftId === p.id ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {new Date(p.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right (DEPOIS) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="badge badge-green text-xs">DEPOIS</span>
                  {rightPhoto?.weight_kg && <span className="text-xs text-gray-500">⚖️ {rightPhoto.weight_kg} kg</span>}
                </div>
                <div className="aspect-[3/4] bg-gray-100 rounded-xl overflow-hidden relative">
                  {rightUrl ? (
                    <img src={rightUrl} alt="Depois" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      {rightId ? <div className="w-6 h-6 border-2 border-gray-300 border-t-pgf-500 rounded-full animate-spin" /> : 'Selecione'}
                    </div>
                  )}
                  {rightPhoto && (
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                      <p className="text-white text-xs font-semibold">
                        {new Date(rightPhoto.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </div>
                {/* Photo picker for right */}
                <div className="mt-2 flex gap-1 flex-wrap">
                  {filteredPhotos.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setRightId(p.id)}
                      className={`text-[10px] px-2 py-1 rounded transition-all ${rightId === p.id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                    >
                      {new Date(p.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Print button */}
            <div className="flex justify-center">
              <button
                onClick={() => window.print()}
                className="btn btn-outline"
              >
                🖨️ Imprimir comparativo
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
