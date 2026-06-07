export default function AgendaPage() {
  return (
    <div>
      <div
        className="sticky top-0 z-40 px-8 h-14 flex items-center"
        style={{ background: 'var(--dark-surface)', borderBottom: '1px solid var(--dark-border)' }}
      >
        <h1 className="text-base font-bold text-white">Agenda</h1>
      </div>
      <div className="p-8 text-center py-20">
        <div className="font-semibold text-gray-600 mb-1">Agenda — em breve</div>
        <div className="text-sm text-gray-400">Funcionalidade de agendamento será adicionada na próxima versão.</div>
      </div>
    </div>
  )
}
