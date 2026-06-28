import { getCurrentUserProfile, getProfiles, getMilestones, getIdeas, getGroups } from '../actions'
import { redirect } from 'next/navigation'
import IdeasClient from './ideas-client'

export const revalidate = 0 // تعطيل التخزين المؤقت لضمان حداثة البيانات عند كل تحميل

export default async function IdeasPage() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/login')
  }

  const teamProfiles = await getProfiles()
  const milestones = await getMilestones()
  const initialIdeas = await getIdeas()
  
  const todayStr = new Date().toISOString().split('T')[0]
  const groups = await getGroups(todayStr)

  return (
    <IdeasClient 
      currentProfile={profile} 
      teamProfiles={teamProfiles} 
      initialMilestones={milestones}
      initialIdeas={initialIdeas}
      initialGroups={groups}
    />
  )
}
