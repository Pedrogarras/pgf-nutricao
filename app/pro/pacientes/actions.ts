'use server'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createPatient(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Não autenticado.' }

  const fullName = (formData.get('full_name') as string).trim()
  const dob = formData.get('date_of_birth') as string

  if (!fullName) return { error: 'Nome é obrigatório.' }
  if (!dob) return { error: 'Data de nascimento é obrigatória (usada como senha do aluno).' }

  const { error } = await supabase.from('patients').insert({
    professional_id: user.id,
    full_name: fullName,
    date_of_birth: dob,
    email: (formData.get('email') as string) || null,
    phone: (formData.get('phone') as string) || null,
    gender: (formData.get('gender') as string) || null,
    weight_kg: formData.get('weight_kg') ? Number(formData.get('weight_kg')) : null,
    height_cm: formData.get('height_cm') ? Number(formData.get('height_cm')) : null,
    goal: (formData.get('goal') as string) || null,
    notes: (formData.get('notes') as string) || null,
    active: true,
  })

  if (error) return { error: 'Erro ao cadastrar: ' + error.message }
  revalidatePath('/pro/pacientes')
}
