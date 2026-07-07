'use client'

import { useState, useEffect, useRef } from 'react'
import { Calendar as CalendarIcon, ChevronRight, ChevronLeft } from 'lucide-react'

interface DatePickerProps {
  value: string // YYYY-MM-DD
  onChange: (value: string) => void
  name?: string
  placeholder?: string
  className?: string
  align?: 'left' | 'right'
  direction?: 'up' | 'down'
  fullWidth?: boolean
}

export default function DatePicker({ value, onChange, name, placeholder, className, align = 'right', direction = 'down', fullWidth = false }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dynamicAlign, setDynamicAlign] = useState<'left' | 'right'>(align)

  // ضبط اتجاه المحاذاة ديناميكياً بناءً على المساحة المتاحة في الشاشة لمنع اختراق الحدود
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      const dropdownWidth = 288 // عرض w-72 هو 288 بكسل
      const spaceRight = window.innerWidth - rect.left
      const spaceLeft = rect.right

      if (align === 'right' && spaceLeft < dropdownWidth && spaceRight >= dropdownWidth) {
        setDynamicAlign('left')
      } else if (align === 'left' && spaceRight < dropdownWidth && spaceLeft >= dropdownWidth) {
        setDynamicAlign('right')
      } else {
        setDynamicAlign(align)
      }
    }
  }, [isOpen, align])

  // تهيئة التاريخ بناءً على القيمة المرسلة
  const initialDate = value ? new Date(value) : new Date()
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear())
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth()) // 0-11

  useEffect(() => {
    if (value) {
      const d = new Date(value)
      if (!isNaN(d.getTime())) {
        setCurrentYear(d.getFullYear())
        setCurrentMonth(d.getMonth())
      }
    }
  }, [value])

  // إغلاق القائمة عند النقر خارجها
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const arabicMonths = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ]
  const dayNames = ['أحد', 'ثن', 'ثلا', 'أرب', 'خم', 'جم', 'سب']

  // حساب الأيام في الشهر الحالي
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
  // اليوم الأول في الشهر (0 = الأحد، 1 = الاثنين، إلخ)
  const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay()

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11)
      setCurrentYear(currentYear - 1)
    } else {
      setCurrentMonth(currentMonth - 1)
    }
  }

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0)
      setCurrentYear(currentYear + 1)
    } else {
      setCurrentMonth(currentMonth + 1)
    }
  }

  const handleSelectDay = (day: number) => {
    const yyyy = currentYear
    const mm = String(currentMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    onChange(dateStr)
    setIsOpen(false)
  }

  const handleSelectToday = () => {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    const dateStr = `${yyyy}-${mm}-${dd}`
    onChange(dateStr)
    setIsOpen(false)
  }

  // توليد الفراغات قبل اليوم الأول من الشهر
  const blanks = Array.from({ length: firstDayIndex })
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  // تنسيق التاريخ للعرض
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr) return placeholder || 'اختر التاريخ'
    const d = new Date(dateStr)
    if (isNaN(d.getTime())) return placeholder || 'اختر التاريخ'
    const yyyy = d.getFullYear()
    const mm = d.getMonth()
    const dd = d.getDate()
    return `${dd} ${arabicMonths[mm]} ${yyyy}`
  }

  return (
    <div className={`relative inline-block text-right ${fullWidth ? 'w-full' : 'w-full sm:w-auto'}`} ref={containerRef}>
      {name && <input type="hidden" name={name} value={value} />}
      
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full bg-theme-panel border border-theme-border focus:border-theme-accent focus:bg-theme-bg text-theme-text rounded-xl pr-10 pl-4 py-2.5 text-xs font-bold outline-none transition-all cursor-pointer shadow-sm hover:border-theme-border/80 flex items-center justify-between gap-2 ${className}`}
      >
        <span>{formatDisplayDate(value)}</span>
        <CalendarIcon className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-theme-text-muted pointer-events-none" />
      </button>

      {isOpen && (
        <>
          {/* خلفية معتمة للهواتف الذكية تمنع التداخل وتمركز التركيز */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-[49] sm:hidden" 
            onClick={() => setIsOpen(false)}
          ></div>
          
          <div className={`fixed sm:absolute top-1/2 sm:top-auto left-1/2 sm:left-auto right-auto transform -translate-x-1/2 sm:translate-x-0 -translate-y-1/2 sm:translate-y-0 w-72 bg-theme-panel border border-theme-border rounded-2xl shadow-2xl p-4 z-50 animate-modal-in select-none ${
            direction === 'up'
              ? 'sm:bottom-full sm:mb-2'
              : 'sm:top-full mt-2'
          } ${
            dynamicAlign === 'left' 
              ? 'left-1/2 sm:left-0 right-auto sm:right-auto' 
              : 'left-1/2 sm:left-auto right-auto sm:right-0'
          }`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={handleNextMonth} // الشهر القادم في واجهة RTL يذهب لليمين أو اليسار حسب التصميم، هنا السهم المناسب
                className="p-1.5 hover:bg-theme-bg rounded-xl border border-theme-border transition-colors text-theme-text cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <div className="text-xs font-black text-theme-text">
                {arabicMonths[currentMonth]} {currentYear}
              </div>
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-theme-bg rounded-xl border border-theme-border transition-colors text-theme-text cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Days of week */}
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-theme-text-muted mb-2 border-b border-theme-border pb-1">
              {dayNames.map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {blanks.map((_, i) => (
                <div key={`blank-${i}`} className="aspect-square" />
              ))}
              {days.map((day) => {
                const yyyy = currentYear
                const mm = String(currentMonth + 1).padStart(2, '0')
                const dd = String(day).padStart(2, '0')
                const dateStr = `${yyyy}-${mm}-${dd}`
                const isSelected = value === dateStr
                const isToday = (() => {
                  const today = new Date()
                  return today.getFullYear() === yyyy && today.getMonth() === currentMonth && today.getDate() === day
                })()

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => handleSelectDay(day)}
                    className={`aspect-square text-xs font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer ${
                      isSelected
                        ? 'bg-theme-accent text-theme-panel shadow-sm font-black'
                        : isToday
                        ? 'bg-theme-accent/15 border border-theme-accent/35 text-theme-accent font-black'
                        : 'text-theme-text hover:bg-theme-bg'
                    }`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-theme-border mt-3 pt-2 text-[10px]">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2.5 py-1 text-theme-accent hover:bg-theme-accent/10 rounded-md font-bold transition-all cursor-pointer"
              >
                اليوم
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange('')
                  setIsOpen(false)
                }}
                className="px-2.5 py-1 text-rose-500 hover:bg-rose-500/10 rounded-md font-bold transition-all cursor-pointer"
              >
                مسح
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
