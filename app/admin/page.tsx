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

      // Fetch counts - use admin endpoints to get all data across organizations
      const [classesRes, sessionsRes, bookingsRes, membersRes, organizationsRes, instructorsRes] = await Promise.all([
        fetch('/api/admin/classes', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }),
        fetch('/api/admin/sessions', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }),
        fetch('/api/admin/bookings', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }),
        fetch('/api/admin/members', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }),
        fetch('/api/admin/organizations', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        }),
        fetch('/api/users?role=INSTRUCTOR', {
          headers: { 'Authorization': `Bearer ${tokenToUse}` }
        })
      ])

      const classes = classesRes.ok ? await classesRes.json() : []
      const sessions = sessionsRes.ok ? await sessionsRes.json() : []
      const bookings = bookingsRes.ok ? await bookingsRes.json() : []
      const members = membersRes.ok ? await membersRes.json() : []
      
      let organizations = []
      if (organizationsRes.ok) {
        organizations = await organizationsRes.json()
      } else {
        const errorData = await organizationsRes.json().catch(() => ({}))
        console.error('Failed to fetch organizations:', organizationsRes.status, errorData)
      }
      
      let instructors = []
      if (instructorsRes.ok) {
        instructors = await instructorsRes.json()
      } else {
        const errorData = await instructorsRes.json().catch(() => ({}))
        console.error('Failed to fetch instructors:', instructorsRes.status, errorData)
      }

      setStats({
        organization: org,
        counts: {
          classes: Array.isArray(classes) ? classes.length : 0,
          sessions: Array.isArray(sessions) ? sessions.length : 0,
          bookings: Array.isArray(bookings) ? bookings.length : 0,
          members: Array.isArray(members) ? members.length : 0,
          organizations: Array.isArray(organizations) ? organizations.length : 0,
          instructors: Array.isArray(instructors) ? instructors.length : 0
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
              title={t('admin.organizations')}
              value={stats.counts.organizations}
              icon="🏢"
              color="#9c27b0"
            />
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
            <StatCard
              title={t('admin.instructors')}
              value={stats.counts.instructors}
              icon="🎓"
              color="#d84315"
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

