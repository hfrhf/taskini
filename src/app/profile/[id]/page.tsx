import { getCurrentUserProfile, getUserProfileDetails, getUserPublications, getUserAvailability } from '../../actions'
import { redirect } from 'next/navigation'
import ProfileClient from './profile-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

interface ProfilePageProps {
  params: Promise<{ id: string }>
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const currentUser = await getCurrentUserProfile()

  if (!currentUser) {
    redirect('/login')
  }

  const { id } = await params

  let targetUserProfileDetails: any = null
  let userPublications: any[] = []
  let userAvailability: any[] = []
  let errorMsg: string | null = null

  try {
    targetUserProfileDetails = await getUserProfileDetails(id)
    userPublications = await getUserPublications(id)
    userAvailability = await getUserAvailability(id)
  } catch (err: any) {
    console.error('Error fetching profile details:', err)
    errorMsg = err.message || 'فشل جلب بيانات الملف الشخصي'
  }

  // إذا لم يتم العثور على المستخدم
  if (!targetUserProfileDetails && !errorMsg) {
    redirect('/')
  }

  return (
    <ProfileClient 
      currentUser={currentUser}
      targetProfile={targetUserProfileDetails?.profile}
      stats={targetUserProfileDetails?.stats}
      initialPublications={userPublications}
      availabilitySlots={userAvailability}
      errorMsg={errorMsg}
    />
  )
}
