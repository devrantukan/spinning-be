'use client'

import { useState, useEffect } from 'react'

export default function UsersPage() {
  const [authToken, setAuthToken] = useState('')
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resendingInvites, setResendingInvites] = useState<Set<string>>(new Set())
  const [invitationStatuses, setInvitationStatuses] = useState<Record<string, any>>({})

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
      
      // Check invitation status for all users - pass the token explicitly
      if (data && Array.isArray(data) && data.length > 0) {
        // Set initial empty statuses to avoid "Checking..." forever
        const initialStatuses: Record<string, any> = {}
        data.forEach((user: any) => {
          initialStatuses[user.id] = null // null means checking
        })
        setInvitationStatuses(initialStatuses)
        
        // Set a timeout to show "Unknown" if checks take too long
        setTimeout(() => {
          setInvitationStatuses((prev) => {
            const updated = { ...prev }
            Object.keys(updated).forEach((userId) => {
              if (updated[userId] === null) {
                updated[userId] = {
                  hasInvitation: false,
                  emailConfirmed: false,
                  needsResend: false,
                  error: true,
                  message: 'Status check timeout'
                }
              }
            })
            return updated
          })
        }, 15000) // 15 second timeout
        
        // Then check actual statuses - pass the token
        checkInvitationStatuses(data, tokenToUse)
      }
    } catch (error: any) {
      setError(`Error: ${error.message}`)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const checkInvitationStatuses = async (usersList: any[], token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) {
      console.warn('No auth token, skipping invitation status check')
      return
    }

    console.log(`Checking invitation statuses for ${usersList.length} users`)
    const statuses: Record<string, any> = {}
    
    // Check status for each user in parallel with timeout
    const statusPromises = usersList.map(async (user) => {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const res = await fetch(`/api/users/${user.id}/invitation-status`, {
          headers: {
            'Authorization': `Bearer ${tokenToUse}`
          },
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
        
        if (res.ok) {
          const status = await res.json()
          console.log(`Status for user ${user.id}:`, status)
          return { userId: user.id, status }
        } else {
          const errorData = await res.json().catch(() => ({}))
          console.error(`Failed to get status for user ${user.id} (${res.status}):`, errorData)
          
          // For 401 errors, the token might be invalid - don't retry
          if (res.status === 401) {
            return { 
              userId: user.id, 
              status: { 
                hasInvitation: false, 
                emailConfirmed: false, 
                needsResend: false,
                error: true,
                message: 'Authentication failed. Please refresh the page.'
              } 
            }
          }
          
          // Set a default status for other failed checks
          return { 
            userId: user.id, 
            status: { 
              hasInvitation: false, 
              emailConfirmed: false, 
              needsResend: false,
              error: true,
              message: errorData.error || `Failed to check status (${res.status})`
            } 
          }
        }
      } catch (error: any) {
        // Don't log AbortError as it's expected for timeouts
        if (error.name !== 'AbortError') {
          console.error(`Error checking status for user ${user.id}:`, error)
        }
        // Set a default status for errors
        return { 
          userId: user.id, 
          status: { 
            hasInvitation: false, 
            emailConfirmed: false, 
            needsResend: false,
            error: true,
            message: error.name === 'AbortError' ? 'Request timeout' : (error.message || 'Failed to check status')
          } 
        }
      }
    })
    
    try {
      const results = await Promise.allSettled(statusPromises)
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          const { userId, status } = result.value
          statuses[userId] = status
        } else {
          // Handle rejected promises
          const user = usersList[index]
          console.error(`Promise rejected for user ${user?.id || index}:`, result.reason)
          if (user) {
            statuses[user.id] = {
              hasInvitation: false,
              emailConfirmed: false,
              needsResend: false,
              error: true,
              message: result.reason?.message || 'Failed to check status'
            }
          }
        }
      })
      
      console.log('Final invitation statuses:', statuses)
      // Ensure all users have a status (even if it's an error)
      usersList.forEach((user) => {
        if (!statuses[user.id]) {
          statuses[user.id] = {
            hasInvitation: false,
            emailConfirmed: false,
            needsResend: false,
            error: true,
            message: 'Status check incomplete'
          }
        }
      })
      setInvitationStatuses(statuses)
    } catch (error) {
      console.error('Error processing invitation statuses:', error)
      // Set default error statuses so UI doesn't show "Checking..." forever
      const errorStatuses: Record<string, any> = {}
      usersList.forEach((user) => {
        errorStatuses[user.id] = {
          hasInvitation: false,
          emailConfirmed: false,
          needsResend: false,
          error: true,
          message: 'Failed to check status'
        }
      })
      setInvitationStatuses(errorStatuses)
    }
  }

  const handleResendInvitation = async (userId: string, userEmail: string) => {
    if (!authToken) {
      alert('Not authenticated')
      return
    }

    if (!confirm(`Resend invitation email to ${userEmail}?`)) {
      return
    }

    setResendingInvites(prev => new Set(prev).add(userId))

    try {
      const res = await fetch(`/api/users/${userId}/resend-invitation`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to resend invitation')
      }

      alert('Invitation sent successfully!')
      
      // Refresh invitation status
      const statusRes = await fetch(`/api/users/${userId}/invitation-status`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      if (statusRes.ok) {
        const status = await statusRes.json()
        setInvitationStatuses(prev => ({
          ...prev,
          [userId]: status
        }))
      }
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setResendingInvites(prev => {
        const next = new Set(prev)
        next.delete(userId)
        return next
      })
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
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Invitation Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Created</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const invitationStatus = invitationStatuses[user.id]
                const needsResend = invitationStatus?.needsResend || false
                const emailConfirmed = invitationStatus?.emailConfirmed || false
                const isResending = resendingInvites.has(user.id)

                return (
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
                    <td style={{ padding: '1rem' }}>
                      {invitationStatus === null || invitationStatus === undefined ? (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          backgroundColor: '#f5f5f5',
                          color: '#666'
                        }}>
                          Checking...
                        </span>
                      ) : invitationStatus.error === true ? (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          backgroundColor: '#ffebee',
                          color: '#d32f2f'
                        }} title={invitationStatus.message || 'Error checking status'}>
                          Unknown
                        </span>
                      ) : invitationStatus.emailConfirmed === true ? (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          backgroundColor: '#e8f5e9',
                          color: '#388e3c'
                        }}>
                          ✓ Confirmed
                        </span>
                      ) : (
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          backgroundColor: '#fff3e0',
                          color: '#f57c00'
                        }}>
                          ⏳ Pending
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', fontSize: '0.85rem', color: '#666' }}>
                      {new Date(user.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '1rem' }}>
                      {needsResend && (
                        <button
                          onClick={() => handleResendInvitation(user.id, user.email)}
                          disabled={isResending}
                          style={{
                            padding: '0.5rem 1rem',
                            backgroundColor: isResending ? '#ccc' : '#f57c00',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            fontSize: '0.85rem',
                            cursor: isResending ? 'not-allowed' : 'pointer',
                            opacity: isResending ? 0.6 : 1
                          }}
                        >
                          {isResending ? 'Sending...' : 'Resend Invitation'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

