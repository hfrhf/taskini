import React from 'react'

export default function Loading() {
  return (
    <div className="min-h-screen bg-theme-bg flex flex-col antialiased">
      {/* هيكل الهيدر (Header Skeleton) */}
      <header className="sticky top-0 z-40 bg-theme-panel/90 backdrop-blur-md border-b border-theme-border transition-all duration-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="h-6 w-24 bg-theme-border rounded-lg animate-pulse" />
          <div className="hidden md:flex gap-8">
            <div className="h-5 w-20 bg-theme-border rounded-xl animate-pulse" />
            <div className="h-5 w-20 bg-theme-border rounded-xl animate-pulse" />
            <div className="h-5 w-20 bg-theme-border rounded-xl animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-theme-border animate-pulse" />
            <div className="w-16 h-8 rounded-xl bg-theme-border animate-pulse" />
          </div>
        </div>
      </header>

      {/* هيكل المحتوى الرئيسي (Main Content Skeleton) */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* بطاقة الترحيب (Banner Skeleton) */}
        <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border h-44 flex flex-col justify-between animate-pulse">
          <div className="space-y-3">
            <div className="h-6 w-1/3 bg-theme-border rounded-lg" />
            <div className="h-4 w-1/4 bg-theme-border rounded-lg" />
          </div>
          <div className="h-10 w-28 bg-theme-border rounded-xl" />
        </div>

        {/* شبكة البطاقات (Cards Grid Skeleton) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* العمود الأول */}
          <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border h-80 space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-5 w-28 bg-theme-border rounded-lg" />
              <div className="h-4 w-12 bg-theme-border rounded-lg" />
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
            </div>
          </div>

          {/* العمود الثاني */}
          <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border h-80 space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-5 w-28 bg-theme-border rounded-lg" />
              <div className="h-4 w-12 bg-theme-border rounded-lg" />
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
            </div>
          </div>

          {/* العمود الثالث */}
          <div className="bg-theme-panel rounded-3xl p-6 border border-theme-border h-80 space-y-4 animate-pulse">
            <div className="flex justify-between items-center">
              <div className="h-5 w-28 bg-theme-border rounded-lg" />
              <div className="h-4 w-12 bg-theme-border rounded-lg" />
            </div>
            <div className="space-y-3 pt-4">
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
              <div className="h-12 bg-theme-bg/60 rounded-2xl" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
