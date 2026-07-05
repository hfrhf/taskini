'use server'

import { createClient } from '@/utils/supabase/server'
import { createAdminClient } from '@/utils/supabase/admin'
import { revalidatePath } from 'next/cache'
import webpush from 'web-push'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      'https://taskini-murex.vercel.app',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  } catch (err) {
    console.error('Error setting VAPID details:', err)
  }
}

// جلب معلومات المستخدم الحالي وملف تعريفه
export async function getCurrentUserProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

// جلب قائمة المستخدمين (للإسناد ولتبويب فريق العمل)
export async function getProfiles() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('name', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// جلب مجموعات العمل لتاريخ محدد مع إحصائيات المهام
export async function getGroups(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('task_groups')
    .select(`
      *,
      creator:profiles!task_groups_created_by_fkey(name, email, avatar_url),
      assignee:profiles!task_groups_assigned_to_fkey(name, email, avatar_url)
    `)
    .or(`date.eq.${dateString},is_permanent.eq.true`)

  const { data: groups, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  // إذا لم يكن مسؤولاً، يرى فقط المجموعات التي أنشأها أو أسندت إليه
  const filteredGroups = profile.role === 'admin'
    ? (groups || [])
    : (groups || []).filter(g => g.created_by === profile.id || g.assigned_to === profile.id)

  // جلب إحصائيات المهام لكل مجموعة
  const groupsWithStats = await Promise.all(
    filteredGroups.map(async (group) => {
      let tasksQuery = supabase
        .from('tasks')
        .select('id, status, assigned_to')
        .eq('group_id', group.id)

      // إذا كانت المجموعة دائمة، نقوم بحساب الإحصائيات لليوم المحدد فقط
      if (group.is_permanent) {
        tasksQuery = tasksQuery.eq('due_date', dateString)
      }

      // للمستخدم العادي: نعد فقط المهام الخاصة به في هذه المجموعة
      if (profile.role !== 'admin') {
        tasksQuery = tasksQuery.eq('assigned_to', profile.id)
      }

      const { data: tasks } = await tasksQuery
      const total = tasks?.length || 0
      const completed = tasks ? tasks.filter(t => t.status === 'completed').length : 0
      const pending = total - completed

      return {
        ...group,
        totalTasks: total,
        completedTasks: completed,
        pendingTasks: pending
      }
    })
  )

  return groupsWithStats
}

// إنشاء مجموعة جديدة
export async function createGroup(name: string, color: string, date: string, assignedTo?: string, isPermanent: boolean = false) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const newGroup = {
    name,
    color,
    date,
    created_by: profile.id,
    assigned_to: profile.role === 'admin' ? (assignedTo || profile.id) : profile.id,
    is_permanent: isPermanent
  }

  const { data, error } = await supabase
    .from('task_groups')
    .insert(newGroup)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return data
}

// حذف مجموعة عمل
export async function deleteGroup(groupId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('task_groups')
    .delete()
    .eq('id', groupId)

  // إذا لم يكن مشرفاً، لا يمكنه حذف المجموعات إلا التي أنشأها بنفسه
  if (profile.role !== 'admin') {
    query = query.eq('created_by', profile.id)
  }

  const { error } = await query
  if (error) throw new Error(error.message)

  revalidatePath('/')
  return { success: true }
}

// تعديل مجموعة عمل
export async function updateGroup(
  groupId: string,
  name: string,
  color: string,
  isPermanent: boolean,
  assignedTo?: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التأكد من الصلاحية (منشئ المجموعة أو مسؤول)
  const { data: group } = await supabase
    .from('task_groups')
    .select('created_by')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error('المجموعة غير موجودة')
  if (profile.role !== 'admin' && group.created_by !== profile.id) {
    throw new Error('ليست لديك الصلاحية لتعديل هذه المجموعة')
  }

  const updateData: any = {
    name,
    color,
    is_permanent: isPermanent
  }

  if (profile.role === 'admin') {
    updateData.assigned_to = assignedTo || null
  }

  const { data, error } = await supabase
    .from('task_groups')
    .update(updateData)
    .eq('id', groupId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return data
}

// جلب المهام التابعة لمجموعة عمل مع الفرز بالتاريخ للمجموعات الدائمة
export async function getTasks(groupId: string, statusFilter: string = 'all', dateString?: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب تفاصيل المجموعة لمعرفة ما إذا كانت دائمة
  const { data: group } = await supabase
    .from('task_groups')
    .select('is_permanent')
    .eq('id', groupId)
    .single()

  let query = supabase
    .from('tasks')
    .select(`
      *,
      assignee:profiles!tasks_assigned_to_fkey(name, email, avatar_url),
      milestone:project_milestones(id, title)
    `)
    .eq('group_id', groupId)

  if (group?.is_permanent && dateString) {
    query = query.eq('due_date', dateString)
  }

  // الفرز حسب حالة المهمة
  if (statusFilter === 'pending') {
    query = query.neq('status', 'completed')
  } else if (statusFilter === 'completed') {
    query = query.eq('status', 'completed')
  }

  // إذا لم يكن مسؤولاً، يرى فقط مهامه المسندة إليه
  if (profile.role !== 'admin') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data: tasks, error } = await query.order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return tasks || []
}

// جلب المهام المعلقة المسندة للمستخدم الحالي (للإشعارات)
export async function getMyPendingTasks() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) return []

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      due_date,
      group:task_groups(name)
    `)
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('created_at', { ascending: false })

  if (error) return []
  return (data || []).map((t: any) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    group_name: t.group?.name || 'عام'
  }))
}

// إضافة مهمة جديدة وإسنادها
export async function addTask(
  title: string,
  description: string,
  groupId: string,
  assignedTo: string,
  dueDate: string,
  color: string,
  milestoneId?: string | null,
  workMinutes?: number
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const newTask = {
    group_id: groupId,
    title,
    description,
    assigned_to: profile.role === 'admin' ? assignedTo : profile.id,
    due_date: dueDate,
    color,
    status: 'not_started',
    milestone_id: milestoneId || null,
    work_minutes: workMinutes || 0
  }

  const { data, error } = await supabase
    .from('tasks')
    .insert(newTask)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  return data
}

// تعديل حالة مهمة
export async function updateTaskStatus(taskId: string, newStatus: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التأكد من الصلاحية (أن المهمة مسندة للمستخدم أو أنه مسؤول)
  const { data: task } = await supabase
    .from('tasks')
    .select('assigned_to')
    .eq('id', taskId)
    .single()

  if (!task) throw new Error('المهمة غير موجودة')
  if (profile.role !== 'admin' && task.assigned_to !== profile.id) {
    throw new Error('ليست لديك الصلاحية لتعديل حالة هذه المهمة')
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const updateData = {
    status: newStatus,
    completed_date: newStatus === 'completed' ? todayStr : null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  return data
}

// تعديل نصوص وتفاصيل مهمة
export async function updateTaskDetails(
  taskId: string,
  title: string,
  description: string,
  milestoneId?: string | null,
  assignedTo?: string | null,
  dueDate?: string | null,
  color?: string | null,
  workMinutes?: number
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const updateData: any = {
    title,
    description,
    milestone_id: milestoneId || null
  }

  if (assignedTo !== undefined) updateData.assigned_to = assignedTo || null
  if (dueDate !== undefined) updateData.due_date = dueDate
  if (color !== undefined) updateData.color = color
  if (workMinutes !== undefined) updateData.work_minutes = workMinutes

  const { error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath('/roadmap')
  return { success: true }
}

// حذف مهمة (Admin Only)
export async function deleteTask(taskId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)

  if (error) throw new Error(error.message)
  revalidatePath('/')
  return { success: true }
}

// ترحيل المهام غير المكتملة لليوم التالي
export async function migrateTasks(groupId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // 1. جلب بيانات المجموعة الحالية
  const { data: group } = await supabase
    .from('task_groups')
    .select('*')
    .eq('id', groupId)
    .single()

  if (!group) throw new Error('المجموعة غير موجودة')

  // 2. جلب المهام غير المكتملة
  let tasksQuery = supabase
    .from('tasks')
    .select('*')
    .eq('group_id', groupId)
    .neq('status', 'completed')

  // للمستخدم العادي: ترحيل مهامه الخاصة فقط
  if (profile.role !== 'admin') {
    tasksQuery = tasksQuery.eq('assigned_to', profile.id)
  }

  const { data: unfinishedTasks, error: tasksError } = await tasksQuery
  if (tasksError) throw new Error(tasksError.message)
  if (!unfinishedTasks || unfinishedTasks.length === 0) {
    return { success: false, message: 'لا توجد مهام غير مكتملة لترحيلها.' }
  }

  // 3. تحديد تاريخ الغد
  const currentDate = new Date(group.date)
  currentDate.setDate(currentDate.getDate() + 1)
  const tomorrowStr = currentDate.toISOString().split('T')[0]

  // 4. البحث عن مجموعة الغد أو إنشائها
  let nextGroupId = ''
  const { data: nextGroup } = await supabase
    .from('task_groups')
    .select('id')
    .eq('name', group.name)
    .eq('date', tomorrowStr)
    .single()

  if (nextGroup) {
    nextGroupId = nextGroup.id
  } else {
    // إنشاء مجموعة جديدة للغد
    const { data: newGroup, error: groupCreateError } = await supabase
      .from('task_groups')
      .insert({
        name: group.name,
        color: group.color,
        date: tomorrowStr,
        created_by: group.created_by,
        assigned_to: group.assigned_to
      })
      .select()
      .single()

    if (groupCreateError) throw new Error(groupCreateError.message)
    nextGroupId = newGroup.id
  }

  // 5. تحديث المجموعات للمهام المترحلة
  const taskIds = unfinishedTasks.map(t => t.id)
  const { error: updateTasksError } = await supabase
    .from('tasks')
    .update({
      group_id: nextGroupId,
      migrated_from_date: group.date
    })
    .in('id', taskIds)

  if (updateTasksError) throw new Error(updateTasksError.message)

  revalidatePath('/')
  return { success: true, message: 'تم ترحيل المهام بنجاح!' }
}

// إنشاء حساب مستخدم جديد (Admin Only)
export async function createTeamUser(name: string, email: string, role: 'admin' | 'user') {
  const adminProfile = await getCurrentUserProfile()
  if (!adminProfile || adminProfile.role !== 'admin') {
    throw new Error('صلاحيات غير كافية لإنشاء مستخدمين')
  }

  // استخدام Admin Client لتفادي تفعيل تسجيل الدخول التلقائي أو إرسال تأكيد بالبريد الإلكتروني
  const adminSupabase = createAdminClient()

  // كلمة مرور افتراضية مبدئية: اسم المستخدم + 123
  const defaultPassword = 'user123'

  const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
    user_metadata: {
      name,
      role
    }
  })

  if (authError) throw new Error(authError.message)

  // ملاحظة: جدول profiles سيتم تعبئته تلقائياً من خلال المحفّز (trigger) الذي أنشأناه في قاعدة البيانات.
  
  revalidatePath('/team')
  return { 
    success: true, 
    user: authData.user, 
    message: `تم إنشاء الحساب بنجاح. كلمة المرور الافتراضية هي: ${defaultPassword}` 
  }
}

// جلب المهام المنجزة في تاريخ محدد (لسجل الإنجاز)
export async function getArchiveTasks(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  let query = supabase
    .from('tasks')
    .select(`
      *,
      group:task_groups(name, color),
      assignee:profiles!tasks_assigned_to_fkey(name, email, avatar_url)
    `)
    .eq('status', 'completed')
    .eq('completed_date', dateString)

  // إذا لم يكن مسؤولاً، يرى فقط مهامه المكتملة هو بنفسه
  if (profile.role !== 'admin') {
    query = query.eq('assigned_to', profile.id)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return data || []
}

// جلب الملفات المرفقة لمهمة محددة
export async function getTaskFiles(taskId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('task_files')
    .select('*')
    .eq('task_id', taskId)
    .order('uploaded_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

// حذف ملف مرفق لمهمة
export async function deleteTaskFile(fileId: string, filePath: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // 1. حذف الملف من مخزن Supabase Storage السحابي
  const { error: storageError } = await supabase.storage
    .from('task-attachments')
    .remove([filePath])

  if (storageError) throw new Error(storageError.message)

  // 2. حذف مسار الملف من جدول task_files لقاعدة البيانات
  const { error: dbError } = await supabase
    .from('task_files')
    .delete()
    .eq('id', fileId)

  if (dbError) throw new Error(dbError.message)

  return { success: true }
}

// رفع ملف مرفق لمهمة سحابياً إلى Supabase Storage
export async function uploadTaskFile(taskId: string, formData: FormData) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const file = formData.get('task_file') as File
  if (!file || file.size === 0) throw new Error('الملف المختار غير صالح')

  // تحويل الملف لـ ArrayBuffer للرفع السحابي
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)
  
  // تنظيف اسم الملف لتفادي المشاكل الأمنية ومشاكل المسارات
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const storagePath = `${taskId}/${Date.now()}_${cleanFileName}`

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('task-attachments')
    .upload(storagePath, buffer, {
      contentType: file.type,
      cacheControl: '3600',
      upsert: false
    })

  if (uploadError) throw new Error(uploadError.message)

  const { error: dbError } = await supabase
    .from('task_files')
    .insert({
      task_id: taskId,
      file_name: file.name,
      file_path: storagePath,
      uploaded_by: profile.id
    })

  if (dbError) {
    // التراجع عن رفع الملف السحابي في حال فشل الإدخال بقاعدة البيانات
    await supabase.storage.from('task-attachments').remove([storagePath])
    throw new Error(dbError.message)
  }

  revalidatePath(`/task/${taskId}`)
  return { success: true }
}

// تحديث بيانات الملف الشخصي (الاسم والأفاتار) للمستخدم الحالي
export async function updateProfile(name: string, formData?: FormData, newPassword?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  if (newPassword && newPassword.trim().length > 0) {
    if (newPassword.trim().length < 6) {
      throw new Error('يجب أن تكون كلمة المرور 6 أحرف على الأقل')
    }
    const { error: passError } = await supabase.auth.updateUser({
      password: newPassword
    })
    if (passError) throw new Error(passError.message)
  }

  let avatarUrl = null
  
  if (formData) {
    const file = formData.get('avatar_file') as File
    if (file && file.size > 0) {
      const arrayBuffer = await file.arrayBuffer()
      const buffer = new Uint8Array(arrayBuffer)
      
      const cleanFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
      const storagePath = `avatars/${user.id}/${Date.now()}_${cleanFileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('task-attachments')
        .upload(storagePath, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) throw new Error(uploadError.message)

      avatarUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/task-attachments/${storagePath}`
    }
  }

  const updateData: any = { name }
  if (avatarUrl) {
    updateData.avatar_url = avatarUrl
  }

  // تحديث جدول profiles
  const { error: dbError } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', user.id)

  if (dbError) throw new Error(dbError.message)

  // تحديث بيانات Auth metadata
  const { error: authError } = await supabase.auth.updateUser({
    data: { 
      name, 
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}) 
    }
  })

  if (authError) throw new Error(authError.message)

  revalidatePath('/')
  return { success: true, avatarUrl }
}

// جلب شبكة المتاحية للمستخدم المحدد
export async function getUserAvailability(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_availability')
    .select('*')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return data || []
}

// تحديث حالة ساعة معينة في جدول المتاحية للمستخدم الحالي
export async function updateAvailabilitySlot(dayOfWeek: number, hour: number, status: 'available' | 'unavailable' | 'maybe') {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('user_availability')
    .upsert({
      user_id: user.id,
      day_of_week: dayOfWeek,
      hour: hour,
      status: status,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,day_of_week,hour'
    })

  if (error) throw new Error(error.message)
  return { success: true }
}

// جلب تقارير اليوميات (daily standup) لتاريخ محدد مع تفاعلاتها وتعليقاتها
export async function getDailyStandups(dateString: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('daily_standups')
    .select(`
      *,
      user:profiles(name, email, avatar_url),
      milestone:project_milestones(id, title),
      reactions:standup_reactions(user_id, reaction_type),
      comments:standup_comments(*, user:profiles(name, avatar_url))
    `)
    .eq('date', dateString)

  if (error) throw new Error(error.message)
  return data || []
}

// حفظ أو تحديث التقرير اليومي للمستخدم الحالي
export async function submitDailyStandup(
  todayTasks: string,
  tomorrowTasks: string,
  blockers: string,
  mood: 'energetic' | 'stable' | 'tired' | 'stressed',
  progressRate: 'all' | 'most' | 'half' | 'low',
  productivityScore: number,
  dateString: string,
  milestoneId?: string | null,
  workMinutes: number = 0
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('daily_standups')
    .upsert({
      user_id: user.id,
      date: dateString,
      today_tasks: todayTasks,
      tomorrow_tasks: tomorrowTasks,
      blockers: blockers || null,
      mood,
      progress_rate: progressRate,
      productivity_score: productivityScore,
      milestone_id: milestoneId || null,
      work_minutes: workMinutes,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,date'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // إرسال إشعار لحظي لبقية أعضاء الفريق
  try {
    const profile = await getCurrentUserProfile()
    const userName = profile?.name || 'زميل لك'

    // استخدام حساب الأدمن (Service Role) لتخطي RLS لجلب اشتراكات بقية الفريق
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', user.id)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: 'تحديث يومي جديد 🚀',
        body: `قام ${userName} بكتابة تحديثه اليومي في اللقاء السريع.`,
        url: '/standup'
      })

      // إرسال الإشعارات بالتوازي وانتظارها لحل مشكلة Serverless timeout
      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          // إذا كان الاشتراك منتهي أو تم إلغاؤه (410 أو 404)، نظف قاعدة البيانات منه باستخدام حساب الأدمن
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            console.log(`حذف اشتراك منتهي للمستخدم: ${subRecord.user_id}`)
            await adminSupabase
              .from('push_subscriptions')
              .delete()
              .eq('id', subRecord.id)
          } else {
            console.error('فشل إرسال إشعار Push لجهاز:', pushErr)
          }
        }
      })

      await Promise.allSettled(pushPromises)
    }
  } catch (pushGeneralErr) {
    console.error('خطأ عام أثناء معالجة الإشعارات اللحظية:', pushGeneralErr)
  }

  revalidatePath('/standup')
  return data
}

// حذف التقرير اليومي للمستخدم الحالي للتاريخ المحدد
export async function deleteDailyStandup(dateString: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  const { error } = await supabase
    .from('daily_standups')
    .delete()
    .eq('user_id', user.id)
    .eq('date', dateString)

  if (error) throw new Error(error.message)
  revalidatePath('/standup')
  return { success: true }
}

// جلب المحطات الكبرى (milestones) مع المهام التابعة لحساب التقدم
export async function getMilestones() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // استعلام أمثل للأداء: جلب المحطات مع حقول id و status فقط من المهام المرتبطة
  const { data, error } = await supabase
    .from('project_milestones')
    .select(`
      *,
      tasks(id, status)
    `)
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)

  // حساب نسبة التقدم لكل محطة
  const milestonesWithProgress = (data || []).map((milestone: any) => {
    const total = milestone.tasks?.length || 0
    const completed = milestone.tasks ? milestone.tasks.filter((t: any) => t.status === 'completed').length : 0
    const progress = total > 0 ? Math.round((completed / total) * 100) : 0
    
    return {
      ...milestone,
      totalTasks: total,
      completedTasks: completed,
      progress
    }
  })

  return milestonesWithProgress
}

// إنشاء محطة كبرى جديدة (Admin Only)
export async function createMilestone(title: string, description: string, dueDate: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data, error } = await supabase
    .from('project_milestones')
    .insert({
      title,
      description,
      due_date: dueDate,
      status: 'active'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return data
}

// تعديل محطة كبرى (Admin Only)
export async function updateMilestone(id: string, title: string, description: string, dueDate: string, status: 'active' | 'completed' | 'delayed') {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data, error } = await supabase
    .from('project_milestones')
    .update({
      title,
      description,
      due_date: dueDate,
      status
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return data
}

// حذف محطة كبرى (Admin Only)
export async function deleteMilestone(id: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('project_milestones')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/roadmap')
  return { success: true }
}

// حفظ اشتراك إشعارات ويب لحظية للمستخدم الحالي
export async function savePushSubscription(subscription: any) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // حفظ الاشتراك في جدول push_subscriptions مع تجنب التكرار
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: profile.id,
      subscription: subscription,
      created_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,subscription'
    })

  if (error) throw new Error(error.message)
  return { success: true }
}

// حذف اشتراك إشعارات ويب لحظية
export async function deletePushSubscription(endpoint: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // حذف الاشتراك بناءً على رابط الـ endpoint
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', profile.id)
    .eq('subscription->>endpoint', endpoint)

  if (error) throw new Error(error.message)
  return { success: true }
}

// جلب التقارير والإحصائيات الشهرية للأعضاء والفريق بالكامل
export async function getMonthlyAnalytics(month: number, year: number) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // 1. جلب كافة الأعضاء
  const { data: teamProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, email, avatar_url, role')
    .order('name', { ascending: true })

  if (profilesError) throw new Error(profilesError.message)

  // 2. جلب كافة التقارير اليومية للشهر المحدد
  const { data: standups, error: standupsError } = await supabase
    .from('daily_standups')
    .select('user_id, date, work_minutes, productivity_score')
    .gte('date', startDate)
    .lte('date', endDate)

  if (standupsError) throw new Error(standupsError.message)

  // 3. جلب كافة المهام المكتملة في هذا الشهر
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('assigned_to, completed_date, title')
    .eq('status', 'completed')
    .gte('completed_date', startDate)
    .lte('completed_date', endDate)

  if (tasksError) throw new Error(tasksError.message)

  // 4. تجميع البيانات لكل موظف
  const userStats = (teamProfiles || []).map((u) => {
    const userStandups = (standups || []).filter((s) => s.user_id === u.id)
    const userTasks = (tasks || []).filter((t) => t.assigned_to === u.id)

    const totalMinutes = userStandups.reduce((sum, s) => sum + (s.work_minutes || 0), 0)
    const totalDays = userStandups.length
    const avgProductivity = totalDays > 0 
      ? Math.round((userStandups.reduce((sum, s) => sum + s.productivity_score, 0) / totalDays) * 10) / 10
      : 0

    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      avatarUrl: u.avatar_url,
      role: u.role,
      totalMinutes,
      totalHours: Math.round((totalMinutes / 60) * 10) / 10,
      completedTasksCount: userTasks.length,
      daysLogged: totalDays,
      avgProductivity,
      tasks: userTasks.map(t => t.title)
    }
  })

  // 5. حساب إجمالي الفريق
  const teamTotalMinutes = userStats.reduce((sum, u) => sum + u.totalMinutes, 0)
  const teamCompletedTasks = userStats.reduce((sum, u) => sum + u.completedTasksCount, 0)
  const loggedUsersCount = userStats.filter(u => u.daysLogged > 0).length
  const teamAvgProductivity = loggedUsersCount > 0
    ? Math.round((userStats.filter(u => u.daysLogged > 0).reduce((sum, u) => sum + u.avgProductivity, 0) / loggedUsersCount) * 10) / 10
    : 0

  return {
    userStats,
    teamSummary: {
      totalHours: Math.round((teamTotalMinutes / 60) * 10) / 10,
      completedTasksCount: teamCompletedTasks,
      avgProductivity: teamAvgProductivity
    }
  }
}

// 6. منسق الاجتماعات والتصويت أسبوعياً

// جلب متاحية كافة الأعضاء لبناء الـ Heatmap
export async function getAllMembersAvailability() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('user_availability')
    .select('*')

  if (error) throw new Error(error.message)
  return data || []
}

// جلب التصويتات النشطة
export async function getActivePolls() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: polls, error: pollsError } = await supabase
    .from('meeting_polls')
    .select('*')
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (pollsError) throw new Error(pollsError.message)
  if (!polls || polls.length === 0) return []

  const pollIds = polls.map(p => p.id)

  const { data: options, error: optionsError } = await supabase
    .from('meeting_poll_options')
    .select('*')
    .in('poll_id', pollIds)

  if (optionsError) throw new Error(optionsError.message)

  const optionIds = options?.map(o => o.id) || []
  let votes: any[] = []
  if (optionIds.length > 0) {
    const { data: votesData, error: votesError } = await supabase
      .from('meeting_poll_votes')
      .select('*, profile:profiles(name, avatar_url)')
      .in('option_id', optionIds)
    if (votesError) throw new Error(votesError.message)
    votes = votesData || []
  }

  return polls.map(poll => {
    const pollOptions = (options || []).filter(o => o.poll_id === poll.id).map(opt => {
      const optVotes = votes.filter(v => v.option_id === opt.id)
      return {
        ...opt,
        votes: optVotes
      }
    })
    return {
      ...poll,
      options: pollOptions
    }
  })
}

// إنشاء استطلاع موعد اجتماع جديد (Admin Only)
export async function createMeetingPoll(
  title: string,
  meetingType: 'online' | 'offline',
  options: { proposed_date: string; proposed_time: string }[]
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: poll, error: pollError } = await supabase
    .from('meeting_polls')
    .insert({
      title,
      meeting_type: meetingType,
      status: 'active'
    })
    .select()
    .single()

  if (pollError) throw new Error(pollError.message)

  const optionsToInsert = options.map(opt => ({
    poll_id: poll.id,
    proposed_date: opt.proposed_date,
    proposed_time: opt.proposed_time
  }))

  const { error: optionsError } = await supabase
    .from('meeting_poll_options')
    .insert(optionsToInsert)

  if (optionsError) {
    await supabase.from('meeting_polls').delete().eq('id', poll.id)
    throw new Error(optionsError.message)
  }

  try {
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', profile.id)

    if (subscriptions && subscriptions.length > 0) {
      const payload = JSON.stringify({
        title: 'استطلاع موعد اجتماع جديد 🗳️',
        body: `تم فتح تصويت جديد: "${title}". شاركنا مواعيدك المفضلة!`,
        url: '/availability'
      })

      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
          }
        }
      })
      await Promise.allSettled(pushPromises)
    }
  } catch (err) {
    console.error('Error sending poll push notification:', err)
  }

  revalidatePath('/availability')
  return poll
}

// حفظ تصويتات العضو
export async function submitMeetingVotes(pollId: string, optionIds: string[]) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: pollOptions, error: optError } = await supabase
    .from('meeting_poll_options')
    .select('id')
    .eq('poll_id', pollId)

  if (optError) throw new Error(optError.message)
  const pollOptionIds = pollOptions.map(o => o.id)

  if (pollOptionIds.length > 0) {
    const { error: deleteError } = await supabase
      .from('meeting_poll_votes')
      .delete()
      .eq('user_id', profile.id)
      .in('option_id', pollOptionIds)

    if (deleteError) throw new Error(deleteError.message)
  }

  if (optionIds.length > 0) {
    const votesToInsert = optionIds.map(optId => ({
      option_id: optId,
      user_id: profile.id
    }))

    const { error: insertError } = await supabase
      .from('meeting_poll_votes')
      .insert(votesToInsert)

    if (insertError) throw new Error(insertError.message)
  }

  revalidatePath('/availability')
  return { success: true }
}

// جدولة اجتماع جديد (Admin Only)
export async function scheduleMeeting(
  pollId: string | null,
  title: string,
  meetingType: 'online' | 'offline',
  date: string,
  time: string,
  locationUrl: string,
  notes: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: meeting, error: meetingError } = await supabase
    .from('scheduled_meetings')
    .insert({
      title,
      meeting_type: meetingType,
      meeting_date: date,
      meeting_time: time,
      location_url: locationUrl || null,
      notes: notes || null,
      created_by: profile.id
    })
    .select()
    .single()

  if (meetingError) throw new Error(meetingError.message)

  if (pollId) {
    const { error: pollError } = await supabase
      .from('meeting_polls')
      .update({ status: 'completed' })
      .eq('id', pollId)
    if (pollError) console.error('Error updating poll status:', pollError)
  }

  try {
    const adminSupabase = createAdminClient()
    const { data: subscriptions } = await adminSupabase
      .from('push_subscriptions')
      .select('id, user_id, subscription')
      .neq('user_id', profile.id)

    if (subscriptions && subscriptions.length > 0) {
      const typeLabel = meetingType === 'online' ? 'Google Meet' : 'لقاء حضوري'
      const payload = JSON.stringify({
        title: 'تم تحديد موعد الاجتماع! 📅',
        body: `تم جدولة اجتماع: "${title}" (${typeLabel}) يوم ${date} في تمام الساعة ${time.slice(0, 5)}.`,
        url: '/availability'
      })

      const pushPromises = subscriptions.map(async (subRecord: any) => {
        try {
          await webpush.sendNotification(subRecord.subscription, payload)
        } catch (pushErr: any) {
          if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
            await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
          }
        }
      })
      await Promise.allSettled(pushPromises)
    }
  } catch (err) {
    console.error('Error sending scheduled meeting push notification:', err)
  }

  revalidatePath('/availability')
  return meeting
}

// جلب الاجتماعات المجدولة
export async function getScheduledMeetings() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const todayStr = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('scheduled_meetings')
    .select('*, creator:profiles(name, avatar_url)')
    .gte('meeting_date', todayStr)
    .order('meeting_date', { ascending: true })
    .order('meeting_time', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// حذف أو إلغاء اجتماع (Admin Only)
export async function deleteScheduledMeeting(meetingId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { error } = await supabase
    .from('scheduled_meetings')
    .delete()
    .eq('id', meetingId)

  if (error) throw new Error(error.message)

  revalidatePath('/availability')
  return { success: true }
}

// تعديل اجتماع مجدول (Admin Only)
export async function updateScheduledMeeting(
  meetingId: string,
  title: string,
  meetingType: 'online' | 'offline',
  date: string,
  time: string,
  locationUrl: string,
  notes: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile || profile.role !== 'admin') throw new Error('صلاحيات غير كافية')

  const { data: meeting, error } = await supabase
    .from('scheduled_meetings')
    .update({
      title,
      meeting_type: meetingType,
      meeting_date: date,
      meeting_time: time,
      location_url: locationUrl || null,
      notes: notes || null
    })
    .eq('id', meetingId)
    .select(`
      *,
      creator:profiles!scheduled_meetings_created_by_fkey(name, email, avatar_url)
    `)
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/availability')
  return meeting
}

// 7. تفاعلات وتعليقات اللقاء اليومي (Daily Standup Reactions & Comments)

// إضافة أو تعديل تفاعل إيموجي على تحديث يومي
export async function toggleStandupReaction(standupId: string, reactionType: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التحقق من تفاعل المستخدم الحالي على هذه اليومية
  const { data: existing, error: fetchErr } = await supabase
    .from('standup_reactions')
    .select('id, reaction_type')
    .eq('standup_id', standupId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (fetchErr) throw new Error(fetchErr.message)

  if (existing) {
    if (existing.reaction_type === reactionType) {
      // إذا نقر على نفس التفاعل، نقوم بحذفه (Toggle off)
      const { error: deleteErr } = await supabase
        .from('standup_reactions')
        .delete()
        .eq('id', existing.id)
      if (deleteErr) throw new Error(deleteErr.message)
    } else {
      // إذا كان التفاعل مختلفاً، نقوم بتحديثه
      const { error: updateErr } = await supabase
        .from('standup_reactions')
        .update({ reaction_type: reactionType })
        .eq('id', existing.id)
      if (updateErr) throw new Error(updateErr.message)
    }
  } else {
    // إضافة تفاعل جديد
    const { error: insertErr } = await supabase
      .from('standup_reactions')
      .insert({
        standup_id: standupId,
        user_id: profile.id,
        reaction_type: reactionType
      })
    if (insertErr) throw new Error(insertErr.message)
  }

  revalidatePath('/standup')
  return { success: true }
}

// إضافة تعليق جديد (رئيسي أو رد متداخل)
export async function addStandupComment(standupId: string, content: string, parentId: string | null = null) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق فارغ')

  const { data: comment, error: insertErr } = await supabase
    .from('standup_comments')
    .insert({
      standup_id: standupId,
      user_id: profile.id,
      parent_id: parentId,
      content: content.trim()
    })
    .select()
    .single()

  if (insertErr) throw new Error(insertErr.message)

  // إرسال إشعار Push موجه
  try {
    const adminSupabase = createAdminClient()
    
    // جلب معلومات كاتب التقرير اليومي
    const { data: standup } = await supabase
      .from('daily_standups')
      .select('user_id')
      .eq('id', standupId)
      .single()

    if (standup) {
      const targetUserIds = new Set<string>()
      let notificationTitle = 'تعليق جديد 💬'
      let notificationBody = `قام ${profile.name} بالتعليق على تحديثك اليومي.`

      if (parentId) {
        // هذا رد متداخل: جلب كاتب التعليق الأب لإرسال إشعار له
        const { data: parentComment } = await supabase
          .from('standup_comments')
          .select('user_id')
          .eq('id', parentId)
          .single()

        if (parentComment && parentComment.user_id !== profile.id) {
          targetUserIds.add(parentComment.user_id)
        }
        
        notificationTitle = 'رد جديد على تعليقك 💬'
        notificationBody = `قام ${profile.name} بالرد على تعليقك في اللقاء اليومي.`

        // نرسل أيضاً لصاحب التقرير اليومي إذا لم يكن هو كاتب الرد الحالي أو صاحب التعليق الأب
        if (standup.user_id !== profile.id && (!parentComment || standup.user_id !== parentComment.user_id)) {
          targetUserIds.add(standup.user_id)
        }
      } else {
        // تعليق رئيسي جديد: نرسل لصاحب التقرير فقط
        if (standup.user_id !== profile.id) {
          targetUserIds.add(standup.user_id)
        }
      }

      const targetList = Array.from(targetUserIds)
      if (targetList.length > 0) {
        const { data: subscriptions } = await adminSupabase
          .from('push_subscriptions')
          .select('id, user_id, subscription')
          .in('user_id', targetList)

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: notificationTitle,
            body: notificationBody,
            url: '/standup'
          })

          const pushPromises = subscriptions.map(async (subRecord: any) => {
            try {
              await webpush.sendNotification(subRecord.subscription, payload)
            } catch (pushErr: any) {
              if (pushErr.statusCode === 410 || pushErr.statusCode === 404) {
                await adminSupabase.from('push_subscriptions').delete().eq('id', subRecord.id)
              }
            }
          })
          await Promise.allSettled(pushPromises)
        }
      }
    }
  } catch (err) {
    console.error('Error sending comment push notification:', err)
  }

  revalidatePath('/standup')
  return comment
}

// حذف تعليق
export async function deleteStandupComment(commentId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: comment, error: fetchErr } = await supabase
    .from('standup_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  // لا يحذف التعليق إلا صاحبه أو الأدمن
  if (profile.role !== 'admin' && comment.user_id !== profile.id) {
    throw new Error('غير مصرح لك بحذف هذا التعليق')
  }

  const { error: deleteErr } = await supabase
    .from('standup_comments')
    .delete()
    .eq('id', commentId)

  if (deleteErr) throw new Error(deleteErr.message)

  revalidatePath('/standup')
  return { success: true }
}

// تعديل تعليق
export async function updateStandupComment(commentId: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق لا يمكن أن يكون فارغاً')

  const { data: comment, error: fetchErr } = await supabase
    .from('standup_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  // لا يمكن تعديل التعليق إلا لصاحب التعليق نفسه
  if (comment.user_id !== profile.id) {
    throw new Error('غير مصرح لك بتعديل هذا التعليق')
  }

  const { data: updatedComment, error: updateErr } = await supabase
    .from('standup_comments')
    .update({ content: content.trim() })
    .eq('id', commentId)
    .select()
    .single()

  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/standup')
  return updatedComment
}

// --------------------------------------------------------------------
// 17. عمليات لوحة الأفكار والعصف الذهني (Ideas Board Actions)
// --------------------------------------------------------------------

export async function getIdeas() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data, error } = await supabase
    .from('ideas')
    .select(`
      *,
      user:profiles!user_id(name, avatar_url),
      idea_upvotes(user_id),
      idea_comments(
        id,
        content,
        created_at,
        user_id,
        user:profiles!user_id(name, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)

  return (data || []).map((idea: any) => {
    const upvotes = idea.idea_upvotes || []
    const hasUpvoted = upvotes.some((u: any) => u.user_id === profile.id)
    
    // ترتيب التعليقات تصاعدياً حسب تاريخ الإنشاء
    const sortedComments = (idea.idea_comments || []).sort(
      (a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )

    return {
      ...idea,
      upvotes_count: upvotes.length,
      comments_count: sortedComments.length,
      idea_comments: sortedComments,
      has_upvoted: hasUpvoted
    }
  })
}

export async function createIdea(title: string, description: string, category: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim()) throw new Error('عنوان الفكرة مطلوب')

  const { data, error } = await supabase
    .from('ideas')
    .insert({
      title: title.trim(),
      description: description.trim(),
      category,
      user_id: profile.id,
      status: 'draft'
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function toggleIdeaUpvote(ideaId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: existing, error: checkErr } = await supabase
    .from('idea_upvotes')
    .select('idea_id')
    .eq('idea_id', ideaId)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (checkErr) throw new Error(checkErr.message)

  if (existing) {
    // إلغاء التصويت
    const { error: deleteErr } = await supabase
      .from('idea_upvotes')
      .delete()
      .eq('idea_id', ideaId)
      .eq('user_id', profile.id)

    if (deleteErr) throw new Error(deleteErr.message)
  } else {
    // إضافة تصويت جديد
    const { error: insertErr } = await supabase
      .from('idea_upvotes')
      .insert({
        idea_id: ideaId,
        user_id: profile.id
      })

    if (insertErr) throw new Error(insertErr.message)
  }

  revalidatePath('/ideas')
  return { success: true }
}

export async function addIdeaComment(ideaId: string, content: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!content.trim()) throw new Error('محتوى التعليق لا يمكن أن يكون فارغاً')

  const { data, error } = await supabase
    .from('idea_comments')
    .insert({
      idea_id: ideaId,
      user_id: profile.id,
      content: content.trim()
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function deleteIdeaComment(commentId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: comment, error: fetchErr } = await supabase
    .from('idea_comments')
    .select('user_id')
    .eq('id', commentId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (comment.user_id !== profile.id && profile.role !== 'admin') {
    throw new Error('غير مصرح لك بحذف هذا التعليق')
  }

  const { error: deleteErr } = await supabase
    .from('idea_comments')
    .delete()
    .eq('id', commentId)

  if (deleteErr) throw new Error(deleteErr.message)

  revalidatePath('/ideas')
  return { success: true }
}

export async function convertIdeaToTask(
  ideaId: string,
  groupId: string,
  assignedTo: string | null,
  dueDate: string
) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // جلب الفكرة الأصلية
  const { data: idea, error: ideaErr } = await supabase
    .from('ideas')
    .select('*')
    .eq('id', ideaId)
    .single()

  if (ideaErr) throw new Error(ideaErr.message)

  // إنشاء المهمة الجديدة
  const { data: task, error: taskErr } = await supabase
    .from('tasks')
    .insert({
      group_id: groupId,
      title: idea.title,
      description: idea.description || '',
      assigned_to: assignedTo,
      due_date: dueDate,
      status: 'not_started',
      color: 'classic'
    })
    .select()
    .single()

  if (taskErr) throw new Error(taskErr.message)

  // ربط الفكرة بالمهمة وتغيير الحالة
  const { error: updateErr } = await supabase
    .from('ideas')
    .update({
      converted_task_id: task.id,
      status: 'converted'
    })
    .eq('id', ideaId)

  if (updateErr) throw new Error(updateErr.message)

  revalidatePath('/')
  revalidatePath('/ideas')
  return task
}

export async function updateIdea(ideaId: string, title: string, description: string, category: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  if (!title.trim()) throw new Error('عنوان الفكرة مطلوب')

  // التحقق من الملكية
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('user_id')
    .eq('id', ideaId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (idea.user_id !== profile.id) {
    throw new Error('غير مصرح لك بتعديل هذه الفكرة')
  }

  const { data, error } = await supabase
    .from('ideas')
    .update({
      title: title.trim(),
      description: description.trim(),
      category
    })
    .eq('id', ideaId)
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return data
}

export async function deleteIdea(ideaId: string) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  // التحقق من الملكية أو الصلاحية الإدارية
  const { data: idea, error: fetchErr } = await supabase
    .from('ideas')
    .select('user_id')
    .eq('id', ideaId)
    .single()

  if (fetchErr) throw new Error(fetchErr.message)

  if (idea.user_id !== profile.id && profile.role !== 'admin') {
    throw new Error('غير مصرح لك بحذف هذه الفكرة')
  }

  const { error } = await supabase
    .from('ideas')
    .delete()
    .eq('id', ideaId)

  if (error) throw new Error(error.message)

  revalidatePath('/ideas')
  return { success: true }
}

// جلب المهام النشطة للمستخدم الحالي
export async function getUserActiveTasks() {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) return []

  const { data, error } = await supabase
    .from('tasks')
    .select(`
      id,
      title,
      due_date,
      status,
      group:task_groups(name)
    `)
    .eq('assigned_to', profile.id)
    .neq('status', 'completed')
    .order('due_date', { ascending: true })

  if (error) throw new Error(error.message)
  return data || []
}

// تسجيل وقت العمل على مهمة معينة (زيادة الوقت الحالي)
export async function logTaskTime(taskId: string, minutes: number) {
  const supabase = await createClient()
  const profile = await getCurrentUserProfile()
  if (!profile) throw new Error('غير مصرح بالدخول')

  const { data: task, error: fetchError } = await supabase
    .from('tasks')
    .select('work_minutes, assigned_to')
    .eq('id', taskId)
    .single()

  if (fetchError || !task) throw new Error('المهمة غير موجودة')
  if (profile.role !== 'admin' && task.assigned_to !== profile.id) {
    throw new Error('ليست لديك الصلاحية لتسجيل الوقت لهذه المهمة')
  }

  const newMinutes = (task.work_minutes || 0) + minutes

  const { data, error } = await supabase
    .from('tasks')
    .update({ work_minutes: newMinutes })
    .eq('id', taskId)
    .select()
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/')
  revalidatePath(`/task/${taskId}`)
  return data
}

// تسجيل وقت العمل في اللقاء اليومي للتاريخ المحدد
export async function logStandupTime(dateString: string, minutes: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('غير مصرح بالدخول')

  // التحقق من وجود تقرير اليوم
  const { data: standup, error: fetchError } = await supabase
    .from('daily_standups')
    .select('id, work_minutes')
    .eq('user_id', user.id)
    .eq('date', dateString)
    .maybeSingle()

  if (standup) {
    const newMinutes = (standup.work_minutes || 0) + minutes
    const { data, error } = await supabase
      .from('daily_standups')
      .update({ work_minutes: newMinutes })
      .eq('id', standup.id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    revalidatePath('/standup')
    return { success: true, updated: true, data }
  } else {
    // إنشاء تقرير مبدئي
    const { data, error } = await supabase
      .from('daily_standups')
      .insert({
        user_id: user.id,
        date: dateString,
        today_tasks: 'تسجيل وقت العمل من العداد التلقائي',
        tomorrow_tasks: 'تحديث لاحق لجدول الأعمال',
        mood: 'stable',
        progress_rate: 'most',
        productivity_score: 4,
        work_minutes: minutes,
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    revalidatePath('/standup')
    return { success: true, created: true, data }
  }
}






