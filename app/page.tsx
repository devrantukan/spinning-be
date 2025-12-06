import Link from 'next/link'

export default function Home() {
  return (
    <main style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Spinning App Backend API</h1>
      <p>Multi-tenant spinning studio management system</p>
      <p>API endpoints are available at <code>/api/*</code></p>
      
      <div style={{ marginTop: '2rem', padding: '1.5rem', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
        <h2>Quick Links</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li style={{ marginBottom: '0.5rem' }}>
            <Link href="/dashboard" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '1.1rem' }}>
              → API Dashboard & Tester
            </Link>
          </li>
          <li>
            <Link href="/admin/login" style={{ color: '#1976d2', textDecoration: 'none', fontSize: '1.1rem' }}>
              → Admin Panel (Login)
            </Link>
          </li>
        </ul>
      </div>

      <div style={{ marginTop: '2rem' }}>
        <h2>Available Endpoints</h2>
        <ul>
          <li><code>GET /api/organizations</code> - Get organization info</li>
          <li><code>GET /api/classes</code> - List classes</li>
          <li><code>POST /api/classes</code> - Create class</li>
          <li><code>GET /api/sessions</code> - List sessions</li>
          <li><code>POST /api/sessions</code> - Create session</li>
          <li><code>GET /api/bookings</code> - List bookings</li>
          <li><code>POST /api/bookings</code> - Create booking</li>
        </ul>
      </div>
    </main>
  )
}

