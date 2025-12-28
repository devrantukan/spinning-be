'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function RedemptionsPage() {
  // All hooks must be called unconditionally at the top level
  const { t } = useLanguage()
  const { theme } = useTheme()
  // Add a third useContext if needed - placeholder for now
  // const someOtherContext = useSomeOtherContext()
  
  const [authToken, setAuthToken] = useState('')
  const [redemptions, setRedemptions] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedMember, setSelectedMember] = useState<string>('')
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRedemption, setSelectedRedemption] = useState<any>(null)
  const [showDetails, setShowDetails] = useState(false)

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchRedemptions(savedToken)
    }
  }, [])

  // Calculate deduplicated pending count - MUST be called unconditionally after all useState and useEffect
  // This useMemo must always be called on every render, never conditionally
  const deduplicatedPendingCount = useMemo(() => {
    const pendingFromBackend = redemptions.filter(
      (r) => r.status === "PENDING"
    );
    return pendingFromBackend.length;
  }, [redemptions]);

  const fetchRedemptions = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    setError('')
    try {
      const url = new URL('/api/redemptions', window.location.origin)
      if (selectedStatus) {
        url.searchParams.set('status', selectedStatus)
      }
      if (selectedMember) {
        url.searchParams.set('memberId', selectedMember)
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to fetch redemptions')
      }

      const data = await res.json()
      setRedemptions(Array.isArray(data) ? data : [])
    } catch (error: any) {
      setError(error.message || 'Failed to fetch redemptions')
      console.error('Error fetching redemptions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleStatusChange = async (redemptionId: string, newStatus: string) => {
    if (!authToken) return

    try {
      const res = await fetch(`/api/redemptions/${redemptionId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || 'Failed to update redemption')
      }

      // Refresh redemptions
      await fetchRedemptions()
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    }
  }

  const filteredRedemptions = useMemo(() => {
    let filtered = redemptions

    if (searchTerm) {
      filtered = filtered.filter((r) => {
        const memberName = r.member?.user?.name || ''
        const memberEmail = r.member?.user?.email || ''
        const packageName = r.package?.name || ''
        const couponCode = r.coupon?.code || ''
        const search = searchTerm.toLowerCase()
        return (
          memberName.toLowerCase().includes(search) ||
          memberEmail.toLowerCase().includes(search) ||
          packageName.toLowerCase().includes(search) ||
          couponCode.toLowerCase().includes(search)
        )
      })
    }

    return filtered
  }, [redemptions, searchTerm])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Redemptions</h1>
          {deduplicatedPendingCount > 0 && (
            <p style={{ color: '#f57c00', marginTop: '0.5rem' }}>
              {deduplicatedPendingCount} pending redemption(s)
            </p>
          )}
        </div>
        <button
          onClick={() => fetchRedemptions()}
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
          padding: '1rem',
          backgroundColor: '#ffebee',
          color: '#c62828',
          borderRadius: '4px',
          marginBottom: '1rem'
        }}>
          {error}
        </div>
      )}

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '1rem',
        marginBottom: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search by member, package, or coupon..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px',
              flex: '1',
              minWidth: '200px'
            }}
          />
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value)
              // Trigger fetch with new status
              setTimeout(() => {
                if (authToken) {
                  fetchRedemptions(authToken)
                }
              }, 0)
            }}
            style={{
              padding: '0.5rem',
              border: '1px solid #ddd',
              borderRadius: '4px'
            }}
          >
            <option value="">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="USED">Used</option>
          </select>
        </div>
      </div>

      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        {loading && filteredRedemptions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
        ) : filteredRedemptions.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#999' }}>No redemptions found</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f5f5f5' }}>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Member</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Package/Coupon</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Price</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Redeemed At</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRedemptions.map((redemption) => (
                <tr key={redemption.id} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '1rem' }}>
                    <strong>{redemption.member?.user?.name || redemption.member?.user?.email || 'N/A'}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {redemption.package?.name || redemption.coupon?.name || 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    ${redemption.finalPrice?.toFixed(2) || '0.00'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {redemption.redeemedAt ? formatDate(redemption.redeemedAt) : 'N/A'}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <span style={{
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      backgroundColor: 
                        redemption.status === 'ACTIVE' ? '#e8f5e9' :
                        redemption.status === 'PENDING' ? '#fff3e0' :
                        redemption.status === 'EXPIRED' ? '#ffebee' :
                        redemption.status === 'CANCELLED' ? '#f5f5f5' : '#e3f2fd',
                      color: 
                        redemption.status === 'ACTIVE' ? '#388e3c' :
                        redemption.status === 'PENDING' ? '#f57c00' :
                        redemption.status === 'EXPIRED' ? '#c62828' :
                        redemption.status === 'CANCELLED' ? '#666' : '#1976d2'
                    }}>
                      {redemption.status}
                    </span>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {redemption.status === 'PENDING' && (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => handleStatusChange(redemption.id, 'ACTIVE')}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#388e3c',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleStatusChange(redemption.id, 'CANCELLED')}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#c62828',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                          }}
                        >
                          Cancel
                        </button>
                      </div>
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

