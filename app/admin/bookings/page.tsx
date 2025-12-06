'use client'

import { useState, useEffect } from 'react'

export default function BookingsPage() {
  const [authToken, setAuthToken] = useState('')
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchBookings(savedToken)
    }
  }, [])

  const fetchBookings = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    try {
      const res = await fetch('/api/bookings', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      const data = await res.json()
      setBookings(Array.isArray(data) ? data : [])
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
        <h1>Bookings</h1>
        <button
          onClick={() => fetchBookings()}
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
        {loading && bookings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : bookings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No bookings found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Member</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Session</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Class</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Start Time</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Checked In</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{booking.member?.user?.name || booking.member?.user?.email || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {booking.session?.class?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {booking.session?.class?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {booking.session?.startTime ? formatDate(booking.session.startTime) : 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
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
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {booking.checkedIn ? (
                      <span style={{ color: '#388e3c' }}>✓ Yes</span>
                    ) : (
                      <span style={{ color: '#999' }}>No</span>
                    )}
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


