'use client'

import { useState, useEffect } from 'react'

export default function MembersPage() {
  const [authToken, setAuthToken] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchMembers(savedToken)
    }
  }, [])

  const fetchMembers = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/members', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setMembers(Array.isArray(data) ? data : [])
      } else {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch members')
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Members</h1>
        <button
          onClick={() => fetchMembers()}
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


      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {loading && members.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : members.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No members found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Organization</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Role</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Bookings</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{member.user?.name || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>{member.user?.email || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>{member.organization?.name || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>{member.user?.role || 'N/A'}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: member.status === 'ACTIVE' ? '#e8f5e9' : '#f5f5f5',
                      color: member.status === 'ACTIVE' ? '#388e3c' : '#666'
                    }}>
                      {member.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{member._count?.bookings || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

