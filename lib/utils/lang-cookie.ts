import { cookies } from 'next/headers'

export async function getLangFromCookies(): Promise<'en' | 'bg'> {
  const cookieStore = await cookies()
  return cookieStore.get('tevd_lang')?.value === 'bg' ? 'bg' : 'en'
}
