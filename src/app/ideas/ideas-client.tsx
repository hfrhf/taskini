'use client'

import { useState, useEffect, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  Lightbulb, 
  MessageSquare, 
  ArrowUp, 
  Plus, 
  X, 
  ChevronLeft, 
  Loader2, 
  Send, 
  Trash2, 
  CheckCircle2, 
  Users, 
  Calendar,
  Layers,
  Sparkles
} from 'lucide-react'
import { 
  getIdeas, 
  createIdea, 
  toggleIdeaUpvote, 
  addIdeaComment, 
  deleteIdeaComment, 
  convertIdeaToTask 
} from '../actions'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
}

interface Milestone {
  id: string
  title: string
  status: string
}

interface TaskGroup {
  id: string
  name: string
  color: string
}

interface IdeaComment {
  id: string
  content: string
  created_at: string
  user_id: string
  user: {
    name: string
    avatar_url: string
  }
}

interface Idea {
  id: string
  title: string
  description: string | null
  category: string
  status: 'draft' | 'discussing' | 'approved' | 'converted'
  user_id: string
  converted_task_id: string | null
  created_at: string
  user: {
    name: string
    avatar_url: string
  }
  upvotes_count: number
  comments_count: number
  has_upvoted: boolean
  idea_comments?: IdeaComment[]
}

interface IdeasClientProps {
  currentProfile: Profile
  teamProfiles: Profile[]
  initialMilestones: Milestone[]
  initialIdeas: Idea[]
  initialGroups: TaskGroup[]
}

const categories = [
  { id: 'all', label: 'كل الأفكار 🌐', color: 'border-theme-border text-theme-text bg-theme-panel' },
  { id: 'general', label: '💡 عامة', color: 'border-gray-500/20 text-gray-500 bg-gray-500/5' },
  { id: 'design', label: '🎨 تصميم وواجهات', color: 'border-purple-500/20 text-purple-500 bg-purple-500/5' },
  { id: 'tech', label: '⚙️ برمجة وتقنية', color: 'border-sky-500/20 text-sky-500 bg-sky-500/5' },
  { id: 'marketing', label: '📢 تسويق ونمو', color: 'border-amber-500/20 text-amber-500 bg-amber-500/5' }
]

const categoryMap: Record<string, { label: string, color: string }> = {
  general: { label: '💡 عام', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  design: { label: '🎨 تصميم', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
  tech: { label: '⚙️ تقني', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  marketing: { label: '📢 تسويق', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' }
}

const statusMap: Record<string, { label: string, color: string }> = {
  draft: { label: '💡 فكرة جديدة', color: 'bg-gray-500/10 text-gray-500 border-gray-500/20' },
  discussing: { label: '💬 قيد النقاش', color: 'bg-sky-500/10 text-sky-500 border-sky-500/20' },
  approved: { label: '✅ معتمدة للعمل', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  converted: { label: '🚀 تحولت لمهمة', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' }
}

export default function IdeasClient({ 
  currentProfile, 
  teamProfiles, 
  initialMilestones, 
  initialIdeas,
  initialGroups
}: IdeasClientProps) {
  const [ideas, setIdeas] = useState<Idea[]>(initialIdeas || [])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [sortBy, setSortBy] = useState<'popular' | 'newest'>('popular')
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // حالات النموذج واللوح المنزلق
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newCategory, setNewCategory] = useState('general')
  const [formPending, setFormPending] = useState(false)

  // شات التعليقات واللوح المنزلق
  const [activeIdeaForSlideOver, setActiveIdeaForSlideOver] = useState<Idea | null>(null)
  const [newCommentContent, setNewCommentContent] = useState('')
  const [commentPending, setCommentPending] = useState(false)

  // مودال تحويل الفكرة لمهمة
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false)
  const [convertGroupId, setConvertGroupId] = useState('')
  const [convertAssignedTo, setConvertAssignedTo] = useState('')
  const [convertDueDate, setConvertDueDate] = useState('')
  const [convertPending, setConvertPending] = useState(false)

  const [isPending, startTransition] = useTransition()

  // مزامنة اللوح المنزلق المفتوح مع أي تحديثات تطرأ على القائمة
  useEffect(() => {
    if (activeIdeaForSlideOver) {
      const updated = ideas.find(i => i.id === activeIdeaForSlideOver.id)
      if (updated) {
        setActiveIdeaForSlideOver(updated)
      }
    }
  }, [ideas])

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  const fetchIdeas = async () => {
    try {
      const data = await getIdeas()
      setIdeas(data as Idea[])
    } catch (err: any) {
      showToast('فشل تحديث الأفكار: ' + err.message, 'error')
    }
  }

  // إضافة فكرة جديدة
  const handleCreateIdea = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    try {
      setFormPending(true)
      await createIdea(newTitle, newDescription, newCategory)
      showToast('تمت إضافة فكرتك بنجاح! شاركها مع شركائك الآن 🔥', 'success')
      setNewTitle('')
      setNewDescription('')
      setNewCategory('general')
      setIsFormOpen(false)
      fetchIdeas()
    } catch (err: any) {
      showToast('فشل إضافة الفكرة: ' + err.message, 'error')
    } finally {
      setFormPending(false)
    }
  }

  // التصويت بشكل متفائل (Optimistic Toggle Upvote)
  const handleToggleUpvote = async (ideaId: string, e: React.MouseEvent) => {
    e.stopPropagation() // منع فتح اللوح المنزلق عند الضغط على زر التصويت
    
    const previousIdeas = [...ideas]

    // تحديث الحالة محلياً وفورياً (Optimistic Update)
    setIdeas((prev) =>
      prev.map((idea) => {
        if (idea.id !== ideaId) return idea

        const delta = idea.has_upvoted ? -1 : 1
        return {
          ...idea,
          has_upvoted: !idea.has_upvoted,
          upvotes_count: Math.max(0, idea.upvotes_count + delta)
        }
      })
    )

    try {
      await toggleIdeaUpvote(ideaId)
      // مزامنة صامتة للحالة من السيرفر
      const data = await getIdeas()
      setIdeas(data as Idea[])
    } catch (err: any) {
      // إرجاع الحالة السابقة فور الفشل
      setIdeas(previousIdeas)
      showToast('فشل التصويت: ' + err.message, 'error')
    }
  }

  // إضافة تعليق للفكرة
  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCommentContent.trim() || !activeIdeaForSlideOver) return

    try {
      setCommentPending(true)
      await addIdeaComment(activeIdeaForSlideOver.id, newCommentContent)
      setNewCommentContent('')
      fetchIdeas()
    } catch (err: any) {
      showToast('فشل إرسال التعليق: ' + err.message, 'error')
    } finally {
      setCommentPending(false)
    }
  }

  // حذف تعليق
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('هل تريد حذف هذا التعليق؟')) return

    try {
      await deleteIdeaComment(commentId)
      fetchIdeas()
    } catch (err: any) {
      showToast('فشل حذف التعليق: ' + err.message, 'error')
    }
  }

  // تحويل الفكرة لمهمة عمل
  const handleConvertToTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!activeIdeaForSlideOver || !convertGroupId || !convertDueDate) {
      showToast('يرجى اختيار مجموعة العمل وتاريخ التسليم', 'warning')
      return
    }

    try {
      setConvertPending(true)
      await convertIdeaToTask(
        activeIdeaForSlideOver.id,
        convertGroupId,
        convertAssignedTo || null,
        convertDueDate
      )
      showToast('تمت العملية بنجاح! تم إنشاء المهمة وربط الفكرة بها 🚀', 'success')
      setIsConvertModalOpen(false)
      setActiveIdeaForSlideOver(null)
      fetchIdeas()
    } catch (err: any) {
      showToast('فشل تحويل الفكرة لمهمة: ' + err.message, 'error')
    } finally {
      setConvertPending(false)
    }
  }

  // تصفية الأفكار وفرزها
  const filteredIdeas = ideas
    .filter(idea => selectedCategory === 'all' || idea.category === selectedCategory)
    .sort((a, b) => {
      if (sortBy === 'popular') {
        return b.upvotes_count - a.upvotes_count
      } else {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      }
    })

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6">

          {/* العناوين وأزرار التحكم */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 border-b border-theme-border pb-5 text-right">
            <div>
              <h1 className="text-2xl font-bold text-theme-text flex items-center gap-2 justify-end md:justify-start">
                <Lightbulb className="w-6 h-6 text-theme-accent" />
                <span>لوحة الأفكار والعصف الذهني (Brainstorming)</span>
              </h1>
              <p className="text-xs text-theme-text-muted mt-1">اطرح مقترحك، صوّت على أفكار زملائك، وناقش أفضل الحلول لتطوير المشروع وتحويلها فوراً لمهام عمل</p>
            </div>

            <button
              type="button"
              onClick={() => setIsFormOpen(true)}
              className="text-xs font-bold px-4 py-2.5 rounded-xl bg-theme-accent hover:opacity-90 text-theme-panel transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer self-stretch md:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة فكرة مقترحة</span>
            </button>
          </div>

          {/* شريط الفلاتر والفرز */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-theme-panel border border-theme-border rounded-2xl p-4 text-right">
            {/* الفئات */}
            <div className="flex flex-wrap gap-2 w-full lg:w-auto">
              {categories.map((c) => {
                const isActive = selectedCategory === c.id
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`text-xs font-bold px-3.5 py-2 rounded-xl border transition-all cursor-pointer ${
                      isActive 
                        ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                        : 'bg-theme-bg border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-border'
                    }`}
                  >
                    {c.label}
                  </button>
                )
              })}
            </div>

            {/* الفرز */}
            <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
              <span className="text-xs font-bold text-theme-text-muted">ترتيب حسب:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-theme-bg border border-theme-border text-theme-text text-xs rounded-xl px-3 py-2 outline-none font-bold cursor-pointer"
              >
                <option value="popular">🔥 الأكثر تصويتاً</option>
                <option value="newest">⏰ الأحدث نشراً</option>
              </select>
            </div>
          </div>

          {/* شبكة الأفكار */}
          {filteredIdeas.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
              <Lightbulb className="w-12 h-12 text-theme-text-muted mb-3 opacity-60 animate-pulse" />
              <h3 className="text-sm font-bold text-theme-text">لا توجد أفكار مقترحة في هذا التصنيف بعد</h3>
              <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                هل لديك فكرة رائعة تود مشاركتها؟ اضغط على زر "إضافة فكرة مقترحة" بالأعلى لبدء العصف الذهني!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 text-right">
              {filteredIdeas.map((idea) => {
                const isConverted = idea.status === 'converted'
                
                return (
                  <div
                    key={idea.id}
                    onClick={() => setActiveIdeaForSlideOver(idea)}
                    className="bg-theme-panel rounded-2xl p-5 border border-theme-border shadow-xs hover:border-theme-accent/30 hover:shadow-md transition-all duration-200 flex flex-col justify-between gap-4 relative overflow-hidden cursor-pointer transform-gpu isolate group"
                  >
                    <div className="space-y-3">
                      {/* رأس كرت الفكرة: فئة + حالة */}
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${categoryMap[idea.category]?.color}`}>
                          {categoryMap[idea.category]?.label}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusMap[idea.status]?.color}`}>
                          {statusMap[idea.status]?.label}
                        </span>
                      </div>

                      {/* عنوان ومحتوى الفكرة */}
                      <div>
                        <h3 className="text-sm font-black text-theme-text line-clamp-1 group-hover:text-theme-accent transition-colors leading-relaxed">
                          {idea.title}
                        </h3>
                        <p className="text-xs text-theme-text-muted mt-1.5 line-clamp-3 leading-relaxed font-medium">
                          {idea.description || 'لا يوجد شرح إضافي لهذه الفكرة.'}
                        </p>
                      </div>
                    </div>

                    {/* ذيل كرت الفكرة: تفاعلات وتصويت */}
                    <div className="border-t border-theme-border/60 pt-3 mt-1 flex items-center justify-between text-xs text-theme-text-muted">
                      {/* معلومات الناشر */}
                      <div className="flex items-center gap-1.5">
                        <img 
                          src={idea.user.avatar_url}
                          alt={idea.user.name}
                          className="w-5 h-5 rounded-md object-cover"
                        />
                        <span className="text-[10px] font-black text-theme-text">{idea.user.name}</span>
                      </div>

                      {/* الأصوات والتعليقات */}
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] font-bold">
                          <MessageSquare className="w-3.5 h-3.5 text-neutral-500" />
                          <span>{idea.comments_count}</span>
                        </div>

                        {/* زر التصويت السريع */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleUpvote(idea.id, e)}
                          disabled={isPending || isConverted}
                          className={`flex items-center gap-1 font-black text-[10px] py-1 px-2.5 rounded-xl border transition-all cursor-pointer active:scale-95 ${
                            idea.has_upvoted
                              ? 'bg-theme-accent/10 border-theme-accent text-theme-accent'
                              : 'bg-theme-bg border-theme-border text-theme-text-muted hover:text-theme-text hover:bg-theme-border disabled:opacity-50'
                          }`}
                          title={idea.has_upvoted ? 'إلغاء التصويت' : 'التصويت وتأييد الفكرة'}
                        >
                          <ArrowUp className={`w-3 h-3 ${idea.has_upvoted ? 'animate-bounce' : ''}`} />
                          <span>{idea.upvotes_count}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      </main>

      {/* ================== اللوح الجانبي المنزلق للنقاش (Slide-over) ================== */}
      {activeIdeaForSlideOver && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 transition-opacity duration-300"
            onClick={() => setActiveIdeaForSlideOver(null)}
          />
          <div className="fixed top-0 bottom-0 left-0 w-full sm:w-[460px] bg-theme-panel border-r border-theme-border z-50 shadow-2xl flex flex-col text-right animate-slide-in-left">
            {/* رأس اللوح */}
            <div className="p-5 border-b border-theme-border flex items-center justify-between bg-theme-bg/10 relative">
              <button
                onClick={() => setActiveIdeaForSlideOver(null)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-theme-accent animate-pulse"></span>
                <span className="text-sm font-black text-theme-text">تفاصيل ونقاش الفكرة</span>
              </div>
            </div>

            {/* محتوى اللوح القابل للتمرير */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6 scrollbar-hide">
              {/* تفاصيل الفكرة */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${categoryMap[activeIdeaForSlideOver.category]?.color}`}>
                    {categoryMap[activeIdeaForSlideOver.category]?.label}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${statusMap[activeIdeaForSlideOver.status]?.color}`}>
                    {statusMap[activeIdeaForSlideOver.status]?.label}
                  </span>
                </div>

                <h2 className="text-lg font-black text-theme-text leading-snug">
                  {activeIdeaForSlideOver.title}
                </h2>

                <div className="flex items-center gap-2 bg-theme-bg/40 border border-theme-border/60 rounded-2xl p-3">
                  <img 
                    src={activeIdeaForSlideOver.user.avatar_url}
                    alt={activeIdeaForSlideOver.user.name}
                    className="w-8 h-8 rounded-xl object-cover border border-theme-border"
                  />
                  <div>
                    <p className="text-xs font-black text-theme-text leading-none">{activeIdeaForSlideOver.user.name}</p>
                    <p className="text-[9px] text-theme-text-muted mt-1.5">
                      تم الاقتراح في: {new Date(activeIdeaForSlideOver.created_at).toLocaleDateString('ar-EG', { month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="bg-theme-bg/25 border border-theme-border/50 rounded-2xl p-4 space-y-2">
                  <p className="text-xs font-bold text-theme-text-muted">شرح المقترح:</p>
                  <p className="text-xs text-theme-text leading-relaxed font-medium whitespace-pre-line">
                    {activeIdeaForSlideOver.description || 'لا يوجد شرح إضافي.'}
                  </p>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex items-center gap-3 border-t border-b border-theme-border/60 py-4">
                <button
                  type="button"
                  onClick={(e) => handleToggleUpvote(activeIdeaForSlideOver.id, e)}
                  disabled={isPending || activeIdeaForSlideOver.status === 'converted'}
                  className={`flex-grow flex items-center justify-center gap-2 font-black text-xs py-3 px-4 rounded-xl border transition-all cursor-pointer ${
                    activeIdeaForSlideOver.has_upvoted
                      ? 'bg-theme-accent text-theme-panel border-theme-accent shadow-sm'
                      : 'bg-theme-bg border-theme-border text-theme-text hover:bg-theme-border disabled:opacity-50'
                  }`}
                >
                  <ArrowUp className="w-4 h-4" />
                  <span>تأييد الفكرة ({activeIdeaForSlideOver.upvotes_count})</span>
                </button>

                {activeIdeaForSlideOver.status !== 'converted' && (
                  <button
                    type="button"
                    onClick={() => {
                      setConvertGroupId(initialGroups[0]?.id || '')
                      setConvertAssignedTo(currentProfile.id)
                      setConvertDueDate(new Date().toISOString().split('T')[0])
                      setIsConvertModalOpen(true)
                    }}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>تحويل لمهمة ⚡</span>
                  </button>
                )}
              </div>

              {/* قسم النقاش والتعليقات */}
              <div className="space-y-4">
                <div className="text-xs font-black text-theme-text flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-theme-accent" />
                  <span>المناقشة والتغذية الراجعة ({activeIdeaForSlideOver.idea_comments?.length || 0})</span>
                </div>

                {/* قائمة التعليقات */}
                <div className="space-y-3.5">
                  {(activeIdeaForSlideOver.idea_comments || []).length === 0 ? (
                    <p className="text-center text-xs text-theme-text-muted py-6">
                      لا توجد مناقشات بعد. شارك رأيك لنضج الفكرة وتطويرها!
                    </p>
                  ) : (
                    (activeIdeaForSlideOver.idea_comments || []).map((comment) => {
                      const isOwner = comment.user_id === currentProfile.id || currentProfile.role === 'admin'
                      return (
                        <div key={comment.id} className="bg-theme-bg/25 border border-theme-border/40 p-3 rounded-2xl relative space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <img 
                                src={comment.user.avatar_url}
                                alt={comment.user.name}
                                className="w-6 h-6 rounded-md object-cover"
                              />
                              <span className="text-[10px] font-black text-theme-text">{comment.user.name}</span>
                              <span className="text-[8px] text-theme-text-muted">
                                {new Date(comment.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {isOwner && (
                              <button
                                onClick={() => handleDeleteComment(comment.id)}
                                className="text-rose-400 hover:text-rose-600 p-0.5 rounded transition-colors cursor-pointer"
                                title="حذف التعليق"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                          <p className="text-xs text-theme-text pr-1 whitespace-pre-line leading-relaxed font-medium">
                            {comment.content}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            </div>

            {/* حقل إدخال التعليق أسفل اللوح */}
            <div className="p-4 border-t border-theme-border bg-theme-bg/10">
              <form onSubmit={handleCommentSubmit} className="flex gap-2">
                <input 
                  type="text"
                  value={newCommentContent}
                  onChange={(e) => setNewCommentContent(e.target.value)}
                  placeholder="اكتب تعليقك أو ملاحظتك هنا..."
                  className="flex-grow bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 text-xs transition-all outline-none"
                  required
                />
                <button
                  type="submit"
                  disabled={commentPending}
                  className="bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold px-3 py-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
                >
                  {commentPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </button>
              </form>
            </div>
          </div>
        </>
      )}

      {/* ================== مودال إضافة فكرة جديدة ================== */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsFormOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-lg rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-50 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-theme-text flex items-center gap-2">
                  <Lightbulb className="w-5 h-5 text-theme-accent" />
                  <span>طرح فكرة ومقترح جديد للمشروع</span>
                </h3>
                <p className="text-xs text-theme-text-muted mt-1">اكتب فكرتك بوضوح ليتمكن الفريق من مناقشتها والتصويت عليها</p>
              </div>
              <button 
                onClick={() => setIsFormOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateIdea} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">عنوان الفكرة المبتكرة <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="مثال: إنشاء ميزة تصدير التقارير الأسبوعية PDF"
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">التصنيف والفرع الفني <span className="text-rose-500">*</span></label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  <option value="general">💡 عام / شؤون إدارية</option>
                  <option value="design">🎨 تصميم تجربة المستخدم والواجهات</option>
                  <option value="tech">⚙️ برمجة وبنية تحتية</option>
                  <option value="marketing">📢 تسويق ونمو وزيادة مستخدمين</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">الشرح التفصيلي والملاحظات (اختياري)</label>
                <textarea
                  rows={4}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="اشرح المشكلة التي تحلها الفكرة، وكيف سيتم تنفيذها، وأي روابط أو تفاصيل مفيدة..."
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl p-4 text-xs transition-all outline-none resize-none leading-relaxed"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={formPending}
                  className="w-full bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  {formPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري نشر الفكرة...</span>
                    </>
                  ) : (
                    <span>نشر المقترح الآن 🚀</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================== مودال تحويل الفكرة لمهمة عمل ================== */}
      {isConvertModalOpen && activeIdeaForSlideOver && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={() => setIsConvertModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-[61] text-right">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="text-lg font-black text-theme-text flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-emerald-500" />
                  <span>تحويل المقترح لمهمة تنفيذية</span>
                </h3>
                <p className="text-xs text-theme-text-muted mt-1">سيتم إنشاء مهمة جديدة في لوحة العمل الرئيسية وتضمين تفاصيل الفكرة بها</p>
              </div>
              <button 
                onClick={() => setIsConvertModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConvertToTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان الفكرة (سيصبح عنوان المهمة)</label>
                <div className="bg-theme-bg/50 border border-theme-border text-theme-text text-xs rounded-xl p-3 font-bold leading-relaxed">
                  {activeIdeaForSlideOver.title}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">مجموعة العمل المستهدفة <span className="text-rose-500">*</span></label>
                <select
                  value={convertGroupId}
                  onChange={(e) => setConvertGroupId(e.target.value)}
                  required
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  <option value="">اختر مجموعة العمل...</option>
                  {initialGroups.map((g) => (
                    <option key={g.id} value={g.id}>📁 {g.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">المستلم المسؤول (Assignee)</label>
                <select
                  value={convertAssignedTo}
                  onChange={(e) => setConvertAssignedTo(e.target.value)}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-bold"
                >
                  <option value="">لا يوجد مستلم (متروكة للجميع)</option>
                  {teamProfiles.map((p) => (
                    <option key={p.id} value={p.id}>👤 {p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text mb-1.5">تاريخ الاستحقاق والتسليم <span className="text-rose-500">*</span></label>
                <input 
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  required
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-bold text-right"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button 
                  type="submit" 
                  disabled={convertPending}
                  className="flex-grow bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
                >
                  {convertPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الإنشاء...</span>
                    </>
                  ) : (
                    <span>تأكيد وإنشاء المهمة ⚡</span>
                  )}
                </button>
                <button 
                  type="button" 
                  onClick={() => setIsConvertModalOpen(false)}
                  className="px-5 bg-neutral-600 hover:bg-neutral-700 text-white font-bold rounded-xl text-xs transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
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
    </div>
  )
}
