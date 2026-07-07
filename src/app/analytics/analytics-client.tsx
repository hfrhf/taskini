'use client'

import { useState, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  TrendingUp, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Star, 
  Loader2, 
  User, 
  Users, 
  Award,
  ChevronDown,
  ChevronUp,
  Check,
  AlertCircle
} from 'lucide-react'
import { getMonthlyAnalytics } from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface UserStat {
  userId: string
  name: string
  email: string
  avatarUrl: string
  role: string
  totalMinutes: number
  totalHours: number
  completedTasksCount: number
  daysLogged: number
  avgProductivity: number
  tasks: string[]
  dailyStandups?: Array<{
    date: string
    workMinutes: number
    productivityScore: number
    todayTasks: string
    tomorrowTasks: string
    blockers: string | null
    mood: string
    progressRate: string
  }>
  completedTasksDetails?: Array<{
    title: string
    completedDate: string
  }>
}

interface TeamSummary {
  totalHours: number
  completedTasksCount: number
  avgProductivity: number
}

interface AnalyticsData {
  userStats: UserStat[]
  teamSummary: TeamSummary
}

interface AnalyticsClientProps {
  currentProfile: Profile
  initialData: AnalyticsData
  initialMonth: number
  initialYear: number
}

const months = [
  { value: 1, label: 'يناير' },
  { value: 2, label: 'فبراير' },
  { value: 3, label: 'مارس' },
  { value: 4, label: 'أبريل' },
  { value: 5, label: 'مايو' },
  { value: 6, label: 'يونيو' },
  { value: 7, label: 'يوليو' },
  { value: 8, label: 'أغسطس' },
  { value: 9, label: 'سبتمبر' },
  { value: 10, label: 'أكتوبر' },
  { value: 11, label: 'نوفمبر' },
  { value: 12, label: 'ديسمبر' }
]

const years = [2025, 2026, 2027]

const formatDateString = (date: Date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const getDaysArray = (m: number, y: number) => {
  const days = []
  const totalDays = new Date(y, m, 0).getDate()
  const firstDayIndex = new Date(y, m - 1, 1).getDay() // 0 = Sunday, 1 = Monday, etc.
  
  for (let i = 0; i < firstDayIndex; i++) {
    days.push(null)
  }
  
  for (let d = 1; d <= totalDays; d++) {
    days.push(new Date(y, m - 1, d))
  }
  
  return days
}

const formatArabicDate = (dateStr: string) => {
  try {
    const date = new Date(dateStr)
    const weekdaysFull = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const monthsFull = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]
    return `${weekdaysFull[date.getDay()]}، ${date.getDate()} ${monthsFull[date.getMonth()]} ${date.getFullYear()}`
  } catch (err) {
    return dateStr
  }
}

const formatWorkTime = (minutes: number) => {
  if (!minutes) return 'لا يوجد'
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  
  let hoursText = ''
  if (hours > 0) {
    if (hours === 1) hoursText = 'ساعة'
    else if (hours === 2) hoursText = 'ساعتين'
    else if (hours >= 3 && hours <= 10) hoursText = `${hours} ساعات`
    else hoursText = `${hours} ساعة`
  }
  
  let minsText = ''
  if (mins > 0) {
    if (mins === 1) minsText = 'دقيقة'
    else if (mins === 2) minsText = 'دقيقتين'
    else if (mins >= 3 && mins <= 10) minsText = `${mins} دقائق`
    else minsText = `${mins} دقيقة`
  }
  
  if (hoursText && minsText) {
    return `${hoursText} و ${minsText}`
  }
  return hoursText || minsText
}

const getMoodDetails = (mood: string) => {
  switch (mood) {
    case 'energetic':
      return { label: 'نشيط ⚡', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 dark:border-emerald-500/10' }
    case 'stable':
      return { label: 'مستقر 😊', color: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20 dark:border-indigo-500/10' }
    case 'tired':
      return { label: 'متعب 😴', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20 dark:border-amber-500/10' }
    case 'stressed':
      return { label: 'مجهد 😫', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20 dark:border-rose-500/10' }
    default:
      return { label: mood, color: 'bg-theme-bg text-theme-text-muted border-theme-border/60' }
  }
}

const getProgressRateDetails = (rate: string) => {
  switch (rate) {
    case 'all':
      return { label: 'أنجزت كل المهام 🎯', color: 'bg-emerald-500/10 text-emerald-500 dark:bg-emerald-500/5' }
    case 'most':
      return { label: 'أنجزت معظم المهام 👍', color: 'bg-indigo-500/10 text-indigo-500 dark:bg-indigo-500/5' }
    case 'half':
      return { label: 'أنجزت نصف المهام ⚖️', color: 'bg-amber-500/10 text-amber-500 dark:bg-amber-500/5' }
    case 'low':
      return { label: 'إنجاز منخفض ⚠️', color: 'bg-rose-500/10 text-rose-500 dark:bg-rose-500/5' }
    default:
      return { label: rate, color: 'bg-theme-bg text-theme-text-muted' }
  }
}

const renderStars = (score: number) => {
  return (
    <div className="flex items-center gap-0.5" dir="ltr">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`w-3 h-3 ${
            star <= score 
              ? 'text-amber-500 fill-amber-500' 
              : 'text-theme-border fill-transparent'
          }`}
        />
      ))}
    </div>
  )
}

const getDefaultDate = (userId: string, userStandups: any[], userTasks: any[], selectedMonth: number, selectedYear: number) => {
  const today = new Date()
  const todayStr = formatDateString(today)
  if (today.getMonth() + 1 === selectedMonth && today.getFullYear() === selectedYear) {
    return todayStr
  }
  
  const allDates = [
    ...userStandups.map(s => s.date),
    ...userTasks.map(t => t.completedDate)
  ].filter(Boolean).sort()
  
  if (allDates.length > 0) {
    return allDates[allDates.length - 1]
  }
  
  return `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-01`
}

export default function AnalyticsClient({ currentProfile, initialData, initialMonth, initialYear }: AnalyticsClientProps) {
  const [data, setData] = useState<AnalyticsData>(initialData)
  const [month, setMonth] = useState<number>(initialMonth)
  const [year, setYear] = useState<number>(initialYear)
  const [isPending, startTransition] = useTransition()
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // التحكم في فتح وغلق قائمة المهام البسيطة داخل بطاقة كل مستخدم
  const [expandedUsers, setExpandedUsers] = useState<Record<string, boolean>>({})
  
  // الشريك المختار للسجل التفصيلي الموحد أسفل الصفحة
  const [selectedUserId, setSelectedUserId] = useState<string | null>(currentProfile.id)
  
  // التاريخ المختار للتقويم التفصيلي الموحد أسفل الصفحة
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const currentUserStats = initialData.userStats.find(s => s.userId === currentProfile.id)
    if (currentUserStats) {
      return getDefaultDate(
        currentProfile.id,
        currentUserStats.dailyStandups || [],
        currentUserStats.completedTasksDetails || [],
        initialMonth,
        initialYear
      )
    }
    return `${initialYear}-${String(initialMonth).padStart(2, '0')}-01`
  })

  // حالات المخططات البيانية التفاعلية
  const [chartMetric, setChartMetric] = useState<'hours' | 'tasks'>('hours')
  const [hoveredSlice, setHoveredSlice] = useState<number | null>(null)

  const toggleUserExpand = (userId: string) => {
    setExpandedUsers(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }))
  }

  const handleSelectUser = (userId: string, userStandups: any[] = [], userTasks: any[] = []) => {
    setSelectedUserId(userId)
    const defaultDate = getDefaultDate(userId, userStandups, userTasks, month, year)
    setSelectedDate(defaultDate)
    
    // التمرير السلس إلى قسم السجل التفصيلي
    setTimeout(() => {
      const element = document.getElementById('detailed-activity-section')
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const monthDays = getDaysArray(month, year)
  const weekdays = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']

  const handleFetchData = async (selectedMonth: number, selectedYear: number) => {
    setMonth(selectedMonth)
    setYear(selectedYear)
    startTransition(async () => {
      try {
        const res = await getMonthlyAnalytics(selectedMonth, selectedYear)
        setData(res)
        
        // تحديث التاريخ المختار للمستخدم الحالي في الشهر الجديد
        if (selectedUserId) {
          const activeUserStats = res.userStats.find(u => u.userId === selectedUserId)
          if (activeUserStats) {
            const defaultDate = getDefaultDate(
              selectedUserId,
              activeUserStats.dailyStandups || [],
              activeUserStats.completedTasksDetails || [],
              selectedMonth,
              selectedYear
            )
            setSelectedDate(defaultDate)
          }
        }
      } catch (err: any) {
        showToast('فشل جلب بيانات التقارير: ' + err.message, 'error')
      }
    })
  }

  // إحصائيات المستخدم الحالي الخاصة
  const myStats = data.userStats.find(s => s.userId === currentProfile.id)

  // الألوان المقترحة للمخططات
  const COLORS = [
    '#6366f1', // Indigo
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#f43f5e', // Rose
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#f97316', // Orange
    '#d946ef', // Fuchsia
    '#14b8a6', // Teal
  ]

  // إعداد بيانات المخطط
  const rawChartData = data.userStats.map((u, idx) => {
    const val = chartMetric === 'hours' ? u.totalHours : u.completedTasksCount
    return {
      name: u.name,
      value: val,
      color: COLORS[idx % COLORS.length],
      userId: u.userId,
      avatarUrl: u.avatarUrl
    }
  })

  // تصفية القيم الأكبر من الصفر لعرض الدائرة
  const chartData = rawChartData.filter(item => item.value > 0)
  const totalSum = chartData.reduce((sum, item) => sum + item.value, 0)

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">
          
          {/* الترويسة والتحكم بالفلتر */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-bold text-theme-text">التقارير والإحصائيات الشهرية</h1>
              <p className="text-xs text-theme-text-muted mt-1">تتبع إجمالي ساعات العمل، المهام المكتملة، ومعدلات الأداء الذاتية للفريق والشركاء</p>
            </div>

            <div className="flex items-center gap-3 justify-end">
              {isPending && (
                <Loader2 className="w-5 h-5 animate-spin text-theme-accent" />
              )}
              
              <div className="flex items-center gap-2">
                <select
                  value={month}
                  onChange={(e) => handleFetchData(parseInt(e.target.value), year)}
                  className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  {months.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>

                <select
                  value={year}
                  onChange={(e) => handleFetchData(month, parseInt(e.target.value))}
                  className="bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* لوحة مؤشرات الأداء الإجمالية */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* إجمالي ساعات العمل */}
            <div className="bg-theme-panel rounded-2xl p-5 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-indigo-500"></div>
              <div className="space-y-1 pr-3">
                <p className="text-xs text-theme-text-muted font-bold">إجمالي ساعات العمل للفريق</p>
                <h3 className="text-2xl font-black text-theme-text flex items-baseline gap-1">
                  <span>{data.teamSummary.totalHours}</span>
                  <span className="text-xs text-theme-text-muted font-bold">ساعة</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-indigo-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Clock className="w-6 h-6 text-indigo-400" />
              </div>
            </div>

            {/* إجمالي المهام المكتملة */}
            <div className="bg-theme-panel rounded-2xl p-5 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-emerald-500"></div>
              <div className="space-y-1 pr-3">
                <p className="text-xs text-theme-text-muted font-bold">المهام المنجزة بالكامل</p>
                <h3 className="text-2xl font-black text-theme-text flex items-baseline gap-1">
                  <span>{data.teamSummary.completedTasksCount}</span>
                  <span className="text-xs text-theme-text-muted font-bold">مهمة</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              </div>
            </div>

            {/* متوسط تقييم الإنتاجية */}
            <div className="bg-theme-panel rounded-2xl p-5 border border-theme-border shadow-sm flex items-center justify-between text-right relative overflow-hidden">
              <div className="absolute top-0 right-0 bottom-0 w-1.5 bg-amber-500"></div>
              <div className="space-y-1 pr-3">
                <p className="text-xs text-theme-text-muted font-bold">متوسط الإنتاجية اليومية للفريق</p>
                <h3 className="text-2xl font-black text-theme-text flex items-baseline gap-1">
                  <span>{data.teamSummary.avgProductivity}</span>
                  <span className="text-xs text-theme-text-muted font-bold">/ 5</span>
                </h3>
              </div>
              <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center shrink-0">
                <Star className="w-6 h-6 text-amber-500 fill-amber-500/20" />
              </div>
            </div>

          </div>

          {/* قسم المخططات البيانية التفاعلية */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* المخطط الدائري (حصص الشركاء) */}
            <div className="lg:col-span-6 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                      <Users className="w-4.5 h-4.5 text-theme-accent" />
                      <span>توزيع المساهمات بين الشركاء</span>
                    </h3>
                    <p className="text-[10px] text-theme-text-muted mt-0.5">النسبة المئوية لحصة كل شريك من المجهود الكلي</p>
                  </div>

                  {/* مفتاح التبديل للمقياس النشط */}
                  <div className="flex bg-theme-bg p-0.5 rounded-xl border border-theme-border shrink-0">
                    <button
                      onClick={() => {
                        setChartMetric('hours')
                        setHoveredSlice(null)
                      }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        chartMetric === 'hours'
                          ? 'bg-theme-panel text-theme-text shadow-xs border border-theme-border/60'
                          : 'text-theme-text-muted hover:text-theme-text'
                      }`}
                    >
                      ساعات العمل
                    </button>
                    <button
                      onClick={() => {
                        setChartMetric('tasks')
                        setHoveredSlice(null)
                      }}
                      className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                        chartMetric === 'tasks'
                          ? 'bg-theme-panel text-theme-text shadow-xs border border-theme-border/60'
                          : 'text-theme-text-muted hover:text-theme-text'
                      }`}
                    >
                      المهام المكتملة
                    </button>
                  </div>
                </div>

                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-8">
                  {/* الدائرة البيانية */}
                  <div className="relative w-40 h-40 shrink-0">
                    {totalSum > 0 ? (
                      <svg viewBox="0 0 140 140" className="w-full h-full transform -rotate-90">
                        {/* الخلفية الداخلية المفرغة للـ Donut */}
                        <circle cx="70" cy="70" r="50" fill="transparent" stroke="var(--theme-border)" strokeWidth="0.5" className="opacity-20" />
                        
                        {/* رسم الحصص */}
                        {(() => {
                          let cumulativePercent = 0
                          return chartData.map((item, idx) => {
                            const pct = item.value / totalSum
                            const strokeDashoffset = 314.16 - (pct * 314.16)
                            const rotation = (cumulativePercent * 360)
                            cumulativePercent += pct

                            const isHovered = hoveredSlice === idx

                            return (
                              <circle
                                key={item.userId}
                                cx="70"
                                cy="70"
                                r="50"
                                fill="transparent"
                                stroke={item.color}
                                strokeWidth={isHovered ? 15 : 11}
                                strokeDasharray="314.16"
                                strokeDashoffset={strokeDashoffset}
                                transform={`rotate(${rotation - 90} 70 70)`}
                                style={{
                                  transition: 'stroke-width 0.2s ease, stroke-dashoffset 0.5s ease',
                                  cursor: 'pointer',
                                }}
                                onMouseEnter={() => setHoveredSlice(idx)}
                                onMouseLeave={() => setHoveredSlice(null)}
                              />
                            )
                          })
                        })()}
                        
                        {/* تراكيب النصوص بالمنتصف */}
                        <g transform="rotate(90 70 70)" className="text-center select-none pointer-events-none">
                          {hoveredSlice !== null && chartData[hoveredSlice] ? (
                            <>
                              <text x="70" y="62" textAnchor="middle" className="fill-theme-text text-[9px] font-black">
                                {chartData[hoveredSlice].name}
                              </text>
                              <text x="70" y="78" textAnchor="middle" className="fill-theme-text text-[11px] font-black">
                                {chartData[hoveredSlice].value} {chartMetric === 'hours' ? 'س' : 'مهمة'}
                              </text>
                              <text x="70" y="90" textAnchor="middle" className="fill-theme-text-muted text-[7px] font-bold">
                                {((chartData[hoveredSlice].value / totalSum) * 100).toFixed(0)}%
                              </text>
                            </>
                          ) : (
                            <>
                              <text x="70" y="62" textAnchor="middle" className="fill-theme-text-muted text-[8px] font-bold">
                                المجموع الكلي
                              </text>
                              <text x="70" y="78" textAnchor="middle" className="fill-theme-text text-[12px] font-black">
                                {totalSum} {chartMetric === 'hours' ? 'س' : 'مهمة'}
                              </text>
                              <text x="70" y="90" textAnchor="middle" className="fill-theme-text-muted text-[7px] font-bold">
                                {chartData.length} شركاء
                              </text>
                            </>
                          )}
                        </g>
                      </svg>
                    ) : (
                      /* حالة عدم وجود بيانات */
                      <div className="absolute inset-0 flex flex-col items-center justify-center border-4 border-dashed border-theme-border rounded-full text-[10px] text-theme-text-muted font-bold">
                        لا توجد بيانات
                      </div>
                    )}
                  </div>

                  {/* وسيلة الإيضاح (Legend) */}
                  <div className="flex-grow space-y-1.5 w-full max-h-[160px] overflow-y-auto pr-1">
                    {rawChartData.map((item, idx) => {
                      const pct = totalSum > 0 ? (item.value / totalSum) * 100 : 0
                      const isHovered = hoveredSlice === idx
                      const hasValue = item.value > 0

                      return (
                        <div
                          key={item.userId}
                          className={`flex items-center justify-between text-[10px] p-1.5 rounded-xl border transition-all duration-150 ${
                            isHovered 
                              ? 'bg-theme-bg border-theme-accent/30 scale-[1.01]' 
                              : 'bg-transparent border-transparent'
                          } ${!hasValue ? 'opacity-40' : ''}`}
                          onMouseEnter={() => hasValue && setHoveredSlice(idx)}
                          onMouseLeave={() => setHoveredSlice(null)}
                        >
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                            <img src={item.avatarUrl} alt={item.name} className="w-4 h-4 rounded-md object-cover border border-theme-border shrink-0" />
                            <span className="font-bold text-theme-text truncate">{item.name}</span>
                          </div>
                          <div className="text-left font-black text-theme-text flex items-center gap-1 font-mono shrink-0">
                            <span>{item.value} {chartMetric === 'hours' ? 'س' : 'م'}</span>
                            {hasValue && (
                              <span className="text-[8px] font-medium text-theme-text-muted">({pct.toFixed(0)}%)</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* مخطط المقارنة (تحليل وتوزيع الجهد) */}
            <div className="lg:col-span-6 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <TrendingUp className="w-4.5 h-4.5 text-theme-accent" />
                  <span>مقارنة إنتاجية الشركاء</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">تحليل مقارن لساعات العمل المسجلة مقابل عدد المهام المنجزة لكل شريك</p>
              </div>

              <div className="space-y-4 mt-6 flex-grow">
                {data.userStats.map((u) => {
                  const maxHours = Math.max(...data.userStats.map(u => u.totalHours), 1)
                  const maxTasks = Math.max(...data.userStats.map(u => u.completedTasksCount), 1)
                  const hoursWidth = (u.totalHours / maxHours) * 100
                  const tasksWidth = (u.completedTasksCount / maxTasks) * 100

                  return (
                    <div key={u.userId} className="space-y-1.5">
                      {/* معلومات الشريك */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="w-5 h-5 rounded-md object-cover border border-theme-border"
                          />
                          <span className="font-bold text-theme-text">{u.name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-theme-text-muted font-bold font-mono">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                            <span>{u.totalHours} س</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>{u.completedTasksCount} مهمة</span>
                          </span>
                        </div>
                      </div>

                      {/* أشرطة المقارنة */}
                      <div className="space-y-1 bg-theme-bg/30 p-1.5 rounded-xl border border-theme-border/40">
                        {/* شريط الساعات */}
                        <div className="h-1.5 w-full bg-theme-border/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-indigo-500 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${hoursWidth}%` }}
                          />
                        </div>
                        {/* شريط المهام */}
                        <div className="h-1.5 w-full bg-theme-border/30 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out" 
                            style={{ width: `${tasksWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* الجزء الأيمن: إحصائياتي الشخصية */}
            <div className="lg:col-span-4 bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm space-y-6 text-right relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-theme-accent to-theme-accent/40"></div>
              
              <div>
                <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                  <Award className="w-4.5 h-4.5 text-theme-accent" />
                  <span>إحصائياتك الشخصية هذا الشهر</span>
                </h3>
                <p className="text-[10px] text-theme-text-muted mt-0.5">ملخص لنشاطك وجهدك الشخصي المسجل خلال الشهر</p>
              </div>

              {myStats ? (
                <div className="space-y-4">
                  
                  {/* ساعات عملك */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-theme-text-muted">ساعات عملك المسجلة</span>
                      <span className="text-lg font-black text-theme-text">{myStats.totalHours} ساعة</span>
                    </div>
                    <Clock className="w-5 h-5 text-indigo-400" />
                  </div>

                  {/* مهامك المكتملة */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-theme-text-muted">مهامك المكتملة بنجاح</span>
                      <span className="text-lg font-black text-theme-text">{myStats.completedTasksCount} مهمة</span>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  </div>

                  {/* متوسط إنتاجيتك */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-theme-text-muted">متوسط إنتاجيتك الذاتية</span>
                      <span className="text-lg font-black text-theme-text flex items-center gap-1">
                        <span>{myStats.avgProductivity}</span>
                        <span className="text-xs text-theme-text-muted font-normal">/ 5</span>
                      </span>
                    </div>
                    <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                  </div>

                  {/* عدد أيام المشاركة */}
                  <div className="bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-4 flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold text-theme-text-muted">أيام الحضور والتقرير اليومي</span>
                      <span className="text-lg font-black text-theme-text">{myStats.daysLogged} يوم</span>
                    </div>
                    <Calendar className="w-5 h-5 text-theme-accent" />
                  </div>

                </div>
              ) : (
                <p className="text-xs text-theme-text-muted text-center py-6">لم يتم العثور على سجلات نشاط لك في هذا الشهر.</p>
              )}
            </div>

            {/* الجزء الأيسر: قائمة تقارير ومقارنة الفريق */}
            <div className="lg:col-span-8 space-y-6 text-right">
              
              <div className="flex items-center justify-between border-b border-theme-border pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-theme-accent"></span>
                  <h2 className="text-sm font-bold text-theme-text">لوحة إنجازات الشركاء والموظفين</h2>
                </div>
              </div>

              <div className="space-y-4">
                {data.userStats.map((u) => {
                  const isExpanded = !!expandedUsers[u.userId]
                  const hasTasks = u.tasks.length > 0
                  
                  return (
                    <div 
                      key={u.userId}
                      className="bg-theme-panel border border-theme-border rounded-2xl p-5 flex flex-col gap-4 shadow-sm hover:border-theme-border/80 transition-all duration-200"
                    >
                      {/* معلومات المستخدم العلوية */}
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <img
                            src={u.avatarUrl}
                            alt={u.name}
                            className="w-10 h-10 rounded-xl object-cover border border-theme-border shrink-0"
                          />
                          <div>
                            <h4 className="text-xs font-black text-theme-text flex items-center gap-1.5 flex-wrap">
                              <span>{u.name}</span>
                              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-md ${
                                u.role === 'admin' 
                                  ? 'bg-theme-accent/10 text-theme-accent' 
                                  : 'bg-theme-bg text-theme-text-muted border border-theme-border/60'
                              }`}>
                                {u.role === 'admin' ? 'مدير' : 'شريك'}
                              </span>
                              <span 
                                className="inline-flex items-center gap-1 text-[9px] font-bold text-violet-600 dark:text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded-md border border-violet-500/20" 
                                title="أيام الحضور والتقرير اليومي"
                              >
                                <Calendar className="w-3.5 h-3.5 text-violet-500 dark:text-violet-400" />
                                <span>{u.daysLogged}</span>
                              </span>
                            </h4>
                            <p className="text-[10px] text-theme-text-muted">{u.email}</p>
                          </div>
                        </div>

                        {/* إحصائيات سريعة للسطر */}
                        <div className="flex flex-wrap items-center gap-4 text-center">
                          <div className="bg-theme-bg px-3 py-1.5 rounded-xl border border-theme-border">
                            <span className="block text-[8px] font-bold text-theme-text-muted">إجمالي الساعات</span>
                            <span className="text-xs font-black text-theme-text">{u.totalHours} س</span>
                          </div>
                          
                          <div className="bg-theme-bg px-3 py-1.5 rounded-xl border border-theme-border">
                            <span className="block text-[8px] font-bold text-theme-text-muted">المهام المنجزة</span>
                            <span className="text-xs font-black text-theme-text">{u.completedTasksCount}</span>
                          </div>

                          <div className="bg-theme-bg px-3 py-1.5 rounded-xl border border-theme-border flex flex-col items-center justify-center">
                            <span className="block text-[8px] font-bold text-theme-text-muted">الإنتاجية</span>
                            <span className="text-xs font-black text-theme-text flex items-center gap-0.5 justify-center">
                              <span>{u.avgProductivity}</span>
                              <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* روابط التحكم السفلية بالبطاقة */}
                      <div className="border-t border-theme-border/50 pt-3 flex items-center justify-between gap-4 flex-wrap">
                        {hasTasks ? (
                          <button
                            type="button"
                            onClick={() => toggleUserExpand(u.userId)}
                            className="flex items-center gap-1 text-[10px] font-black text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                          >
                            <span>استعراض المهام المكتملة ({u.completedTasksCount})</span>
                            {isExpanded ? (
                              <ChevronUp className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronDown className="w-3.5 h-3.5" />
                            )}
                          </button>
                        ) : (
                          <div className="text-[10px] font-bold text-theme-text-muted">لا توجد مهام مكتملة</div>
                        )}
                        
                        <button
                          type="button"
                          onClick={() => handleSelectUser(u.userId, u.dailyStandups || [], u.completedTasksDetails || [])}
                          className="flex items-center gap-1 text-[10px] font-black text-theme-accent hover:underline transition-colors cursor-pointer"
                        >
                          <span>عرض سجل النشاط اليومي 🔍</span>
                        </button>
                      </div>

                      {/* قائمة المهام المكتملة البسيطة */}
                      {isExpanded && hasTasks && (
                        <div className="mt-2 bg-theme-bg/50 border border-theme-border/60 rounded-xl p-3 space-y-2 animate-modal-in">
                          <ul className="list-disc pr-4 space-y-1.5">
                            {u.tasks.map((taskTitle, idx) => (
                              <li key={idx} className="text-xs text-theme-text font-medium leading-relaxed">
                                {taskTitle}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

            </div>

          </div>

          {/* قسم سجل النشاط اليومي التفصيلي الموحد للفريق (col-12) */}
          <div 
            id="detailed-activity-section" 
            className="bg-theme-panel rounded-3xl p-6 border border-theme-border shadow-sm text-right space-y-6 scroll-mt-6"
          >
            <div>
              <h3 className="text-sm font-black text-theme-text flex items-center gap-2">
                <Calendar className="w-4.5 h-4.5 text-theme-accent" />
                <span>سجل النشاط اليومي التفصيلي للشركاء</span>
              </h3>
              <p className="text-[10px] text-theme-text-muted mt-0.5">
                اختر شريكاً من القائمة أدناه لعرض تقويم أدائه وتفاصيل إنجازاته اليومية بشكل مفصل خلال الشهر.
              </p>
            </div>

            {/* شريط اختيار الشريك */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide border-b border-theme-border/40">
              {data.userStats.map((u) => {
                const isSelected = selectedUserId === u.userId
                return (
                  <button
                    key={u.userId}
                    type="button"
                    onClick={() => handleSelectUser(u.userId, u.dailyStandups || [], u.completedTasksDetails || [])}
                    className={`flex items-center gap-2.5 px-4 py-2 rounded-2xl border text-xs font-bold transition-all duration-150 cursor-pointer whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-theme-accent text-theme-panel border-theme-accent scale-[1.01] shadow-xs'
                        : 'bg-theme-bg/40 border-theme-border text-theme-text-muted hover:text-theme-text hover:border-theme-border/80'
                    }`}
                  >
                    <img 
                      src={u.avatarUrl} 
                      alt={u.name} 
                      className="w-5 h-5 rounded-lg object-cover border border-theme-border shrink-0" 
                    />
                    <span>{u.name}</span>
                    <span 
                      className={`text-[8px] font-black px-1.5 py-0.5 rounded-md ${
                        isSelected 
                          ? 'bg-theme-panel/20 text-theme-panel' 
                          : 'bg-theme-bg text-theme-text-muted border border-theme-border/50'
                      }`}
                    >
                      {u.role === 'admin' ? 'مدير' : 'شريك'}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* لوحة عرض النشاط للشركاء */}
            {(() => {
              const selectedUser = data.userStats.find(u => u.userId === selectedUserId)
              if (!selectedUser) {
                return (
                  <div className="flex flex-col items-center justify-center text-center py-12 space-y-2 opacity-60">
                    <User className="w-10 h-10 text-theme-text-muted" />
                    <p className="text-xs text-theme-text-muted font-bold">يرجى اختيار شريك لعرض سجل نشاطه.</p>
                  </div>
                )
              }

              const activeStandup = selectedDate ? (selectedUser.dailyStandups || []).find(s => s.date === selectedDate) : null
              const activeTasks = selectedDate ? (selectedUser.completedTasksDetails || []).filter(t => t.completedDate === selectedDate) : []
              const isTodaySelected = selectedDate === formatDateString(new Date())

              return (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                  
                  {/* عمود تقويم النشاط */}
                  <div className="lg:col-span-5 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-theme-text-muted">تقويم نشاط الشهر</span>
                      <div className="flex items-center gap-3 text-[10px] text-theme-text-muted font-bold">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          <span>ساعات العمل</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                          <span>المهام</span>
                        </span>
                      </div>
                    </div>

                    <div className="bg-theme-bg/15 border border-theme-border/60 rounded-3xl p-4">
                      {/* أسماء الأيام */}
                      <div className="grid grid-cols-7 gap-2 mb-2 border-b border-theme-border/30 pb-2">
                        {weekdays.map((w, idx) => (
                          <div key={idx} className="text-center text-[10px] font-black text-theme-text-muted">
                            {w}
                          </div>
                        ))}
                      </div>

                      {/* مربعات الأيام */}
                      <div className="grid grid-cols-7 gap-2">
                        {monthDays.map((day, idx) => {
                          if (!day) return <div key={`empty-${idx}`} className="aspect-square" />

                          const dateStr = formatDateString(day)
                          const dayStandup = (selectedUser.dailyStandups || []).find(s => s.date === dateStr)
                          const dayTasks = (selectedUser.completedTasksDetails || []).filter(t => t.completedDate === dateStr)
                          const isSelected = selectedDate === dateStr
                          const isToday = formatDateString(new Date()) === dateStr
                          const hasStandup = !!dayStandup
                          const hasTasks = dayTasks.length > 0

                          return (
                            <button
                              key={dateStr}
                              type="button"
                              onClick={() => setSelectedDate(dateStr)}
                              className={`aspect-square rounded-2xl border flex flex-col items-center justify-between p-2.5 cursor-pointer transition-all duration-150 relative ${
                                isSelected
                                  ? 'border-theme-accent bg-theme-panel shadow-sm ring-3 ring-theme-accent/15 font-black text-theme-text'
                                  : isToday
                                  ? 'border-theme-accent/40 bg-theme-bg/40 text-theme-accent font-black'
                                  : hasStandup || hasTasks
                                  ? 'border-theme-border bg-theme-panel hover:bg-theme-bg/30 text-theme-text'
                                  : 'border-transparent bg-transparent hover:bg-theme-bg/15 text-theme-text-muted/60'
                              }`}
                            >
                              {/* رقم اليوم */}
                              <span className={`text-xs font-bold ${isSelected ? 'scale-105' : ''}`}>
                                {day.getDate()}
                              </span>

                              {/* المؤشرات البصرية */}
                              <div className="flex gap-1 w-full justify-center items-center">
                                {hasStandup && (
                                  <>
                                    <span 
                                      className="hidden sm:inline-flex bg-indigo-500/10 text-indigo-500 text-[8px] font-bold px-1 py-0.5 rounded-md border border-indigo-500/10"
                                      title="ساعات العمل"
                                    >
                                      {Math.round((dayStandup.workMinutes / 60) * 10) / 10}س
                                    </span>
                                    <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-indigo-500" title="ساعات العمل" />
                                  </>
                                )}
                                {hasTasks && (
                                  <>
                                    <span 
                                      className="hidden sm:inline-flex bg-emerald-500/10 text-emerald-500 text-[8px] font-bold px-1 py-0.5 rounded-md border border-emerald-500/10"
                                      title="المهام المكتملة"
                                    >
                                      ✓{dayTasks.length}
                                    </span>
                                    <span className="sm:hidden w-1.5 h-1.5 rounded-full bg-emerald-500" title="المهام المكتملة" />
                                  </>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>

                  {/* عمود تفاصيل اليوم المحدد */}
                  <div className="lg:col-span-7 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-theme-text">
                        {selectedDate ? formatArabicDate(selectedDate) : 'اختر يوماً لرؤية التفاصيل'}
                      </span>
                      {isTodaySelected && (
                        <span className="text-[9px] bg-theme-accent text-theme-panel font-bold px-2 py-0.5 rounded-md">
                          اليوم
                        </span>
                      )}
                    </div>

                    <div className="bg-theme-bg/15 border border-theme-border/60 rounded-3xl p-5 min-h-[260px] flex flex-col justify-start gap-5">
                      {(!activeStandup && activeTasks.length === 0) ? (
                        <div className="flex-grow flex flex-col items-center justify-center text-center py-12 space-y-2 opacity-60">
                          <Calendar className="w-9 h-9 text-theme-text-muted" />
                          <p className="text-xs text-theme-text-muted font-bold">لا توجد سجلات أو مهام مكتملة في هذا اليوم للشريك المحدد</p>
                        </div>
                      ) : (
                        <div className="space-y-5">
                          
                          {/* تفاصيل اللقاء اليومي */}
                          {activeStandup && (
                            <div className="space-y-4">
                              
                              {/* مقاييس الترويسة للسجل اليومي */}
                              <div className="flex flex-wrap gap-2.5 items-center justify-between border-b border-theme-border/40 pb-3">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md border ${getMoodDetails(activeStandup.mood).color}`}>
                                    المزاج: {getMoodDetails(activeStandup.mood).label}
                                  </span>
                                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-md ${getProgressRateDetails(activeStandup.progressRate).color}`}>
                                    {getProgressRateDetails(activeStandup.progressRate).label}
                                  </span>
                                </div>

                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-theme-text-muted font-bold">الإنتاجية:</span>
                                    {renderStars(activeStandup.productivityScore)}
                                  </div>
                                  <div className="flex items-center gap-1 text-xs font-bold text-indigo-500 font-mono">
                                    <Clock className="w-4 h-4 text-indigo-400" />
                                    <span>{formatWorkTime(activeStandup.workMinutes)}</span>
                                  </div>
                                </div>
                              </div>

                              {/* النصوص التفصيلية */}
                              <div className="space-y-4 text-right">
                                {activeStandup.todayTasks && (
                                  <div>
                                    <h5 className="text-[10px] font-bold text-theme-text-muted mb-1.5 flex items-center gap-1 justify-start">
                                      <span className="w-1.5 h-1.5 rounded-full bg-theme-accent"></span>
                                      <span>ما تم إنجازه اليوم:</span>
                                    </h5>
                                    <div className="text-xs text-theme-text bg-theme-panel border border-theme-border/40 rounded-2xl p-4 leading-relaxed font-semibold whitespace-pre-wrap">
                                      {activeStandup.todayTasks}
                                    </div>
                                  </div>
                                )}

                                {activeStandup.tomorrowTasks && (
                                  <div>
                                    <h5 className="text-[10px] font-bold text-theme-text-muted mb-1.5 flex items-center gap-1 justify-start">
                                      <span className="w-1.5 h-1.5 rounded-full bg-theme-accent/60"></span>
                                      <span>خطة الغد:</span>
                                    </h5>
                                    <div className="text-xs text-theme-text bg-theme-panel border border-theme-border/40 rounded-2xl p-4 leading-relaxed font-semibold whitespace-pre-wrap">
                                      {activeStandup.tomorrowTasks}
                                    </div>
                                  </div>
                                )}

                                {activeStandup.blockers && (
                                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl p-4 flex gap-2.5 items-start text-right">
                                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                                    <div className="space-y-0.5">
                                      <h5 className="text-[10px] font-black">العوائق والصعوبات:</h5>
                                      <p className="text-xs font-bold leading-relaxed whitespace-pre-wrap">{activeStandup.blockers}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* المهام المكتملة */}
                          {activeTasks.length > 0 && (
                            <div className="space-y-2.5 pt-2.5 border-t border-theme-border/40">
                              <h5 className="text-[10px] font-black text-emerald-500 flex items-center gap-1.5 justify-start">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>المهام المكتملة في هذا اليوم ({activeTasks.length}):</span>
                              </h5>
                              <div className="grid grid-cols-1 gap-2">
                                {activeTasks.map((t, idx) => (
                                  <div key={idx} className="flex items-center gap-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-2xl p-3 text-right">
                                    <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                                    <span className="text-xs text-theme-text font-bold leading-normal">{t.title}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>

        </div>
      </main>

      {/* تنبيه التوست */}
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
