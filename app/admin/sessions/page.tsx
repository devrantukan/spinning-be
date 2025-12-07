'use client'

import { useState, useEffect } from 'react'

export default function SessionsPage() {
  const [authToken, setAuthToken] = useState('')
  const [sessions, setSessions] = useState<any[]>([])
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedSession, setSelectedSession] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [formData, setFormData] = useState({
    classId: '',
    instructorId: '',
    startTime: '',
    endTime: '',
    maxCapacity: '20'
  })

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchSessions(savedToken)
      fetchClasses(savedToken)
    }
  }, [])

  const fetchSessions = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/sessions', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch sessions')
      }
      
      const data = await res.json()
      setSessions(Array.isArray(data) ? data : [])
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchSessionDetails = async (sessionId: string) => {
    if (!authToken) return

    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/admin/sessions/${sessionId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch session details')
      }

      const data = await res.json()
      setSelectedSession(data)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoadingDetails(false)
    }
  }

  const fetchClasses = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    try {
      const res = await fetch('/api/admin/classes', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setClasses(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching classes:', error)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authToken) {
      alert('Not authenticated. Please log in.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          maxCapacity: parseInt(formData.maxCapacity),
          instructorId: formData.instructorId || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create session')
      }

      const newSession = await res.json()
      setSessions([...sessions, newSession])
      setShowForm(false)
      setFormData({ classId: '', instructorId: '', startTime: '', endTime: '', maxCapacity: '20' })
      alert('Session created successfully!')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Sessions</h1>
        <button
          onClick={() => setShowForm(!showForm)}
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
          {showForm ? 'Cancel' : '+ New Session'}
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: 'white',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2>Create New Session</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Class *
                </label>
                <select
                  required
                  value={formData.classId}
                  onChange={(e) => setFormData({ ...formData, classId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                >
                  <option value="">Select a class</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Max Capacity
                </label>
                <input
                  type="number"
                  value={formData.maxCapacity}
                  onChange={(e) => setFormData({ ...formData, maxCapacity: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Start Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  End Time *
                </label>
                <input
                  type="datetime-local"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                Instructor ID (optional)
              </label>
              <input
                type="text"
                value={formData.instructorId}
                onChange={(e) => setFormData({ ...formData, instructorId: e.target.value })}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px'
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#388e3c',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                fontSize: '1rem',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Creating...' : 'Create Session'}
            </button>
          </form>
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ padding: '1rem', borderBottom: '1px solid #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong>All Sessions ({sessions.length})</strong>
          <button
            onClick={() => fetchSessions()}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        {loading && sessions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : sessions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No sessions found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Class</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Organization</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Start Time</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>End Time</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Bookings</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{session.class?.name || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {session.organization?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>{formatDate(session.startTime)}</td>
                  <td style={{ padding: '1rem' }}>{formatDate(session.endTime)}</td>
                  <td style={{ padding: '1rem' }}>
                    {session.currentBookings || session._count?.bookings || 0} / {session.maxCapacity}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: 
                        session.status === 'SCHEDULED' ? '#e3f2fd' :
                        session.status === 'COMPLETED' ? '#e8f5e9' :
                        session.status === 'CANCELLED' ? '#ffebee' : '#fff3e0',
                      color: 
                        session.status === 'SCHEDULED' ? '#1976d2' :
                        session.status === 'COMPLETED' ? '#388e3c' :
                        session.status === 'CANCELLED' ? '#d32f2f' : '#f57c00'
                    }}>
                      {session.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => fetchSessionDetails(session.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        backgroundColor: '#1976d2',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '0.85rem',
                        cursor: 'pointer'
                      }}
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {selectedSession && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '2rem'
          }}
          onClick={() => setSelectedSession(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {loadingDetails ? (
              <div style={{ padding: '2rem', textAlign: 'center' }}>Loading details...</div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ margin: 0 }}>{selectedSession.class?.name || 'Session Details'}</h2>
                  <button
                    onClick={() => setSelectedSession(null)}
                    style={{
                      backgroundColor: 'transparent',
                      border: 'none',
                      fontSize: '1.5rem',
                      cursor: 'pointer',
                      color: '#666'
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Start Time</strong>
                    <div>{formatDate(selectedSession.startTime)}</div>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>End Time</strong>
                    <div>{formatDate(selectedSession.endTime)}</div>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Capacity</strong>
                    <div>{selectedSession.currentBookings || selectedSession._count?.bookings || 0} / {selectedSession.maxCapacity}</div>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Status</strong>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: 
                        selectedSession.status === 'SCHEDULED' ? '#e3f2fd' :
                        selectedSession.status === 'COMPLETED' ? '#e8f5e9' :
                        selectedSession.status === 'CANCELLED' ? '#ffebee' : '#fff3e0',
                      color: 
                        selectedSession.status === 'SCHEDULED' ? '#1976d2' :
                        selectedSession.status === 'COMPLETED' ? '#388e3c' :
                        selectedSession.status === 'CANCELLED' ? '#d32f2f' : '#f57c00'
                    }}>
                      {selectedSession.status}
                    </span>
                  </div>
                </div>

                {selectedSession.class && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Class Information</strong>
                    <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <div><strong>{selectedSession.class.name}</strong></div>
                      {selectedSession.class.description && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                          {selectedSession.class.description}
                        </div>
                      )}
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.5rem' }}>
                        Duration: {selectedSession.class.duration} minutes
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Organization</strong>
                  <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <div><strong>{selectedSession.organization?.name || 'N/A'}</strong></div>
                    {selectedSession.organization?.email && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedSession.organization.email}
                      </div>
                    )}
                    {selectedSession.organization?.phone && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedSession.organization.phone}
                      </div>
                    )}
                    {selectedSession.organization?.address && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedSession.organization.address}
                      </div>
                    )}
                  </div>
                </div>

                {selectedSession.instructor && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Instructor</strong>
                    <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <div><strong>{selectedSession.instructor.user?.name || 'N/A'}</strong></div>
                      {selectedSession.instructor.user?.email && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                          {selectedSession.instructor.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedSession.bookings && selectedSession.bookings.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>
                      Bookings ({selectedSession.bookings.length})
                    </strong>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Member</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Email</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Booked At</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSession.bookings.map((booking: any) => (
                            <tr key={booking.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                              <td style={{ padding: '0.75rem' }}>
                                {booking.member?.user?.name || 'N/A'}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                {booking.member?.user?.email || 'N/A'}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                <span style={{
                                  padding: '0.25rem 0.5rem',
                                  borderRadius: '4px',
                                  fontSize: '0.85rem',
                                  backgroundColor: 
                                    booking.status === 'CONFIRMED' ? '#e8f5e9' :
                                    booking.status === 'CANCELLED' ? '#ffebee' :
                                    booking.status === 'COMPLETED' ? '#e3f2fd' : '#fff3e0',
                                  color: 
                                    booking.status === 'CONFIRMED' ? '#388e3c' :
                                    booking.status === 'CANCELLED' ? '#d32f2f' :
                                    booking.status === 'COMPLETED' ? '#1976d2' : '#f57c00'
                                }}>
                                  {booking.status}
                                </span>
                                {booking.checkedIn && (
                                  <span style={{
                                    marginLeft: '0.5rem',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '4px',
                                    fontSize: '0.85rem',
                                    backgroundColor: '#e8f5e9',
                                    color: '#388e3c'
                                  }}>
                                    ✓ Checked In
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: '0.75rem', fontSize: '0.85rem', color: '#666' }}>
                                {new Date(booking.createdAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0', fontSize: '0.85rem', color: '#666' }}>
                  <div>Created: {new Date(selectedSession.createdAt).toLocaleString()}</div>
                  <div style={{ marginTop: '0.5rem' }}>Last Updated: {new Date(selectedSession.updatedAt).toLocaleString()}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

