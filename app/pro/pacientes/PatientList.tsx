'use client'
import { useState } from 'react'
import Link from 'next/link'

type Patient = {
  id: string; full_name: string; email: string | null; phone: string | null
  goal: string | null; weight_kg: number | null; height_cm: number | null
  date_of_birth: string | null; gender: string | null; auth_user_id: string | null
}

export default function PatientList({ patients }: { patients: Patient[] }) {
  const [search, setSearch] = useState('')

  const filtered = patients.filter(p =>
    p.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (p.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.goal ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <>
      <div className="mb-5">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Filtrar por nome, e-mail ou objetivo..."
          className="form-input max-w-sm"
        />
      </div>

      <div className="card">
        <table className="w-full">
          <thead>
            <tr>
              {['Paciente', 'Objetivo', 'Dados', 'Acesso', 'Ações'].map(h => (
                <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide bg-gray-50 border-b">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const age = p.date_of_birth
                ? Math.floor((Date.now() - new Date(p.date_of_birth + 'T12:00:00').getTime()) / (1000 * 60 * 60 * 24 * 365.25))
                : null
              return (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-pgf-50/30 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-pgf-100 flex items-center justify-center text-pgf-600 font-bold text-sm flex-shrink-0">
                        {p.full_name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                      </div>
                      <div>
                        <div className="font-semibold text-sm text-gray-900">{p.full_name}</div>
                        <div className="text-xs text-gray-400">{p.email ?? p.phone ?? ''}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`badge ${
                      p.goal?.toLowerCase().includes('massa') ? 'badge-blue' :
                      p.goal?.toLowerCase().includes('emagr') ? 'badge-orange' : 'badge-gray'
                    }`}>{p.goal ?? '—'}</span>
                  </td>
                  <td className="px-5 py-3.5 text-sm text-gray-500">
                    <div>{p.weight_kg ? `${p.weight_kg} kg` : '—'}{p.height_cm ? ` · ${p.height_cm} cm` : ''}</div>
                    {(() => {
                      const bmi = p.weight_kg && p.height_cm
                        ? p.weight_kg / ((p.height_cm / 100) ** 2)
                        : null
                      const bmiLabel = bmi
                        ? bmi < 18.5 ? 'Baixo peso'
                        : bmi < 25 ? 'Eutrófico'
                        : bmi < 30 ? 'Sobrepeso'
                        : bmi < 35 ? 'Ob. I'
                        : bmi < 40 ? 'Ob. II' : 'Ob. III'
                        : null
                      const bmiColor = bmi
                        ? bmi < 18.5 ? 'text-blue-500'
                        : bmi < 25 ? 'text-green-600'
                        : bmi < 30 ? 'text-amber-500'
                        : 'text-red-500'
                        : ''
                      return (
                        <div className="text-xs text-gray-400 mt-0.5">
                          {age ? `${age} anos` : ''}{age && (bmi || p.gender) ? ' · ' : ''}
                          {p.gender === 'F' ? 'F' : p.gender === 'M' ? 'M' : ''}
                          {bmi && (age || p.gender) ? ' · ' : ''}
                          {bmi && <span className={`font-medium ${bmiColor}`}>IMC {bmi.toFixed(1)} ({bmiLabel})</span>}
                        </div>
                      )
                    })()}
                  </td>
                  <td className="px-5 py-3.5">
                    {p.auth_user_id ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-400" style={{ boxShadow: '0 0 4px rgba(74,222,128,0.6)' }} />
                        <span className="text-xs text-green-600 font-medium">Ativo</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-gray-300" />
                        <span className="text-xs text-gray-400">Sem acesso</span>
                      </div>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <Link href={`/pro/pacientes/${p.id}`} className="btn btn-primary btn-sm">Abrir</Link>
                      <Link href={`/pro/pacientes/${p.id}/treino`} className="btn btn-outline btn-sm">Treino</Link>
                    </div>
                  </td>
                </tr>
              )
            })}
            {!filtered.length && (
              <tr><td colSpan={5} className="px-5 py-10 text-center text-gray-400 text-sm">
                {search ? `Nenhum paciente encontrado para "${search}".` : (
                  <>
                    <div className="font-semibold text-gray-600 mb-1">Nenhum paciente cadastrado</div>
                    <div className="text-sm">Clique em &quot;Novo Paciente&quot; para começar.</div>
                  </>
                )}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  )
}
