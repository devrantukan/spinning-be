'use client'

import { useState, useEffect } from 'react'

export default function UsersPage() {
  const [authToken, setAuthToken] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchUsers(savedToken)
    }
  }, [])

  const fetchUsers = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 403) {
          setError('Only admins can view users')
        } else {
          setError(errorData.error || 'Failed to fetch users')
        }
        setUsers([])
        return
      }

      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setError(`Error: ${error.message}`)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Users</h1>
        <button
          onClick={() => fetchUsers()}
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
          <strong>Note:</strong> Please log in to view users.
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>All Users ({users.length})</strong>
        </div>
        {loading && users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>
            {error ? 'Unable to load users' : 'No users found'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Email</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Role</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Organization</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Memberships</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Bookings</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{user.name || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>{user.email}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: 
                        user.role === 'ADMIN' ? '#e3f2fd' :
                        user.role === 'TENANT_ADMIN' ? '#f3e5f5' :
                        user.role === 'INSTRUCTOR' ? '#fff3e0' :
                        '#e8f5e9',
                      color: 
                        user.role === 'ADMIN' ? '#1976d2' :
                        user.role === 'TENANT_ADMIN' ? '#7b1fa2' :
                        user.role === 'INSTRUCTOR' ? '#f57c00' :
                        '#388e3c'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {user.organization?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>{user._count?.memberships || 0}</td>
                  <td style={{ padding: '1rem' }}>{user._count?.bookings || 0}</td>
                  <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#666' }}>
                    {new Date(user.createdAt).toLocaleDateString()}
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

