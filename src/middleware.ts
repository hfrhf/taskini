import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // التحقق من حالة تسجيل الدخول
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isAuthPage = path.startsWith('/login')
  const isPublicFile = path.match(/\.(png|jpg|jpeg|gif|ico|svg)$/)
  const isApi = path.startsWith('/api')
  const isPwaFile = path === '/sw.js' || path === '/manifest.json'

  // إذا لم يكن مسجلاً ويحاول الدخول لصفحات محمية، وجهه لتسجيل الدخول
  if (!user && !isAuthPage && !isPublicFile && !isApi && !isPwaFile) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // إذا كان مسجلاً ويحاول فتح صفحة تسجيل الدخول، وجهه للرئيسية
  if (user && isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * مطابقة جميع المسارات ما عدا ملفات next/static و next/image والأيقونات والملفات العامة وملفات PWA
     */
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
