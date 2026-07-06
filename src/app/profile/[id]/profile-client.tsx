'use client'

import { useState, useEffect, useTransition } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  Clock, 
  Info, 
  ShieldCheck, 
  Check, 
  Calendar, 
  Users, 
  Plus, 
  Loader2, 
  Award, 
  Edit2, 
  Globe, 
  ThumbsUp, 
  MessageSquare,
  ArrowUpRight,
  User,
  Heart,
  X,
  Trash2
} from 'lucide-react'
import { getPublications, togglePublicationReaction, addPublicationComment, deletePublicationComment, deletePublication } from '../../actions'
import Link from 'next/link'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
  created_at?: string
}

interface PublicationComment {
  id: string
  publication_id: string
  user_id: string
  parent_id: string | null
  content: string
  created_at: string
  user: {
    name: string
    avatar_url: string
  }
}

interface Publication {
  id: string
  user_id: string
  content: string
  image_url: string | null
  created_at: string
  user: {
    name: string
    avatar_url: string
  }
  reactions_count: number
  reactions_grouped: Record<string, number>
  user_reaction: string | null
  comments: PublicationComment[]
}

interface AvailabilitySlot {
  user_id: string
  day_of_week: number
  hour: number
  status: 'available' | 'unavailable' | 'maybe'
}

interface ProfileClientProps {
  currentUser: Profile
  targetProfile: Profile
  stats: {
    publications_count: number
    reactions_received: number
    completed_tasks_count: number
  }
  initialPublications: Publication[]
  availabilitySlots: AvailabilitySlot[]
  errorMsg: string | null
}

const daysOfWeekArabic = [
  'السبت',
  'الأحد',
  'الأثنين',
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

const reactionMap: Record<string, { label: string; icon: string; colorClass: string; bgClass: string }> = {
  like: { label: 'أعجبني', icon: '👍', colorClass: 'text-blue-500', bgClass: 'bg-blue-500/10' },
  heart: { label: 'حبّبته', icon: '❤️', colorClass: 'text-rose-500', bgClass: 'bg-rose-500/10' },
  haha: { label: 'أضحكني', icon: '😆', colorClass: 'text-amber-500', bgClass: 'bg-amber-500/10' },
  wow: { label: 'أدهشني', icon: '😮', colorClass: 'text-yellow-500', bgClass: 'bg-yellow-500/10' },
  sad: { label: 'أحزنني', icon: '😢', colorClass: 'text-sky-500', bgClass: 'bg-sky-500/10' },
  angry: { label: 'أغضبني', icon: '😡', colorClass: 'text-orange-600', bgClass: 'bg-orange-500/10' }
}

export default function ProfileClient({
  currentUser,
  targetProfile,
  stats,
  initialPublications,
  availabilitySlots,
  errorMsg
}: ProfileClientProps) {
  const [publications, setPublications] = useState<Publication[]>(initialPublications || [])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // Interactive Reactions State
  const [activeReactionPostId, setActiveReactionPostId] = useState<string | null>(null)

  // Comments toggles
  const [openCommentsPostId, setOpenCommentsPostId] = useState<string | null>(null)
  const [newCommentContent, setNewCommentContent] = useState('')
  const [replyContent, setReplyContent] = useState('')
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null)
  const [commentPendingPostId, setCommentPendingPostId] = useState<string | null>(null)

  // Lightbox Modal for Full Image View
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null)

  const [isPending, startTransition] = useTransition()

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // Availability matrix map
  const availabilityMap: Record<string, 'available' | 'unavailable' | 'maybe'> = {}
  availabilitySlots.forEach(slot => {
    availabilityMap[`${slot.day_of_week}-${slot.hour}`] = slot.status
  })

  // Format time ago for publications
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'الآن'
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`
    if (diffHours < 24) return `منذ ${diffHours} ساعة`
    return date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  // Refetch publications
  const refetchPublications = async () => {
    try {
      const data = await getPublications()
      // Filter for this user
      const filtered = (data as Publication[]).filter(p => p.user_id === targetProfile.id)
      setPublications(filtered)
    } catch (err: any) {
      console.error(err)
    }
  }

  // Toggle/Set Reaction
  const handleReact = async (pubId: string, type: string) => {
    setActiveReactionPostId(null)
    
    // Optimistic Update
    const previousPublications = [...publications]
    setPublications((prev) =>
      prev.map((pub) => {
        if (pub.id !== pubId) return pub

        const hadReaction = pub.user_reaction !== null
        const isSameReaction = pub.user_reaction === type

        let newReaction: string | null = type
        let reactionsCount = pub.reactions_count
        let reactionsGrouped = { ...pub.reactions_grouped }

        if (hadReaction) {
          const oldType = pub.user_reaction!
          reactionsGrouped[oldType] = Math.max(0, (reactionsGrouped[oldType] || 0) - 1)
          if (reactionsGrouped[oldType] === 0) delete reactionsGrouped[oldType]
          reactionsCount--

          if (isSameReaction) {
            newReaction = null
          }
        }

        if (newReaction) {
          reactionsGrouped[newReaction] = (reactionsGrouped[newReaction] || 0) + 1
          reactionsCount++
        }

        return {
          ...pub,
          user_reaction: newReaction,
          reactions_count: reactionsCount,
          reactions_grouped: reactionsGrouped
        }
      })
    )

    try {
      await togglePublicationReaction(pubId, type)
      await refetchPublications()
    } catch (err: any) {
      setPublications(previousPublications)
      showToast('فشل التفاعل: ' + err.message, 'error')
    }
  }

  // Add Comment (top-level or reply)
  const handleCommentSubmit = async (pubId: string, parentId: string | null = null) => {
    const text = parentId ? replyContent : newCommentContent
    if (!text.trim()) return

    try {
      setCommentPendingPostId(pubId)
      await addPublicationComment(pubId, text, parentId)
      
      if (parentId) {
        setReplyContent('')
        setActiveReplyCommentId(null)
      } else {
        setNewCommentContent('')
      }
      await refetchPublications()
    } catch (err: any) {
      showToast('فشل إرسال التعليق: ' + err.message, 'error')
    } finally {
      setCommentPendingPostId(null)
    }
  }

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('هل تريد حذف هذا التعليق/الرد؟')) return

    try {
      await deletePublicationComment(commentId)
      showToast('تم حذف التعليق بنجاح', 'success')
      await refetchPublications()
    } catch (err: any) {
      showToast('فشل حذف التعليق: ' + err.message, 'error')
    }
  }

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentUser} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full text-right">
        <div className="space-y-6">

          {errorMsg && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-rose-500 text-xs font-bold">
              ⚠️ {errorMsg}
            </div>
          )}

          {/* الملف الشخصي الفاخر (Profile Header Card) */}
          <div className="bg-theme-panel border border-theme-border rounded-[2rem] shadow-sm overflow-hidden relative">
            {/* غلاف الملف الشخصي مع تدرج لوني يعكس المظهر */}
            <div className="h-32 sm:h-40 bg-gradient-to-r from-theme-accent/20 via-theme-accent/5 to-theme-border/50 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#111827_1px,transparent_1px)] [background-size:16px_16px]"></div>
            </div>

            {/* تفاصيل البروفايل */}
            <div className="px-6 pb-6 relative">
              {/* صورة الأفاتار الكبيرة المتداخلة مع الغلاف */}
              <div className="flex flex-col sm:flex-row sm:items-end justify-between -mt-16 sm:-mt-20 gap-4 mb-4">
                <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 text-center sm:text-right">
                  <img 
                    src={targetProfile.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=100&auto=format&fit=crop'} 
                    alt={targetProfile.name} 
                    className="w-28 h-28 sm:w-32 sm:h-32 rounded-3xl object-cover border-4 border-theme-panel shadow-md shrink-0 bg-theme-panel"
                  />
                  <div className="pb-2">
                    <h1 className="text-xl sm:text-2xl font-black text-theme-text">{targetProfile.name}</h1>
                    <p className="text-xs text-theme-text-muted mt-1 leading-none font-bold">{targetProfile.email}</p>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 self-center sm:self-end">
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-xl border ${
                    targetProfile.role === 'admin' 
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500' 
                      : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {targetProfile.role === 'admin' ? 'مدير النظام' : 'مستلم مهام'}
                  </span>
                  
                  {targetProfile.id === currentUser.id && (
                    <span className="text-[10px] font-bold px-3 py-1.5 bg-theme-bg border border-theme-border text-theme-text rounded-xl">
                      هذا حسابك الشخصي
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* شبكة الإحصاءات الفاخرة (Stats Grid) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-theme-panel border border-theme-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-theme-text-muted">المنشورات الاجتماعية</p>
                <p className="text-xl font-black text-theme-text mt-1">{stats?.publications_count || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-theme-accent/5 flex items-center justify-center border border-theme-accent/10">
                <Globe className="w-5 h-5 text-theme-accent" />
              </div>
            </div>

            <div className="bg-theme-panel border border-theme-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-theme-text-muted">التفاعلات المستلمة</p>
                <p className="text-xl font-black text-theme-text mt-1">{stats?.reactions_received || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-rose-500/5 flex items-center justify-center border border-rose-500/10">
                <Heart className="w-5 h-5 text-rose-500" />
              </div>
            </div>

            <div className="bg-theme-panel border border-theme-border rounded-2xl p-5 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold text-theme-text-muted">المهام المنجزة بنجاح</p>
                <p className="text-xl font-black text-theme-text mt-1">{stats?.completed_tasks_count || 0}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/5 flex items-center justify-center border border-emerald-500/10">
                <Check className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>

          {/* تفاصيل أوقات التوفر (Availability heatmap - Read Only) */}
          <div className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-xs">
            <h2 className="text-xs font-black text-theme-text flex items-center gap-1.5 border-b border-theme-border/60 pb-3 mb-4">
              <Clock className="w-4 h-4 text-theme-accent" />
              <span>أوقات توفر {targetProfile.name.split(' ')[0]} الأسبوعية (للقاءات العمل)</span>
            </h2>

            <div className="overflow-x-auto scrollbar-hide">
              <div className="min-w-[650px] space-y-2.5">
                {/* ترويسة الساعات */}
                <div className="flex items-center text-center text-[9px] text-theme-text-muted font-bold pb-1">
                  <div className="w-20 shrink-0 text-right pr-2">اليوم</div>
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
                        const key = `${dayIndex}-${hour}`
                        const status = availabilityMap[key] || 'unavailable'
                        
                        let colorClass = 'bg-rose-500/10 border-rose-500/5 text-transparent'
                        if (status === 'available') colorClass = 'bg-emerald-500 text-white'
                        if (status === 'maybe') colorClass = 'bg-amber-400 text-neutral-900 font-bold'

                        return (
                          <div
                            key={hour}
                            className={`aspect-square rounded-[4px] border text-[8px] flex items-center justify-center select-none font-bold ${colorClass}`}
                            title={`يوم ${dayName} | الساعة ${String(hour).padStart(2, '0')}:00 - الحالة: ${statusLabels[status]}`}
                          >
                            {status === 'available' ? '✓' : status === 'maybe' ? '؟' : ''}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center gap-4 text-[9px] text-theme-text-muted mt-3 font-bold">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>
                <span>متاح للعمل</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-amber-400"></span>
                <span>متوقع / محتمل</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded bg-rose-500/10 border border-rose-500/20"></span>
                <span>غير متاح</span>
              </span>
            </div>
          </div>

          {/* تغذية منشورات المستخدم الشخصية (User's feed) */}
          <div className="space-y-4">
            <h2 className="text-sm font-black text-theme-text flex items-center gap-1.5 border-b border-theme-border/60 pb-3 mb-2">
              <Globe className="w-4 h-4 text-theme-accent" />
              <span>منشورات {targetProfile.name.split(' ')[0]} السابقة</span>
            </h2>

            {publications.length === 0 ? (
              <div className="bg-theme-panel border border-theme-border rounded-3xl p-8 text-center text-xs text-theme-text-muted">
                لا توجد منشورات منشورة بواسطة {targetProfile.name.split(' ')[0]} بعد.
              </div>
            ) : (
              <div className="space-y-6">
                {publications.map((pub) => {
                  const isPostOwner = pub.user_id === currentUser.id || currentUser.role === 'admin'
                  const reactionsList = Object.keys(pub.reactions_grouped || {})
                  const hasReacted = pub.user_reaction !== null
                  const commentsList = pub.comments || []
                  const topLevelComments = commentsList.filter(c => c.parent_id === null)

                  return (
                    <div 
                      key={pub.id}
                      className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-xs animate-modal-in"
                    >
                      {/* ترويسة المنشور */}
                      <div className="flex justify-between items-start gap-4 mb-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={pub.user.avatar_url}
                            alt={pub.user.name}
                            className="w-10 h-10 rounded-2xl object-cover border border-theme-border"
                          />
                          <div>
                            <span className="text-xs font-black text-theme-text block">{pub.user.name}</span>
                            <span className="text-[9px] text-theme-text-muted block mt-0.5">{formatTime(pub.created_at)}</span>
                          </div>
                        </div>

                        {isPostOwner && (
                          <button
                            onClick={() => {
                              if (window.confirm('هل تريد حذف منشورك؟')) {
                                deletePublication(pub.id).then(() => {
                                  showToast('تم حذف المنشور', 'success')
                                  refetchPublications()
                                })
                              }
                            }}
                            className="p-2 text-theme-text-muted hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer"
                            title="حذف المنشور"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* محتوى المنشور النصي */}
                      <div className="mb-4">
                        <p className="text-xs text-theme-text whitespace-pre-line leading-relaxed font-medium">
                          {pub.content}
                        </p>
                      </div>

                      {/* الصورة */}
                      {pub.image_url && (
                        <div 
                          className="mb-4 rounded-2xl overflow-hidden border border-theme-border max-h-96 bg-theme-bg cursor-zoom-in"
                          onClick={() => setLightboxImageUrl(pub.image_url)}
                        >
                          <img 
                            src={pub.image_url} 
                            alt="صورة المنشور" 
                            className="w-full max-h-96 object-cover hover:scale-[1.01] transition-transform duration-300"
                          />
                        </div>
                      )}

                      {/* شريط الإحصاءات */}
                      <div className="flex justify-between items-center text-[10px] text-theme-text-muted border-t border-b border-theme-border/50 py-3 mb-3 font-bold select-none">
                        <div className="flex items-center gap-1.5">
                          {pub.reactions_count > 0 ? (
                            <>
                              <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                                {reactionsList.map((type) => (
                                  <span 
                                    key={type} 
                                    className="w-4 h-4 rounded-full bg-theme-panel border border-theme-border flex items-center justify-center text-[10px]"
                                  >
                                    {reactionMap[type]?.icon}
                                  </span>
                                ))}
                              </div>
                              <span className="mr-1 text-[9px] font-black text-theme-text">{pub.reactions_count} تفاعلات</span>
                            </>
                          ) : (
                            <span>لا تفاعلات</span>
                          )}
                        </div>

                        <button 
                          onClick={() => setOpenCommentsPostId(openCommentsPostId === pub.id ? null : pub.id)}
                          className="hover:text-theme-text transition-colors cursor-pointer"
                        >
                          {commentsList.length} تعليقات
                        </button>
                      </div>

                      {/* أزرار تفاعل وتعليق */}
                      <div className="flex items-center justify-between gap-2 relative">
                        <div 
                          className="relative flex-1"
                          onMouseEnter={() => setActiveReactionPostId(pub.id)}
                          onMouseLeave={() => setActiveReactionPostId(null)}
                        >
                          <button
                            onClick={() => handleReact(pub.id, 'like')}
                            className={`w-full py-2 bg-theme-bg/30 hover:bg-theme-bg text-xs font-black rounded-xl border border-transparent transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              hasReacted 
                                ? reactionMap[pub.user_reaction!]?.colorClass + ' bg-theme-accent/5 border-theme-accent/20' 
                                : 'text-theme-text-muted hover:text-theme-text'
                            }`}
                          >
                            {hasReacted ? (
                              <>
                                <span className="text-sm">{reactionMap[pub.user_reaction!]?.icon}</span>
                                <span>{reactionMap[pub.user_reaction!]?.label}</span>
                              </>
                            ) : (
                              <>
                                <ThumbsUp className="w-4 h-4" />
                                <span>تفاعل</span>
                              </>
                            )}
                          </button>

                          {activeReactionPostId === pub.id && (
                            <div className="absolute bottom-11 right-0 left-0 sm:left-auto mt-2 bg-theme-panel border border-theme-border shadow-xl rounded-full py-1.5 px-3.5 z-40 flex items-center gap-3.5 animate-modal-in justify-center w-full sm:w-auto">
                              {Object.entries(reactionMap).map(([type, value]) => (
                                <button
                                  key={type}
                                  type="button"
                                  onClick={() => handleReact(pub.id, type)}
                                  className="text-xl cursor-pointer transition-transform transform duration-150 active:scale-95"
                                >
                                  {value.icon}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => setOpenCommentsPostId(openCommentsPostId === pub.id ? null : pub.id)}
                          className="flex-1 py-2 bg-theme-bg/30 hover:bg-theme-bg text-xs font-black text-theme-text-muted hover:text-theme-text rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <MessageSquare className="w-4 h-4" />
                          <span>التعليقات</span>
                        </button>
                      </div>

                      {/* قسم تعليقات المنشور */}
                      {openCommentsPostId === pub.id && (
                        <div className="mt-5 border-t border-theme-border/40 pt-4 space-y-4 text-right">
                          <div className="flex gap-2 items-center">
                            <img 
                              src={currentUser.avatar_url}
                              alt={currentUser.name}
                              className="w-8 h-8 rounded-xl object-cover border border-theme-border shrink-0"
                            />
                            <div className="flex-1 flex gap-2 relative">
                              <input 
                                type="text"
                                value={newCommentContent}
                                onChange={(e) => setNewCommentContent(e.target.value)}
                                placeholder="اكتب تعليقاً..."
                                className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 pl-10 text-xs transition-all outline-none"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleCommentSubmit(pub.id)
                                }}
                              />
                              <button
                                onClick={() => handleCommentSubmit(pub.id)}
                                disabled={commentPendingPostId === pub.id}
                                className="absolute left-2 top-1.5 p-1 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel rounded-lg cursor-pointer"
                              >
                                {commentPendingPostId === pub.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            {topLevelComments.length === 0 ? (
                              <p className="text-center text-[10px] text-theme-text-muted py-2">لا تعليقات بعد.</p>
                            ) : (
                              topLevelComments.map((comment) => {
                                const isCommentOwner = comment.user_id === currentUser.id || currentUser.role === 'admin'
                                const replies = commentsList.filter(c => c.parent_id === comment.id)

                                return (
                                  <div key={comment.id} className="space-y-3">
                                    <div className="bg-theme-bg/20 border border-theme-border/40 p-3 rounded-2xl relative space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <img 
                                            src={comment.user.avatar_url}
                                            alt={comment.user.name}
                                            className="w-6 h-6 rounded-lg object-cover border border-theme-border shrink-0"
                                          />
                                          <span className="text-[10px] font-black text-theme-text">{comment.user.name}</span>
                                          <span className="text-[8px] text-theme-text-muted">{formatTime(comment.created_at)}</span>
                                        </div>

                                        {isCommentOwner && (
                                          <button
                                            onClick={() => handleDeleteComment(comment.id)}
                                            className="text-theme-text-muted hover:text-rose-500 p-1 rounded transition-colors cursor-pointer"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </div>
                                      <p className="text-xs text-theme-text leading-relaxed whitespace-pre-line pr-1 font-medium">{comment.content}</p>
                                    </div>

                                    {/* ردود مائلة */}
                                    {replies.map((reply) => {
                                      const isReplyOwner = reply.user_id === currentUser.id || currentUser.role === 'admin'
                                      return (
                                        <div key={reply.id} className="mr-6 bg-theme-bg/10 border border-theme-border/30 p-2.5 rounded-xl space-y-1">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                              <img 
                                                src={reply.user.avatar_url}
                                                alt={reply.user.name}
                                                className="w-5 h-5 rounded-md object-cover border border-theme-border shrink-0"
                                              />
                                              <span className="text-[9px] font-black text-theme-text">{reply.user.name}</span>
                                              <span className="text-[7px] text-theme-text-muted">{formatTime(reply.created_at)}</span>
                                            </div>
                                            {isReplyOwner && (
                                              <button
                                                onClick={() => handleDeleteComment(reply.id)}
                                                className="text-theme-text-muted hover:text-rose-500 p-0.5 rounded cursor-pointer"
                                              >
                                                <Trash2 className="w-2.5 h-2.5" />
                                              </button>
                                            )}
                                          </div>
                                          <p className="text-[11px] text-theme-text pr-1 whitespace-pre-line leading-relaxed font-medium">{reply.content}</p>
                                        </div>
                                      )
                                    })}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>

        </div>
      </main>

      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-modal-in cursor-zoom-out"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 p-2 rounded-2xl transition-all cursor-pointer border border-white/10"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImageUrl} 
            alt="صورة كاملة" 
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
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
