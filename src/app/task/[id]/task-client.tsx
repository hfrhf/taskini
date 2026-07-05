'use client'

import { useState } from 'react'
import Header from '@/components/Header'
import Toast from '@/components/Toast'
import DatePicker from '@/components/DatePicker'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { 
  ArrowRight, 
  Paperclip, 
  Download, 
  Trash2, 
  Edit, 
  Loader2, 
  CheckCircle2, 
  AlertCircle,
  FileIcon
} from 'lucide-react'
import { 
  updateTaskStatus, 
  updateTaskDetails, 
  uploadTaskFile, 
  deleteTaskFile, 
  getTaskFiles 
} from '../../actions'

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

interface TaskFile {
  id: string
  file_name: string
  file_path: string
  uploaded_by: string
  uploaded_at: string
}

interface TaskClientProps {
  currentProfile: Profile
  initialTask: any
  initialFiles: TaskFile[]
  teamProfiles: Profile[]
  milestones: Milestone[]
}

const statusMap: Record<string, string> = {
  'not_started': 'لم تبدأ بعد',
  'in_progress': 'قيد التنفيذ',
  'completed': 'مكتمل',
  'late': 'متأخر'
}

// خريطة لتنسيق ألوان المهام التاريخية والنشطة
const colorClassMap: Record<string, { card: string; badge: string }> = {
  'classic': { card: 'bg-theme-panel border-theme-border text-theme-text', badge: 'bg-theme-bg text-theme-text-muted' },
  'pastel-red': { card: 'bg-rose-500/10 border-rose-500/20 text-theme-text', badge: 'bg-rose-500/20 text-rose-450' },
  'pastel-blue': { card: 'bg-sky-500/10 border-sky-500/20 text-theme-text', badge: 'bg-sky-500/20 text-sky-400' },
  'pastel-green': { card: 'bg-emerald-500/10 border-emerald-500/20 text-theme-text', badge: 'bg-emerald-500/20 text-emerald-400' },
  'pastel-amber': { card: 'bg-amber-500/10 border-amber-500/20 text-theme-text', badge: 'bg-amber-500/20 text-amber-400' },
  'pastel-purple': { card: 'bg-purple-500/10 border-purple-500/20 text-theme-text', badge: 'bg-purple-500/20 text-purple-400' },
  'pastel-neutral': { card: 'bg-orange-500/10 border-orange-500/20 text-theme-text', badge: 'bg-orange-500/20 text-orange-400' }
}

export default function TaskDetailClient({ currentProfile, initialTask, initialFiles, teamProfiles, milestones }: TaskClientProps) {
  const router = useRouter()
  const [task, setTask] = useState(initialTask)
  const [files, setFiles] = useState<TaskFile[]>(initialFiles)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  
  // حالات تعديل تفاصيل المهمة
  const [taskDueDate, setTaskDueDate] = useState(task.due_date || '')
  const [taskMilestoneId, setTaskMilestoneId] = useState(task.milestone_id || '')
  const [taskColor, setTaskColor] = useState(task.color || 'classic')
  const [taskWorkHours, setTaskWorkHours] = useState<number>(0)
  const [taskWorkMinutes, setTaskWorkMinutes] = useState<number>(0)

  const openEditModal = () => {
    setTaskDueDate(task.due_date || '')
    setTaskMilestoneId(task.milestone_id || '')
    setTaskColor(task.color || 'classic')
    setTaskWorkHours(Math.floor((task.work_minutes || 0) / 60))
    setTaskWorkMinutes((task.work_minutes || 0) % 60)
    setIsEditModalOpen(true)
  }

  // حالات تحميل الأفعال
  const [isUploading, setIsUploading] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [isSavingDetails, setIsSavingDetails] = useState(false)
  
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type })
  }

  // تحديث حالة المهمة
  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    try {
      setIsUpdatingStatus(true)
      const updated = await updateTaskStatus(task.id, newStatus)
      setTask({ ...task, status: updated.status, completed_date: updated.completed_date })
      showToast('تم تحديث حالة المهمة بنجاح', 'success')
    } catch (err: any) {
      showToast('فشل تحديث الحالة: ' + err.message, 'error')
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  // تعديل تفاصيل المهمة
  const handleEditDetailsSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    const title = formData.get('title') as string
    const description = formData.get('description') as string
    const assignedTo = formData.get('assigned_to') as string
    const workHours = parseInt(formData.get('work_hours') as string) || 0
    const workMinutes = parseInt(formData.get('work_minutes') as string) || 0
    const totalMinutes = (workHours * 60) + workMinutes

    try {
      setIsSavingDetails(true)
      await updateTaskDetails(
        task.id,
        title,
        description,
        taskMilestoneId || null,
        assignedTo || null,
        taskDueDate,
        taskColor,
        totalMinutes
      )

      // البحث عن المسؤول في قائمة الفريق لتحديث الاسم والصورة بالواجهة
      const selectedAssignee = teamProfiles.find(p => p.id === assignedTo)
      // البحث عن المحطة الاستراتيجية لتحديث الشارات بالواجهة
      const selectedMilestone = milestones.find(m => m.id === taskMilestoneId)

      setTask({
        ...task,
        title,
        description,
        milestone_id: taskMilestoneId || null,
        milestone: selectedMilestone ? { id: selectedMilestone.id, title: selectedMilestone.title } : null,
        assigned_to: assignedTo || null,
        assignee: selectedAssignee ? { name: selectedAssignee.name, email: selectedAssignee.email, avatar_url: selectedAssignee.avatar_url } : null,
        due_date: taskDueDate,
        color: taskColor,
        work_minutes: totalMinutes
      })

      showToast('تم حفظ التعديلات بنجاح', 'success')
      setIsEditModalOpen(false)
    } catch (err: any) {
      showToast('فشل تعديل المهمة: ' + err.message, 'error')
    } finally {
      setIsSavingDetails(false)
    }
  }

  // رفع ملف مرفق
  const handleFileUpload = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = e.currentTarget
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement
    if (!fileInput.files || fileInput.files.length === 0) return

    const formData = new FormData(form)
    try {
      setIsUploading(true)
      await uploadTaskFile(task.id, formData)
      showToast('تم رفع الملف المرفق بنجاح', 'success')
      form.reset()
      // إعادة تحميل قائمة الملفات
      const updatedFiles = await getTaskFiles(task.id)
      setFiles(updatedFiles)
    } catch (err: any) {
      showToast('فشل رفع الملف: ' + err.message, 'error')
    } finally {
      setIsUploading(false)
    }
  }

  // حذف ملف مرفق
  const handleDeleteFile = async (fileId: string, filePath: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الملف المرفق؟')) return
    try {
      await deleteTaskFile(fileId, filePath)
      showToast('تم حذف الملف بنجاح', 'success')
      setFiles(files.filter(f => f.id !== fileId))
    } catch (err: any) {
      showToast('فشل حذف الملف: ' + err.message, 'error')
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const getFileDownloadUrl = (filePath: string) => {
    return `${supabaseUrl}/storage/v1/object/public/task-attachments/${filePath}`
  }

  const style = colorClassMap[task.color] || colorClassMap.classic
  const isCompleted = task.status === 'completed'

  return (
    <div className="flex-grow flex flex-col min-h-screen pb-24 md:pb-8">
      <Header user={currentProfile} />

      <main className="flex-grow max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="space-y-6 animate-modal-in">
          
          {/* Breadcrumb و الرجوع */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-5">
            <div className="flex items-center gap-3 text-right w-full md:w-auto">
              <button 
                onClick={() => router.push('/')}
                className="p-2.5 bg-theme-panel hover:bg-theme-bg text-theme-text rounded-xl border border-theme-border transition-all flex items-center justify-center shadow-sm cursor-pointer shrink-0"
                title="الرجوع للرئيسية"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <div>
                <div className="flex items-center gap-1.5 text-[10px] text-theme-text-muted font-bold mb-1">
                  <span>الرئيسية</span>
                  <span>/</span>
                  <span style={{ color: task.group?.color === 'pastel-purple' ? '#a855f7' : task.group?.color === 'pastel-blue' ? '#0ea5e9' : 'currentColor' }}>
                    {task.group?.name}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-theme-text">تفاصيل المهمة</h1>
              </div>
            </div>

            <button 
              onClick={openEditModal}
              className="w-full md:w-auto bg-theme-panel hover:bg-theme-bg border border-theme-border text-theme-text text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5" />
              <span>تعديل المهمة</span>
            </button>
          </div>

          {/* كرت المهمة بالكامل */}
          <div className={`border rounded-3xl p-6 sm:p-8 shadow-sm text-right space-y-6 ${style.card}`}>
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border pb-5">
              <div>
                <h2 className="text-lg font-bold text-theme-text">{task.title}</h2>
                <p className="text-[11px] text-theme-text-muted mt-1">
                  المسؤول: <strong className="text-theme-text">{task.assignee ? task.assignee.name : 'غير محدد'}</strong> | تاريخ الاستحقاق: {task.due_date}
                </p>
                {task.milestone && (
                  <span className="inline-block text-[10px] text-theme-accent bg-theme-accent/10 px-2.5 py-0.5 rounded-md mt-2 font-bold">
                    🎯 المحطة الكبرى: {task.milestone.title}
                  </span>
                )}
                {task.work_minutes > 0 && (
                  <span className="inline-block text-[10px] text-theme-accent bg-theme-accent/10 px-2.5 py-0.5 rounded-md mt-2 mr-2 font-bold">
                    ⏱️ مدة العمل: {Math.floor(task.work_minutes / 60)}س {task.work_minutes % 60}د
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-start">
                <span className="text-xs font-bold text-theme-text-muted">حالة العمل:</span>
                <div className="relative w-40 sm:w-auto">
                  {isUpdatingStatus && (
                    <div className="absolute inset-0 bg-theme-panel/50 flex items-center justify-center rounded-xl">
                      <Loader2 className="w-4 h-4 animate-spin text-theme-accent" />
                    </div>
                  )}
                  <select 
                    value={task.status} 
                    onChange={handleStatusChange}
                    className="w-full text-xs bg-theme-panel border border-theme-border focus:border-theme-accent text-theme-text rounded-xl px-4 py-2.5 outline-none transition-all cursor-pointer font-bold"
                  >
                    {Object.entries(statusMap).map(([key, val]) => (
                      <option key={key} value={key}>{val}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* الوصف */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold text-theme-text">الوصف والتفاصيل</h3>
              <p className="text-xs text-theme-text-muted leading-relaxed whitespace-pre-line bg-theme-input/40 border border-theme-border rounded-2xl p-4 min-h-[100px]">
                {task.description || 'لا يوجد تفاصيل إضافية مكتوبة لهذه المهمة.'}
              </p>
            </div>

            {/* المرفقات والملفات */}
            <div className="space-y-4 border-t border-theme-border pt-5">
              <h3 className="text-xs font-bold text-theme-text flex items-center gap-1.5">
                <Paperclip className="w-4 h-4 text-theme-text-muted" />
                <span>ملفات ومرفقات المهمة ({files.length})</span>
              </h3>

              {/* قائمة الملفات */}
              {files.length === 0 ? (
                <p className="text-xs text-theme-text-muted bg-theme-input/50 rounded-2xl p-4 text-center border border-dashed border-theme-border">
                  لا توجد ملفات مرفقة بهذه المهمة حالياً.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {files.map((file) => (
                    <div 
                      key={file.id}
                      className="bg-theme-panel border border-theme-border rounded-xl p-3 flex items-center justify-between gap-3 text-right"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <FileIcon className="w-4 h-4 text-theme-text-muted shrink-0" />
                        <span className="text-[11px] font-medium truncate text-theme-text" title={file.file_name}>
                          {file.file_name}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 shrink-0">
                        <a 
                          href={getFileDownloadUrl(file.file_path)} 
                          download={file.file_name}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 hover:bg-theme-bg text-theme-text-muted hover:text-theme-text rounded-lg transition-colors cursor-pointer"
                          title="تنزيل الملف"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>
                        <button 
                          onClick={() => handleDeleteFile(file.id, file.file_path)}
                          className="p-1.5 hover:bg-rose-950/20 text-theme-text-muted hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                          title="حذف الملف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* نموذج الرفع */}
              <form onSubmit={handleFileUpload} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <input 
                  type="file" 
                  name="task_file" 
                  required
                  className="flex-1 bg-theme-input border border-theme-border focus:border-theme-accent text-theme-text rounded-xl px-3 py-2 text-xs transition-all outline-none file:bg-theme-accent file:text-theme-panel file:border-0 file:rounded-lg file:px-3 file:py-1.5 file:ml-3 file:text-[10px] file:font-bold file:cursor-pointer cursor-pointer"
                />
                <button 
                  type="submit"
                  disabled={isUploading}
                  className="bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 text-theme-panel text-xs font-bold px-5 py-3 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الرفع السحابي...</span>
                    </>
                  ) : (
                    <span>رفع ملف جديد</span>
                  )}
                </button>
              </form>
            </div>

          </div>

        </div>
      </main>

      {/* ================== نافذة تعديل المهمة (Modal) ================== */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-xs" onClick={() => setIsEditModalOpen(false)}></div>
          <div className="relative bg-theme-panel w-full max-w-md mx-4 rounded-3xl p-6 sm:p-8 shadow-2xl border border-theme-border animate-modal-in z-10 text-right">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-bold text-theme-text">تعديل تفاصيل المهمة</h3>
                <p className="text-xs text-theme-text-muted mt-1">تحديث عنوان ووصف المهمة الحاليين</p>
              </div>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="p-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-bg rounded-xl transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditDetailsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">عنوان المهمة</label>
                <input 
                  type="text" 
                  name="title" 
                  required
                  defaultValue={task.title}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الوصف والتفاصيل</label>
                <textarea 
                  name="description" 
                  rows={4}
                  defaultValue={task.description || ''}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none resize-none" 
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5">المسؤول عن المهمة</label>
                  <select 
                    name="assigned_to"
                    required
                    defaultValue={task.assigned_to || ''}
                    className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                  >
                    {currentProfile.role === 'admin' ? (
                      teamProfiles.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))
                    ) : (
                      <option value={currentProfile.id}>{currentProfile.name}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-theme-text-muted mb-1.5">الموعد النهائي للتسليم</label>
                  <DatePicker 
                    name="due_date"
                    value={taskDueDate}
                    onChange={setTaskDueDate}
                    className="bg-theme-input focus:bg-theme-panel py-3"
                    direction="up"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">وقت العمل المسجل</label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="number"
                      name="work_hours"
                      min={0}
                      max={24}
                      value={taskWorkHours}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setTaskWorkHours(Math.min(24, Math.max(0, val)))
                      }}
                      className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                      placeholder="0"
                    />
                    <span className="text-xs font-bold text-theme-text-muted">ساعة</span>
                  </div>
                  <div className="flex-1 flex items-center gap-2">
                    <input 
                      type="number"
                      name="work_minutes"
                      min={0}
                      max={59}
                      value={taskWorkMinutes}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0
                        setTaskWorkMinutes(Math.min(59, Math.max(0, val)))
                      }}
                      className="w-full text-center bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl py-2.5 text-xs transition-all outline-none font-bold"
                      placeholder="00"
                    />
                    <span className="text-xs font-bold text-theme-text-muted">دقيقة</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-1.5">المحطة الكبرى المرتبطة (Milestone)</label>
                <select 
                  value={taskMilestoneId}
                  onChange={(e) => setTaskMilestoneId(e.target.value)}
                  className="w-full bg-theme-input border border-theme-border focus:border-theme-accent focus:bg-theme-panel text-theme-text rounded-xl px-4 py-3 text-xs transition-all outline-none cursor-pointer font-semibold"
                >
                  <option value="">أعمال عامة / غير مرتبطة بمحطة</option>
                  {milestones.map(m => (
                    <option key={m.id} value={m.id}>
                      {m.status === 'completed' ? '💯' : m.status === 'delayed' ? '⚠️' : '🎯'} {m.title}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-theme-text-muted mb-2">اختر لون بوكس المهمة للتمييز:</label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {Object.keys(colorClassMap).map((colorKey) => (
                    <label key={colorKey} className="cursor-pointer">
                      <input 
                        type="radio" 
                        name="color" 
                        value={colorKey} 
                        checked={taskColor === colorKey}
                        onChange={() => setTaskColor(colorKey)}
                        className="peer sr-only"
                      />
                      <div className="peer-checked:ring-2 peer-checked:ring-theme-accent border border-theme-border rounded-xl py-2 px-1 text-center text-[10px] font-bold bg-theme-panel text-theme-text transition-all select-none">
                        {colorKey === 'classic' ? 'أبيض' : 
                         colorKey === 'pastel-red' ? 'وردي' : 
                         colorKey === 'pastel-blue' ? 'سماوي' : 
                         colorKey === 'pastel-green' ? 'زمردي' : 
                         colorKey === 'pastel-amber' ? 'ذهبي' : 
                         colorKey === 'pastel-purple' ? 'بنفسجي' : 'رملي'}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSavingDetails}
                  className="w-full bg-theme-accent hover:bg-theme-accent-hover disabled:bg-neutral-300 text-theme-panel font-bold py-3.5 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSavingDetails ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري حفظ التعديلات...</span>
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

      {/* عرض التنبيهات المنبثقة */}
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
