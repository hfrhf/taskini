'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import { 
  Globe, 
  MessageSquare, 
  ThumbsUp, 
  Heart, 
  Send, 
  Trash2, 
  Image, 
  X, 
  Loader2, 
  Smile, 
  CornerDownLeft,
  Share2
} from 'lucide-react'
import { 
  getPublications, 
  createPublication, 
  deletePublication, 
  togglePublicationReaction, 
  addPublicationComment, 
  deletePublicationComment 
} from '../actions'
import Link from 'next/link'

interface Profile {
  id: string
  name: string
  email: string
  role: string
  avatar_url: string
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

interface FeedClientProps {
  currentProfile: Profile
  initialPublications: Publication[]
  dbError: string | null
}

const reactionMap: Record<string, { label: string; icon: string; colorClass: string; bgClass: string }> = {
  like: { label: 'أعجبني', icon: '👍', colorClass: 'text-blue-500 hover:scale-125', bgClass: 'bg-blue-500/10' },
  heart: { label: 'حبّبته', icon: '❤️', colorClass: 'text-rose-500 hover:scale-125', bgClass: 'bg-rose-500/10' },
  haha: { label: 'أضحكني', icon: '😆', colorClass: 'text-amber-500 hover:scale-125', bgClass: 'bg-amber-500/10' },
  wow: { label: 'أدهشني', icon: '😮', colorClass: 'text-yellow-500 hover:scale-125', bgClass: 'bg-yellow-500/10' },
  sad: { label: 'أحزنني', icon: '😢', colorClass: 'text-sky-500 hover:scale-125', bgClass: 'bg-sky-500/10' },
  angry: { label: 'أغضبني', icon: '😡', colorClass: 'text-orange-600 hover:scale-125', bgClass: 'bg-orange-500/10' }
}

export default function FeedClient({ 
  currentProfile, 
  initialPublications,
  dbError 
}: FeedClientProps) {
  const [publications, setPublications] = useState<Publication[]>(initialPublications || [])
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)
  
  // Publication Form States
  const [content, setContent] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isPublishing, setIsPublishing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Interactive Reactions State
  const [activeReactionPostId, setActiveReactionPostId] = useState<string | null>(null)
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleReactionMouseEnter = (pubId: string) => {
    if (reactionTimeoutRef.current) {
      clearTimeout(reactionTimeoutRef.current)
      reactionTimeoutRef.current = null
    }
    setActiveReactionPostId(pubId)
  }

  const handleReactionMouseLeave = () => {
    reactionTimeoutRef.current = setTimeout(() => {
      setActiveReactionPostId(null)
    }, 300)
  }

  useEffect(() => {
    return () => {
      if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
    }
  }, [])

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

  const fetchPublications = async () => {
    try {
      const data = await getPublications()
      setPublications(data as Publication[])
    } catch (err: any) {
      showToast('فشل تحديث المنشورات: ' + err.message, 'error')
    }
  }

  // Handle Image Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت', 'warning')
        return
      }
      setSelectedFile(file)
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleCancelFile = () => {
    setSelectedFile(null)
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Create Publication
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() && !selectedFile) {
      showToast('يرجى كتابة نص أو إرفاق صورة للمنشور', 'warning')
      return
    }

    try {
      setIsPublishing(true)
      const formData = new FormData()
      if (selectedFile) {
        formData.append('image_file', selectedFile)
      }

      await createPublication(content, selectedFile ? formData : undefined)
      showToast('تم نشر منشورك بنجاح! 🎉', 'success')
      
      // Reset form
      setContent('')
      handleCancelFile()
      fetchPublications()
    } catch (err: any) {
      showToast('فشل نشر المنشور: ' + err.message, 'error')
    } finally {
      setIsPublishing(false)
    }
  }

  // Delete Publication
  const handleDeletePost = async (pubId: string) => {
    if (!window.confirm('هل أنت متأكد من رغبتك في حذف هذا المنشور نهائياً؟')) return

    try {
      await deletePublication(pubId)
      showToast('تم حذف المنشور بنجاح', 'success')
      fetchPublications()
    } catch (err: any) {
      showToast('فشل حذف المنشور: ' + err.message, 'error')
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
          // Remove old reaction count
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
      // Silent sync
      const data = await getPublications()
      setPublications(data as Publication[])
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
      fetchPublications()
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
      fetchPublications()
    } catch (err: any) {
      showToast('فشل حذف التعليق: ' + err.message, 'error')
    }
  }

  // Copy link to clipboard
  const handleShare = (pubId: string) => {
    const shareUrl = `${window.location.origin}/feed?post=${pubId}`
    navigator.clipboard.writeText(shareUrl)
    showToast('تم نسخ رابط المنشور إلى الحافظة 🔗', 'success')
  }

  // Format creation date
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

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full text-right">
        <div className="space-y-6">
          
          {dbError && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-5 text-rose-500 space-y-2">
              <h3 className="text-sm font-black flex items-center gap-2">
                <span>⚠️ تنبيه قاعدة البيانات</span>
              </h3>
              <p className="text-xs text-theme-text-muted leading-relaxed">
                يبدو أن جداول المنشورات والتعليقات والتفاعلات لم يتم تثبيتها بعد في قاعدة البيانات. 
                يرجى نسخ التعليمات من ملف <code className="bg-theme-bg px-1.5 py-0.5 rounded border border-theme-border font-mono text-[10px]">publications_setup.sql</code> وتشغيلها في SQL Editor الخاص بـ Supabase.
              </p>
              <p className="text-[9px] text-rose-400 font-mono">
                تفاصيل الخطأ: {dbError}
              </p>
            </div>
          )}

          {/* العنوان الرئيسي للمجتمع */}
          <div className="flex items-center gap-3 border-b border-theme-border pb-4">
            <div className="w-12 h-12 rounded-2xl bg-theme-accent/10 flex items-center justify-center shrink-0 border border-theme-accent/20">
              <Globe className="w-6 h-6 text-theme-accent animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl font-black text-theme-text">ساحة المشاركة والمنشورات الاجتماعية</h1>
              <p className="text-xs text-theme-text-muted mt-1">تواصل مع فريق عملك، شارك منشوراتك وصورك وتفاعل مع نقاشات زملائك</p>
            </div>
          </div>

          {/* نموذج كتابة منشور جديد (Create Post Card) */}
          <div className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-xs relative overflow-hidden">
            <div className="flex gap-3 items-start">
              <img 
                src={currentProfile.avatar_url}
                alt={currentProfile.name}
                className="w-10 h-10 rounded-2xl object-cover border border-theme-border"
              />
              <form onSubmit={handlePublish} className="flex-1 space-y-3">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={`ماذا يدور في ذهنك يا ${currentProfile.name.split(' ')[0]}؟ شارك أفكارك أو صور إنجازاتك...`}
                  rows={3}
                  className="w-full bg-theme-bg/50 border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-2xl p-4 text-xs transition-all outline-none resize-none leading-relaxed"
                />

                {/* معاينة الصورة المرفقة قبل النشر */}
                {previewUrl && (
                  <div className="relative rounded-2xl overflow-hidden border border-theme-border max-h-60 w-fit">
                    <img 
                      src={previewUrl} 
                      alt="معاينة الصورة" 
                      className="max-h-60 object-contain rounded-2xl"
                    />
                    <button
                      type="button"
                      onClick={handleCancelFile}
                      className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white p-1.5 rounded-full transition-colors cursor-pointer"
                      title="إلغاء الصورة"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-theme-border/50 pt-3">
                  <div className="flex gap-2">
                    {/* زر إضافة صورة */}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 bg-theme-bg hover:bg-theme-border text-theme-text-muted hover:text-theme-text rounded-xl border border-theme-border transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer text-xs font-bold"
                    >
                      <Image className="w-4 h-4 text-emerald-500" />
                      <span className="hidden sm:inline">إضافة صورة</span>
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept="image/*"
                      className="hidden"
                    />
                  </div>

                  {/* زر النشر */}
                  <button
                    type="submit"
                    disabled={isPublishing}
                    className="bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel font-black px-5 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer text-xs"
                  >
                    {isPublishing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>جاري النشر...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>نشر الآن</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* قائمة المنشورات الاجتماعية */}
          {publications.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center bg-theme-panel rounded-3xl border border-dashed border-theme-border">
              <Globe className="w-12 h-12 text-theme-text-muted mb-3 opacity-60 animate-pulse" />
              <h3 className="text-sm font-bold text-theme-text">لا توجد منشورات اجتماعية بعد</h3>
              <p className="text-xs text-theme-text-muted max-w-xs mt-1 leading-relaxed">
                كن أول من يفتتح هذه الساحة بمشاركة منشور تشجع فيه زملائك أو تطرح فكرة ملهمة!
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {publications.map((pub) => {
                const isPostOwner = pub.user_id === currentProfile.id || currentProfile.role === 'admin'
                const reactionsList = Object.keys(pub.reactions_grouped || {})
                const hasReacted = pub.user_reaction !== null
                const commentsList = pub.comments || []

                // Separate top-level comments and replies
                const topLevelComments = commentsList.filter(c => c.parent_id === null)

                return (
                  <div 
                    key={pub.id}
                    className="bg-theme-panel border border-theme-border rounded-3xl p-5 shadow-xs transition-all duration-200 animate-modal-in"
                  >
                    {/* ترويسة كارت المنشور */}
                    <div className="flex justify-between items-start gap-4 mb-4">
                      <div className="flex items-center gap-3">
                        <Link href={`/profile/${pub.user_id}`}>
                          <img 
                            src={pub.user.avatar_url}
                            alt={pub.user.name}
                            className="w-10 h-10 rounded-2xl object-cover border border-theme-border cursor-pointer hover:opacity-90 transition-opacity"
                          />
                        </Link>
                        <div>
                          <div className="flex items-center gap-2">
                            <Link href={`/profile/${pub.user_id}`} className="text-xs font-black text-theme-text hover:text-theme-accent transition-colors">
                              {pub.user.name}
                            </Link>
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${
                              pub.user_id === currentProfile.id ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-theme-bg border-theme-border text-theme-text-muted'
                            }`}>
                              {pub.user_id === currentProfile.id ? 'أنا' : 'عضو'}
                            </span>
                          </div>
                          <span className="text-[9px] text-theme-text-muted block mt-0.5">{formatTime(pub.created_at)}</span>
                        </div>
                      </div>

                      {/* زر الحذف لصاحب المنشور */}
                      {isPostOwner && (
                        <button
                          onClick={() => handleDeletePost(pub.id)}
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

                    {/* صورة المنشور إن وجدت */}
                    {pub.image_url && (
                      <div 
                        className="mb-4 rounded-2xl overflow-hidden border border-theme-border/60 max-h-96 bg-theme-bg cursor-zoom-in"
                        onClick={() => setLightboxImageUrl(pub.image_url)}
                      >
                        <img 
                          src={pub.image_url} 
                          alt="صورة المنشور" 
                          className="w-full max-h-96 object-cover hover:scale-[1.01] transition-transform duration-300"
                        />
                      </div>
                    )}

                    {/* شريط الإحصاءات (عدد التفاعلات والتعليقات) */}
                    <div className="flex justify-between items-center text-[10px] text-theme-text-muted border-t border-b border-theme-border/50 py-3 mb-3 font-bold select-none">
                      {/* التفاعلات والوجوه */}
                      <div className="flex items-center gap-1.5">
                        {pub.reactions_count > 0 ? (
                          <>
                            <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                              {reactionsList.map((type) => (
                                <span 
                                  key={type} 
                                  className="w-4 h-4 rounded-full bg-theme-panel border border-theme-border flex items-center justify-center text-[10px]"
                                  title={reactionMap[type]?.label}
                                >
                                  {reactionMap[type]?.icon}
                                </span>
                              ))}
                            </div>
                            <span className="mr-1 text-[9px] font-black text-theme-text">{pub.reactions_count} تفاعلات</span>
                          </>
                        ) : (
                          <span>لا تفاعلات بعد</span>
                        )}
                      </div>

                      {/* عدد التعليقات ومشاركة */}
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setOpenCommentsPostId(openCommentsPostId === pub.id ? null : pub.id)}
                          className="hover:text-theme-text transition-colors cursor-pointer"
                        >
                          {commentsList.length} تعليقات
                        </button>
                        <span>•</span>
                        <button 
                          onClick={() => handleShare(pub.id)}
                          className="hover:text-theme-text transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>مشاركة</span>
                        </button>
                      </div>
                    </div>

                    {/* شريط الأزرار التفاعلية (أعجبني، تعليق) مع قائمة التفاعلات العائمة */}
                    <div className="flex items-center justify-between gap-2 relative">
                      {/* زر التفاعل (مثل فيسبوك) */}
                      <div 
                        className="relative flex-1"
                        onMouseEnter={() => handleReactionMouseEnter(pub.id)}
                        onMouseLeave={handleReactionMouseLeave}
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

                        {/* قائمة التفاعلات العائمة (Facebook style popover) */}
                        {activeReactionPostId === pub.id && (
                          <div className="absolute bottom-11 right-0 left-0 sm:left-auto mt-2 bg-theme-panel border border-theme-border shadow-xl rounded-full py-1.5 px-3.5 z-40 flex items-center gap-3.5 animate-modal-in justify-center w-full sm:w-auto">
                            {Object.entries(reactionMap).map(([type, value]) => (
                              <button
                                key={type}
                                type="button"
                                onClick={() => handleReact(pub.id, type)}
                                className="text-xl cursor-pointer transition-transform transform duration-150 active:scale-95"
                                title={value.label}
                              >
                                {value.icon}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* زر فتح التعليقات */}
                      <button
                        onClick={() => setOpenCommentsPostId(openCommentsPostId === pub.id ? null : pub.id)}
                        className={`flex-1 py-2 bg-theme-bg/30 hover:bg-theme-bg text-xs font-black text-theme-text-muted hover:text-theme-text rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          openCommentsPostId === pub.id ? 'bg-theme-bg border border-theme-border' : ''
                        }`}
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>التعليقات</span>
                      </button>
                    </div>

                    {/* حاوية التعليقات والردود المتداخلة */}
                    {openCommentsPostId === pub.id && (
                      <div className="mt-5 border-t border-theme-border/40 pt-4 space-y-4">
                        {/* كتابة تعليق رئيسي جديد */}
                        <div className="flex gap-2 items-center">
                          <img 
                            src={currentProfile.avatar_url}
                            alt={currentProfile.name}
                            className="w-8 h-8 rounded-xl object-cover border border-theme-border shrink-0"
                          />
                          <div className="flex-1 flex gap-2 relative">
                            <input 
                              type="text"
                              value={newCommentContent}
                              onChange={(e) => setNewCommentContent(e.target.value)}
                              placeholder="اكتب تعليقاً على هذا المنشور..."
                              className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-2.5 pl-10 text-xs transition-all outline-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleCommentSubmit(pub.id)
                              }}
                            />
                            <button
                              onClick={() => handleCommentSubmit(pub.id)}
                              disabled={commentPendingPostId === pub.id}
                              className="absolute left-2 top-1.5 p-1 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel rounded-lg cursor-pointer transition-colors"
                            >
                              {commentPendingPostId === pub.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Send className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* قائمة التعليقات الهرمية */}
                        <div className="space-y-4">
                          {topLevelComments.length === 0 ? (
                            <p className="text-center text-[10px] text-theme-text-muted py-2 select-none">
                              لا تعليقات هنا بعد. أضف تعليقك لبدء النقاش!
                            </p>
                          ) : (
                            topLevelComments.map((comment) => {
                              const isCommentOwner = comment.user_id === currentProfile.id || currentProfile.role === 'admin'
                              
                              // Find replies for this specific comment
                              const replies = commentsList.filter(c => c.parent_id === comment.id)

                              return (
                                <div key={comment.id} className="space-y-3">
                                  {/* تعليق رئيسي */}
                                  <div className="bg-theme-bg/20 border border-theme-border/40 p-3 rounded-2xl relative space-y-1.5 group">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Link href={`/profile/${comment.user_id}`}>
                                          <img 
                                            src={comment.user.avatar_url}
                                            alt={comment.user.name}
                                            className="w-6 h-6 rounded-lg object-cover border border-theme-border shrink-0 cursor-pointer"
                                          />
                                        </Link>
                                        <Link href={`/profile/${comment.user_id}`} className="text-[10px] font-black text-theme-text hover:text-theme-accent">
                                          {comment.user.name}
                                        </Link>
                                        <span className="text-[8px] text-theme-text-muted">{formatTime(comment.created_at)}</span>
                                      </div>

                                      {isCommentOwner && (
                                        <button
                                          onClick={() => handleDeleteComment(comment.id)}
                                          className="text-theme-text-muted hover:text-rose-500 p-1 rounded-md transition-colors cursor-pointer"
                                          title="حذف التعليق"
                                        >
                                          <Trash2 className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                    <p className="text-xs text-theme-text leading-relaxed font-medium whitespace-pre-line pr-1">
                                      {comment.content}
                                    </p>

                                    {/* زر الرد */}
                                    <div className="pt-1 select-none">
                                      <button 
                                        onClick={() => {
                                          setActiveReplyCommentId(activeReplyCommentId === comment.id ? null : comment.id)
                                          setReplyContent('')
                                        }}
                                        className="text-[9px] font-black text-theme-text-muted hover:text-theme-accent transition-colors cursor-pointer flex items-center gap-1"
                                      >
                                        <CornerDownLeft className="w-3 h-3" />
                                        <span>رد على التعليق</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* صندوق كتابة الرد */}
                                  {activeReplyCommentId === comment.id && (
                                    <div className="mr-6 flex gap-2 items-center">
                                      <img 
                                        src={currentProfile.avatar_url}
                                        alt={currentProfile.name}
                                        className="w-6 h-6 rounded-lg object-cover border border-theme-border shrink-0"
                                      />
                                      <div className="flex-1 flex gap-2 relative">
                                        <input 
                                          type="text"
                                          value={replyContent}
                                          onChange={(e) => setReplyContent(e.target.value)}
                                          placeholder={`ردّ على ${comment.user.name.split(' ')[0]}...`}
                                          className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-3 py-2 pl-9 text-xs transition-all outline-none"
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleCommentSubmit(pub.id, comment.id)
                                          }}
                                        />
                                        <button
                                          onClick={() => handleCommentSubmit(pub.id, comment.id)}
                                          disabled={commentPendingPostId === pub.id}
                                          className="absolute left-1.5 top-1.5 p-1 bg-theme-accent hover:opacity-90 disabled:opacity-50 text-theme-panel rounded-lg cursor-pointer transition-colors"
                                        >
                                          {commentPendingPostId === pub.id ? (
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                          ) : (
                                            <Send className="w-3 h-3" />
                                          )}
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {/* ردود مائلة ومزاحة */}
                                  {replies.length > 0 && (
                                    <div className="mr-6 space-y-2 border-r border-theme-border/60 pr-3 mt-1.5">
                                      {replies.map((reply) => {
                                        const isReplyOwner = reply.user_id === currentProfile.id || currentProfile.role === 'admin'
                                        return (
                                          <div key={reply.id} className="bg-theme-bg/10 border border-theme-border/30 p-2.5 rounded-xl space-y-1">
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center gap-1.5">
                                                <Link href={`/profile/${reply.user_id}`}>
                                                  <img 
                                                    src={reply.user.avatar_url}
                                                    alt={reply.user.name}
                                                    className="w-5 h-5 rounded-md object-cover border border-theme-border shrink-0 cursor-pointer"
                                                  />
                                                </Link>
                                                <Link href={`/profile/${reply.user_id}`} className="text-[9px] font-black text-theme-text hover:text-theme-accent">
                                                  {reply.user.name}
                                                </Link>
                                                <span className="text-[7px] text-theme-text-muted">{formatTime(reply.created_at)}</span>
                                              </div>

                                              {isReplyOwner && (
                                                <button
                                                  onClick={() => handleDeleteComment(reply.id)}
                                                  className="text-theme-text-muted hover:text-rose-500 p-0.5 rounded transition-colors cursor-pointer"
                                                  title="حذف الرد"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                            <p className="text-[11px] text-theme-text pr-1 whitespace-pre-line leading-relaxed font-medium">
                                              {reply.content}
                                            </p>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
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
      </main>

      {/* ================== نافذة عرض الصورة بالحجم الكامل (Lightbox) ================== */}
      {lightboxImageUrl && (
        <div 
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-md flex items-center justify-center p-4 animate-modal-in cursor-zoom-out"
          onClick={() => setLightboxImageUrl(null)}
        >
          <button
            onClick={() => setLightboxImageUrl(null)}
            className="absolute top-5 right-5 text-white bg-white/10 hover:bg-white/20 p-2 rounded-2xl transition-all cursor-pointer border border-white/10 shadow-lg"
          >
            <X className="w-6 h-6" />
          </button>
          <img 
            src={lightboxImageUrl} 
            alt="عرض كامل الصورة" 
            className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl border border-white/5"
            onClick={(e) => e.stopPropagation()} // منع إغلاق النافذة عند الضغط على الصورة
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
