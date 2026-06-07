'use client'
import { useState, useRef, useEffect } from 'react'
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
  url?: string
}

interface Patient {
  id: string
  full_name: string
  weight_kg: number | null
}

interface Props {
  patient: Patient
  initialPhotos: Photo[]
  patientId: string
}

const CATEGORIES = [
  { id: 'frente',     label: 'Frente',      icon: '👤' },
  { id: 'costas',     label: 'Costas',      icon: '🔄' },
  { id: 'lateral_d',  label: 'Lateral D',   icon: '▶️' },
  { id: 'lateral_e',  label: 'Lateral E',   icon: '◀️' },
  { id: 'livre',      label: 'Livre',       icon: '📷' },
]

export default function FotosClient({ patient, initialPhotos, patientId }: Props) {
  const supabase = createClient()
  const [photos, setPhotos] = useState<Photo[]>(initialPhotos)
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({})
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState<{ photo: Photo; url: string } | null>(null)
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [toast, setToast] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Upload form state
  const [uploadDate, setUploadDate] = useState(new Date().toISOString().split('T')[0])
  const [uploadCategory, setUploadCategory] = useState('frente')
  const [uploadWeight, setUploadWeight] = useState(patient.weight_kg ? String(patient.weight_kg) : '')
  const [uploadNotes, setUploadNotes] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadPreview, setUploadPreview] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  async function getSignedUrl(storagePath: string): Promise<string> {
    if (signedUrls[storagePath]) return signedUrls[storagePath]
    const { data } = await supabase.storage
      .from('progress-photos')
      .createSignedUrl(storagePath, 3600)
    const url = data?.signedUrl ?? ''
    if (url) setSignedUrls(prev => ({ ...prev, [storagePath]: url }))
    return url
  }

  async function openLightbox(photo: Photo) {
    const url = await getSignedUrl(photo.storage_path)
    setLightbox({ photo, url })
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
    if (!uploadFile) { showToast('Selecione uma imagem.'); return }
    setUploading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { showToast('Não autenticado.'); return }

      // Upload to storage
      const ext = uploadFile.name.split('.').pop() ?? 'jpg'
      const path = `${user.id}/${patientId}/${uploadDate}_${uploadCategory}_${Date.now()}.${ext}`

      const { error: storageErr } = await supabase.storage
        .from('progress-photos')
        .upload(path, uploadFile, { contentType: uploadFile.type })

      if (storageErr) { showToast('Erro no upload: ' + storageErr.message); return }

      // Save metadata
      const { data: photo, error: dbErr } = await supabase
        .from('progress_photos')
        .insert({
          patient_id: patientId,
          professional_id: user.id,
          storage_path: path,
          taken_at: uploadDate,
          category: uploadCategory,
          weight_kg: uploadWeight ? Number(uploadWeight) : null,
          notes: uploadNotes || null,
        })
        .select()
        .single()

      if (dbErr || !photo) { showToast('Erro ao salvar metadados.'); return }

      setPhotos(prev => [photo, ...prev])
      setUploadOpen(false)
      setUploadFile(null)
      setUploadPreview(null)
      setUploadNotes('')
      showToast('Foto enviada com sucesso! 📸')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(photo: Photo) {
    if (!confirm(`Excluir esta foto de ${new Date(photo.taken_at + 'T12:00').toLocaleDateString('pt-BR')}?`)) return
    setDeletingId(photo.id)

    await supabase.storage.from('progress-photos').remove([photo.storage_path])
    await supabase.from('progress_photos').delete().eq('id', photo.id)

    setPhotos(prev => prev.filter(p => p.id !== photo.id))
    setSignedUrls(prev => { const copy = { ...prev }; delete copy[photo.storage_path]; return copy })
    if (lightbox?.photo.id === photo.id) setLightbox(null)
    setDeletingId(null)
    showToast('Foto excluída.')
  }

  const filtered = filterCategory === 'all' ? photos : photos.filter(p => p.category === filterCategory)

  // Group by date for timeline view
  const byDate: Record<string, Photo[]> = {}
  for (const p of filtered) {
    if (!byDate[p.taken_at]) byDate[p.taken_at] = []
    byDate[p.taken_at].push(p)
  }
  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a))

  return (
    <div>
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center justify-between px-8 h-14"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <div className="flex items-center gap-3">
          <Link href={`/pro/pacientes/${patientId}`} className="text-pgf-400 hover:text-pgf-300 text-sm">
            ← {patient.full_name}
          </Link>
          <span style={{ color: 'rgba(255,255,255,0.2)' }}>/</span>
          <h1 className="text-base font-bold text-white">📸 Fotos de Progresso</h1>
        </div>
        <button onClick={() => setUploadOpen(true)} className="btn btn-primary btn-sm">
          + Nova foto
        </button>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Total de fotos</div>
            <div className="text-2xl font-black text-pgf-600 my-1">{photos.length}</div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Última atualização</div>
            <div className="text-base font-bold text-gray-900 my-1">
              {photos.length > 0
                ? new Date(photos[0].taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                : '—'
              }
            </div>
          </div>
          <div className="card p-4">
            <div className="text-xs text-gray-400 font-medium uppercase tracking-wide">Sessões registradas</div>
            <div className="text-2xl font-black text-emerald-600 my-1">{Object.keys(byDate).length}</div>
          </div>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCategory === 'all' ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todas ({photos.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = photos.filter(p => p.category === cat.id).length
            if (count === 0) return null
            return (
              <button
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterCategory === cat.id ? 'bg-pgf-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {cat.icon} {cat.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Photo timeline */}
        {sortedDates.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-5xl mb-4">📸</div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">Nenhuma foto registrada</h3>
            <p className="text-sm text-gray-500 mb-6">
              Registre fotos de progresso para acompanhar a evolução visual do paciente.
            </p>
            <button onClick={() => setUploadOpen(true)} className="btn btn-primary mx-auto">
              + Enviar primeira foto
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedDates.map(date => (
              <div key={date}>
                {/* Date header */}
                <div className="flex items-center gap-3 mb-3">
                  <div className="text-sm font-bold text-gray-900">
                    {new Date(date + 'T12:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                  </div>
                  {byDate[date][0].weight_kg && (
                    <span className="badge badge-blue text-[10px]">⚖️ {byDate[date][0].weight_kg} kg</span>
                  )}
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-400">{byDate[date].length} foto{byDate[date].length !== 1 ? 's' : ''}</span>
                </div>

                {/* Photos grid for this date */}
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {byDate[date].map(photo => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      getUrl={getSignedUrl}
                      onOpen={openLightbox}
                      onDelete={handleDelete}
                      deleting={deletingId === photo.id}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload modal */}
      {uploadOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setUploadOpen(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-100">
              <h3 className="font-bold text-lg">Enviar Foto de Progresso</h3>
            </div>
            <form onSubmit={handleUpload} className="p-6 space-y-4">
              {/* File picker */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${uploadPreview ? 'border-pgf-200' : 'border-gray-200 hover:border-pgf-300'}`}
              >
                {uploadPreview ? (
                  <img src={uploadPreview} alt="Preview" className="max-h-48 mx-auto rounded-lg object-contain" />
                ) : (
                  <>
                    <div className="text-3xl mb-2">📷</div>
                    <p className="text-sm text-gray-500">Clique para selecionar uma foto</p>
                    <p className="text-xs text-gray-400 mt-1">JPG, PNG, WEBP · máx 10 MB</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/heic"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data</label>
                  <input
                    type="date"
                    value={uploadDate}
                    onChange={e => setUploadDate(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">Posição</label>
                  <select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="form-select">
                    {CATEGORIES.map(c => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="form-label">Peso nesta data (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={uploadWeight}
                  onChange={e => setUploadWeight(e.target.value)}
                  className="form-input"
                  placeholder="Ex: 82.5"
                />
              </div>

              <div>
                <label className="form-label">Observações</label>
                <textarea
                  value={uploadNotes}
                  onChange={e => setUploadNotes(e.target.value)}
                  className="form-input"
                  rows={2}
                  placeholder="Notas opcionais sobre este registro..."
                />
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setUploadOpen(false)} className="btn btn-ghost flex-1">Cancelar</button>
                <button type="submit" disabled={uploading || !uploadFile} className="btn btn-primary flex-1">
                  {uploading ? 'Enviando...' : '📤 Enviar foto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-2xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              className="absolute -top-10 right-0 text-white/70 hover:text-white text-2xl"
            >
              ✕
            </button>
            <img
              src={lightbox.url}
              alt="Foto de progresso"
              className="w-full rounded-xl shadow-2xl object-contain max-h-[75vh]"
            />
            <div className="mt-3 flex items-center justify-between text-white/80 text-sm">
              <div>
                <span className="font-semibold">
                  {new Date(lightbox.photo.taken_at + 'T12:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </span>
                <span className="ml-3 text-white/50">
                  {CATEGORIES.find(c => c.id === lightbox.photo.category)?.icon}{' '}
                  {CATEGORIES.find(c => c.id === lightbox.photo.category)?.label}
                </span>
                {lightbox.photo.weight_kg && (
                  <span className="ml-3">⚖️ {lightbox.photo.weight_kg} kg</span>
                )}
              </div>
              <button
                onClick={() => handleDelete(lightbox.photo)}
                disabled={deletingId === lightbox.photo.id}
                className="text-red-400 hover:text-red-300 text-xs px-3 py-1 rounded border border-red-400/30 hover:border-red-300/30 transition-all"
              >
                {deletingId === lightbox.photo.id ? 'Excluindo...' : '🗑 Excluir'}
              </button>
            </div>
            {lightbox.photo.notes && (
              <p className="mt-2 text-white/50 text-sm italic">{lightbox.photo.notes}</p>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 bg-gray-900 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium z-50">
          {toast}
        </div>
      )}
    </div>
  )
}

// ---- PhotoCard: lazy-loads signed URL on mount ----
function PhotoCard({
  photo, getUrl, onOpen, onDelete, deleting
}: {
  photo: Photo
  getUrl: (path: string) => Promise<string>
  onOpen: (photo: Photo) => void
  onDelete: (photo: Photo) => void
  deleting: boolean
}) {
  const [url, setUrl] = useState<string | null>(null)
  const [loadError, setLoadError] = useState(false)
  const cat = CATEGORIES.find(c => c.id === photo.category)

  useEffect(() => {
    getUrl(photo.storage_path).then(u => setUrl(u)).catch(() => setLoadError(true))
  }, [photo.storage_path]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="group relative rounded-xl overflow-hidden bg-gray-100 aspect-square cursor-pointer shadow-sm hover:shadow-md transition-shadow">
      {url ? (
        <img
          src={url}
          alt={cat?.label ?? photo.category}
          className="w-full h-full object-cover"
          onClick={() => onOpen({ ...photo, url })}
          onError={() => setLoadError(true)}
        />
      ) : loadError ? (
        <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
          ⚠️ erro
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-pgf-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Overlay on hover */}
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors">
        <div className="absolute bottom-0 left-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-between">
          <span className="text-white text-xs font-semibold">{cat?.icon} {cat?.label}</span>
          <button
            onClick={e => { e.stopPropagation(); onDelete(photo) }}
            disabled={deleting}
            className="text-red-300 hover:text-red-200 text-xs bg-black/50 rounded px-1"
          >
            {deleting ? '...' : '🗑'}
          </button>
        </div>
      </div>
    </div>
  )
}
