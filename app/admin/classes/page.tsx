'use client'

import { useState, useEffect } from 'react'

export default function ClassesPage() {
  const [authToken, setAuthToken] = useState('')
  const [classes, setClasses] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [selectedClass, setSelectedClass] = useState<any>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    duration: '45',
    maxCapacity: '20',
    instructorId: ''
  })

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchClasses(savedToken)
    }
  }, [])

  const fetchClasses = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    try {
      const res = await fetch('/api/admin/classes', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch classes')
      }
      
      const data = await res.json()
      setClasses(Array.isArray(data) ? data : [])
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchClassDetails = async (classId: string) => {
    if (!authToken) return

    setLoadingDetails(true)
    try {
      const res = await fetch(`/api/admin/classes/${classId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch class details')
      }

      const data = await res.json()
      setSelectedClass(data)
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoadingDetails(false)
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
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...formData,
          duration: parseInt(formData.duration),
          maxCapacity: parseInt(formData.maxCapacity),
          instructorId: formData.instructorId || undefined
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create class')
      }

      const newClass = await res.json()
      setClasses([...classes, newClass])
      setShowForm(false)
      setFormData({ name: '', description: '', duration: '45', maxCapacity: '20', instructorId: '' })
      alert('Class created successfully!')
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>Classes</h1>
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
          {showForm ? 'Cancel' : '+ New Class'}
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
          <h2>Create New Class</h2>
          <form onSubmit={handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                  Duration (minutes) *
                </label>
                <input
                  type="number"
                  required
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
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
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
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
              <div>
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
              {loading ? 'Creating...' : 'Create Class'}
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
          <strong>All Classes ({classes.length})</strong>
          <button
            onClick={() => fetchClasses()}
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
        {loading && classes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : classes.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No classes found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Name</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Organization</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Duration</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Capacity</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Sessions</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((cls) => (
                <tr key={cls.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{cls.name}</strong>
                    {cls.description && (
                      <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                        {cls.description.substring(0, 50)}{cls.description.length > 50 ? '...' : ''}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {cls.organization?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>{cls.duration} min</td>
                  <td style={{ padding: '1rem' }}>{cls.maxCapacity}</td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: cls.status === 'ACTIVE' ? '#e8f5e9' : '#f5f5f5',
                      color: cls.status === 'ACTIVE' ? '#388e3c' : '#666'
                    }}>
                      {cls.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>{cls._count?.sessions || 0}</td>
                  <td style={{ padding: '1rem' }}>
                    <button
                      onClick={() => fetchClassDetails(cls.id)}
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
      {selectedClass && (
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
          onClick={() => setSelectedClass(null)}
        >
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '8px',
              padding: '2rem',
              maxWidth: '800px',
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
                  <h2 style={{ margin: 0 }}>{selectedClass.name}</h2>
                  <button
                    onClick={() => setSelectedClass(null)}
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
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Duration</strong>
                    <div>{selectedClass.duration} minutes</div>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Max Capacity</strong>
                    <div>{selectedClass.maxCapacity}</div>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Status</strong>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: selectedClass.status === 'ACTIVE' ? '#e8f5e9' : '#f5f5f5',
                      color: selectedClass.status === 'ACTIVE' ? '#388e3c' : '#666'
                    }}>
                      {selectedClass.status}
                    </span>
                  </div>
                  <div>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Total Sessions</strong>
                    <div>{selectedClass._count?.sessions || 0}</div>
                  </div>
                </div>

                {selectedClass.description && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Description</strong>
                    <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      {selectedClass.description}
                    </div>
                  </div>
                )}

                <div style={{ marginBottom: '1.5rem' }}>
                  <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Organization</strong>
                  <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                    <div><strong>{selectedClass.organization?.name || 'N/A'}</strong></div>
                    {selectedClass.organization?.email && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedClass.organization.email}
                      </div>
                    )}
                    {selectedClass.organization?.phone && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedClass.organization.phone}
                      </div>
                    )}
                    {selectedClass.organization?.address && (
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                        {selectedClass.organization.address}
                      </div>
                    )}
                  </div>
                </div>

                {selectedClass.instructor && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Assigned Instructor</strong>
                    <div style={{ padding: '1rem', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                      <div><strong>{selectedClass.instructor.user?.name || 'N/A'}</strong></div>
                      {selectedClass.instructor.user?.email && (
                        <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                          {selectedClass.instructor.user.email}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {selectedClass.sessions && selectedClass.sessions.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', color: '#666' }}>Recent Sessions</strong>
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#f5f5f5' }}>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Start Time</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Bookings</th>
                            <th style={{ padding: '0.75rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedClass.sessions.map((session: any) => (
                            <tr key={session.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                              <td style={{ padding: '0.75rem' }}>
                                {new Date(session.startTime).toLocaleString()}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
                                {session._count?.bookings || 0} / {session.maxCapacity}
                              </td>
                              <td style={{ padding: '0.75rem' }}>
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
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e0e0e0', fontSize: '0.85rem', color: '#666' }}>
                  <div>Created: {new Date(selectedClass.createdAt).toLocaleString()}</div>
                  <div style={{ marginTop: '0.5rem' }}>Last Updated: {new Date(selectedClass.updatedAt).toLocaleString()}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

