import { getCurrentUserProfile, getPublications } from '../actions'
import { redirect } from 'next/navigation'
import FeedClient from './feed-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

export default async function FeedPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  let initialPublications: any[] = []
  let dbError: string | null = null

  try {
    initialPublications = await getPublications()
  } catch (err: any) {
    console.error('Error fetching publications:', err)
    dbError = err.message || 'فشل الاتصال بقاعدة البيانات'
  }

  return (
    <FeedClient 
      currentProfile={profile} 
      initialPublications={initialPublications}
      dbError={dbError}
    />
  )
}
