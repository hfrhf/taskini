'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Users, Calendar, FolderKanban, Edit2, Loader2, Clock, Palette, Download, MessageSquare, TrendingUp, BarChart3, Lightbulb, Bell, Globe } from 'lucide-react'
import { logout } from '@/app/login/actions'
import { updateProfile, getMyPendingTasks } from '@/app/actions'

interface HeaderProps {
  user: {
    name: string
    email: string
    role: string
    avatar_url: string
  }
}

const themes = [
  { id: 'light', name: 'كلاسيكي فاتح', colorClass: 'bg-white border-gray-200' },
  { id: 'chatgpt-dark', name: 'رمادي كربوني', colorClass: 'bg-[#171717] border-neutral-700' },
  { id: 'purple-dark', name: 'بنفسجي ملكي', colorClass: 'bg-[#8B5CF6] border-purple-500' },
  { id: 'midnight-blue', name: 'أزرق داكن', colorClass: 'bg-[#0F172A] border-sky-400' },
]

export default function Header({ user }: HeaderProps) {
  const pathname = usePathname()
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [activeTheme, setActiveTheme] = useState('light')
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false)

  // إشعارات المهام المسندة
  const [myTasks, setMyTasks] = useState<any[]>([])
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const tasks = await getMyPendingTasks()
        setMyTasks(tasks)
      } catch (e) {
        console.error('Failed to load pending tasks for notifications', e)
      }
    }
    loadNotifications()

    // استعلام دوري خفيف كل 60 ثانية لتحديث قائمة الإشعارات تلقائياً
    const interval = setInterval(loadNotifications, 60000)
    return () => clearInterval(interval)
  }, [])

  // حالات PWA وتثبيت التطبيق
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [isIOS, setIsIOS] = useState(false)
  const [isInstalled, setIsInstalled] = useState(true) // نبدأ بـ true (مخفي) افتراضياً للأندرويد حتى يثبت العكس
  const [installErrorModalOpen, setInstallErrorModalOpen] = useState(false)

  useEffect(() => {
    const savedTheme = localStorage.getItem('taskini-theme') || 'light'
    setActiveTheme(savedTheme)

    // التحقق مما إذا كان نظام التشغيل iOS
    const userAgent = window.navigator.userAgent.toLowerCase()
    const iosMatch = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(iosMatch)

    const checkStatus = async () => {
      // 1. التحقق مما إذا كان التطبيق يعمل حالياً في وضع Standalone (تطبيق مثبت ومفتوح)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone
      console.log('[PWA Header] checkStatus isStandalone:', isStandalone)
      if (isStandalone) {
        setIsInstalled(true)
        try {
          localStorage.setItem('pwa-installed', 'true')
        } catch (e) {}
        return
      }

      // 2. التحقق عبر getInstalledRelatedApps إذا كان مدعوماً في المتصفح
      if ('navigator' in window && 'getInstalledRelatedApps' in navigator) {
        try {
          const apps = await (navigator as any).getInstalledRelatedApps()
          console.log('[PWA Header] getInstalledRelatedApps apps:', apps)
          if (apps && apps.length > 0) {
            setIsInstalled(true)
            try {
              localStorage.setItem('pwa-installed', 'true')
            } catch (e) {}
            return
          }
        } catch (err) {
          console.warn('[PWA Header] getInstalledRelatedApps error:', err)
        }
      }

      // 3. التحقق من علامة localStorage
      try {
        const localVal = localStorage.getItem('pwa-installed')
        if (localVal === 'true') {
          setIsInstalled(true)
          return
        }
      } catch (e) {}

      // 4. إذا لم يكن مثبتاً بأي طريقة أعلاه:
      if (iosMatch) {
        // في الآيفون، نظهر الزر دائماً لأن حدث beforeinstallprompt لا يعمل هناك، ونحتاج لتوجيههم يدوياً
        setIsInstalled(false)
      } else {
        // في الأندرويد/الكمبيوتر: نفحص ما إذا كان الحدث قد تم التقاطه مسبقاً في الـ window
        const winPrompt = (window as any).deferredPrompt
        console.log('[PWA Header] Initial window.deferredPrompt check:', winPrompt ? 'EXISTS' : 'NULL')
        if (winPrompt) {
          setDeferredPrompt(winPrompt)
          setIsInstalled(false) // إظهار الزر لأن المتصفح أخبرنا أنه غير مثبت ومتاح للتثبيت
        } else {
          // إذا لم يتم التقاطه بعد، نترك الزر مخفياً حتى يطلق المتصفح الحدث
          setIsInstalled(true)
        }
      }
    }

    checkStatus()

    // الاستماع لحدث التثبيت الأصلي من المتصفح (يطلق فقط إذا كان التطبيق غير مثبت)
    const handleBeforeInstallPrompt = (e: Event) => {
      console.log('[PWA Header] Caught native beforeinstallprompt event')
      e.preventDefault()
      setDeferredPrompt(e)
      setIsInstalled(false) // إظهار الزر فوراً بمجرد تفعيل المتصفح لإمكانية التثبيت
      try {
        localStorage.setItem('pwa-installed', 'false')
      } catch (err) {}
    }

    // الاستماع للحدث المخصص المبثوث من الـ layout
    const handleCustomPromptNotification = (e: any) => {
      console.log('[PWA Header] Caught custom pwa-prompt-available event. Detail:', e.detail ? 'EXISTS' : 'NULL')
      setDeferredPrompt(e.detail)
      setIsInstalled(false) // إظهار الزر
      try {
        localStorage.setItem('pwa-installed', 'false')
      } catch (err) {}
    }

    // الاستماع لاكتمال التثبيت
    const handleAppInstalled = () => {
      console.log('[PWA Header] Caught native appinstalled event')
      setIsInstalled(true) // إخفاء الزر فوراً بعد اكتمال التثبيت
      setDeferredPrompt(null)
      delete (window as any).deferredPrompt
      try {
        localStorage.setItem('pwa-installed', 'true')
      } catch (err) {}
    }

    const handleCustomInstalledStatus = (e: any) => {
      console.log('[PWA Header] Caught custom pwa-installed-status event. Detail:', e.detail)
      if (e.detail) {
        setIsInstalled(true) // إخفاء الزر
        setDeferredPrompt(null)
        try {
          localStorage.setItem('pwa-installed', 'true')
        } catch (err) {}
      }
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('pwa-prompt-available', handleCustomPromptNotification as EventListener)
    window.addEventListener('appinstalled', handleAppInstalled)
    window.addEventListener('pwa-installed-status', handleCustomInstalledStatus as EventListener)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('pwa-prompt-available', handleCustomPromptNotification as EventListener)
      window.removeEventListener('appinstalled', handleAppInstalled)
      window.removeEventListener('pwa-installed-status', handleCustomInstalledStatus as EventListener)
    }
  }, [])

  const handleInstallApp = async () => {
    const promptEvent = deferredPrompt || (window as any).deferredPrompt
    console.log('[PWA Header] handleInstallApp called. Event exists?', !!promptEvent)
    
    if (!promptEvent) {
      console.log('[PWA Header] No prompt event available. Showing manual install guide modal');
      setInstallErrorModalOpen(true)
      setIsUserMenuOpen(false)
      return
    }
    
    try {
      console.log('[PWA Header] Triggering PWA installation prompt...')
      await promptEvent.prompt()
      
      const { outcome } = await promptEvent.userChoice
      console.log('[PWA Header] User choice outcome:', outcome)
      
      if (outcome === 'accepted') {
        setIsInstalled(true)
        try {
          localStorage.setItem('pwa-installed', 'true')
        } catch (e) {}
      }
      
      setDeferredPrompt(null)
      delete (window as any).deferredPrompt
      setIsUserMenuOpen(false)
    } catch (err) {
      console.error('[PWA Header] Failed to open native install prompt:', err)
      setInstallErrorModalOpen(true)
      setIsUserMenuOpen(false)
    }
  }

  const handleThemeChange = (themeId: string) => {
    localStorage.setItem('taskini-theme', themeId)
    document.documentElement.setAttribute('data-theme', themeId)
    setActiveTheme(themeId)
    setIsThemeMenuOpen(false)
  }

  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') return true
    if (path !== '/' && pathname.startsWith(path)) return true
    return false
  }

  const handleUpdateProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const name = formData.get('name') as string
    const password = formData.get('password') as string

    try {
      setIsPending(true)
      const res = await updateProfile(name, formData, password)
      if (res.success) {
        setIsProfileModalOpen(false)
        window.location.reload() // تحديث الصفحة لتظهر الصورة والاسم الجديدين في كل مكان
      }
    } catch (err: any) {
      alert('فشل تحديث الملف الشخصي: ' + err.message)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <>
      <header className="sticky top-0 z-40 bg-theme-panel/90 backdrop-blur-md border-b border-theme-border transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-20 h-auto sm:h-20 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] pb-4 sm:py-0 flex items-center justify-between">
          
          {/* الشعار */}
          <Link href="/" className="text-2xl font-bold tracking-tight text-theme-text">
            ديجي<span className="text-theme-text-muted font-normal">تاسك</span>
          </Link>

          {/* روابط التنقل بين الصفحات الرئيسية */}
          <nav className="hidden md:flex items-center gap-8 font-medium text-sm">
            <Link 
              href="/" 
              className={`flex items-center gap-1.5 pb-1 transition-all border-b-2 ${
                isActive('/') 
                  ? 'text-theme-text border-theme-accent font-bold' 
                  : 'text-theme-text-muted hover:text-theme-text border-transparent'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>مجموعات العمل</span>
            </Link>
            <Link 
              href="/feed" 
              className={`flex items-center gap-1.5 pb-1 transition-all border-b-2 ${
                isActive('/feed') 
                  ? 'text-theme-text border-theme-accent font-bold' 
                  : 'text-theme-text-muted hover:text-theme-text border-transparent'
              }`}
            >
              <Globe className="w-4 h-4" />
              <span>ساحة المشاركة</span>
            </Link>
            <Link 
              href="/standup" 
              className={`flex items-center gap-1.5 pb-1 transition-all border-b-2 ${
                isActive('/standup') 
                  ? 'text-theme-text border-theme-accent font-bold' 
                  : 'text-theme-text-muted hover:text-theme-text border-transparent'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>اللقاء اليومي</span>
            </Link>
            <Link 
              href="/ideas" 
              className={`flex items-center gap-1.5 pb-1 transition-all border-b-2 ${
                isActive('/ideas') 
                  ? 'text-theme-text border-theme-accent font-bold' 
                  : 'text-theme-text-muted hover:text-theme-text border-transparent'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>العصف الذهني</span>
            </Link>
          </nav>

          {/* معلومات الحساب والسمات */}
          <div className="flex items-center gap-2.5">
            {/* مربع حساب المستخدم والمنسدلة */}
            <div className="relative">
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-2 bg-theme-bg hover:bg-theme-border border border-theme-border rounded-2xl p-1.5 pl-3 cursor-pointer transition-all duration-200 group text-right"
                title="قائمة الحساب"
              >
                <div className="relative">
                  <img 
                    src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'} 
                    alt={user.name} 
                    className="w-8 h-8 rounded-xl object-cover border border-theme-border animate-modal-in"
                  />
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-theme-text">{user.name}</p>
                  <p className="text-[10px] text-theme-text-muted font-medium">
                    {user.role === 'admin' ? 'مدير النظام' : 'مستلم مهام'}
                  </p>
                </div>
              </button>

              {isUserMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                  <div className="absolute right-0 left-auto rtl:left-0 rtl:right-auto mt-2 w-52 bg-theme-panel border border-theme-border rounded-2xl shadow-xl py-2 z-50 animate-modal-in text-right">
                    <div className="px-4 py-2 border-b border-theme-border">
                      <p className="text-xs font-bold text-theme-text truncate">{user.name}</p>
                      <p className="text-[10px] text-theme-text-muted truncate mt-0.5">{user.email}</p>
                    </div>
                    
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false)
                        setIsProfileModalOpen(true)
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تعديل الملف الشخصي</span>
                    </button>

                    <Link
                      href="/availability"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right"
                    >
                      <Clock className="w-3.5 h-3.5" />
                      <span>جدول أوقات توفري</span>
                    </Link>

                    <Link
                      href="/team"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>فريق العمل</span>
                    </Link>

                    <Link
                      href="/analytics"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right"
                    >
                      <BarChart3 className="w-3.5 h-3.5" />
                      <span>تقارير الإنتاجية</span>
                    </Link>

                    <Link
                      href="/archive"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right"
                    >
                      <Calendar className="w-3.5 h-3.5 text-theme-text-muted" />
                      <span>سجل الإنجاز التاريخي</span>
                    </Link>

                    <Link
                      href="/roadmap"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right border-t border-theme-border/30 pt-1"
                    >
                      <TrendingUp className="w-3.5 h-3.5 text-theme-text-muted" />
                      <span>خريطة الطريق</span>
                    </Link>

                    {/* خيار تثبيت التطبيق PWA */}
                    {!isInstalled && (
                      <button
                        onClick={handleInstallApp}
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-theme-text hover:bg-theme-bg cursor-pointer transition-colors text-right border-t border-theme-border/50 pt-2 group"
                      >
                        <div className="bg-emerald-500/10 p-1.5 rounded-lg group-hover:bg-emerald-500/20 transition-colors">
                          <Download className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">تحميل التطبيق مباشرة</span>
                          <span className="text-[9px] text-theme-text-muted mt-0.5">تثبيت بنقرة واحدة</span>
                        </div>
                      </button>
                    )}

                    <div className="h-px bg-theme-border my-1"></div>

                    <form action={logout} onSubmit={() => setIsUserMenuOpen(false)}>
                      <button 
                        type="submit"
                        className="w-full flex items-center gap-2 px-4 py-2.5 text-xs text-rose-600 hover:bg-rose-950/10 cursor-pointer transition-colors text-right"
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        <span>تسجيل الخروج</span>
                      </button>
                    </form>
                  </div>
                </>
              )}
            </div>

            {/* جرس الإشعارات الفاخر */}
            <div className="relative">
              <button
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text rounded-xl border border-theme-border transition-all duration-200 flex items-center justify-center shadow-sm cursor-pointer relative"
                title="الإشعارات والمهام المسندة"
              >
                <Bell className="w-4 h-4" />
                {myTasks.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center animate-pulse">
                    {myTasks.length}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)}></div>
                  <div className="fixed sm:absolute top-24 sm:top-auto left-4 right-4 sm:left-auto sm:right-0 sm:rtl:left-0 sm:rtl:right-auto mt-2 w-auto sm:w-80 bg-theme-panel border border-theme-border rounded-2xl shadow-xl py-3 z-50 animate-modal-in text-right">
                    <div className="px-4 pb-2 border-b border-theme-border/50 flex items-center justify-between">
                      <span className="text-xs font-black text-theme-text">الإشعارات</span>
                      <span className="text-[10px] font-bold text-theme-text-muted bg-theme-bg px-2 py-0.5 rounded-full">
                        {myTasks.length} مهام معلقة
                      </span>
                    </div>

                    <div className="max-h-60 overflow-y-auto custom-scrollbar pt-1">
                      {myTasks.length === 0 ? (
                        <div className="px-4 py-6 text-center text-xs text-theme-text-muted">
                          لا توجد مهام جديدة مسندة إليك حالياً 🎉
                        </div>
                      ) : (
                        myTasks.map((task) => (
                          <Link
                            key={task.id}
                            href={`/task/${task.id}`}
                            onClick={() => setIsNotificationsOpen(false)}
                            className="block px-4 py-3 hover:bg-theme-bg transition-colors border-b border-theme-border/20 last:border-b-0 text-right"
                          >
                            <p className="text-xs font-bold text-theme-text hover:text-theme-accent line-clamp-1">{task.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-theme-text-muted">
                              <span>المجموعة: {task.group_name}</span>
                              <span>•</span>
                              <span>تسليم: {task.due_date}</span>
                            </div>
                          </Link>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* مبدل السمات الأنيق */}
            <div className="relative">
              <button
                onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
                className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text-muted hover:text-theme-text rounded-xl border border-theme-border transition-all duration-200 flex items-center justify-center shadow-sm cursor-pointer"
                title="تغيير المظهر"
              >
                <Palette className="w-4 h-4" />
              </button>

              {isThemeMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsThemeMenuOpen(false)}></div>
                  <div className="absolute right-0 left-auto rtl:left-0 rtl:right-auto mt-2 w-48 bg-theme-panel border border-theme-border rounded-2xl shadow-xl py-2 z-50 animate-modal-in text-right">
                    <p className="px-4 py-1.5 text-[10px] font-bold text-theme-text-muted select-none">اختر مظهر النظام</p>
                    <div className="h-px bg-theme-border my-1"></div>
                    {themes.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => handleThemeChange(t.id)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-xs font-medium transition-colors hover:bg-theme-bg cursor-pointer ${
                          activeTheme === t.id ? 'text-theme-accent font-bold' : 'text-theme-text'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-3.5 h-3.5 rounded-full border ${t.colorClass}`}></span>
                          <span>{t.name}</span>
                        </div>
                        {activeTheme === t.id && (
                          <span className="w-1.5 h-1.5 bg-theme-accent rounded-full"></span>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* شريط التنقل السفلي الفاخر العائم للهواتف الذكية */}
      <nav className="md:hidden fixed bottom-5 left-4 right-4 bg-theme-panel/90 backdrop-blur-md border border-theme-border/60 flex items-center justify-around py-2 px-1 z-40 rounded-[2rem] shadow-[0_12px_40px_rgba(0,0,0,0.12)] transition-all duration-300">
        <Link 
          href="/" 
          className={`flex flex-col items-center gap-1 text-[10px] py-2 px-3 rounded-2xl transition-all duration-300 relative ${
            isActive('/') 
              ? 'text-theme-accent font-bold bg-theme-accent/10 shadow-sm' 
              : 'text-theme-text-muted hover:text-theme-text'
          }`}
        >
          <FolderKanban className="w-5 h-5 transition-transform duration-300 active:scale-95" />
          <span>المجموعات</span>
        </Link>
        <Link 
          href="/feed" 
          className={`flex flex-col items-center gap-1 text-[10px] py-2 px-2.5 rounded-2xl transition-all duration-300 relative ${
            isActive('/feed') 
              ? 'text-theme-accent font-bold bg-theme-accent/10 shadow-sm' 
              : 'text-theme-text-muted hover:text-theme-text'
          }`}
        >
          <Globe className="w-5 h-5 transition-transform duration-300 active:scale-95" />
          <span>المنشورات</span>
        </Link>
        <Link 
          href="/standup" 
          className={`flex flex-col items-center gap-1 text-[10px] py-2 px-2.5 rounded-2xl transition-all duration-300 relative ${
            isActive('/standup') 
              ? 'text-theme-accent font-bold bg-theme-accent/10 shadow-sm' 
              : 'text-theme-text-muted hover:text-theme-text'
          }`}
        >
          <MessageSquare className="w-5 h-5 transition-transform duration-300 active:scale-95" />
          <span>اللقاء</span>
        </Link>
        <Link 
          href="/ideas" 
          className={`flex flex-col items-center gap-1 text-[10px] py-2 px-2.5 rounded-2xl transition-all duration-300 relative ${
            isActive('/ideas') 
              ? 'text-theme-accent font-bold bg-theme-accent/10 shadow-sm' 
              : 'text-theme-text-muted hover:text-theme-text'
          }`}
        >
          <Lightbulb className="w-5 h-5 transition-transform duration-300 active:scale-95" />
          <span>الأفكار</span>
        </Link>

      </nav>

      {/* ================== نافذة تعديل الملف الشخصي (Modal) ================== */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsProfileModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-50 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">تعديل ملفك الشخصي</h3>
                <p className="text-xs text-theme-text-muted mt-1">تحديث اسمك الكامل وصورتك الشخصية (Avatar)</p>
              </div>
              <button 
                onClick={() => setIsProfileModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleUpdateProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الاسم الكامل</label>
                <input 
                  type="text" 
                  name="name" 
                  required
                  defaultValue={user.name}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-base md:text-xs transition-all outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">تحديث الصورة الشخصية (الأفاتار)</label>
                <div className="flex items-center gap-3">
                  <img 
                    src={user.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'} 
                    alt={user.name} 
                    className="w-12 h-12 rounded-2xl object-cover border border-theme-border"
                  />
                  <input 
                    type="file" 
                    name="avatar_file"
                    accept="image/*"
                    className="flex-1 bg-theme-input border border-theme-border focus:border-theme-accent text-theme-text rounded-xl px-3 py-2 text-base md:text-xs transition-all outline-none file:bg-theme-accent file:text-theme-panel file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:ml-3 file:text-[10px] file:font-bold file:cursor-pointer cursor-pointer"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">كلمة مرور جديدة (اختياري)</label>
                <input 
                  type="password" 
                  name="password" 
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-base md:text-xs transition-all outline-none text-left" 
                  placeholder="اتركها فارغة إذا لم تكن تريد تغييرها"
                  minLength={6}
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isPending}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التغييرات...</span>
                    </>
                  ) : (
                    <span>حفظ التعديلات</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* نافذة التنبيه وتعليمات التثبيت اليدوي */}
      {installErrorModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-0" role="dialog">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setInstallErrorModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-auto rounded-[2rem] p-8 shadow-2xl border border-theme-border animate-modal-in z-[61] text-right overflow-hidden">
            
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-emerald-500/10 to-transparent pointer-events-none"></div>

            <div className="relative z-10">
              <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-emerald-500/20">
                <Download className="w-8 h-8 text-emerald-500" />
              </div>

              <h3 className="text-xl font-black text-theme-text text-center mb-3">تثبيت التطبيق</h3>
              
              <div className="bg-theme-bg/50 backdrop-blur-sm rounded-2xl p-5 mb-8 border border-theme-border shadow-inner">
                {isIOS ? (
                  <>
                    <p className="text-sm text-theme-text-muted leading-relaxed text-center font-medium mb-4">
                      لأنظمة iOS (الآيفون والآيباد)، يرجى اتباع الخطوات التالية لتثبيت التطبيق:
                    </p>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3 text-xs text-theme-text bg-theme-panel p-3 rounded-xl border border-theme-border shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-emerald-500 font-bold">1</span>
                        </div>
                        <span>افتح هذا الرابط باستخدام متصفح <b>Safari</b>.</span>
                      </li>
                      <li className="flex items-center gap-3 text-xs text-theme-text bg-theme-panel p-3 rounded-xl border border-theme-border shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-emerald-500 font-bold">2</span>
                        </div>
                        <span>اضغط على زر المشاركة (Share) في أسفل الشاشة.</span>
                      </li>
                      <li className="flex items-center gap-3 text-xs text-theme-text bg-theme-panel p-3 rounded-xl border border-theme-border shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-emerald-500 font-bold">3</span>
                        </div>
                        <span>اختر "إضافة إلى الصفحة الرئيسية" (Add to Home Screen).</span>
                      </li>
                    </ul>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-theme-text-muted leading-relaxed text-center font-medium mb-4">
                      التثبيت التلقائي غير متاح حالياً (قد يكون التطبيق مثبتاً بالفعل أو بسبب إعدادات المتصفح). يمكنك التثبيت يدوياً:
                    </p>
                    <ul className="space-y-3">
                      <li className="flex items-center gap-3 text-xs text-theme-text bg-theme-panel p-3 rounded-xl border border-theme-border shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-emerald-500 font-bold">1</span>
                        </div>
                        <span>اضغط على قائمة المتصفح (الثلاث نقاط) في الأعلى.</span>
                      </li>
                      <li className="flex items-center gap-3 text-xs text-theme-text bg-theme-panel p-3 rounded-xl border border-theme-border shadow-sm">
                        <div className="w-6 h-6 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <span className="text-emerald-500 font-bold">2</span>
                        </div>
                        <span>اختر "تثبيت التطبيق" (Install App) أو "إضافة للشاشة الرئيسية".</span>
                      </li>
                    </ul>
                  </>
                )}
              </div>

              <button 
                onClick={() => setInstallErrorModalOpen(false)}
                className="w-full bg-theme-text text-theme-panel hover:bg-theme-text-muted font-bold py-4 rounded-2xl text-sm transition-all duration-200 cursor-pointer shadow-lg hover:shadow-xl hover:-translate-y-0.5"
              >
                حسناً، فهمت
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
