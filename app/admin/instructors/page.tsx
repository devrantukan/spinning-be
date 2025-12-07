'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

export default function InstructorsPage() {
  const { theme } = useTheme()
  const [authToken, setAuthToken] = useState('')
  const [instructors, setInstructors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchInstructors(savedToken)
    }
  }, [])

  const fetchInstructors = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users?role=INSTRUCTOR', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 403) {
          setError('Only admins can view instructors')
        } else {
          setError(errorData.error || 'Failed to fetch instructors')
        }
        setInstructors([])
        return
      }

      const data = await res.json()
      setInstructors(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setError(`Error: ${error.message}`)
      setInstructors([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Instructors</h1>
        <button
          onClick={() => fetchInstructors()}
          disabled={loading}
          style={{
            padding: '0.75rem 1.5rem',
            backgroundColor: '#1976d2',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '1rem',
            fontWeight: 'bold',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1
          }}
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: '#ffebee',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #d32f2f',
          color: '#c62828'
        }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!authToken && (
        <div style={{
          backgroundColor: '#fff3cd',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          border: '1px solid #ffc107'
        }}>
          <strong>Note:</strong> Please log in to view instructors.
        </div>
      )}

      <div style={{
        backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
        color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ 
          padding: '1rem', 
          borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}`, 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center' 
        }}>
          <strong>All Instructors ({instructors.length})</strong>
          <p style={{ 
            margin: 0, 
            fontSize: '0.85rem', 
            color: theme === 'dark' ? '#b0b0b0' : '#666' 
          }}>
            Instructors are users with the INSTRUCTOR role. Assign a user the INSTRUCTOR role to create an instructor.
          </p>
        </div>
        {loading && instructors.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : instructors.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme === 'dark' ? '#999' : '#999' }}>
            {error ? 'Unable to load instructors' : 'No instructors found'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: theme === 'dark' ? '#1e1e1e' : '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Organization</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Memberships</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Bookings</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {instructors.map((instructor) => (
                <tr key={instructor.id} style={{ borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}` }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{instructor.name || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>{instructor.email}</td>
                  <td style={{ padding: '1rem' }}>
                    {instructor.organization?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>{instructor._count?.memberships || 0}</td>
                  <td style={{ padding: '1rem' }}>{instructor._count?.bookings || 0}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem', color: theme === 'dark' ? '#b0b0b0' : '#666' }}>
                    {new Date(instructor.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}





