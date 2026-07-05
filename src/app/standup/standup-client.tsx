'use client'

import { useState, useEffect, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import { 
  MessageSquare, 
  Star, 
  Loader2, 
  Send, 
  User, 
  Users,
  AlertOctagon, 
  CheckCircle2, 
  Calendar, 
  AlertCircle,
  HelpCircle,
  Trash2,
  TrendingUp,
  Bell,
  BellOff,
  XCircle,
  Pencil
} from 'lucide-react'
import { 
  getDailyStandups, submitDailyStandup, deleteDailyStandup, 
  savePushSubscription, deletePushSubscription,
  toggleStandupReaction, addStandupComment, deleteStandupComment,
  updateStandupComment
} from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Standup {
  id: string
  user_id: string
  date: string
  today_tasks: string
  tomorrow_tasks: string
  blockers: string | null
  mood: 'energetic' | 'stable' | 'tired' | 'stressed'
  progress_rate: 'all' | 'most' | 'half' | 'low'
  productivity_score: number
  work_minutes?: number
  created_at: string
  milestone_id?: string | null
  milestone?: {
    id: string
    title: string
  } | null
  user: {
    name: string
    email: string
    avatar_url: string
  }
  reactions?: {
    user_id: string
    reaction_type: string
  }[]
  comments?: {
    id: string
    user_id: string
    parent_id: string | null
    content: string
    created_at: string
    user: {
      name: string
      avatar_url: string
    }
  }[]
}

interface Milestone {
  id: string
  title: string
  status: string
}

interface StandupClientProps {
  currentProfile: Profile
  teamProfiles: Profile[]
  initialMilestones: Milestone[]
}

const moodMap = {
  energetic: { label: 'طاقة عالية 🚀', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  stable: { label: 'طبيعي ومستقر 😊', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  tired: { label: 'متعب 🥱', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  stressed: { label: 'مضغوط جداً 🤯', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' }
}

const progressMap = {
  all: { label: 'أنجزت كل المخطط 💯', color: 'bg-emerald-500/10 text-emerald-500' },
  most: { label: 'أنجزت معظم المخطط 🔄', color: 'bg-sky-500/10 text-sky-500' },
  half: { label: 'أنجزت نصف المخطط ⏳', color: 'bg-amber-500/10 text-amber-500' },
  low: { label: 'واجهت صعوبات ⚠️', color: 'bg-rose-500/10 text-rose-500' }
}

export default function StandupClient({ currentProfile, teamProfiles, initialMilestones }: StandupClientProps) {
  const [milestones] = useState<Milestone[]>(initialMilestones || [])
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date()
    return today.toISOString().split('T')[0]
  })

  const [standups, setStandups] = useState<Standup[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  // حالة النموذج
  const [todayTasks, setTodayTasks] = useState('')
  const [tomorrowTasks, setTomorrowTasks] = useState('')
  const [blockers, setBlockers] = useState('')
  const [mood, setMood] = useState<'energetic' | 'stable' | 'tired' | 'stressed'>('stable')
  const [progressRate, setProgressRate] = useState<'all' | 'most' | 'half' | 'low'>('most')
  const [productivityScore, setProductivityScore] = useState(5)
  const [hoveredStar, setHoveredStar] = useState<number | null>(null)
  const [workHours, setWorkHours] = useState<number>(0)
  const [workMinutes, setWorkMinutes] = useState<number>(0)
  const [isFormVisible, setIsFormVisible] = useState(false)
  const [hasExistingReport, setHasExistingReport] = useState(false)
  const [milestoneId, setMilestoneId] = useState<string>('')

  // حالات إشعارات الويب اللحظية
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)

  // حالات المودال التفاعلي والتعليقات
  const [activeStandupForModal, setActiveStandupForModal] = useState<Standup | null>(null)
  const [mainCommentContent, setMainCommentContent] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null)
  const [commentPending, setCommentPending] = useState(false)
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null)
  const [editingCommentContent, setEditingCommentContent] = useState('')

  // التحقق من حالة اشتراك الإشعارات للجهاز الحالي عند التحميل
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      return
    }

    navigator.serviceWorker.ready.then((registration) => {
      registration.pushManager.getSubscription().then((subscription) => {
        setIsSubscribed(!!subscription)
      })
    })
  }, [])

  // دالة تحويل مفتاح VAPID العام إلى الصيغة الرقمية المناسبة
  function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')
    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
  }

  // تفعيل أو إلغاء تفعيل الإشعارات
  const handleNotificationToggle = async () => {
    // التحقق مما إذا كان التطبيق يعمل داخل Capacitor (بيئة هجينة)
    const isCapacitor = typeof window !== 'undefined' && (window as any).Capacitor;
    if (isCapacitor) {
      showToast('إشعارات الويب لا تعمل داخل التطبيقات المعبأة (Capacitor). سيتم دعم الإشعارات الأصلية تلقائياً بمجرد ربط التطبيق بـ Firebase ورفعه للمتاجر.', 'warning');
      return;
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      showToast('جهازك أو متصفحك الحالي لا يدعم إشعارات الويب اللحظية.', 'warning')
      return
    }

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      showToast('يرجى تمكين صلاحية الإشعارات لموقعنا من إعدادات متصفحك أولاً.', 'warning')
      return
    }

    try {
      setIsSubscribing(true)
      const registration = await navigator.serviceWorker.ready
      
      if (isSubscribed) {
        // إلغاء تفعيل الاشتراك الحالي
        const subscription = await registration.pushManager.getSubscription()
        if (subscription) {
          await subscription.unsubscribe()
          await deletePushSubscription(subscription.endpoint)
        }
        setIsSubscribed(false)
        showToast('تم إلغاء تفعيل إشعارات اللقاء اليومي بنجاح.', 'success')
      } else {
        // تفعيل اشتراك جديد
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
        if (!vapidPublicKey) {
          throw new Error('مفتاح إشعارات الويب العام VAPID_PUBLIC_KEY غير متوفر.')
        }

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
        })

        await savePushSubscription(JSON.parse(JSON.stringify(subscription)))
        setIsSubscribed(true)
        showToast('تم تفعيل إشعارات اللقاء اليومي على هذا الجهاز بنجاح! 🔔', 'success')
      }
    } catch (err: any) {
      console.error('فشل معالجة اشتراك الإشعارات:', err)
      showToast('فشل تفعيل الإشعارات: ' + err.message, 'error')
    } finally {
      setIsSubscribing(false)
    }
  }

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // جلب تقارير اليوم المختار
  const fetchStandups = async (dateStr: string) => {
    try {
      setIsLoading(true)
      const data = await getDailyStandups(dateStr)
      setStandups(data as Standup[])

      // البحث عن تقرير المستخدم الحالي لتعبئة النموذج تلقائياً
      const myStandup = (data as Standup[]).find(s => s.user_id === currentProfile.id)
      
      // التحقق من وجود دقائق معلقة قادمة من العداد
      let additionalMinutes = 0
      try {
        const pending = localStorage.getItem('pending_chrono_minutes')
        if (pending) {
          additionalMinutes = parseInt(pending, 10)
          setIsFormVisible(true)
          localStorage.removeItem('pending_chrono_minutes')
        }
      } catch (e) {}

      if (myStandup) {
        setTodayTasks(myStandup.today_tasks)
        setTomorrowTasks(myStandup.tomorrow_tasks)
        setBlockers(myStandup.blockers || '')
        setMood(myStandup.mood)
        setProgressRate(myStandup.progress_rate)
        setProductivityScore(myStandup.productivity_score)
        setMilestoneId(myStandup.milestone_id || '')
        const totalMins = (myStandup.work_minutes || 0) + additionalMinutes
        setWorkHours(Math.floor(totalMins / 60))
        setWorkMinutes(totalMins % 60)
        setHasExistingReport(true)
      } else {
        // تفريغ النموذج إذا لم يكن هناك تقرير سابق في هذا اليوم
        setTodayTasks('')
        setTomorrowTasks('')
        setBlockers('')
        setMood('stable')
        setProgressRate('most')
        setProductivityScore(5)
        setMilestoneId('')
        setWorkHours(Math.floor(additionalMinutes / 60))
        setWorkMinutes(additionalMinutes % 60)
        setHasExistingReport(false)
      }
    } catch (err: any) {
      showToast('فشل تحميل التقارير: ' + err.message, 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchStandups(selectedDate)
  }, [selectedDate])

  // الاستماع لأي نقل لوقت العداد بشكل مباشر أثناء فتح الصفحة
  useEffect(() => {
    const handleTimeTransferred = (e: Event) => {
      const customEvent = e as CustomEvent
      const minutes = customEvent.detail
      if (typeof minutes === 'number' && minutes > 0) {
        setWorkMinutes(prevMins => {
          const totalMins = prevMins + minutes
          setWorkHours(prevHrs => prevHrs + Math.floor(totalMins / 60))
          return totalMins % 60
        })
        setIsFormVisible(true)
        localStorage.removeItem('pending_chrono_minutes')
      }
    }

    window.addEventListener('chrono-time-transferred', handleTimeTransferred)
    return () => {
      window.removeEventListener('chrono-time-transferred', handleTimeTransferred)
    }
  }, [])

  // تأثير لمزامنة الكارت المفتوح بالبوباب مع القائمة المحدثة
  useEffect(() => {
    if (activeStandupForModal) {
      const updated = standups.find(s => s.id === activeStandupForModal.id)
      if (updated) {
        setActiveStandupForModal(updated)
      }
    }
  }, [standups])

  // التفاعلات الثمانية وإيموجياتها وتسمياتها
  const reactionEmojis: Record<string, string> = {
    like: '👍',
    heart: '❤️',
    haha: '😂',
    rocket: '🚀',
    tada: '🎉',
    eyes: '👀',
    angry: '😡',
    alert: '🚨'
  }

  const reactionLabels: Record<string, string> = {
    like: 'أعجبني',
    heart: 'حب',
    haha: 'أضحكني',
    rocket: 'انطلاق',
    tada: 'تهنئة',
    eyes: 'جاري الاطلاع',
    angry: 'أغضبني',
    alert: 'عقبة معطلة'
  }

  // التعامل مع التفاعل بشكل متفائل وفوري (Optimistic & Silent Update)
  const handleToggleReaction = async (standupId: string, reactionType: string) => {
    const previousStandups = [...standups]

    // تحديث الحالة محلياً وفورياً
    setStandups((prevStandups) =>
      prevStandups.map((s) => {
        if (s.id !== standupId) return s

        const currentReactions = s.reactions || []
        const userReactionIdx = currentReactions.findIndex((r) => r.user_id === currentProfile.id)

        let newReactions = [...currentReactions]
        if (userReactionIdx > -1) {
          const existing = currentReactions[userReactionIdx]
          if (existing.reaction_type === reactionType) {
            // إلغاء التفاعل عند الضغط مجدداً
            newReactions.splice(userReactionIdx, 1)
          } else {
            // تعديل التفاعل
            newReactions[userReactionIdx] = {
              user_id: currentProfile.id,
              reaction_type: reactionType
            }
          }
        } else {
          // تفاعل جديد
          newReactions.push({
            user_id: currentProfile.id,
            reaction_type: reactionType
          })
        }

        return {
          ...s,
          reactions: newReactions
        }
      })
    )

    try {
      await toggleStandupReaction(standupId, reactionType)
      // مزامنة صامتة للبيانات من السيرفر دون إشعار المستخدم لإبقاء الأرقام دقيقة
      const data = await getDailyStandups(selectedDate)
      setStandups(data as Standup[])
    } catch (err: any) {
      // التراجع عن التحديث المتفائل في حال الفشل
      setStandups(previousStandups)
      showToast('فشل تسجيل التفاعل: ' + err.message, 'error')
    }
  }

  // التعامل مع إرسال التعليق
  const handleCommentSubmit = async (parentId: string | null = null) => {
    const content = parentId ? replyContent : mainCommentContent
    if (!content.trim() || !activeStandupForModal) return

    try {
      setCommentPending(true)
      await addStandupComment(activeStandupForModal.id, content, parentId)
      if (parentId) {
        setReplyContent('')
        setReplyToCommentId(null)
      } else {
        setMainCommentContent('')
      }
      fetchStandups(selectedDate)
    } catch (err: any) {
      showToast('فشل إرسال التعليق: ' + err.message, 'error')
    } finally {
      setCommentPending(false)
    }
  }

  // حذف تعليق
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا التعليق؟')) return

    try {
      await deleteStandupComment(commentId)
      fetchStandups(selectedDate)
    } catch (err: any) {
      showToast('فشل حذف التعليق: ' + err.message, 'error')
    }
  }

  // تعديل تعليق
  const handleUpdateComment = async (commentId: string) => {
    if (!editingCommentContent.trim()) return

    try {
      setCommentPending(true)
      await updateStandupComment(commentId, editingCommentContent)
      setEditingCommentId(null)
      setEditingCommentContent('')
      fetchStandups(selectedDate)
    } catch (err: any) {
      showToast('فشل تعديل التعليق: ' + err.message, 'error')
    } finally {
      setCommentPending(false)
    }
  }

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!todayTasks.trim() || !tomorrowTasks.trim()) {
      showToast('يرجى ملء الأسئلة الرئيسية للتحديث اليومي', 'warning')
      return
    }

    startTransition(async () => {
      try {
        const totalMinutes = (workHours * 60) + workMinutes
        await submitDailyStandup(
          todayTasks,
          tomorrowTasks,
          blockers,
          mood,
          progressRate,
          productivityScore,
          selectedDate,
          milestoneId || null,
          totalMinutes
        )
        showToast('تم حفظ تحديثك اليومي بنجاح', 'success')
        fetchStandups(selectedDate)
      } catch (err: any) {
        showToast('حدث خطأ أثناء حفظ التحديث: ' + err.message, 'error')
      }
    })
  }

  const handleDeleteReport = () => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف تحديثك اليومي لهذا اليوم؟')) {
      return
    }

    startTransition(async () => {
      try {
        await deleteDailyStandup(selectedDate)
        showToast('تم حذف تحديثك اليومي بنجاح', 'success')
        fetchStandups(selectedDate)
      } catch (err: any) {
        showToast('حدث خطأ أثناء حذف التحديث: ' + err.message, 'error')
      }
    })
  }

  // تصفية الأعضاء الذين شاركوا والذين لم يشاركوا
  const participatingIds = standups.map(s => s.user_id)
  const nonParticipants = teamProfiles.filter(p => !participatingIds.includes(p.id))

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">
          
          {/* العناوين والتحكم بالتاريخ */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-bold text-theme-text">اللقاء اليومي المكتوب (Standup)</h1>
              <p className="text-xs text-theme-text-muted mt-1">مساحة سريعة لمشاركة الإنجازات اليومية، الخطط القادمة، وتنبيه الفريق بأي عقبات تعيق العمل</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 self-stretch md:self-auto w-full md:w-auto justify-end">
              <button
                type="button"
                onClick={handleNotificationToggle}
                disabled={isSubscribing}
                className={`p-2.5 rounded-xl border transition-all flex items-center justify-center shadow-sm cursor-pointer active:scale-95 ${
                  isSubscribed
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/20'
                    : 'bg-theme-panel border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-bg'
                }`}
                title={isSubscribed ? 'إيقاف الإشعارات اللحظية' : 'تفعيل الإشعارات اللحظية على هذا الجهاز'}
              >
                {isSubscribing ? (
                  <Loader2 className="w-4 h-4 animate-spin text-theme-text-muted" />
                ) : isSubscribed ? (
                  <Bell className="w-4 h-4" />
                ) : (
                  <BellOff className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setIsFormVisible(!isFormVisible)}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shadow-sm active:scale-95 ${
                  isFormVisible
                    ? 'bg-theme-text border-theme-text text-theme-panel hover:opacity-90'
                    : 'bg-theme-panel border-theme-border text-theme-text hover:bg-theme-bg'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>{isFormVisible ? 'إخفاء نموذج الإدخال' : 'كتابة تحديثي اليومي'}</span>
              </button>

              <div className="flex items-center gap-2 min-w-[180px]">
                <span className="text-xs font-bold text-theme-text-muted hidden sm:inline whitespace-nowrap">تاريخ التقرير:</span>
                <DatePicker value={selectedDate} onChange={setSelectedDate} className="py-2.5" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* العمود الأيمن: نموذج الكتابة */}
            {isFormVisible && (
              <div className="lg:col-span-5 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm space-y-5 text-right relative overflow-hidden animate-modal-in">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-theme-accent to-theme-accent/40"></div>
              
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-theme-accent" />
                  <span>{hasExistingReport ? 'تعديل تحديثك اليومي' : 'تحديثك اليومي السريع'}</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">اكتب تقرير اليوم للتاريخ المختار ({selectedDate})</p>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-5">
                
                {/* 1. تقييم الإنتاجية الذاتي (1-5 نجوم) */}
                <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 space-y-2">
                  <label className="block text-xs font-bold text-theme-text">1. كيف تقيم إنجازك وإنتاجيتك اليوم؟</label>
                  <div className="flex items-center gap-1.5 justify-start direction-ltr" style={{ direction: 'ltr' }}>
                    {[1, 2, 3, 4, 5].map((star) => {
                      const isLit = hoveredStar !== null ? star <= hoveredStar : star <= productivityScore
                      return (
                        <button
                          key={star}
                          type="button"
                          onClick={() => setProductivityScore(star)}
                          onMouseEnter={() => setHoveredStar(star)}
                          onMouseLeave={() => setHoveredStar(null)}
                          className="p-1 cursor-pointer transition-all duration-150 transform hover:scale-125 focus:outline-none"
                        >
                          <Star 
                            className={`w-6 h-6 ${
                              isLit 
                                ? 'text-amber-500 fill-amber-500 filter drop-shadow-[0_0_2px_rgba(245,158,11,0.4)]' 
                                : 'text-theme-text-muted opacity-40'
                            } transition-colors`}
                          />
                        </button>
                      )
                    })}
                    <span className="text-xs font-bold text-theme-text-muted ml-3 pt-1">
                      {productivityScore} من 5
                    </span>
                  </div>
                </div>

                {/* 2. الحالة المزاجية ومستوى الطاقة */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-theme-text">2. ما هي حالتك المزاجية ومستوى طاقتك اليوم؟</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(moodMap) as Array<keyof typeof moodMap>).map((key) => {
                      const selected = mood === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setMood(key)}
                          className={`flex items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all duration-200 cursor-pointer ${
                            selected 
                              ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                              : 'bg-theme-bg border-theme-border text-theme-text hover:border-theme-border/80'
                          }`}
                        >
                          {moodMap[key].label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3. معدل إنجاز أهداف اليوم */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-theme-text">3. ما مدى تحقيقك لأهداف اليوم المخطط لها؟</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.keys(progressMap) as Array<keyof typeof progressMap>).map((key) => {
                      const selected = progressRate === key
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setProgressRate(key)}
                          className={`flex items-center justify-center p-2.5 rounded-xl border text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                            selected 
                              ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                              : 'bg-theme-bg border-theme-border text-theme-text hover:border-theme-border/80'
                          }`}
                        >
                          {progressMap[key].label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 3.5. عدد ساعات العمل اليومية */}
                <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 space-y-2">
                  <label className="block text-xs font-bold text-theme-text">كم عدد ساعات العمل التي قضيتها اليوم؟</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="number"
                        min={0}
                        max={24}
                        value={workHours || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setWorkHours(Math.min(24, Math.max(0, val)))
                        }}
                        className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                        placeholder="0"
                      />
                      <span className="text-xs font-bold text-theme-text-muted">ساعة</span>
                    </div>
                    <div className="flex-1 flex items-center gap-2">
                      <input 
                        type="number"
                        min={0}
                        max={59}
                        value={workMinutes || ''}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0
                          setWorkMinutes(Math.min(59, Math.max(0, val)))
                        }}
                        className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                        placeholder="00"
                      />
                      <span className="text-xs font-bold text-theme-text-muted">دقيقة</span>
                    </div>
                  </div>
                </div>

                {/* 4. ماذا أنجزت اليوم؟ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-theme-text">4. ماذا أنجزت اليوم باختصار؟ <span className="text-rose-500">*</span></label>
                  <textarea
                    rows={2}
                    value={todayTasks}
                    onChange={(e) => setTodayTasks(e.target.value)}
                    required
                    placeholder="مثال: أكملت برمجة لوحة التحكم وحل مشاكل الهاتف..."
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3 text-xs transition-all outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* 5. ماذا ستفعل غداً؟ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-theme-text">5. ماذا ستقوم بفعله غداً؟ <span className="text-rose-500">*</span></label>
                  <textarea
                    rows={2}
                    value={tomorrowTasks}
                    onChange={(e) => setTomorrowTasks(e.target.value)}
                    required
                    placeholder="مثال: سأبدأ في تصميم صفحة الأرشيف وربط API..."
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3 text-xs transition-all outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* 6. ربط المحطة الكبرى */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-theme-text flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5 text-theme-accent" />
                    <span>5. عملك اليوم يخدم أي محطة كبرى مباشرة؟</span>
                  </label>
                  <select 
                    value={milestoneId}
                    onChange={(e) => setMilestoneId(e.target.value)}
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                  >
                    <option value="">أعمال عامة / أخرى (خارج المحطات الاستراتيجية)</option>
                    {milestones.filter(m => m.status === 'active').map((m) => (
                      <option key={m.id} value={m.id}>🎯 {m.title}</option>
                    ))}
                  </select>
                </div>

                {/* 7. عقبات أو معوقات؟ */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-rose-500 flex items-center gap-1">
                    <span>6. هل توجد أي عقبة تعطّل عملك حالياً؟ (اختياري)</span>
                  </label>
                  <textarea
                    rows={1.5}
                    value={blockers}
                    onChange={(e) => setBlockers(e.target.value)}
                    placeholder="مثال: أنتظر إرسال ملفات التصميم من شريكي لربط الواجهة..."
                    className="w-full bg-theme-input border border-rose-500/20 focus:border-rose-500 focus:bg-theme-panel text-theme-text rounded-xl p-3 text-xs transition-all outline-none resize-none leading-relaxed"
                  />
                </div>

                {/* زر الحفظ والحذف */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isPending}
                    className="flex-grow bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow active:scale-98"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>جاري الحفظ...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{hasExistingReport ? 'حفظ التعديلات' : 'إرسال التحديث اليومي'}</span>
                      </>
                    )}
                  </button>
                  
                  {hasExistingReport && (
                    <button
                      type="button"
                      onClick={handleDeleteReport}
                      disabled={isPending}
                      className="px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 hover:text-rose-600 border border-rose-500/20 font-bold rounded-xl text-xs transition-all flex items-center justify-center cursor-pointer active:scale-95"
                      title="حذف هذا التحديث"
                    >
                      <Trash2 className="w-4.5 h-4.5 animate-modal-in" />
                    </button>
                  )}
                </div>
              </form>
            </div>
            )}

            {/* العمود الأيسر: لوحة تقارير الفريق */}
            <div className={`${isFormVisible ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-6 text-right transition-all duration-300`}>
              
              {/* قسم العنوان الفرعي */}
              <div className="flex items-center justify-between border-b border-theme-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-theme-accent"></span>
                  <h2 className="text-sm font-bold text-theme-text">تحديثات الشركاء لليوم المختار</h2>
                </div>
                <span className="text-xs font-bold text-theme-panel bg-theme-accent px-3 py-1 rounded-full">
                  {standups.length} مشارك
                </span>
              </div>

              {isLoading ? (
                <div className="flex flex-col items-center justify-center p-16 text-theme-text-muted">
                  <Loader2 className="w-8 h-8 animate-spin text-theme-accent mb-2" />
                  <span className="text-xs">جاري تحميل تحديثات الشركاء...</span>
                </div>
              ) : standups.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
                  <AlertCircle className="w-12 h-12 text-theme-text-muted mb-3 opacity-60" />
                  <h3 className="text-sm font-bold text-theme-text">لم يتم نشر أي تحديثات لهذا اليوم بعد</h3>
                  <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                    لا تتوفر تقارير Standup مسجلة للأعضاء في هذا التاريخ. كن أول من يكتب تحديثه اليوم!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {standups.map((standup) => {
                    const hasBlockers = !!standup.blockers?.trim()
                    
                    return (
                      <div
                        key={standup.id}
                        onClick={() => setActiveStandupForModal(standup)}
                        className={`bg-theme-panel rounded-2xl p-5 border shadow-sm transition-[border-color,box-shadow] duration-200 flex flex-col gap-4 relative overflow-hidden cursor-pointer hover:border-theme-accent/30 hover:shadow-md transform-gpu isolate ${
                          hasBlockers 
                            ? 'border-rose-500/30 bg-gradient-to-br from-theme-panel to-rose-500/[0.02]' 
                            : 'border-theme-border'
                        }`}
                      >
                        {/* خط إشارة لوجود عقبة معطلة */}
                        {hasBlockers && (
                          <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
                        )}

                        {/* رأس الكارت: معلومات المستخدم والخيارات التفاعلية */}
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <img
                              src={standup.user.avatar_url}
                              alt={standup.user.name}
                              className="w-10 h-10 rounded-xl object-cover border border-theme-border"
                            />
                            <div>
                              <h4 className="text-xs font-black text-theme-text">{standup.user.name}</h4>
                              {/* عرض النجوم */}
                              <div className="flex items-center gap-0.5 mt-0.5 text-amber-500">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-3 h-3 ${
                                      i < standup.productivity_score 
                                        ? 'fill-amber-500' 
                                        : 'text-theme-text-muted opacity-30'
                                    }`}
                                  />
                                ))}
                                <span className="text-[9px] text-theme-text-muted mr-1.5 font-bold">
                                  {standup.productivity_score}/5
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* شارات الحالة والمزاج */}
                          <div className="flex flex-wrap gap-1.5">
                            {standup.work_minutes ? (
                              <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 flex items-center gap-1">
                                ⏱️ {Math.floor(standup.work_minutes / 60)}س {standup.work_minutes % 60}د
                              </span>
                            ) : null}
                            {standup.milestone ? (
                              <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-theme-accent text-theme-panel">
                                🎯 {standup.milestone.title}
                              </span>
                            ) : (
                              <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-theme-bg text-theme-text-muted border border-theme-border/60">
                                ⚙️ أعمال عامة
                              </span>
                            )}
                            <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${moodMap[standup.mood]?.color}`}>
                              {moodMap[standup.mood]?.label}
                            </span>
                            <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-theme-bg text-theme-text border border-theme-border">
                              {progressMap[standup.progress_rate]?.label}
                            </span>
                            {hasBlockers && (
                              <span className="text-[9px] font-black px-2 py-1 rounded-lg bg-rose-500 text-white animate-pulse">
                                🚨 عقبة معطلة
                              </span>
                            )}
                          </div>
                        </div>

                        {/* تفاصيل الأسئلة المكتوبة */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-theme-border/60 pt-4">
                          
                          {/* عمود الإنجاز */}
                          <div className="bg-theme-bg/30 border border-theme-border/40 rounded-xl p-3 space-y-1">
                            <div className="text-[10px] font-black text-theme-text-muted">ماذا أنجز اليوم؟</div>
                            <p className="text-xs text-theme-text leading-relaxed font-medium">
                              {standup.today_tasks}
                            </p>
                          </div>

                          {/* عمود خطة الغد */}
                          <div className="bg-theme-bg/30 border border-theme-border/40 rounded-xl p-3 space-y-1">
                            <div className="text-[10px] font-black text-theme-text-muted">ماذا سيفعل غداً؟</div>
                            <p className="text-xs text-theme-text leading-relaxed font-medium">
                              {standup.tomorrow_tasks}
                            </p>
                          </div>
                        </div>

                        {/* حقل العقبات إذا وجد */}
                        {hasBlockers && (
                          <div className="bg-rose-500/[0.04] border border-rose-500/20 rounded-xl p-3 space-y-1">
                            <div className="text-[10px] font-black text-rose-500 flex items-center gap-1">
                              <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                              <span>العقبات الحالية (Blockers)</span>
                            </div>
                            <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed font-bold">
                              {standup.blockers}
                            </p>
                          </div>
                        )}

                        {/* شريط التفاعلات والتعليقات في كعب الكرت */}
                        <div className="border-t border-theme-border/60 pt-3 mt-1 flex items-center justify-between text-[11px] text-theme-text-muted">
                          {/* ملخص التفاعلات النشطة بزر التفاعل العائم */}
                          <div className="flex items-center gap-3">
                            {/* ملخص التفاعلات */}
                            {(() => {
                              const reactions = standup.reactions || []
                              if (reactions.length === 0) return null
                              
                              const uniqueTypes = Array.from(new Set(reactions.map(r => r.reaction_type))).slice(0, 3)
                              
                              return (
                                <div className="flex items-center gap-1">
                                  <div className="flex -space-x-1.5 space-x-reverse">
                                    {uniqueTypes.map(type => (
                                      <span key={type} className="text-xs" title={reactionLabels[type]}>
                                        {reactionEmojis[type]}
                                      </span>
                                    ))}
                                  </div>
                                  <span className="font-bold text-[10px] text-theme-text-muted mr-1">
                                    {reactions.length}
                                  </span>
                                </div>
                              )
                            })()}

                            {/* زر التفاعل المباشر المحاكي لفيسبوك */}
                            {(() => {
                              const reactions = standup.reactions || []
                              const currentUserReaction = reactions.find(r => r.user_id === currentProfile.id)
                              
                              return (
                                <div className="relative group/react">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleToggleReaction(
                                        standup.id, 
                                        currentUserReaction ? currentUserReaction.reaction_type : 'like'
                                      )
                                    }}
                                    className={`flex items-center gap-1 font-bold text-[10px] py-1 px-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                                      currentUserReaction 
                                        ? 'bg-theme-accent/10 border-theme-accent text-theme-accent'
                                        : 'bg-theme-bg border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-border'
                                    }`}
                                  >
                                    <span>{currentUserReaction ? reactionEmojis[currentUserReaction.reaction_type] : '👍'}</span>
                                    <span>{currentUserReaction ? reactionLabels[currentUserReaction.reaction_type] : 'تفاعل'}</span>
                                  </button>

                                  {/* القائمة العائمة المنبثقة للأعلى عند الحوم فوق زر تفاعل */}
                                  <div className="absolute bottom-full pb-2 right-0 hidden group-hover/react:flex flex-col items-center z-20 animate-modal-in select-none">
                                    <div className="flex items-center gap-1.5 bg-theme-panel border border-theme-border rounded-full p-1.5 shadow-xl">
                                      {Object.keys(reactionEmojis).map((type) => (
                                        <button
                                          key={type}
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            handleToggleReaction(standup.id, type)
                                          }}
                                          className="text-base p-1.5 hover:scale-130 transition-all cursor-pointer"
                                          title={reactionLabels[type]}
                                        >
                                          {reactionEmojis[type]}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )
                            })()}
                          </div>

                          {/* عدد التعليقات */}
                          <div className="flex items-center gap-1 font-bold text-[10px] text-theme-text-muted">
                            <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                            <span>{(standup.comments || []).length} تعليقات</span>
                          </div>
                        </div>

                        <div className="text-[9px] text-theme-text-muted self-end">
                          تم النشر في: {new Date(standup.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                        </div>

                      </div>
                    )
                  })}
                </div>
              )}

              {/* قسم غير المشاركين */}
              {!isLoading && nonParticipants.length > 0 && (
                <div className="bg-theme-panel rounded-2xl p-5 border border-theme-border space-y-3">
                  <div className="text-xs font-bold text-theme-text-muted flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    <span>شركاء لم يسجلوا تحديثهم اليوم ({nonParticipants.length})</span>
                  </div>
                  <div className="flex flex-wrap gap-2.5 justify-start">
                    {nonParticipants.map((partner) => (
                      <div
                        key={partner.id}
                        className="flex items-center gap-2 bg-theme-bg hover:bg-theme-border border border-theme-border rounded-xl p-1.5 pr-2.5 transition-colors select-none"
                        title={partner.email}
                      >
                        <img
                          src={partner.avatar_url}
                          alt={partner.name}
                          className="w-6 h-6 rounded-lg object-cover border border-theme-border grayscale opacity-60"
                        />
                        <span className="text-[10px] font-bold text-theme-text-muted">{partner.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>

          </div>

        </div>
      </main>

      {/* مودال تفاعلات وتعليقات اللقاء اليومي */}
      {activeStandupForModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-theme-panel border border-theme-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col text-right animate-modal-in overflow-hidden shadow-2xl relative">
            
            {/* رأس المودال */}
            <div className="flex justify-between items-center border-b border-theme-border p-4 shrink-0">
              <button 
                onClick={() => {
                  setActiveStandupForModal(null)
                  setReplyToCommentId(null)
                  setReplyContent('')
                }}
                className="text-neutral-500 hover:text-theme-text cursor-pointer p-0.5 rounded transition-colors"
              >
                <XCircle className="w-5 h-5" />
              </button>
              <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-theme-accent" />
                <span>تفاصيل التقرير اليومي والمناقشة</span>
              </h3>
            </div>

            {/* محتوى المودال القابل للتمرير */}
            <div className="p-6 overflow-y-auto flex-grow space-y-6">
              
              {/* تفاصيل صاحب اليومية */}
              <div className="flex items-center justify-between gap-3 border-b border-theme-border/40 pb-4">
                <div className="flex items-center gap-3">
                  <img
                    src={activeStandupForModal.user.avatar_url}
                    alt={activeStandupForModal.user.name}
                    className="w-11 h-11 rounded-xl object-cover border border-theme-border"
                  />
                  <div>
                    <h4 className="text-xs font-black text-theme-text">{activeStandupForModal.user.name}</h4>
                    <div className="text-[10px] text-theme-text-muted mt-0.5">
                      تاريخ التقرير: {activeStandupForModal.date} | النشر: {new Date(activeStandupForModal.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 justify-end">
                  <span className={`text-[9px] font-bold px-2 py-1 rounded-lg border ${moodMap[activeStandupForModal.mood]?.color}`}>
                    {moodMap[activeStandupForModal.mood]?.label}
                  </span>
                  <span className="text-[9px] font-bold px-2 py-1 rounded-lg bg-theme-bg text-theme-text border border-theme-border">
                    {progressMap[activeStandupForModal.progress_rate]?.label}
                  </span>
                </div>
              </div>

              {/* أسئلة اليومية */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-theme-bg/30 border border-theme-border/40 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black text-theme-text-muted">ماذا أنجز اليوم؟</div>
                  <p className="text-xs text-theme-text leading-relaxed font-medium whitespace-pre-line">
                    {activeStandupForModal.today_tasks}
                  </p>
                </div>
                <div className="bg-theme-bg/30 border border-theme-border/40 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black text-theme-text-muted">ماذا سيفعل غداً؟</div>
                  <p className="text-xs text-theme-text leading-relaxed font-medium whitespace-pre-line">
                    {activeStandupForModal.tomorrow_tasks}
                  </p>
                </div>
              </div>

              {/* العقبات إن وجدت */}
              {activeStandupForModal.blockers?.trim() && (
                <div className="bg-rose-500/[0.04] border border-rose-500/20 rounded-xl p-3.5 space-y-1">
                  <div className="text-[10px] font-black text-rose-500 flex items-center gap-1">
                    <AlertOctagon className="w-3.5 h-3.5 shrink-0" />
                    <span>العقبات الحالية (Blockers)</span>
                  </div>
                  <p className="text-xs text-rose-600 dark:text-rose-400 leading-relaxed font-bold whitespace-pre-line">
                    {activeStandupForModal.blockers}
                  </p>
                </div>
              )}

              {/* 1. قسم تفاعلات الإيموجي (Facebook Style) */}
              <div className="border-t border-b border-theme-border/60 py-4 space-y-3">
                <div className="text-xs font-bold text-theme-text-muted">تفاعل مع هذا التقرير:</div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  {/* شريط الإيموجي */}
                  <div className="flex items-center gap-1.5 bg-theme-bg border border-theme-border/60 p-1.5 rounded-2xl">
                    {Object.keys(reactionEmojis).map((type) => {
                      const emoji = reactionEmojis[type]
                      const label = reactionLabels[type]
                      const userReacted = (activeStandupForModal.reactions || []).some(
                        r => r.user_id === currentProfile.id && r.reaction_type === type
                      )
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => handleToggleReaction(activeStandupForModal.id, type)}
                          className={`text-lg p-2 rounded-xl hover:bg-theme-panel hover:scale-125 transition-all cursor-pointer ${
                            userReacted ? 'bg-theme-accent/15 border border-theme-accent/30 scale-110' : 'border border-transparent'
                          }`}
                          title={label}
                        >
                          {emoji}
                        </button>
                      )
                    })}
                  </div>

                  {/* قائمة المتفاعلين وأعدادهم */}
                  <div className="flex flex-wrap gap-2 text-xs">
                    {activeStandupForModal.reactions && activeStandupForModal.reactions.length > 0 ? (
                      activeStandupForModal.reactions.map((r, idx) => {
                        const userName = teamProfiles.find(p => p.id === r.user_id)?.name || 'زميل'
                        return (
                          <span 
                            key={idx} 
                            className="bg-theme-bg border border-theme-border/60 text-[10px] font-bold text-theme-text px-2 py-1 rounded-lg flex items-center gap-1"
                          >
                            <span>{reactionEmojis[r.reaction_type]}</span>
                            <span>{userName}</span>
                          </span>
                        )
                      })
                    ) : (
                      <span className="text-[10px] text-theme-text-muted">لا توجد تفاعلات بعد.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 2. قسم التعليقات والردود */}
              <div className="space-y-4">
                <div className="text-xs font-black text-theme-text flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-theme-accent" />
                  <span>التعليقات والمناقشات ({(activeStandupForModal.comments || []).length})</span>
                </div>

                {/* قائمة التعليقات الشجرية */}
                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
                  {(() => {
                    const comments = activeStandupForModal.comments || []
                    if (comments.length === 0) {
                      return (
                        <p className="text-center text-xs text-theme-text-muted py-6">
                          لا توجد تعليقات بعد. اكتب تعليقك أدناه لبدء النقاش!
                        </p>
                      )
                    }

                    // فصل التعليقات الرئيسية عن الردود
                    const mainComments = comments.filter(c => !c.parent_id).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    const replies = comments.filter(c => c.parent_id).sort((a,b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

                    return mainComments.map((comment) => {
                      const commentReplies = replies.filter(r => r.parent_id === comment.id)
                      const isCommentOwner = comment.user_id === currentProfile.id || currentProfile.role === 'admin'
                      const isReplying = replyToCommentId === comment.id
                      const isEditingComment = editingCommentId === comment.id

                      return (
                        <div key={comment.id} className="space-y-3 border-b border-theme-border/40 pb-3 last:border-b-0">
                          {/* التعليق الرئيسي */}
                          <div className="bg-theme-bg/25 border border-theme-border/40 p-3 rounded-2xl relative">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <img
                                  src={comment.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100'}
                                  alt={comment.user?.name}
                                  className="w-6 h-6 rounded-md object-cover"
                                />
                                <span className="text-[11px] font-black text-theme-text">{comment.user?.name}</span>
                                <span className="text-[9px] text-theme-text-muted">
                                  {new Date(comment.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5">
                                {comment.user_id === currentProfile.id && (
                                  <button
                                    onClick={() => {
                                      setEditingCommentId(comment.id)
                                      setEditingCommentContent(comment.content)
                                    }}
                                    className="text-neutral-500 hover:text-theme-accent p-1 rounded transition-colors cursor-pointer"
                                    title="تعديل التعليق"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {isCommentOwner && (
                                  <button
                                    onClick={() => handleDeleteComment(comment.id)}
                                    className="text-rose-400 hover:text-rose-600 p-1 rounded transition-colors cursor-pointer"
                                    title="حذف التعليق"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isEditingComment ? (
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  handleUpdateComment(comment.id)
                                }}
                                className="mt-2 flex gap-2 items-center"
                              >
                                <input 
                                  type="text"
                                  value={editingCommentContent}
                                  onChange={(e) => setEditingCommentContent(e.target.value)}
                                  className="flex-grow bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-1.5 text-xs transition-all outline-none"
                                  required
                                  autoFocus
                                />
                                <div className="flex gap-1">
                                  <button
                                    type="submit"
                                    disabled={commentPending}
                                    className="bg-theme-accent hover:opacity-90 text-theme-panel font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                                  >
                                    حفظ
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingCommentId(null)
                                      setEditingCommentContent('')
                                    }}
                                    className="bg-neutral-600 hover:bg-neutral-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                                  >
                                    إلغاء
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <p className="text-xs text-theme-text mt-2 pr-1 whitespace-pre-line leading-relaxed font-medium">
                                {comment.content}
                              </p>
                            )}

                            {/* زر الرد */}
                            <div className="mt-2 flex justify-end">
                              <button
                                onClick={() => setReplyToCommentId(isReplying ? null : comment.id)}
                                className="text-[10px] text-theme-accent hover:text-theme-accent-hover font-black flex items-center gap-1 cursor-pointer"
                              >
                                <span>{isReplying ? 'إلغاء الرد' : 'رد على التعليق'}</span>
                              </button>
                            </div>
                          </div>

                          {/* الردود المتداخلة (Level 2) */}
                          {commentReplies.length > 0 && (
                            <div className="mr-8 border-r-2 border-theme-border/60 pr-4 space-y-2.5">
                              {commentReplies.map((reply) => {
                                const isReplyOwner = reply.user_id === currentProfile.id || currentProfile.role === 'admin'
                                const isEditingReply = editingCommentId === reply.id

                                return (
                                  <div key={reply.id} className="bg-theme-bg/40 border border-theme-border/30 p-2.5 rounded-xl relative">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <img
                                          src={reply.user?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100'}
                                          alt={reply.user?.name}
                                          className="w-5.5 h-5.5 rounded-md object-cover"
                                        />
                                        <span className="text-[10px] font-black text-theme-text">{reply.user?.name}</span>
                                        <span className="text-[8px] text-theme-text-muted">
                                          {new Date(reply.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {reply.user_id === currentProfile.id && (
                                          <button
                                            onClick={() => {
                                              setEditingCommentId(reply.id)
                                              setEditingCommentContent(reply.content)
                                            }}
                                            className="text-neutral-500 hover:text-theme-accent p-1 rounded transition-colors cursor-pointer"
                                            title="تعديل الرد"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}
                                        {isReplyOwner && (
                                          <button
                                            onClick={() => handleDeleteComment(reply.id)}
                                            className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                            title="حذف الرد"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                    </div>

                                    {isEditingReply ? (
                                      <form 
                                        onSubmit={(e) => {
                                          e.preventDefault()
                                          handleUpdateComment(reply.id)
                                        }}
                                        className="mt-2 flex gap-2 items-center"
                                      >
                                        <input 
                                          type="text"
                                          value={editingCommentContent}
                                          onChange={(e) => setEditingCommentContent(e.target.value)}
                                          className="flex-grow bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-1.5 text-xs transition-all outline-none"
                                          required
                                          autoFocus
                                        />
                                        <div className="flex gap-1">
                                          <button
                                            type="submit"
                                            disabled={commentPending}
                                            className="bg-theme-accent hover:opacity-90 text-theme-panel font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                                          >
                                            حفظ
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingCommentId(null)
                                              setEditingCommentContent('')
                                            }}
                                            className="bg-neutral-600 hover:bg-neutral-700 text-white font-bold px-2.5 py-1.5 rounded-lg text-[10px] transition-colors cursor-pointer"
                                          >
                                            إلغاء
                                          </button>
                                        </div>
                                      </form>
                                    ) : (
                                      <p className="text-xs text-theme-text mt-1.5 pr-1 whitespace-pre-line leading-relaxed font-medium">
                                        {reply.content}
                                      </p>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          )}

                          {/* حقل إدخال الرد المتداخل */}
                          {isReplying && (
                            <div className="mr-8 pr-4">
                              <form 
                                onSubmit={(e) => {
                                  e.preventDefault()
                                  handleCommentSubmit(comment.id)
                                }} 
                                className="flex gap-2 items-center"
                              >
                                <input
                                  type="text"
                                  value={replyContent}
                                  onChange={(e) => setReplyContent(e.target.value)}
                                  placeholder={`اكتب ردك على ${comment.user?.name}...`}
                                  className="flex-grow bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none leading-relaxed"
                                  required
                                  autoFocus
                                />
                                <button
                                  type="submit"
                                  disabled={commentPending}
                                  className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold px-4 py-2 rounded-xl text-xs transition-colors flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50"
                                >
                                  {commentPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      )
                    })
                  })()}
                </div>

                {/* حقل إدخال تعليق رئيسي جديد */}
                <form 
                  onSubmit={(e) => {
                    e.preventDefault()
                    handleCommentSubmit(null)
                  }} 
                  className="pt-2 border-t border-theme-border/60 flex gap-2 items-start shrink-0"
                >
                  <textarea
                    rows={1.5}
                    value={mainCommentContent}
                    onChange={(e) => setMainCommentContent(e.target.value)}
                    placeholder="اكتب تعليقاً رئيسياً جديداً..."
                    className="flex-grow bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-3 text-xs transition-all outline-none resize-none leading-relaxed"
                    required
                  />
                  <button
                    type="submit"
                    disabled={commentPending}
                    className="bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold p-3.5 rounded-xl text-xs transition-colors flex items-center justify-center cursor-pointer shadow-sm disabled:opacity-50 mt-1 shrink-0"
                  >
                    {commentPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </form>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* عرض الرسائل العائمة */}
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
