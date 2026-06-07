import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const DEFAULT_TEMPLATES = [
  {
    name: 'Boas-vindas ao plano', category: 'dieta',
    content: 'Olá {{nome}}! 🌟\n\nSeu novo plano alimentar está disponível no aplicativo!\n\nAcesse: pedro-garrastazu-emagrecimento.vercel.app\n\nQualquer dúvida, estou à disposição. Vamos juntos! 💪',
    variables: ['{{nome}}'],
  },
  {
    name: 'Solicitação de check-in', category: 'check_in',
    content: 'Oi {{nome}}! 👋\n\nJá faz um tempo que não recebo seu check-in. Consegue pesar hoje e me enviar o resultado?\n\nLembre de registrar também no app! 📊',
    variables: ['{{nome}}'],
  },
  {
    name: 'Parabéns pela evolução', category: 'motivacao',
    content: 'Parabéns {{nome}}! 🎉🏆\n\nVocê perdeu {{peso_perdido}} kg em {{semanas}} semanas de acompanhamento!\n\nEsse resultado é fruto do seu esforço e dedicação. Continue assim! 💚',
    variables: ['{{nome}}', '{{peso_perdido}}', '{{semanas}}'],
  },
  {
    name: 'Lembrete de consulta', category: 'retorno',
    content: 'Oi {{nome}}! 📅\n\nLembrando que sua consulta está agendada para {{data}} às {{hora}}.\n\nAté lá! 😊',
    variables: ['{{nome}}', '{{data}}', '{{hora}}'],
  },
  {
    name: 'Resultado da avaliação', category: 'check_in',
    content: 'Oi {{nome}}!\n\nResultado da sua avaliação de hoje:\n⚖️ Peso: {{peso}} kg\n📉 Variação: {{variacao}} kg\n🏃 Continue focado no plano!\n\nProxima avaliação: {{proxima}}',
    variables: ['{{nome}}', '{{peso}}', '{{variacao}}', '{{proxima}}'],
  },
  {
    name: 'Motivação semanal', category: 'motivacao',
    content: 'Bom dia {{nome}}! ☀️\n\nComeçando mais uma semana de superação!\n\nLembre-se: cada refeição feita corretamente é um passo rumo ao seu objetivo de {{objetivo}}.\n\nYou got this! 💪🥗',
    variables: ['{{nome}}', '{{objetivo}}'],
  },
  {
    name: 'Orientação pré-treino', category: 'treino',
    content: 'Oi {{nome}}!\n\nNão esqueça de fazer sua refeição pré-treino {{tempo}} antes da academia:\n{{refeicao_pre}}\n\nBom treino! 🏋️',
    variables: ['{{nome}}', '{{tempo}}', '{{refeicao_pre}}'],
  },
  {
    name: 'Plano renovado', category: 'dieta',
    content: 'Oi {{nome}}! 🔄\n\nSeu plano alimentar foi atualizado no app com as novas orientações da nossa última consulta.\n\nAs principais mudanças foram:\n{{mudancas}}\n\nQualquer dúvida é só falar! 😊',
    variables: ['{{nome}}', '{{mudancas}}'],
  },
]

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const { data } = await supabase
    .from('message_templates')
    .select('*')
    .eq('professional_id', user.id)
    .eq('active', true)
    .order('category')
    .order('name')

  // If no templates exist yet, seed defaults
  if (!data || data.length === 0) {
    const { data: seeded } = await supabase
      .from('message_templates')
      .insert(DEFAULT_TEMPLATES.map(t => ({ ...t, professional_id: user.id })))
      .select()
    return NextResponse.json({ templates: seeded ?? [] })
  }

  return NextResponse.json({ templates: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const body = await request.json()
  const { data, error } = await supabase
    .from('message_templates')
    .insert({ ...body, professional_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ template: data })
}
