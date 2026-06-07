'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Photo {
  id: string
  taken_at: string
  category: string
  weight_kg: number | null
  notes: string | null
  storage_path: string
  created_at: string
}

interface PatientInfo {
  id: string
  full_name: string
  weight_kg: number | null
  professional_id: string
}

const CATEGORIES = [
  { id: 'frente',    label: 'Frente',    icon: '👤' },
  { id: 'costas',    label: 'Costas',    icon: '🔄' },
  { id: 'lateral_d', label: 'Lateral D', icon: '▶️' },
  { id: 'lateral_e', label: 'Lateral E', icon: '◀️' },
  { id: 'livre',     label: 'Livre',     icon: '📷' },
]

function catLabel(id: string) {
  return CATEGORIES.find(c => c.id === id) ?? { label: id, icon: '📷' }
}

function PhotoCard({ photo, onOpen }: { photo: Photo; onOpen: (p: Photo) => void }) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    const sb = createClient()
    sb.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl)
    })
  }, [photo.storage_path])

  const cat = catLabel(photo.category)

  return (
    <button
      onClick={() => onOpen(photo)}
      className="relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95"
      style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      {url ? (
        <img src={url} alt={cat.label} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-3xl opacity-30">📷</div>
        </div>
      )}
      {/* Badge */}
      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
        style={{ background: 'rgba(6,6,10,0.8)', color: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(4px)' }}>
        {cat.icon} {cat.label}
      </div>
      {photo.weight_kg && (
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold"
          style={{ background: 'rgba(6,6,10,0.75)', color: '#93C5FD', backdropFilter: 'blur(4px)' }}>
          {photo.weight_kg}kg
        </div>
      )}
    </button>
  )
}

export default function AlunoFotosPage() {
  const [patient, setPatient] = useState<PatientInfo | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCategory, setFilterCategory] = useState('all')
  const [lightbox, setLightbox] = useState<{ photo: Photo; url: string } | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload form
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0])
  const [uploadCategory, setUploadCategory] = useState('frente')
  const [uploadWeight, setUploadWeight] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  useEffect(() => {
    async function load() {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: pat } = await sb
        .from('patients')
        .select('id, full_name, weight_kg, professional_id')
        .eq('auth_user_id', user.id)
        .single()

      if (!pat) { setLoading(false); return }
      setPatient(pat)
      setUploadWeight(pat.weight_kg ? String(pat.weight_kg) : '')

      const { data } = await sb
        .from('progress_photos')
        .select('id, taken_at, category, weight_kg, notes, storage_path, created_at')
        .eq('patient_id', pat.id)
        .order('taken_at', { ascending: false })
        .order('created_at', { ascending: false })

      setPhotos(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  async function openLightbox(photo: Photo) {
    const sb = createClient()
    const { data } = await sb.storage.from('progress-photos').createSignedUrl(photo.storage_path, 3600)
    if (data?.signedUrl) setLightbox({ photo, url: data.signedUrl })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setUploadFile(f)
    const reader = new FileReader()
    reader.onload = ev => setUploadPreview(ev.target?.result as string)
    reader.readAsDataURL(f)
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    if (!uploadFile || !patient) { showToast('Selecione uma imagem.'); return }
    setUploading(true)

    try {
      const sb = createClient()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { showToast('Não autenticado.'); return }

      const ext = uploadFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = `patients/${user.id}/${uploadDate}_${uploadCategory}_${Date.now()}.${ext}`

      const { error: storageErr } = await sb.storage
        .from('progress-photos')
        .upload(path, uploadFile, { contentType: uploadFile.type })

      if (storageErr) { showToast('Erro no upload: ' + storageErr.message); setUploading(false); return }

      const { data: photo, error: dbErr } = await sb
        .from('progress_photos')
        .insert({
          patient_id: patient.id,
          professional_id: patient.professional_id,
          storage_path: path,
          taken_at: uploadDate,
          category: uploadCategory,
          weight_kg: uploadWeight ? Number(uploadWeight) : null,
          notes: null,
        })
        .select()
        .single()

      if (dbErr || !photo) { showToast('Erro ao salvar. Tente novamente.'); setUploading(false); return }

      setPhotos(prev => [photo, ...prev])
      setUploadOpen(false)
      setUploadFile(null)
      setUploadPreview(null)
      showToast('✅ Foto enviada! Seu nutricionista foi notificado.')
    } finally {
      setUploading(false)
    }
  }

  const filtered = filterCategory === 'all' ? photos : photos.filter(p => p.category === filterCategory)

  // Group by date
  const byDate: Record<string, Photo[]> = {}
  for (const p of filtered) {
    if (!byDate[p.taken_at]) byDate[p.taken_at] = []
    byDate[p.taken_at].push(p)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  // Lightbox navigation
  function lightboxNav(dir: 1 | -1) {
    if (!lightbox) return
    const allFiltered = filtered
    const idx = allFiltered.findIndex(p => p.id === lightbox.photo.id)
    const next = allFiltered[idx + dir]
    if (next) openLightbox(next)
  }

  return (
    <div className="min-h-screen pb-10" style={{ background: 'var(--dark-bg)' }}>
      {/* Header */}
      <div className="sticky top-0 z-40 px-5 py-4 flex items-center gap-3"
        style={{ background: 'rgba(6,6,10,0.95)', borderBottom: '1px solid rgba(37,99,235,0.15)', backdropFilter: 'blur(12px)' }}>
        <Link href="/aluno" className="text-2xl">←</Link>
        <div className="flex-1">
          <h1 className="text-base font-black text-white leading-none">Fotos de Progresso</h1>
          <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
            {photos.length > 0 ? `${photos.length} foto${photos.length !== 1 ? 's' : ''} registradas` : 'Registre sua evolução'}
          </p>
        </div>
        {photos.length >= 2 && (
          <Link
            href="/aluno/fotos/comparar"
            className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
            style={{ background: 'rgba(37,99,235,0.15)', color: '#93C5FD', border: '1px solid rgba(37,99,235,0.3)' }}
          >
            📊 Comparar
          </Link>
        )}
        <button
          onClick={() => setUploadOpen(true)}
          className="px-3 py-2 rounded-xl text-xs font-bold transition-all"
          style={{ background: 'var(--dark-accent)', color: '#fff' }}
        >
          + Enviar foto
        </button>
      </div>

      <div className="px-4 pt-4 max-w-lg mx-auto">
        {loading ? (
          <div className="text-center py-20" style={{ color: 'rgba(255,255,255,0.2)' }}>
            <div className="text-4xl mb-3">📷</div>
            <div>Carregando...</div>
          </div>
        ) : photos.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📸</div>
            <div className="text-white font-bold text-base mb-2">Nenhuma foto ainda</div>
            <div className="text-sm mb-6" style={{ color: 'rgba(255,255,255,0.35)' }}>
              Envie fotos de progresso para acompanhar sua evolução visual
            </div>
            <button
              onClick={() => setUploadOpen(true)}
              className="px-5 py-3 rounded-xl text-sm font-bold"
              style={{ background: 'var(--dark-accent)', color: '#fff' }}
            >
              📷 Enviar primeira foto
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-xl font-black text-white">{photos.length}</div>
                <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>fotos</div>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-xl font-black text-white">{sortedDates.length}</div>
                <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>sessões</div>
              </div>
              <div className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <div className="text-sm font-black text-white leading-tight">
                  {new Date(photos[0].taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                </div>
                <div className="text-[9px] uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>última</div>
              </div>
            </div>

            {/* Category filter */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
              {[{ id: 'all', label: 'Todas', icon: '🖼️' }, ...CATEGORIES].map(c => {
                const count = c.id === 'all' ? photos.length : photos.filter(p => p.category === c.id).length
                if (c.id !== 'all' && count === 0) return null
                return (
                  <button key={c.id} onClick={() => setFilterCategory(c.id)}
                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5"
                    style={{
                      background: filterCategory === c.id ? 'var(--dark-accent)' : 'rgba(255,255,255,0.06)',
                      color: filterCategory === c.id ? '#fff' : 'rgba(255,255,255,0.5)',
                      border: `1px solid ${filterCategory === c.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                    }}>
                    {c.icon} {c.label}
                    <span className="text-[9px] opacity-60">({count})</span>
                  </button>
                )
              })}
            </div>

            {/* Photos by date */}
            <div className="space-y-5">
              {sortedDates.map(date => {
                const datePhotos = byDate[date]
                const withWeight = datePhotos.find(p => p.weight_kg)
                return (
                  <div key={date}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-bold" style={{ color: 'rgba(255,255,255,0.5)' }}>
                        {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'long', year: 'numeric' })}
                      </span>
                      {withWeight && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: 'rgba(147,197,253,0.1)', color: '#93C5FD' }}>
                          {withWeight.weight_kg}kg
                        </span>
                      )}
                    </div>
                    <div className={`grid gap-2 ${datePhotos.length === 1 ? 'grid-cols-1 max-w-[200px]' : datePhotos.length === 2 ? 'grid-cols-2' : datePhotos.length === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                      {datePhotos.map(p => (
                        <PhotoCard key={p.id} photo={p} onOpen={openLightbox} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={e => e.target === e.currentTarget && setUploadOpen(false)}>
          <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            style={{ background: 'var(--dark-card)', border: '1px solid rgba(37,99,235,0.3)' }}>
            {/* Top accent */}
            <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent, #2563EB, transparent)' }} />

            <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <h2 className="font-black text-white">📷 Enviar Foto</h2>
                <button onClick={() => setUploadOpen(false)} className="text-xl" style={{ color: 'rgba(255,255,255,0.3)' }}>×</button>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>
                Fotos visíveis para você e seu nutricionista
              </p>
            </div>

            <form onSubmit={handleUpload} className="p-5 space-y-4">
              {/* File picker */}
              <div>
                <input ref={fileRef} type="file" accept="image/*" capture="user" onChange={handleFileChange} className="hidden" />
                {uploadPreview ? (
                  <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: '3/4', maxHeight: 220 }}>
                    <img src={uploadPreview} alt="preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setUploadFile(null); setUploadPreview(null) }}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>×</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => fileRef.current?.click()}
                    className="w-full rounded-xl py-8 flex flex-col items-center gap-2 transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '2px dashed rgba(37,99,235,0.3)' }}>
                    <span className="text-3xl">📷</span>
                    <span className="text-sm font-semibold" style={{ color: '#93C5FD' }}>Selecionar ou tirar foto</span>
                    <span className="text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>JPG, PNG, HEIC</span>
                  </button>
                )}
              </div>

              {/* Category chips */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest mb-2 block" style={{ color: 'rgba(255,255,255,0.35)' }}>
                  Posição
                </label>
                <div className="flex gap-2 flex-wrap">
                  {CATEGORIES.map(c => (
                    <button key={c.id} type="button" onClick={() => setUploadCategory(c.id)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                      style={{
                        background: uploadCategory === c.id ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                        color: uploadCategory === c.id ? '#fff' : 'rgba(255,255,255,0.45)',
                        border: `1px solid ${uploadCategory === c.id ? 'transparent' : 'rgba(255,255,255,0.08)'}`,
                      }}>
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date + Weight row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>Data</label>
                  <input type="date" value={uploadDate} onChange={e => setUploadDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: 'rgba(255,255,255,0.35)' }}>Peso (kg)</label>
                  <input type="number" step="0.1" value={uploadWeight} onChange={e => setUploadWeight(e.target.value)}
                    placeholder="opcional"
                    className="w-full px-3 py-2 rounded-xl text-sm text-white outline-none placeholder-white/20"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }} />
                </div>
              </div>

              <button type="submit" disabled={!uploadFile || uploading}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={{
                  background: uploadFile ? 'var(--dark-accent)' : 'rgba(255,255,255,0.05)',
                  color: uploadFile ? '#fff' : 'rgba(255,255,255,0.3)',
                  opacity: uploading ? 0.7 : 1,
                }}>
                {uploading ? '📤 Enviando...' : '📤 Enviar Foto'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.95)' }}
          onClick={e => e.target === e.currentTarget && setLightbox(null)}>
          <button onClick={() => setLightbox(null)}
            className="absolute top-5 right-5 text-2xl"
            style={{ color: 'rgba(255,255,255,0.6)' }}>×</button>

          {/* Prev/Next */}
          {filtered.findIndex(p => p.id === lightbox.photo.id) > 0 && (
            <button onClick={() => lightboxNav(-1)}
              className="absolute left-3 text-2xl w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>‹</button>
          )}
          {filtered.findIndex(p => p.id === lightbox.photo.id) < filtered.length - 1 && (
            <button onClick={() => lightboxNav(1)}
              className="absolute right-3 text-2xl w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>›</button>
          )}

          <div className="relative max-w-sm w-full mx-8">
            <img src={lightbox.url} alt="" className="w-full rounded-2xl object-contain" style={{ maxHeight: '75vh' }} />
            <div className="mt-3 text-center">
              <div className="text-sm font-semibold text-white">
                {catLabel(lightbox.photo.category).icon} {catLabel(lightbox.photo.category).label}
                {lightbox.photo.weight_kg && <span className="ml-2 text-[#93C5FD]">· {lightbox.photo.weight_kg}kg</span>}
              </div>
              <div className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {new Date(lightbox.photo.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white z-50 shadow-xl"
          style={{ background: 'rgba(37,99,235,0.95)', backdropFilter: 'blur(12px)' }}>
          {toast}
        </div>
      )}
    </div>
  )
}
