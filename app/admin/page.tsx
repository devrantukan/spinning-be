'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function AdminDashboard() {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const [authToken, setAuthToken] = useState('')
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    // Get token from localStorage (set by admin layout)
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchStats(savedToken)
    }
  }, [])

  const fetchStats = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) {
      alert('Not authenticated. Please log in.')
      return
    }

    setLoading(true)
    try {
      // Fetch organization info
      const orgRes = await fetch('/api/organizations', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })

      if (!orgRes.ok) {
        const errorData = await orgRes.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch organization')
      }

      const org = await orgRes.json()

      // Fetch counts
      const [classesRes, sessionsRes, bookingsRes, membersRes] = await Promise.all([
        fetch(`/api/classes?organizationId=${org.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`/api/sessions?organizationId=${org.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`/api/bookings?organizationId=${org.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        }),
        fetch(`/api/members?organizationId=${org.id}`, {
          headers: { 'Authorization': `Bearer ${authToken}` }
        })
      ])

      const classes = await classesRes.json()
      const sessions = await sessionsRes.json()
      const bookings = await bookingsRes.json()
      const members = await membersRes.json()

      setStats({
        organization: org,
        counts: {
          classes: Array.isArray(classes) ? classes.length : 0,
          sessions: Array.isArray(sessions) ? sessions.length : 0,
          bookings: Array.isArray(bookings) ? bookings.length : 0,
          members: Array.isArray(members) ? members.length : 0
        }
      })
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h1>{t('dashboard.title')}</h1>

      {!authToken && (
        <div style={{
          backgroundColor: '#fff3cd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #ffc107'
        }}>
          <strong>Note:</strong> You are logged in via Supabase. Loading statistics...
        </div>
      )}

      {authToken && !stats && !loading && (
        <div style={{
          backgroundColor: '#e3f2fd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #1976d2'
        }}>
          <button
            onClick={() => fetchStats()}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              fontSize: '1rem',
              fontWeight: 'bold',
              cursor: 'pointer'
            }}
          >
            Load Statistics
          </button>
        </div>
      )}

      {stats && (
        <div>
        <div style={{
          backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
          color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
            <h2 style={{ marginTop: 0 }}>{t('dashboard.organization')}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <strong>{t('organizations.name')}:</strong> {stats.organization.name}
              </div>
              <div>
                <strong>{t('organizations.slug')}:</strong> {stats.organization.slug}
              </div>
              <div>
                <strong>ID:</strong> <code style={{ fontSize: '0.85rem' }}>{stats.organization.id}</code>
              </div>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '1.5rem'
          }}>
            <StatCard
              title={t('admin.classes')}
              value={stats.counts.classes}
              icon="🚴"
              color="#1976d2"
            />
            <StatCard
              title={t('admin.sessions')}
              value={stats.counts.sessions}
              icon="📅"
              color="#388e3c"
            />
            <StatCard
              title={t('admin.bookings')}
              value={stats.counts.bookings}
              icon="🎫"
              color="#f57c00"
            />
            <StatCard
              title={t('admin.members')}
              value={stats.counts.members}
              icon="👤"
              color="#7b1fa2"
            />
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ title, value, icon, color }: { title: string, value: number, icon: string, color: string }) {
  const { theme } = useTheme()
  
  return (
    <div style={{
      backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
      color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
      padding: '1.5rem',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      borderTop: `4px solid ${color}`
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.9rem', color: theme === 'dark' ? '#b0b0b0' : '#666', marginBottom: '0.5rem' }}>{title}</div>
          <div style={{ fontSize: '2rem', fontWeight: 'bold', color }}>{value}</div>
        </div>
        <div style={{ fontSize: '3rem' }}>{icon}</div>
      </div>
    </div>
  )
}

