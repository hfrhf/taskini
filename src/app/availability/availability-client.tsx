'use client'

import { useState, useEffect } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { 
  Clock, Info, ShieldCheck, Check, HelpCircle, XCircle, 
  Calendar, Users, MapPin, Video, Plus, Trash2, CheckSquare, 
  Loader2, Sparkles, Send, Award, Link, CalendarDays, ExternalLink, Edit2
} from 'lucide-react'
import { 
  updateAvailabilitySlot, 
  createMeetingPoll, 
  submitMeetingVotes, 
  scheduleMeeting, 
  deleteScheduledMeeting,
  getActivePolls,
  getScheduledMeetings,
  updateScheduledMeeting,
  getHeldMeetings,
  markMeetingAsHeld
} from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface AvailabilitySlot {
  user_id: string
  day_of_week: number
  hour: number
  status: 'available' | 'unavailable' | 'maybe'
}

interface MeetingPollOption {
  id: string
  poll_id: string
  proposed_date: string
  proposed_time: string
  votes?: {
    id: string
    option_id: string
    user_id: string
    profile: {
      name: string
      avatar_url: string
    }
  }[]
}

interface MeetingPoll {
  id: string
  title: string
  meeting_type: 'online' | 'offline'
  status: 'active' | 'completed'
  created_at: string
  options: MeetingPollOption[]
}

interface ScheduledMeeting {
  id: string
  title: string
  meeting_type: 'online' | 'offline'
  meeting_date: string
  meeting_time: string
  location_url?: string
  notes?: string
  status?: 'scheduled' | 'held' | 'cancelled'
  duration_minutes?: number
  created_by?: string
  creator?: {
    name: string
    avatar_url: string
  }
}

interface AvailabilityClientProps {
  currentProfile: Profile
  initialAvailability: AvailabilitySlot[]
  teamProfiles: Profile[]
  allAvailability: AvailabilitySlot[]
  initialActivePolls: MeetingPoll[]
  initialScheduledMeetings: ScheduledMeeting[]
}

const daysOfWeekArabic = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة'
]

const statusStyles = {
  unavailable: 'bg-rose-500/10 border-rose-500/20 hover:bg-rose-500/20 text-rose-400',
  available: 'bg-emerald-500 border-emerald-600 text-white shadow-sm',
  maybe: 'bg-amber-400 border-amber-500 text-neutral-900 shadow-sm'
}

const statusLabels = {
  unavailable: 'غير متاح',
  available: 'متاح للعمل',
  maybe: 'متوقع / محتمل'
}

export default function AvailabilityClient({ 
  currentProfile, 
  initialAvailability,
  teamProfiles,
  allAvailability: propAllAvailability,
  initialActivePolls,
  initialScheduledMeetings
}: AvailabilityClientProps) {
  
  // التبويبات: جدول توفري الأسبوعي / اجتماعات الفريق / سجل اللقاءات المنفذة
  const [activeTab, setActiveTab] = useState<'my-availability' | 'team-meetings' | 'held-meetings'>('my-availability')
  const isAdmin = currentProfile.role === 'admin'

  // البيانات
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, 'available' | 'unavailable' | 'maybe'>>(() => {
    const map: Record<string, 'available' | 'unavailable' | 'maybe'> = {}
    initialAvailability.forEach(slot => {
      map[`${slot.day_of_week}-${slot.hour}`] = slot.status
    })
    return map
  })
  
  const [allAvailability, setAllAvailability] = useState<AvailabilitySlot[]>(propAllAvailability)
  const [activePolls, setActivePolls] = useState<MeetingPoll[]>(initialActivePolls)
  const [scheduledMeetings, setScheduledMeetings] = useState<ScheduledMeeting[]>(initialScheduledMeetings)

  // التنبيهات
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // مؤقت التنازل
  const [currentTime, setCurrentTime] = useState(new Date())
  
  // حالات تحميل
  const [loading, setLoading] = useState(false)
  const [votingMapLoading, setVotingMapLoading] = useState<Record<string, boolean>>({})

  // اختيار خلايا الهيتماب التفاعلية
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{ day: number; hour: number } | null>(null)

  // نموذج إطلاق تصويت جديد
  const [newPollTitle, setNewPollTitle] = useState('')
  const [newPollType, setNewPollType] = useState<'online' | 'offline'>('online')
  const [newPollOptions, setNewPollOptions] = useState<{ date: string; time: string }[]>([
    { date: '', time: '' }
  ])

  // نموذج جدولة اجتماع نهائي أو تعديله
  const [scheduleModal, setScheduleModal] = useState<{
    isOpen: boolean
    pollId: string | null
    meetingId: string | null
    title: string
    meetingType: 'online' | 'offline'
    date: string
    time: string
    locationUrl: string
    notes: string
  }>({
    isOpen: false,
    pollId: null,
    meetingId: null,
    title: '',
    meetingType: 'online',
    date: '',
    time: '',
    locationUrl: '',
    notes: ''
  })

  // سجل الاجتماعات التاريخية المنفذة
  const [heldMeetings, setHeldMeetings] = useState<ScheduledMeeting[]>([])
  const [isConfirmHeldOpen, setIsConfirmHeldOpen] = useState(false)
  const [confirmHeldMeetingId, setConfirmHeldMeetingId] = useState<string | null>(null)
  const [confirmHeldTitle, setConfirmHeldTitle] = useState('')
  const [confirmHeldHours, setConfirmHeldHours] = useState(0)
  const [confirmHeldMinutes, setConfirmHeldMinutes] = useState(0)
  const [isSavingHeldConfirm, setIsSavingHeldConfirm] = useState(false)

  // خيارات التصويت المختارة لكل تصويت (مفاتيحها pollId)
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string[]>>(() => {
    const votesMap: Record<string, string[]> = {}
    initialActivePolls.forEach(poll => {
      const userVotedOptionIds: string[] = []
      poll.options.forEach(opt => {
        const hasVoted = opt.votes?.some(v => v.user_id === currentProfile.id)
        if (hasVoted) {
          userVotedOptionIds.push(opt.id)
        }
      })
      votesMap[poll.id] = userVotedOptionIds
    })
    return votesMap
  })

  const fetchHeldMeetings = async () => {
    try {
      const data = await getHeldMeetings()
      setHeldMeetings(data)
    } catch (err: any) {
      console.error('Error fetching held meetings:', err)
    }
  }

  useEffect(() => {
    fetchHeldMeetings()
    const timer = setInterval(() => setCurrentTime(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // تحديث خانة متاحية المستخدم
  const handleSlotClick = async (day: number, hour: number) => {
    const key = `${day}-${hour}`
    const currentStatus = availabilityMap[key] || 'unavailable'
    
    let nextStatus: 'available' | 'unavailable' | 'maybe' = 'available'
    if (currentStatus === 'available') {
      nextStatus = 'maybe'
    } else if (currentStatus === 'maybe') {
      nextStatus = 'unavailable'
    }

    setAvailabilityMap(prev => ({ ...prev, [key]: nextStatus }))

    try {
      await updateAvailabilitySlot(day, hour, nextStatus)
      // تحديث المتاحية الكلية محلياً لمواكبة التغيير في الـ heatmap
      setAllAvailability(prev => {
        const filtered = prev.filter(s => !(s.user_id === currentProfile.id && s.day_of_week === day && s.hour === hour))
        return [...filtered, { user_id: currentProfile.id, day_of_week: day, hour, status: nextStatus }]
      })
    } catch (err: any) {
      setAvailabilityMap(prev => ({ ...prev, [key]: currentStatus }))
      showToast('فشل تحديث الساعة: ' + err.message, 'error')
    }
  }

  // ملء يوم كامل بمتاحية محددة
  const fillDayStatus = async (day: number, status: 'available' | 'unavailable' | 'maybe') => {
    const backupMap = { ...availabilityMap }
    const updatedMap = { ...availabilityMap }
    
    for (let hour = 0; hour < 24; hour++) {
      updatedMap[`${day}-${hour}`] = status
    }
    
    setAvailabilityMap(updatedMap)

    try {
      await Promise.all(
        Array.from({ length: 24 }).map((_, hour) => 
          updateAvailabilitySlot(day, hour, status)
        )
      )
      
      setAllAvailability(prev => {
        const filtered = prev.filter(s => !(s.user_id === currentProfile.id && s.day_of_week === day))
        const newSlots: AvailabilitySlot[] = Array.from({ length: 24 }).map((_, hour) => ({
          user_id: currentProfile.id,
          day_of_week: day,
          hour,
          status
        }))
        return [...filtered, ...newSlots]
      })

      showToast(`تم تعيين يوم ${daysOfWeekArabic[day]} بالكامل كـ: ${statusLabels[status]}`, 'success')
    } catch (err: any) {
      setAvailabilityMap(backupMap)
      showToast('فشل تحديث اليوم بالكامل: ' + err.message, 'error')
    }
  }

  // حساب نسبة التوافق لخلية الهيتماب
  const getCellCompatibility = (day: number, hour: number) => {
    const slots = allAvailability.filter(s => s.day_of_week === day && s.hour === hour)
    
    const availableIds = slots.filter(s => s.status === 'available').map(s => s.user_id)
    const maybeIds = slots.filter(s => s.status === 'maybe').map(s => s.user_id)
    
    const available = teamProfiles.filter(p => availableIds.includes(p.id))
    const maybe = teamProfiles.filter(p => maybeIds.includes(p.id))
    const unavailable = teamProfiles.filter(p => !availableIds.includes(p.id) && !maybeIds.includes(p.id))
    
    const score = available.length + (maybe.length * 0.5)
    const percentage = teamProfiles.length > 0 ? Math.round((score / teamProfiles.length) * 100) : 0
    
    return {
      available,
      maybe,
      unavailable,
      percentage,
      count: available.length
    }
  }

  // الحصول على ألوان خلايا الهيتماب بناءً على النسبة
  const getHeatmapColorClass = (percentage: number) => {
    if (percentage === 100) return 'bg-emerald-500 text-white border-emerald-600 shadow-sm shadow-emerald-500/20'
    if (percentage >= 75) return 'bg-emerald-500/70 border-emerald-500/30 text-white'
    if (percentage >= 50) return 'bg-emerald-500/40 border-emerald-500/20 text-emerald-100'
    if (percentage >= 25) return 'bg-amber-500/20 border-amber-500/10 text-amber-300'
    if (percentage > 0) return 'bg-rose-500/10 border-rose-500/10 text-rose-300'
    return 'bg-neutral-800/20 border-transparent text-neutral-600 opacity-40'
  }

  // إضافة سطر خيار تصويت جديد في النموذج
  const addPollOptionRow = () => {
    setNewPollOptions([...newPollOptions, { date: '', time: '' }])
  }

  // إزالة سطر خيار تصويت
  const removePollOptionRow = (index: number) => {
    if (newPollOptions.length === 1) return
    setNewPollOptions(newPollOptions.filter((_, idx) => idx !== index))
  }

  // معالجة تغيير حقول الخيارات في نموذج الاستطلاع
  const handlePollOptionChange = (index: number, field: 'date' | 'time', value: string) => {
    const updated = [...newPollOptions]
    updated[index][field] = value
    setNewPollOptions(updated)
  }

  // إرسال استطلاع تصويت جديد
  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPollTitle.trim()) {
      showToast('يرجى كتابة عنوان للتصويت', 'error')
      return
    }

    const validOptions = newPollOptions.filter(o => o.date && o.time)
    if (validOptions.length === 0) {
      showToast('يرجى إضافة خيار موعد واحد صالح على الأقل (تاريخ ووقت)', 'error')
      return
    }

    setLoading(true)
    try {
      const formattedOptions = validOptions.map(opt => ({
        proposed_date: opt.date,
        proposed_time: opt.time
      }))
      
      await createMeetingPoll(newPollTitle, newPollType, formattedOptions)
      
      // إعادة جلب الاستطلاعات
      const updatedPolls = await getActivePolls()
      setActivePolls(updatedPolls)

      // إعادة تهيئة النموذج
      setNewPollTitle('')
      setNewPollType('online')
      setNewPollOptions([{ date: '', time: '' }])
      
      showToast('تم إطلاق استطلاع الموعد وإشعار الفريق بنجاح! 🗳️', 'success')
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء إنشاء الاستطلاع', 'error')
    } finally {
      setLoading(false)
    }
  }

  // تبديل اختيار الموعد للتصويت
  const handleToggleVoteOption = (pollId: string, optionId: string) => {
    const currentSelected = selectedVotes[pollId] || []
    let updatedSelected: string[] = []

    if (currentSelected.includes(optionId)) {
      updatedSelected = currentSelected.filter(id => id !== optionId)
    } else {
      updatedSelected = [...currentSelected, optionId]
    }

    setSelectedVotes(prev => ({
      ...prev,
      [pollId]: updatedSelected
    }))
  }

  // إرسال أصوات المستخدم
  const handleSaveVotes = async (pollId: string) => {
    setVotingMapLoading(prev => ({ ...prev, [pollId]: true }))
    try {
      const optionIds = selectedVotes[pollId] || []
      await submitMeetingVotes(pollId, optionIds)
      
      // تحديث البيانات محلياً
      const updatedPolls = await getActivePolls()
      setActivePolls(updatedPolls)
      
      showToast('تم حفظ وتحديث أصواتك بنجاح! 🗳️', 'success')
    } catch (err: any) {
      showToast(err.message || 'فشل حفظ التصويت', 'error')
    } finally {
      setVotingMapLoading(prev => ({ ...prev, [pollId]: false }))
    }
  }

  // فتح نافذة اعتماد موعد لجدولته
  const openScheduleModal = (poll: MeetingPoll, option: MeetingPollOption) => {
    setScheduleModal({
      isOpen: true,
      pollId: poll.id,
      meetingId: null,
      title: `اجتماع: ${poll.title}`,
      meetingType: poll.meeting_type,
      date: option.proposed_date,
      time: option.proposed_time,
      locationUrl: poll.meeting_type === 'online' ? 'https://meet.google.com/' : '',
      notes: `تم اعتماده بناءً على تصويت الفريق أسبوعياً.`
    })
  }

  // فتح نافذة تعديل الاجتماع المجدول
  const openEditMeetingModal = (meeting: ScheduledMeeting) => {
    setScheduleModal({
      isOpen: true,
      pollId: null,
      meetingId: meeting.id,
      title: meeting.title,
      meetingType: meeting.meeting_type,
      date: meeting.meeting_date,
      time: meeting.meeting_time,
      locationUrl: meeting.location_url || '',
      notes: meeting.notes || ''
    })
  }

  // إرسال جدولة الاجتماع النهائي أو تعديله
  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!scheduleModal.title.trim()) {
      showToast('يرجى تحديد عنوان للاجتماع', 'error')
      return
    }
    if (!scheduleModal.date || !scheduleModal.time) {
      showToast('يرجى تحديد تاريخ ووقت الاجتماع', 'error')
      return
    }

    setLoading(true)
    try {
      if (scheduleModal.meetingId) {
        // تعديل الاجتماع المجدول حالياً
        const updated = await updateScheduledMeeting(
          scheduleModal.meetingId,
          scheduleModal.title,
          scheduleModal.meetingType,
          scheduleModal.date,
          scheduleModal.time,
          scheduleModal.locationUrl,
          scheduleModal.notes
        )

        setScheduledMeetings(prev => prev.map(m => m.id === scheduleModal.meetingId ? updated : m))
        showToast('تم تعديل تفاصيل الاجتماع بنجاح! ✏️', 'success')
      } else {
        // جدولة اجتماع جديد
        await scheduleMeeting(
          scheduleModal.pollId,
          scheduleModal.title,
          scheduleModal.meetingType,
          scheduleModal.date,
          scheduleModal.time,
          scheduleModal.locationUrl,
          scheduleModal.notes
        )

        // جلب البيانات المحدثة
        const updatedMeetings = await getScheduledMeetings()
        setScheduledMeetings(updatedMeetings)

        const updatedPolls = await getActivePolls()
        setActivePolls(updatedPolls)
        showToast('تمت جدولة الاجتماع النهائي وإرسال التنبيهات بنجاح! 📅', 'success')
      }

      setScheduleModal(prev => ({ ...prev, isOpen: false }))
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء حفظ الاجتماع', 'error')
    } finally {
      setLoading(false)
    }
  }

  // إلغاء اجتماع مجدول
  const handleDeleteMeeting = async (meetingId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء وحذف هذا الاجتماع؟')) return

    try {
      await deleteScheduledMeeting(meetingId)
      setScheduledMeetings(prev => prev.filter(m => m.id !== meetingId))
      showToast('تم إلغاء وحذف الاجتماع بنجاح.', 'success')
    } catch (err: any) {
      showToast(err.message || 'فشل حذف الاجتماع', 'error')
    }
  }

  // فتح نافذة تأكيد إقامة الاجتماع
  const openConfirmHeldModal = (meetingId: string, title: string) => {
    setConfirmHeldMeetingId(meetingId)
    setConfirmHeldTitle(title)
    setConfirmHeldHours(0)
    setConfirmHeldMinutes(0)
    setIsConfirmHeldOpen(true)
  }

  // إرسال تأكيد إقامة الاجتماع
  const handleConfirmHeldSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!confirmHeldMeetingId) return

    const totalMinutes = (confirmHeldHours * 60) + confirmHeldMinutes
    setIsSavingHeldConfirm(true)
    try {
      await markMeetingAsHeld(confirmHeldMeetingId, totalMinutes)
      showToast('تم تأكيد إقامة الاجتماع وحفظ مدته بنجاح! 🎉', 'success')
      
      // تحديث قوائم الاجتماعات
      const updatedMeetings = await getScheduledMeetings()
      setScheduledMeetings(updatedMeetings)
      fetchHeldMeetings()
      
      setIsConfirmHeldOpen(false)
      setConfirmHeldMeetingId(null)
    } catch (err: any) {
      showToast(err.message || 'حدث خطأ أثناء تأكيد إقامة الاجتماع', 'error')
    } finally {
      setIsSavingHeldConfirm(false)
    }
  }

  // تنسيق مؤقت العد التنازلي
  const getCountdownString = (dateStr: string, timeStr: string) => {
    const target = new Date(`${dateStr}T${timeStr}`)
    const diff = target.getTime() - currentTime.getTime()

    if (diff <= 0) return 'بدأ الآن 🟢'

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    const parts = []
    if (days > 0) parts.push(`${days} ي`)
    if (hours > 0) parts.push(`${hours} سا`)
    parts.push(`${minutes} د`)

    return `يبدأ بعد: ${parts.join(' و ')}`
  }

  // تحويل التاريخ لاسم يوم عربي منسق
  const getArabicFormattedDate = (dateStr: string) => {
    const dateObj = new Date(dateStr)
    const dayName = dateObj.toLocaleDateString('ar-EG', { weekday: 'long' })
    const dayNum = dateObj.getDate()
    const monthName = dateObj.toLocaleDateString('ar-EG', { month: 'short' })
    return `${dayName} (${dayNum} ${monthName})`
  }

  // تجميع اللقاءات المنفذة حسب الشهر والسنة
  const getGroupedHeldMeetings = () => {
    const groups: Record<string, ScheduledMeeting[]> = {}
    heldMeetings.forEach(meeting => {
      if (!meeting.meeting_date) return
      const date = new Date(meeting.meeting_date)
      const year = date.getFullYear()
      const monthName = date.toLocaleDateString('ar-EG', { month: 'long' })
      const key = `${monthName} ${year}`
      if (!groups[key]) {
        groups[key] = []
      }
      groups[key].push(meeting)
    })
    return groups
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <section className="space-y-6 animate-modal-in">
          
          <div className="border-b border-theme-border pb-5 text-right flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-theme-text">تنسيق المتاحية والاجتماعات</h1>
              <p className="text-xs text-theme-text-muted mt-1">
                حدد متاحيتك الأسبوعية، واعرض أوقات توافق الفريق للتصويت وجدولة لقاءات العمل.
              </p>
            </div>
            
            {/* أزرار التبويبات الملتزمة بنسبة 100% بالهوية البصرية والبراند للمشروع */}
            <div className="flex flex-wrap items-center gap-2 pb-2 text-right w-full sm:w-auto">
              <button 
                onClick={() => setActiveTab('my-availability')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  activeTab === 'my-availability' 
                    ? 'bg-theme-accent text-theme-panel shadow-md shadow-theme-accent/15 border-transparent' 
                    : 'bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text border-theme-border'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>جدول توفري الأسبوعي</span>
              </button>
              <button 
                onClick={() => setActiveTab('team-meetings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  activeTab === 'team-meetings' 
                    ? 'bg-theme-accent text-theme-panel shadow-md shadow-theme-accent/15 border-transparent' 
                    : 'bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text border-theme-border'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>اجتماعات وتنسيق الفريق</span>
                {activePolls.length > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.5 rounded-full shrink-0 font-bold animate-pulse">
                    {activePolls.length}
                  </span>
                )}
              </button>
              <button 
                onClick={() => setActiveTab('held-meetings')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border flex items-center gap-1.5 ${
                  activeTab === 'held-meetings' 
                    ? 'bg-theme-accent text-theme-panel shadow-md shadow-theme-accent/15 border-transparent' 
                    : 'bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text border-theme-border'
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                <span>سجل اللقاءات المنفذة</span>
              </button>
            </div>
          </div>

          {/* تبويب متاحية المستخدم الفردية */}
          {activeTab === 'my-availability' && (
            <div className="space-y-6">
              {/* دليل الألوان والأزرار السريعة */}
              <div className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-right">
                <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-theme-text">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-emerald-500"></span>
                    <span>متاح للعمل (أخضر)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-amber-400"></span>
                    <span>متوقع / محتمل (أصفر)</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3.5 h-3.5 rounded-md bg-rose-500/10 border border-rose-500/20"></span>
                    <span>غير متاح (أحمر)</span>
                  </span>
                </div>

                <div className="flex items-center gap-2 text-[10px] text-theme-text-muted leading-relaxed max-w-md">
                  <Info className="w-4 h-4 text-theme-text-muted shrink-0" />
                  <span>جدول المتاحية ثابت أسبوعياً، ويمكن للأعضاء والمدير رؤية توافق الأوقات لتنظيم لقاءات العمل.</span>
                </div>
              </div>

              {/* شبكة المتاحية الأسبوعية */}
              <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm overflow-x-auto scrollbar-hide">
                <div className="min-w-[800px] space-y-4">
                  {/* ترويسة الساعات */}
                  <div className="flex items-center text-center text-[10px] text-theme-text-muted font-bold border-b border-theme-border pb-2">
                    <div className="w-24 shrink-0 text-right pr-2">اليوم / الساعة</div>
                    <div className="flex-grow grid gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                      {Array.from({ length: 24 }).map((_, hour) => (
                        <div key={hour} className="py-1">
                          {String(hour).padStart(2, '0')}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* أسطر الأيام */}
                  {daysOfWeekArabic.map((dayName, dayIndex) => (
                    <div key={dayIndex} className="flex items-center py-1 group">
                      
                      <div className="w-24 shrink-0 text-right flex flex-col justify-center">
                        <span className="text-xs font-bold text-theme-text">{dayName}</span>
                        <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button 
                            onClick={() => fillDayStatus(dayIndex, 'available')}
                            className="text-[8px] bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/40 border border-emerald-500/10 px-1.5 py-0.5 rounded cursor-pointer font-bold transition-colors"
                            title="تعبئة اليوم كمتاح"
                          >
                            متاح
                          </button>
                          <button 
                            onClick={() => fillDayStatus(dayIndex, 'unavailable')}
                            className="text-[8px] bg-rose-950/20 text-rose-400 hover:bg-rose-950/40 border border-rose-500/10 px-1.5 py-0.5 rounded cursor-pointer font-bold transition-colors"
                            title="تعبئة اليوم كغير متاح"
                          >
                            إلغاء
                          </button>
                        </div>
                      </div>

                      {/* مربعات الـ 24 ساعة */}
                      <div className="flex-grow grid gap-1" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                        {Array.from({ length: 24 }).map((_, hour) => {
                          const key = `${dayIndex}-${hour}`
                          const status = availabilityMap[key] || 'unavailable'
                          const classes = statusStyles[status]
                          
                          return (
                            <button
                              key={hour}
                              onClick={() => handleSlotClick(dayIndex, hour)}
                              className={`aspect-square rounded-lg border text-[9px] font-bold flex items-center justify-center transition-all cursor-pointer select-none active:scale-95 ${classes}`}
                              title={`يوم ${dayName} | الساعة ${String(hour).padStart(2, '0')}:00 - الحالة: ${statusLabels[status]}`}
                            >
                              {status === 'available' ? '✓' : status === 'maybe' ? '؟' : ''}
                            </button>
                          )
                        })}
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* تبويب اجتماعات الفريق */}
          {activeTab === 'team-meetings' && (
            <div className="space-y-8">
              
              {/* قسم 1: كرت اللقاء القادم المجدول نهائياً */}
              <div className="space-y-3 text-right">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-theme-text-muted flex items-center gap-1.5">
                    <CalendarDays className="w-4 h-4 text-theme-accent" />
                    <span>الاجتماعات المجدولة القادمة</span>
                  </h2>
                </div>

                {scheduledMeetings.length === 0 ? (
                  <div className="bg-theme-panel border border-theme-border rounded-3xl p-8 text-center text-xs text-theme-text-muted">
                    لا توجد اجتماعات مجدولة حالياً.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {scheduledMeetings.map((meeting) => (
                      <div 
                        key={meeting.id} 
                        className="bg-theme-panel border border-theme-border/60 hover:border-theme-accent/30 transition-all rounded-3xl p-5 shadow-sm relative overflow-hidden flex flex-col justify-between"
                      >
                        {/* خط علوي ملون بناءً على نوع الاجتماع */}
                        <div className={`absolute top-0 left-0 right-0 h-1.5 ${meeting.meeting_type === 'online' ? 'bg-theme-accent' : 'bg-amber-500'}`}></div>
                        
                        <div className="space-y-4">
                          <div className="flex items-start justify-between">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              meeting.meeting_type === 'online' 
                                ? 'bg-theme-accent/10 text-theme-text border border-theme-accent/20' 
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}>
                              {meeting.meeting_type === 'online' ? 'جوجل ميت (إجباري)' : 'لقاء كافيه (اختياري)'}
                            </span>

                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] text-theme-text-muted">جدولها: {meeting.creator?.name || 'المنسق'}</span>
                              {isAdmin && (
                                <>
                                  <button 
                                    onClick={() => openEditMeetingModal(meeting)}
                                    className="text-theme-text hover:text-theme-accent p-1 rounded hover:bg-theme-accent/10 transition-colors cursor-pointer"
                                    title="تعديل الاجتماع"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteMeeting(meeting.id)}
                                    className="text-rose-400 hover:text-rose-300 p-1 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="إلغاء الاجتماع"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div>
                            <h3 className="text-base font-bold text-theme-text mt-1">{meeting.title}</h3>
                            <p className="text-xs text-theme-text-muted mt-1 leading-relaxed">{meeting.notes}</p>
                          </div>

                          {/* الموعد والعد التنازلي */}
                          <div className="bg-theme-input p-3.5 rounded-2xl flex flex-col gap-1.5 border border-theme-border">
                            <div className="flex justify-between items-center text-xs font-bold text-theme-text">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5 text-theme-accent" />
                                <span>{getArabicFormattedDate(meeting.meeting_date)}</span>
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-theme-accent" />
                                <span>{meeting.meeting_time.slice(0, 5)}</span>
                              </span>
                            </div>
                            
                            <div className="text-[10px] text-theme-text font-bold flex items-center gap-1.5 mt-1 border-t border-theme-border/50 pt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-theme-accent animate-ping"></span>
                              <span>{getCountdownString(meeting.meeting_date, meeting.meeting_time)}</span>
                            </div>
                          </div>
                        </div>

                        {/* زر الانضمام أو العنوان */}
                        <div className="mt-4 pt-3 border-t border-theme-border/50 flex flex-wrap gap-2 items-center justify-between">
                          {isAdmin && (
                            <button
                              onClick={() => openConfirmHeldModal(meeting.id, meeting.title)}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs py-2 px-3 rounded-xl flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-sm"
                            >
                              <CheckSquare className="w-3.5 h-3.5" />
                              <span>تأكيد عقد الاجتماع</span>
                            </button>
                          )}
                          <div className="flex-1 flex justify-end">
                            {meeting.meeting_type === 'online' ? (
                              <a 
                                href={meeting.location_url || '#'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-theme-accent/15 active:scale-95"
                              >
                                <Video className="w-3.5 h-3.5" />
                                <span>انضمام إلى Google Meet</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            ) : (
                              <a 
                                href={meeting.location_url || '#'} 
                                target="_blank" 
                                rel="noreferrer"
                                className="bg-amber-500 hover:bg-amber-400 text-neutral-900 font-bold text-xs py-2 px-4 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-amber-500/10 active:scale-95"
                              >
                                <MapPin className="w-3.5 h-3.5" />
                                <span>عرض موقع الكافيه</span>
                                <ExternalLink className="w-3 h-3 shrink-0" />
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* قسم 2: استطلاعات التصويت النشطة حالياً */}
              <div className="space-y-3 text-right">
                <h2 className="text-sm font-bold text-theme-text-muted flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-theme-accent" />
                  <span>التصويتات المفتوحة للفريق</span>
                </h2>

                {activePolls.length === 0 ? (
                  <div className="bg-theme-panel border border-theme-border rounded-3xl p-8 text-center text-xs text-theme-text-muted">
                    لا توجد استطلاعات تصويت نشطة حالياً.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activePolls.map((poll) => {
                      const userVotes = selectedVotes[poll.id] || []
                      const isSaving = votingMapLoading[poll.id]

                      return (
                        <div key={poll.id} className="bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm space-y-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h3 className="text-lg font-bold text-theme-text">{poll.title}</h3>
                              <p className="text-[10px] text-theme-text-muted mt-0.5">
                                نوع الاجتماع المُرتقب: {poll.meeting_type === 'online' ? 'جوجل ميت (أونلاين)' : 'لقاء حضوري'}
                              </p>
                            </div>
                            <span className="text-[9px] bg-theme-accent/10 border border-theme-border text-theme-text px-2 py-0.5 rounded-full font-bold">
                              نشط للتصويت
                            </span>
                          </div>

                          {/* الخيارات للتصويت */}
                          <div className="grid grid-cols-1 gap-3">
                            {poll.options.map((opt) => {
                              const isChecked = userVotes.includes(opt.id)
                              const optVotes = opt.votes || []
                              const percent = teamProfiles.length > 0 ? Math.round((optVotes.length / teamProfiles.length) * 100) : 0

                              return (
                                <div 
                                  key={opt.id}
                                  onClick={() => handleToggleVoteOption(poll.id, opt.id)}
                                  className={`border p-3.5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-3 cursor-pointer select-none transition-all ${
                                    isChecked 
                                      ? 'bg-theme-accent/10 border-theme-accent' 
                                      : 'bg-theme-input/40 border-theme-border hover:bg-theme-input/60'
                                  }`}
                                >
                                  {/* التاريخ والتصويت */}
                                  <div className="flex items-center gap-3">
                                    <div className={`w-5 h-5 rounded-lg border flex items-center justify-center shrink-0 transition-all ${
                                      isChecked ? 'bg-theme-accent border-theme-accent text-theme-panel' : 'border-neutral-600 text-transparent'
                                    }`}>
                                      <Check className="w-3.5 h-3.5 stroke-[3px]" />
                                    </div>

                                    <div>
                                      <span className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-theme-accent shrink-0" />
                                        <span>{getArabicFormattedDate(opt.proposed_date)}</span>
                                      </span>
                                      <span className="text-[11px] text-theme-text-muted flex items-center gap-1.5 mt-0.5">
                                        <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                                        <span>{opt.proposed_time.slice(0, 5)}</span>
                                      </span>
                                    </div>
                                  </div>

                                  {/* الأصوات والتقدم والأعضاء */}
                                  <div className="flex items-center gap-3 md:self-center shrink-0">
                                    {/* قائمة الآفاتارات الفاخرة للذين صوتوا */}
                                    <div className="flex -space-x-1.5 overflow-hidden justify-end">
                                      {optVotes.map((v) => (
                                        <img 
                                          key={v.id}
                                          src={v.profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'} 
                                          alt={v.profile.name}
                                          title={v.profile.name}
                                          className="w-5 h-5 rounded-full border border-theme-panel object-cover shrink-0"
                                        />
                                      ))}
                                    </div>

                                    {/* نسبة وعدد الأصوات */}
                                    <div className="text-left md:text-right shrink-0">
                                      <span className="text-xs font-bold text-theme-text">{optVotes.length} أصوات</span>
                                      <div className="w-24 bg-theme-bg rounded-full h-1 mt-1 overflow-hidden">
                                        <div className="bg-theme-accent h-1 transition-all" style={{ width: `${percent}%` }}></div>
                                      </div>
                                    </div>

                                    {/* زر الجدولة السريع للأدمن */}
                                    {isAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          openScheduleModal(poll, opt)
                                        }}
                                        className="bg-theme-accent/20 text-theme-text border border-theme-accent/10 hover:bg-theme-accent hover:text-theme-panel px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer shrink-0"
                                      >
                                        جدولة هذا الموعد
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>

                          <div className="flex justify-end pt-2 border-t border-theme-border/40">
                            <button
                              onClick={() => handleSaveVotes(poll.id)}
                              disabled={isSaving}
                              className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold text-xs py-2 px-5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-theme-accent/15 cursor-pointer active:scale-95"
                            >
                              {isSaving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5" />
                              )}
                              <span>حفظ أصواتي وتحديثها</span>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* قسم 3: أدوات المشرف (إنشاء تصويت، توافق الأعضاء) */}
              {isAdmin && (
                <div className="border-t border-theme-border/60 pt-8 space-y-8">
                  <div className="border-b border-theme-border pb-3">
                    <h2 className="text-lg font-bold text-theme-text flex items-center gap-1.5">
                      <ShieldCheck className="w-5 h-5 text-theme-accent" />
                      <span>صلاحيات المشرف والتنسيق الذكي</span>
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* A. نموذج إطلاق تصويت جديد */}
                    <div className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-sm space-y-4 lg:col-span-1 text-right flex flex-col justify-between">
                      <form onSubmit={handleCreatePoll} className="space-y-4">
                        <div className="flex items-center gap-1.5 text-xs font-bold text-theme-text">
                          <Plus className="w-4 h-4 text-theme-accent" />
                          <span>إطلاق تصويت أسبوعي جديد</span>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-theme-text-muted">عنوان الاستطلاع</label>
                          <input 
                            type="text"
                            placeholder="مثال: موعد جوجل ميت للأسبوع 26"
                            value={newPollTitle}
                            onChange={(e) => setNewPollTitle(e.target.value)}
                            className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-accent transition-colors"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-theme-text-muted">نوع اللقاء</label>
                          <select 
                            value={newPollType}
                            onChange={(e) => setNewPollType(e.target.value as any)}
                            className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-accent transition-colors"
                          >
                            <option value="online">جوجل ميت (أونلاين)</option>
                            <option value="offline">لقاء كافيه (حضوري)</option>
                          </select>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-bold text-theme-text-muted flex justify-between">
                            <span>خيارات المواعيد المقترحة</span>
                            <button 
                              type="button" 
                              onClick={addPollOptionRow}
                              className="text-[9px] text-theme-accent hover:text-theme-accent-hover font-bold flex items-center gap-0.5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>إضافة خيار</span>
                            </button>
                          </label>

                          <div className="space-y-2 pr-1">
                            {newPollOptions.map((opt, idx) => (
                              <div key={idx} className="flex gap-2 items-center">
                                <div className="w-1/2">
                                  <DatePicker 
                                    value={opt.date}
                                    onChange={(val) => handlePollOptionChange(idx, 'date', val)}
                                    className="w-full"
                                    align="right"
                                  />
                                </div>
                                <input 
                                  type="time"
                                  value={opt.time}
                                  onChange={(e) => handlePollOptionChange(idx, 'time', e.target.value)}
                                  className="w-1/2 bg-theme-input border border-theme-border rounded-lg p-1.5 text-[10px] text-theme-text focus:outline-none focus:border-theme-accent"
                                />
                                {newPollOptions.length > 1 && (
                                  <button 
                                    type="button"
                                    onClick={() => removePollOptionRow(idx)}
                                    className="text-rose-400 hover:text-rose-300 p-1 shrink-0 cursor-pointer"
                                  >
                                    <XCircle className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={loading}
                          className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-50 text-theme-panel font-bold text-xs py-2.5 rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-md shadow-theme-accent/15 cursor-pointer"
                        >
                          {loading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Send className="w-3.5 h-3.5" />
                          )}
                          <span>فتح التصويت وإبلاغ الأعضاء</span>
                        </button>
                      </form>
                    </div>

                    {/* B. جدول التوافق التلقائي للشركاء (Heatmap) */}
                    <div className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-sm lg:col-span-2 text-right flex flex-col justify-between space-y-4">
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-xs font-bold text-theme-text">
                            <Sparkles className="w-4 h-4 text-emerald-400" />
                            <span>محلل التوافق التلقائي وجداول الأعضاء (Heatmap)</span>
                          </span>
                          <span className="text-[10px] text-theme-text-muted">
                            تحليل تقاطعي للمتاحية الأسبوعية الثابتة
                          </span>
                        </div>

                        <div className="bg-theme-panel border border-theme-border rounded-2xl p-3.5 flex flex-wrap gap-3 items-center text-[10px] font-bold text-theme-text mt-3">
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                            <span>100% متوافق</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-500/70"></span>
                            <span>75% متوافق</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-emerald-500/40"></span>
                            <span>50% متوافق</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-amber-500/20"></span>
                            <span>25% متوافق</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2.5 h-2.5 rounded bg-rose-500/10"></span>
                            <span>&lt;25% متوافق</span>
                          </span>
                        </div>

                        {/* شبكة التحليل */}
                        <div className="overflow-x-auto scrollbar-hide mt-3 max-h-[220px] overflow-y-auto pr-1">
                          <div className="min-w-[700px] space-y-2 pb-2">
                            {/* ترويسة الساعات */}
                            <div className="flex items-center text-center text-[8px] text-theme-text-muted font-bold border-b border-theme-border/50 pb-1">
                              <div className="w-20 shrink-0 text-right pr-2">اليوم / الساعة</div>
                              <div className="flex-grow grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                {Array.from({ length: 24 }).map((_, hour) => (
                                  <div key={hour} className="py-0.5">
                                    {String(hour).padStart(2, '0')}
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* أسطر الأيام */}
                            {daysOfWeekArabic.map((dayName, dayIndex) => (
                              <div key={dayIndex} className="flex items-center py-0.5">
                                <div className="w-20 shrink-0 text-right">
                                  <span className="text-[10px] font-bold text-theme-text">{dayName}</span>
                                </div>
                                <div className="flex-grow grid gap-0.5" style={{ gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                                  {Array.from({ length: 24 }).map((_, hour) => {
                                    const compat = getCellCompatibility(dayIndex, hour)
                                    const colorClass = getHeatmapColorClass(compat.percentage)
                                    const isSelected = selectedHeatmapCell?.day === dayIndex && selectedHeatmapCell?.hour === hour

                                    return (
                                      <button
                                        key={hour}
                                        onClick={() => setSelectedHeatmapCell({ day: dayIndex, hour })}
                                        className={`aspect-square rounded border text-[7px] font-bold flex items-center justify-center transition-all cursor-pointer ${colorClass} ${
                                          isSelected ? 'ring-2 ring-theme-accent scale-105' : 'hover:scale-105'
                                        }`}
                                        title={`يوم ${dayName} | الساعة ${String(hour).padStart(2, '0')}:00\nالتوافق: ${compat.percentage}% (${compat.count}/${teamProfiles.length} أعضاء)`}
                                      >
                                        {compat.count > 0 ? compat.count : ''}
                                      </button>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* تفاصيل الخلية المحددة */}
                      <div className="bg-theme-input p-4 border border-theme-border rounded-2xl text-xs space-y-2 mt-2">
                        {selectedHeatmapCell ? (
                          (() => {
                            const { day, hour } = selectedHeatmapCell
                            const compat = getCellCompatibility(day, hour)
                            return (
                              <div className="space-y-2 text-right">
                                <div className="flex justify-between items-center text-xs font-bold border-b border-theme-border/60 pb-1.5">
                                  <span className="text-theme-accent">التفاصيل المتقاطعة</span>
                                  <span className="text-theme-text">يوم {daysOfWeekArabic[day]} | الساعة {String(hour).padStart(2, '0')}:00</span>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-[11px] leading-relaxed">
                                  <div className="space-y-1">
                                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                      <span>متاحون ({compat.available.length}):</span>
                                    </span>
                                    {compat.available.length === 0 ? (
                                      <p className="text-theme-text-muted text-[10px]">لا أحد</p>
                                    ) : (
                                      <p className="text-theme-text font-semibold">{compat.available.map(p => p.name).join('، ')}</p>
                                    )}

                                    {compat.maybe.length > 0 && (
                                      <div className="pt-1.5">
                                        <span className="text-amber-400 font-bold flex items-center gap-1">
                                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                          <span>محتمل ({compat.maybe.length}):</span>
                                        </span>
                                        <p className="text-theme-text font-semibold">{compat.maybe.map(p => p.name).join('، ')}</p>
                                      </div>
                                    )}
                                  </div>

                                  <div className="space-y-1">
                                    <span className="text-rose-400 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                      <span>غير متاحين ({compat.unavailable.length}):</span>
                                    </span>
                                    {compat.unavailable.length === 0 ? (
                                      <p className="text-theme-text-muted text-[10px]">لا أحد (توافق كامل!)</p>
                                    ) : (
                                      <p className="text-theme-text-muted font-semibold">{compat.unavailable.map(p => p.name).join('، ')}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          })()
                        ) : (
                          <p className="text-center text-[10px] text-theme-text-muted py-2">
                            انقر على أي ساعة في جدول التحليل الذكي أعلاه لعرض أسماء المتاحين والمشغولين فيها وتوفير الوقت!
                          </p>
                        )}
                      </div>

                    </div>

                  </div>
                </div>
              )}

            </div>
          )}

          {activeTab === 'held-meetings' && (
            <div className="space-y-6 animate-modal-in">
              <div className="bg-theme-panel border border-theme-border rounded-3xl p-6 shadow-sm text-right space-y-4">
                <div className="flex items-center justify-between border-b border-theme-border/60 pb-3">
                  <div>
                    <h2 className="text-base font-bold text-theme-text flex items-center gap-1.5">
                      <Award className="w-5 h-5 text-theme-accent" />
                      <span>سجل اللقاءات والاجتماعات المنفذة</span>
                    </h2>
                    <p className="text-[10px] text-theme-text-muted mt-1">
                      جدول توثيقي لجميع الاجتماعات التي عقدها الفريق ومقدار وقت العمل المنقضي بها.
                    </p>
                  </div>
                </div>

                {heldMeetings.length === 0 ? (
                  <div className="text-center text-xs text-theme-text-muted py-12">
                    لا توجد اجتماعات منفذة مسجلة في الأرشيف حالياً.
                  </div>
                ) : (
                  <div className="space-y-8">
                    {Object.entries(getGroupedHeldMeetings()).map(([monthKey, meetingsList]) => (
                      <div key={monthKey} className="space-y-3">
                        <h3 className="text-xs font-black text-theme-accent bg-theme-accent/5 border border-theme-accent/15 px-3 py-1.5 rounded-lg inline-block">
                          {monthKey}
                        </h3>

                        <div className="overflow-x-auto rounded-2xl border border-theme-border">
                          <table className="w-full text-right border-collapse text-xs">
                            <thead>
                              <tr className="bg-theme-bg/60 text-theme-text-muted font-bold border-b border-theme-border">
                                <th className="p-3.5">عنوان الاجتماع</th>
                                <th className="p-3.5">النوع</th>
                                <th className="p-3.5">التاريخ والوقت</th>
                                <th className="p-3.5">مدة الاجتماع</th>
                                <th className="p-3.5">المنسق</th>
                                <th className="p-3.5">ملاحظات</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-theme-border/50 text-theme-text">
                              {meetingsList.map((m) => (
                                <tr key={m.id} className="hover:bg-theme-bg/30 transition-colors">
                                  <td className="p-3.5 font-bold">{m.title}</td>
                                  <td className="p-3.5">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                      m.meeting_type === 'online' 
                                        ? 'bg-theme-accent/10 text-theme-text' 
                                        : 'bg-amber-500/10 text-amber-500'
                                    }`}>
                                      {m.meeting_type === 'online' ? 'أونلاين' : 'حضوري'}
                                    </span>
                                  </td>
                                  <td className="p-3.5 font-medium">
                                    {getArabicFormattedDate(m.meeting_date)} | {m.meeting_time.slice(0, 5)}
                                  </td>
                                  <td className="p-3.5 font-bold text-theme-accent">
                                    {m.duration_minutes ? (
                                      <>
                                        {Math.floor(m.duration_minutes / 60) > 0 && `${Math.floor(m.duration_minutes / 60)}س `}
                                        {m.duration_minutes % 60}د
                                      </>
                                    ) : 'غير محدد'}
                                  </td>
                                  <td className="p-3.5">
                                    <div className="flex items-center gap-1.5">
                                      <img 
                                        src={m.creator?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde'} 
                                        className="w-5 h-5 rounded-full object-cover"
                                        alt=""
                                      />
                                      <span>{m.creator?.name || 'المنسق'}</span>
                                    </div>
                                  </td>
                                  <td className="p-3.5 text-theme-text-muted max-w-xs truncate" title={m.notes || ''}>
                                    {m.notes || '-'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </section>
      </main>

      {/* مودال تأكيد إقامة الاجتماع وتسجيل مدته */}
      {isConfirmHeldOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-panel border border-theme-border rounded-[2rem] w-full max-w-md p-6 sm:p-8 space-y-6 text-right animate-modal-in shadow-2xl relative">
            <button 
              onClick={() => { setIsConfirmHeldOpen(false); setConfirmHeldMeetingId(null); }}
              className="absolute top-6 left-6 p-2 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-full transition-all cursor-pointer"
            >
              ✕
            </button>

            <div className="text-center">
              <h3 className="text-lg font-black text-theme-text mb-2">تأكيد إقامة الاجتماع</h3>
              <p className="text-xs text-theme-text-muted">
                هل تم بالفعل عقد الاجتماع: <strong className="text-theme-text">{confirmHeldTitle}</strong>؟
              </p>
            </div>

            <form onSubmit={handleConfirmHeldSubmit} className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted text-center mb-4">
                  كم استغرقت مدة الاجتماع الفعلية؟
                </label>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <label className="block text-[10px] font-bold text-theme-text-muted mb-2">عدد الساعات</label>
                    <input 
                      type="number"
                      min={0}
                      max={24}
                      value={confirmHeldHours}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setConfirmHeldHours(Math.min(24, Math.max(0, val)))
                      }}
                      className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-2xl py-3 text-base font-black outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div className="text-center">
                    <label className="block text-[10px] font-bold text-theme-text-muted mb-2">عدد الدقائق</label>
                    <input 
                      type="number"
                      min={0}
                      max={59}
                      value={confirmHeldMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setConfirmHeldMinutes(Math.min(59, Math.max(0, val)))
                      }}
                      className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-2xl py-3 text-base font-black outline-none transition-all"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <button
                  type="submit"
                  disabled={isSavingHeldConfirm}
                  className="w-full bg-[#10b981] hover:bg-[#059669] text-white font-extrabold py-3.5 rounded-2xl text-xs transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  {isSavingHeldConfirm ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ والتأكيد...</span>
                    </>
                  ) : (
                    <span>تأكيد عقد اللقاء وحفظ المدة ⏱️✓</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsConfirmHeldOpen(false); setConfirmHeldMeetingId(null); }}
                  className="w-full bg-theme-input hover:bg-theme-border text-theme-text font-bold py-3 rounded-2xl text-xs transition-colors cursor-pointer text-center"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* مودال اعتماد وجدولة الاجتماع النهائي */}
      {scheduleModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-md p-6 space-y-4 text-right animate-modal-in">
            <div className="flex justify-between items-start border-b border-theme-border pb-3">
              <button 
                onClick={() => setScheduleModal(prev => ({ ...prev, isOpen: false }))}
                className="text-neutral-500 hover:text-theme-text cursor-pointer p-0.5 rounded"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-theme-text flex items-center gap-1.5">
                <CalendarDays className="w-5 h-5 text-theme-accent" />
                <span>{scheduleModal.meetingId ? 'تعديل تفاصيل الاجتماع المجدول' : 'اعتماد وجدولة الاجتماع النهائي'}</span>
              </h3>
            </div>

            <form onSubmit={handleScheduleMeeting} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-theme-text-muted">اسم الاجتماع</label>
                <input 
                  type="text"
                  placeholder="مثال: اللقاء الأسبوعي السريع"
                  value={scheduleModal.title}
                  onChange={(e) => setScheduleModal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-theme-text-muted">تاريخ الاجتماع</label>
                  <DatePicker 
                    value={scheduleModal.date}
                    onChange={(val) => setScheduleModal(prev => ({ ...prev, date: val }))}
                    className="w-full"
                    align="right"
                    direction="up"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-theme-text-muted">وقت الاجتماع</label>
                  <input 
                    type="time"
                    value={scheduleModal.time}
                    onChange={(e) => setScheduleModal(prev => ({ ...prev, time: e.target.value }))}
                    className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2.5 text-xs text-theme-text focus:outline-none focus:border-theme-accent"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-theme-text-muted">
                  {scheduleModal.meetingType === 'online' ? 'رابط Google Meet' : 'عنوان الكافيه / خرائط Google'}
                </label>
                <input 
                  type="url"
                  placeholder={scheduleModal.meetingType === 'online' ? 'https://meet.google.com/xxx-xxxx-xxx' : 'https://maps.google.com/...'}
                  value={scheduleModal.locationUrl}
                  onChange={(e) => setScheduleModal(prev => ({ ...prev, locationUrl: e.target.value }))}
                  className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-theme-text-muted">ملاحظات الاجتماع</label>
                <textarea 
                  rows={3}
                  placeholder="ملاحظات أو أجندة الاجتماع للشركاء..."
                  value={scheduleModal.notes}
                  onChange={(e) => setScheduleModal(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full bg-theme-input border border-theme-border rounded-xl px-3 py-2 text-xs text-theme-text focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setScheduleModal(prev => ({ ...prev, isOpen: false }))}
                  className="bg-neutral-800 text-theme-text hover:bg-neutral-700 font-bold text-xs py-2 px-4 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="bg-theme-accent hover:bg-theme-accent-hover disabled:opacity-50 text-theme-panel font-bold text-xs py-2 px-5 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-theme-accent/15 cursor-pointer"
                >
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{scheduleModal.meetingId ? 'حفظ التعديلات' : 'اعتماد الموعد وجدولته'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* عرض التنبيهات */}
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  )
}
