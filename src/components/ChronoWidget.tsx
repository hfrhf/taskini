'use client'

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Play, Pause, RotateCcw, X, Minimize2, Maximize2, Timer, Calendar, CheckSquare, Clock, Loader2 } from 'lucide-react'
import { getUserActiveTasks, logTaskTime } from '../app/actions'
import Toast from './Toast'

export default function ChronoWidget() {
  const pathname = usePathname()
  const router = useRouter()
  const [displayMode, setDisplayMode] = useState<'closed' | 'open' | 'minimized'>('closed')
  const [time, setTime] = useState<number>(0)
  const [isRunning, setIsRunning] = useState<boolean>(false)

  // حالات تحويل الوقت
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [activeTasks, setActiveTasks] = useState<any[]>([])
  const [selectedTaskId, setSelectedTaskId] = useState<string>('')
  const [convertType, setConvertType] = useState<'standup' | 'task'>('standup')
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingTasks, setIsLoadingTasks] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  const openConvertModal = async () => {
    setIsConvertModalOpen(true)
    setIsLoadingTasks(true)
    try {
      const tasks = await getUserActiveTasks()
      setActiveTasks(tasks)
      if (tasks.length > 0) {
        setSelectedTaskId(tasks[0].id)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingTasks(false)
    }
  }

  const elapsedMinutes = Math.max(1, Math.round(time / 60))

  const handleConvertConfirm = async () => {
    setIsSaving(true)
    try {
      if (convertType === 'standup') {
        // حفظ الوقت بالدقائق في المخزن المحلي وإرسال حدث تنبيه
        localStorage.setItem('pending_chrono_minutes', elapsedMinutes.toString())
        window.dispatchEvent(new CustomEvent('chrono-time-transferred', { detail: elapsedMinutes }))
        
        // التوجيه لصفحة اللقاء اليومي
        router.push('/standup')
        
        setToast({ message: 'تم نقل الوقت للّقاء اليومي. يرجى كتابة التقرير وتأكيد الحفظ.', type: 'success' })
      } else {
        if (!selectedTaskId) {
          setToast({ message: 'يرجى اختيار المهمة أولاً', type: 'warning' })
          setIsSaving(false)
          return
        }
        await logTaskTime(selectedTaskId, elapsedMinutes)
        setToast({ message: `تم تسجيل ${elapsedMinutes} دقيقة للمهمة بنجاح!`, type: 'success' })
      }
      setIsConvertModalOpen(false)
      handleReset() // تصفير العداد عند الحفظ بنجاح
    } catch (error: any) {
      setToast({ message: 'فشل حفظ الوقت: ' + error.message, type: 'error' })
    } finally {
      setIsSaving(false)
    }
  }

  // إخفاء العداد في صفحة تسجيل الدخول
  if (pathname === '/login') return null

  // تحميل حالة المؤقت عند بدء التشغيل
  useEffect(() => {
    try {
      const running = localStorage.getItem('chrono_is_running') === 'true'
      const mode = (localStorage.getItem('chrono_display_mode') || 'closed') as 'closed' | 'open' | 'minimized'
      
      if (running) {
        const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
        const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
        
        if (startTime > 0) {
          const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
          setTime(currentElapsed)
          setIsRunning(true)
          // إذا كان المؤقت يعمل، نفتحه بوضع مصغر تلقائياً لتنبيه المستخدم
          setDisplayMode(mode === 'closed' ? 'minimized' : mode)
        }
      } else {
        const elapsed = parseInt(localStorage.getItem('chrono_elapsed') || '0', 10)
        setTime(elapsed)
        setIsRunning(false)
        setDisplayMode(mode)
      }
    } catch (e) {
      console.error('[ChronoWidget] Load state error:', e)
    }
  }, [])

  // الحفاظ على تشغيل العداد وتحديثه
  useEffect(() => {
    let intervalId: any = null

    if (isRunning) {
      intervalId = setInterval(() => {
        try {
          const startTime = parseInt(localStorage.getItem('chrono_start_time') || '0', 10)
          const elapsedBefore = parseInt(localStorage.getItem('chrono_elapsed_before') || '0', 10)
          if (startTime > 0) {
            const currentElapsed = Math.floor((Date.now() - startTime) / 1000) + elapsedBefore
            setTime(currentElapsed)
          }
        } catch (e) {}
      }, 250)
    }

    return () => {
      if (intervalId) clearInterval(intervalId)
    }
  }, [isRunning])

  // حفظ حالة وضع العرض عند تغييره
  const changeDisplayMode = (newMode: 'closed' | 'open' | 'minimized') => {
    setDisplayMode(newMode)
    try {
      localStorage.setItem('chrono_display_mode', newMode)
    } catch (e) {}
  }

  // بدء المؤقت
  const handleStart = () => {
    setIsRunning(true)
    const now = Date.now()
    try {
      localStorage.setItem('chrono_is_running', 'true')
      localStorage.setItem('chrono_start_time', now.toString())
      localStorage.setItem('chrono_elapsed_before', time.toString())
    } catch (e) {}
  }

  // إيقاف مؤقت
  const handlePause = () => {
    setIsRunning(false)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', time.toString())
    } catch (e) {}
  }

  // تصفير العداد
  const handleReset = () => {
    setIsRunning(false)
    setTime(0)
    try {
      localStorage.setItem('chrono_is_running', 'false')
      localStorage.setItem('chrono_elapsed', '0')
      localStorage.setItem('chrono_start_time', '0')
      localStorage.setItem('chrono_elapsed_before', '0')
    } catch (e) {}
  }

  // تنسيق الوقت المكتوب (ساعات:دقائق:ثواني)
  const formatTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  };

  // تنسيق وقت مصغر (دقائق:ثواني أو ساعات:دقائق)
  const formatCompactTime = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hrs > 0) {
      return `${hrs}س ${mins}د`
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  };

  // حساب طول الدائرة لثانية التحديث (حلقة الدوران)
  const radius = 40
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - ((time % 60) / 60) * circumference

  return (
    <>
      {displayMode === 'closed' ? (
        <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 animate-modal-in">
          <button
            onClick={() => changeDisplayMode('open')}
            className="w-12 h-12 rounded-full bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text border border-theme-border shadow-2xl flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105 active:scale-95 group relative"
            title="مؤقت العمل المساعد"
          >
            <Timer className="w-5.5 h-5.5 text-theme-accent group-hover:rotate-12 transition-transform" />
            {time > 0 && (
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-theme-accent rounded-full animate-ping" />
            )}
          </button>
        </div>
      ) : displayMode === 'minimized' ? (
        <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 animate-modal-in">
          <div
            onClick={() => changeDisplayMode('open')}
            className="flex items-center gap-2 bg-theme-accent text-theme-panel font-mono font-bold text-[11px] py-2 px-3.5 rounded-full shadow-2xl cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200 border border-theme-accent-hover/30"
            title="توسيع عداد العمل"
          >
            <Timer className="w-4 h-4 animate-pulse shrink-0" />
            <span>{formatCompactTime(time)}</span>
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-theme-panel animate-ping shrink-0" />
            )}
          </div>
        </div>
      ) : (
        <div className="fixed bottom-24 left-4 md:bottom-6 md:left-6 z-50 w-64 bg-theme-panel/90 backdrop-blur-md border border-theme-border rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.3)] text-right animate-modal-in select-none">
          {/* الترويسة وأزرار التحكم بالوضع */}
          <div className="flex items-center justify-between gap-4 border-b border-theme-border/50 pb-2 mb-4">
            <span className="text-[10px] font-bold text-theme-text-muted flex items-center gap-1">
              <Timer className="w-3.5 h-3.5 text-theme-accent" />
              <span>عداد ساعات العمل</span>
            </span>
            
            <div className="flex items-center gap-1">
              <button
                onClick={() => changeDisplayMode('minimized')}
                className="p-1 hover:bg-theme-bg rounded-lg text-theme-text-muted hover:text-theme-text transition-colors cursor-pointer"
                title="تصغير"
              >
                <Minimize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => changeDisplayMode('closed')}
                className="p-1 hover:bg-theme-bg rounded-lg text-theme-text-muted hover:text-rose-500 transition-colors cursor-pointer"
                title="إغلاق تماماً"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* حلقة المؤقت الدائرية الفخمة */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center my-4">
            <svg className="w-full h-full transform -rotate-90">
              {/* حلقة الخلفية الباهتة */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="transparent"
                stroke="var(--theme-border)"
                strokeWidth="4"
                className="opacity-40"
              />
              {/* حلقة التقدم النشطة */}
              <circle
                cx="72"
                cy="72"
                r={radius}
                fill="transparent"
                stroke="var(--theme-accent)"
                strokeWidth="4"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-300"
                style={{
                  filter: isRunning ? 'drop-shadow(0 0 2px var(--theme-accent))' : 'none'
                }}
              />
            </svg>
            
            {/* الوقت المكتوب في المنتصف */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-mono text-lg font-black text-theme-text tracking-tight">
                {formatTime(time)}
              </span>
              <span className="text-[9px] font-bold text-theme-text-muted mt-0.5">
                {isRunning ? 'جاري الحساب...' : 'متوقف مؤقتاً'}
              </span>
            </div>
          </div>

          {/* أزرار التحكم بالعداد */}
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={handleReset}
              className="flex-1 bg-theme-bg hover:bg-theme-border border border-theme-border text-theme-text-muted hover:text-theme-text font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
              title="إعادة تعيين العداد"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>تصفير</span>
            </button>

            {isRunning ? (
              <button
                onClick={handlePause}
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-lg shadow-amber-500/10"
                title="إيقاف مؤقت"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>إيقاف</span>
              </button>
            ) : (
              <button
                onClick={handleStart}
                className="flex-1 bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-lg shadow-theme-accent/15"
                title="بدء الحساب"
              >
                <Play className="w-3.5 h-3.5" />
                <span>بدء</span>
              </button>
            )}
          </div>

          {time > 0 && (
            <div className="pt-3 border-t border-theme-border/50 mt-3">
              <button
                onClick={openConvertModal}
                className="w-full bg-theme-accent hover:bg-theme-accent-hover text-theme-panel font-bold py-2 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-lg shadow-theme-accent/15"
                title="تحويل الوقت المسجل"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>تحويل الوقت كـ...</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* ================== نافذة تحويل الوقت (Modal) ================== */}
      {isConvertModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 animate-fade-in" role="dialog">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity" onClick={() => setIsConvertModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-sm rounded-3xl p-5 shadow-[0_25px_60px_rgba(0,0,0,0.4)] border border-theme-border animate-modal-in z-10 text-right max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-start justify-between gap-4 mb-4 border-b border-theme-border/50 pb-2">
              <div>
                <h3 className="text-xs font-black text-theme-text">تحويل وقت العداد</h3>
                <p className="text-[9px] text-theme-text-muted mt-0.5">تسجيل الوقت المستغرق في إنجاز أعمالك</p>
              </div>
              <button 
                onClick={() => setIsConvertModalOpen(false)}
                className="p-1 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              {/* عرض الوقت المستغرق - مبسط وأفقي */}
              <div className="bg-theme-bg/40 border border-theme-border rounded-2xl p-2.5 flex items-center justify-between text-xs">
                <span className="text-theme-text-muted font-bold">وقت العداد المترجم:</span>
                <span className="font-mono font-black text-theme-accent text-sm">
                  {elapsedMinutes >= 60 
                    ? `${Math.floor(elapsedMinutes / 60)}س ${elapsedMinutes % 60}د` 
                    : `${elapsedMinutes} دقيقة`
                  }
                </span>
              </div>

              {/* اختيار نوع التحويل - أزرار مسطحة ومبسطة كـ Segmented Tabs */}
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-theme-text-muted">اختر مكان التسجيل:</label>
                <div className="flex bg-theme-bg/60 p-1 rounded-2xl border border-theme-border/50">
                  <button
                    type="button"
                    onClick={() => setConvertType('standup')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                      convertType === 'standup'
                        ? 'bg-theme-accent text-theme-panel shadow-sm font-black'
                        : 'text-theme-text-muted hover:text-theme-text'
                    }`}
                  >
                    لقاء اليوميات
                  </button>
                  <button
                    type="button"
                    onClick={() => setConvertType('task')}
                    className={`flex-1 py-2 rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer ${
                      convertType === 'task'
                        ? 'bg-theme-accent text-theme-panel shadow-sm font-black'
                        : 'text-theme-text-muted hover:text-theme-text'
                    }`}
                  >
                    مهمة نشطة
                  </button>
                </div>
              </div>

              {/* اختيار المهمة في حال كان نوع التحويل مهمة */}
              {convertType === 'task' && (
                <div className="space-y-1.5 animate-modal-in">
                  <label className="block text-[10px] font-bold text-theme-text-muted">اختر المهمة النشطة:</label>
                  {isLoadingTasks ? (
                    <div className="flex items-center justify-center p-2 text-xs text-theme-text-muted">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-theme-accent ml-2" />
                      <span>جاري تحميل مهامك...</span>
                    </div>
                  ) : activeTasks.length === 0 ? (
                    <p className="text-[9px] text-rose-500 bg-rose-500/10 border border-rose-500/20 rounded-xl p-2.5 text-center font-bold">
                      لا توجد مهام نشطة مسندة إليك حالياً.
                    </p>
                  ) : (
                    <select
                      value={selectedTaskId}
                      onChange={(e) => setSelectedTaskId(e.target.value)}
                      className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-2xl px-4 py-2.5 text-xs transition-all outline-none cursor-pointer font-bold shadow-inner"
                    >
                      {activeTasks.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title} ({t.group?.name || 'عام'})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {/* أزرار الحفظ والإغلاق */}
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleConvertConfirm}
                  disabled={isSaving || (convertType === 'task' && activeTasks.length === 0)}
                  className="flex-grow order-1 sm:order-2 bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 disabled:text-theme-text-muted text-theme-panel font-bold py-2.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-md hover:shadow-lg active:scale-95"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري التسجيل...</span>
                    </>
                  ) : (
                    <span>تأكيد وتسجيل الوقت</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsConvertModalOpen(false)}
                  className="order-2 sm:order-1 px-4 bg-theme-bg hover:bg-theme-border border border-theme-border text-theme-text font-bold py-2.5 rounded-xl text-xs transition-colors cursor-pointer active:scale-95 text-center"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </>
  )
}
