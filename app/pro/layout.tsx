import Sidebar from '@/components/Sidebar'

const PROFILE = {
  id: '95af5b8a-78bb-452b-988a-f8d91be26409',
  role: 'professional',
  full_name: 'Pedro Garrastazu Frey',
  created_at: '',
}

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar profile={PROFILE as any} />
      <main className="flex-1 ml-60 min-h-screen flex flex-col">
        {children}
      </main>
    </div>
  )
}
