'use client'
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
      style={{ background: 'var(--dark-card)', border: '1px solid var(--dark-border2)', color: '#9BAAE6' }}
    >
      Baixar Plano em PDF
    </button>
  )
}
