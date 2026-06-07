import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type Supplement = {
  id: string
  name: string
  brand: string | null
  dosage: string
  timing: string
  with_food: boolean
  instructions: string | null
  start_date: string | null
  end_date: string | null
}

const TIMING_LABELS: Record<string, { label: string; emoji: string }> = {
  ao_acordar:    { label: 'Ao acordar',       emoji: '🌅' },
  cafe_manha:    { label: 'Café da manhã',     emoji: '☀️' },
  pre_treino:    { label: 'Pré-treino',        emoji: '⚡' },
  pos_treino:    { label: 'Pós-treino',        emoji: '💪' },
  almoco:        { label: 'Almoço',            emoji: '🍽️' },
  lanche:        { label: 'Lanche',            emoji: '🍎' },
  jantar:        { label: 'Jantar',            emoji: '🌙' },
  antes_dormir:  { label: 'Antes de dormir',   emoji: '😴' },
  qualquer_hora: { label: 'Qualquer horário',  emoji: '🕐' },
}

const TIMING_ORDER = ['ao_acordar', 'cafe_manha', 'pre_treino', 'almoco', 'lanche', 'pos_treino', 'jantar', 'antes_dormir', 'qualquer_hora']

export default async function SuplementosImprimirPage({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { id } = await params

  const [{ data: patient }, { data: supplements }, { data: profile }] = await Promise.all([
    supabase.from('patients').select('full_name, date_of_birth, weight_kg, goal').eq('id', id).eq('professional_id', user.id).single(),
    supabase.from('supplement_prescriptions').select('*').eq('patient_id', id).eq('professional_id', user.id).eq('active', true).order('timing'),
    supabase.from('profiles').select('full_name, crn, specialty').eq('id', user.id).single(),
  ])

  if (!patient) redirect('/pro/pacientes')

  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
  const age = patient.date_of_birth
    ? Math.floor((Date.now() - new Date(patient.date_of_birth + 'T12:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
    : null

  // Group by timing in correct order
  const byTiming: Record<string, Supplement[]> = {}
  for (const s of supplements ?? []) {
    if (!byTiming[s.timing]) byTiming[s.timing] = []
    byTiming[s.timing].push(s)
  }

  const orderedTimings = TIMING_ORDER.filter(t => byTiming[t]?.length > 0)

  return (
    <div className="min-h-screen bg-white" id="print-root">
      <style dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap');
        * { font-family: 'Inter', sans-serif; box-sizing: border-box; }
        @media print {
          .no-print { display: none !important; }
          @page { margin: 15mm 15mm 20mm 15mm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        body { background: white; color: #111; }
      ` }} />

      {/* Browser UI */}
      <div className="no-print flex items-center justify-between px-6 py-3 bg-gray-50 border-b border-gray-200">
        <a href={`/pro/pacientes/${id}/suplementos`} className="text-sm text-gray-500 hover:text-gray-800">
          ← Voltar para suplementos
        </a>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
          dangerouslySetInnerHTML={{ __html: '🖨️ Imprimir / Salvar PDF' }}
        />
      </div>

      {/* Document */}
      <div className="max-w-[680px] mx-auto p-10">
        {/* Header */}
        <div className="flex items-start justify-between pb-5 mb-5" style={{ borderBottom: '2px solid #1e40af' }}>
          <div>
            <div className="font-black text-3xl tracking-tighter" style={{ color: '#1e40af', letterSpacing: '-0.04em' }}>PGF</div>
            <div className="text-sm font-bold mt-0.5" style={{ color: '#374151' }}>
              {profile?.full_name ?? 'Pedro Garrastazu Frey'}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Nutricionista{profile?.crn ? ` · CRN ${profile.crn}` : ''}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm font-bold text-gray-700">Prescrição de Suplementação</div>
            <div className="text-xs text-gray-400 mt-0.5">{today}</div>
          </div>
        </div>

        {/* Patient info */}
        <div className="rounded-xl p-4 mb-6" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-0.5">Paciente</div>
              <div className="font-bold text-gray-900">{patient.full_name}</div>
            </div>
            {age && (
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-0.5">Idade</div>
                <div className="font-semibold text-gray-700">{age} anos</div>
              </div>
            )}
            {patient.goal && (
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-0.5">Objetivo</div>
                <div className="font-semibold text-gray-700">{patient.goal}</div>
              </div>
            )}
            {patient.weight_kg && (
              <div>
                <div className="text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-0.5">Peso</div>
                <div className="font-semibold text-gray-700">{patient.weight_kg} kg</div>
              </div>
            )}
          </div>
        </div>

        {/* Supplements by timing */}
        {supplements && supplements.length === 0 ? (
          <div className="text-center py-10 text-gray-400">Nenhum suplemento ativo prescrito</div>
        ) : (
          <div className="space-y-5">
            {orderedTimings.map(timing => {
              const timingInfo = TIMING_LABELS[timing] ?? { label: timing, emoji: '💊' }
              const sups = byTiming[timing]
              return (
                <div key={timing}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{timingInfo.emoji}</span>
                    <div className="font-bold text-sm" style={{ color: '#1e40af' }}>{timingInfo.label}</div>
                    <div className="flex-1 h-px" style={{ background: '#e2e8f0' }} />
                  </div>
                  <div className="space-y-2 pl-6">
                    {sups.map(s => (
                      <div key={s.id} className="flex items-start gap-3 py-2.5 px-4 rounded-xl"
                        style={{ border: '1px solid #e2e8f0', background: 'white' }}>
                        <div className="flex-1">
                          <div className="font-bold text-sm text-gray-900">
                            {s.name}
                            {s.brand && <span className="font-normal text-gray-400 text-xs ml-2">({s.brand})</span>}
                          </div>
                          <div className="flex items-center flex-wrap gap-3 mt-1">
                            <div className="flex items-center gap-1">
                              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Dosagem:</span>
                              <span className="text-sm font-bold" style={{ color: '#1e40af' }}>{s.dosage}</span>
                            </div>
                            {s.with_food && (
                              <span className="text-xs text-gray-500 flex items-center gap-1">
                                🍽️ Tomar com refeição
                              </span>
                            )}
                          </div>
                          {s.instructions && (
                            <div className="text-xs text-gray-500 mt-1.5 italic">📝 {s.instructions}</div>
                          )}
                          {(s.start_date || s.end_date) && (
                            <div className="text-[11px] text-gray-400 mt-1">
                              {s.start_date && `Início: ${new Date(s.start_date + 'T12:00').toLocaleDateString('pt-BR')}`}
                              {s.start_date && s.end_date && ' · '}
                              {s.end_date && `Até: ${new Date(s.end_date + 'T12:00').toLocaleDateString('pt-BR')}`}
                            </div>
                          )}
                        </div>
                        <div className="text-xl flex-shrink-0">💊</div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Summary schedule */}
        {supplements && supplements.length > 0 && (
          <div className="mt-8 p-4 rounded-xl" style={{ background: '#f0f7ff', border: '1px solid #bfdbfe' }}>
            <div className="text-sm font-bold mb-3" style={{ color: '#1e40af' }}>⏰ Cronograma de Suplementação</div>
            <div className="space-y-1.5">
              {orderedTimings.map(timing => {
                const timingInfo = TIMING_LABELS[timing] ?? { label: timing, emoji: '💊' }
                const sups = byTiming[timing]
                return (
                  <div key={timing} className="flex items-center gap-2 text-sm">
                    <span>{timingInfo.emoji}</span>
                    <span className="text-gray-600 w-36 text-xs">{timingInfo.label}</span>
                    <span className="text-gray-800 font-medium">{sups.map(s => `${s.name} (${s.dosage})`).join(' + ')}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Important notes */}
        <div className="mt-6 p-4 rounded-xl" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
          <div className="text-xs font-bold mb-2" style={{ color: '#b45309' }}>⚠️ Orientações Importantes</div>
          <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
            <li>Mantenha os suplementos armazenados conforme indicação do fabricante</li>
            <li>Em caso de reações adversas, interrompa o uso e entre em contato imediatamente</li>
            <li>Não substitua por marcas diferentes sem consultar seu nutricionista</li>
            <li>Esta prescrição é válida para o período indicado ou até revisão profissional</li>
          </ul>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-5 flex items-end justify-between" style={{ borderTop: '1px solid #e2e8f0' }}>
          <div className="text-xs text-gray-400">
            <div>Prescrição válida a partir de {today}</div>
            <div className="mt-1">pedro-garrastazu-emagrecimento.vercel.app</div>
          </div>
          <div className="text-right">
            <div className="w-40 border-b border-gray-400 mb-1" />
            <div className="text-xs font-bold text-gray-700">{profile?.full_name ?? 'Pedro Garrastazu Frey'}</div>
            <div className="text-xs text-gray-500">Nutricionista{profile?.crn ? ` · CRN ${profile.crn}` : ''}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
