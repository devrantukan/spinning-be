import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With, X-Organization-Id',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Get the response
  const response = NextResponse.next()

  // Add CORS headers to all responses
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Organization-Id')
  response.headers.set('Access-Control-Max-Age', '86400')

  return response
}

// Configure which routes the middleware applies to
export const config = {
  matcher: '/api/:path*',
}

