'use client'

import { useState, useEffect } from 'react'

interface ApiEndpoint {
  method: string
  path: string
  description: string
  requiresAuth: boolean
  requiresRole?: string
}

const apiEndpoints: ApiEndpoint[] = [
  {
    method: 'GET',
    path: '/api/organizations',
    description: 'Get current user\'s organization',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/api/classes',
    description: 'Get all classes for organization',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/api/classes',
    description: 'Create a new class',
    requiresAuth: true,
    requiresRole: 'ADMIN or INSTRUCTOR'
  },
  {
    method: 'GET',
    path: '/api/sessions',
    description: 'Get all sessions (with optional filters: startDate, endDate, classId, status)',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/api/sessions',
    description: 'Create a new session',
    requiresAuth: true,
    requiresRole: 'ADMIN or INSTRUCTOR'
  },
  {
    method: 'GET',
    path: '/api/sessions/[id]',
    description: 'Get a specific session',
    requiresAuth: true
  },
  {
    method: 'PATCH',
    path: '/api/sessions/[id]',
    description: 'Update a session',
    requiresAuth: true,
    requiresRole: 'ADMIN or INSTRUCTOR'
  },
  {
    method: 'DELETE',
    path: '/api/sessions/[id]',
    description: 'Delete a session',
    requiresAuth: true,
    requiresRole: 'ADMIN'
  },
  {
    method: 'GET',
    path: '/api/bookings',
    description: 'Get all bookings (with optional filters: sessionId, memberId, status)',
    requiresAuth: true
  },
  {
    method: 'POST',
    path: '/api/bookings',
    description: 'Create a new booking',
    requiresAuth: true
  },
  {
    method: 'GET',
    path: '/api/bookings/[id]',
    description: 'Get a specific booking',
    requiresAuth: true
  },
  {
    method: 'PATCH',
    path: '/api/bookings/[id]',
    description: 'Update a booking (cancel, check-in, etc.)',
    requiresAuth: true
  },
  {
    method: 'DELETE',
    path: '/api/bookings/[id]',
    description: 'Cancel/delete a booking',
    requiresAuth: true
  }
]

export default function Dashboard() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ApiEndpoint | null>(null)
  const [authToken, setAuthToken] = useState('')
  const [response, setResponse] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [requestBody, setRequestBody] = useState('')
  const [queryParams, setQueryParams] = useState('')

  const handleTestEndpoint = async () => {
    if (!selectedEndpoint) return

    setLoading(true)
    setResponse(null)

    try {
      const url = new URL(selectedEndpoint.path, window.location.origin)
      
      // Add query params
      if (queryParams) {
        const params = new URLSearchParams(queryParams)
        params.forEach((value, key) => {
          url.searchParams.append(key, value)
        })
      }

      // Add organizationId if provided
      const orgId = new URLSearchParams(queryParams).get('organizationId')
      if (orgId) {
        url.searchParams.set('organizationId', orgId)
      }

      const options: RequestInit = {
        method: selectedEndpoint.method,
        headers: {
          'Content-Type': 'application/json',
        }
      }

      if (authToken) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${authToken}`
        }
      }

      // Add organization ID header if provided
      const orgIdHeader = new URLSearchParams(queryParams).get('organizationId')
      if (orgIdHeader) {
        options.headers = {
          ...options.headers,
          'X-Organization-ID': orgIdHeader
        }
      }

      if (requestBody && (selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PATCH')) {
        options.body = requestBody
      }

      const res = await fetch(url.toString(), options)
      const data = await res.json()

      setResponse({
        status: res.status,
        statusText: res.statusText,
        data
      })
    } catch (error: any) {
      setResponse({
        error: error.message
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui', maxWidth: '1400px', margin: '0 auto' }}>
      <h1>Spinning App API Dashboard</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginTop: '2rem' }}>
        {/* API Endpoints List */}
        <div>
          <h2>API Endpoints</h2>
          <div style={{ 
            border: '1px solid #e0e0e0', 
            borderRadius: '8px', 
            overflow: 'hidden',
            maxHeight: '600px',
            overflowY: 'auto'
          }}>
            {apiEndpoints.map((endpoint, index) => (
              <div
                key={index}
                onClick={() => setSelectedEndpoint(endpoint)}
                style={{
                  padding: '1rem',
                  borderBottom: '1px solid #e0e0e0',
                  cursor: 'pointer',
                  backgroundColor: selectedEndpoint?.path === endpoint.path ? '#f0f0f0' : 'white',
                  transition: 'background-color 0.2s'
                }}
              >
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: 
                      endpoint.method === 'GET' ? '#e3f2fd' :
                      endpoint.method === 'POST' ? '#e8f5e9' :
                      endpoint.method === 'PATCH' ? '#fff3e0' :
                      endpoint.method === 'DELETE' ? '#ffebee' : '#f5f5f5',
                    color: 
                      endpoint.method === 'GET' ? '#1976d2' :
                      endpoint.method === 'POST' ? '#388e3c' :
                      endpoint.method === 'PATCH' ? '#f57c00' :
                      endpoint.method === 'DELETE' ? '#d32f2f' : '#666'
                  }}>
                    {endpoint.method}
                  </span>
                  <code style={{ fontSize: '0.9rem' }}>{endpoint.path}</code>
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', color: '#666' }}>
                  {endpoint.description}
                </p>
                {endpoint.requiresRole && (
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: '#f57c00',
                    marginTop: '0.25rem',
                    display: 'block'
                  }}>
                    Requires: {endpoint.requiresRole}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* API Tester */}
        <div>
          <h2>API Tester</h2>
          {selectedEndpoint ? (
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '1.5rem' 
            }}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Endpoint:
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold',
                    backgroundColor: '#e3f2fd',
                    color: '#1976d2'
                  }}>
                    {selectedEndpoint.method}
                  </span>
                  <code>{selectedEndpoint.path}</code>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Auth Token (Bearer):
                </label>
                <input
                  type="text"
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  placeholder="Enter Supabase JWT token"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Query Parameters (e.g., organizationId=xxx&status=ACTIVE):
                </label>
                <input
                  type="text"
                  value={queryParams}
                  onChange={(e) => setQueryParams(e.target.value)}
                  placeholder="organizationId=xxx&startDate=2024-01-01"
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontFamily: 'monospace',
                    fontSize: '0.85rem'
                  }}
                />
              </div>

              {(selectedEndpoint.method === 'POST' || selectedEndpoint.method === 'PATCH') && (
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                    Request Body (JSON):
                  </label>
                  <textarea
                    value={requestBody}
                    onChange={(e) => setRequestBody(e.target.value)}
                    placeholder='{"name": "Morning Spin", "duration": 45}'
                    rows={6}
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: '1px solid #ccc',
                      borderRadius: '4px',
                      fontFamily: 'monospace',
                      fontSize: '0.85rem',
                      resize: 'vertical'
                    }}
                  />
                </div>
              )}

              <button
                onClick={handleTestEndpoint}
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '0.75rem',
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
                {loading ? 'Testing...' : 'Test Endpoint'}
              </button>

              {response && (
                <div style={{ 
                  marginTop: '1.5rem', 
                  padding: '1rem', 
                  backgroundColor: '#f5f5f5',
                  borderRadius: '4px',
                  maxHeight: '400px',
                  overflow: 'auto'
                }}>
                  <h3 style={{ marginTop: 0 }}>Response:</h3>
                  {response.status && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <strong>Status:</strong> {response.status} {response.statusText}
                    </div>
                  )}
                  <pre style={{ 
                    margin: 0, 
                    fontSize: '0.85rem',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {JSON.stringify(response.data || response, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <div style={{ 
              border: '1px solid #e0e0e0', 
              borderRadius: '8px', 
              padding: '2rem',
              textAlign: 'center',
              color: '#999'
            }}>
              Select an endpoint from the list to test it
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: '2rem', padding: '1rem', backgroundColor: '#e3f2fd', borderRadius: '8px' }}>
        <h3>How to use:</h3>
        <ol style={{ margin: 0, paddingLeft: '1.5rem' }}>
          <li>Get your Supabase JWT token from your frontend app or Supabase dashboard</li>
          <li>Select an API endpoint from the list</li>
          <li>Enter your auth token in the "Auth Token" field</li>
          <li>Add query parameters if needed (e.g., organizationId, filters)</li>
          <li>For POST/PATCH requests, add the request body as JSON</li>
          <li>Click "Test Endpoint" to make the request</li>
        </ol>
      </div>
    </div>
  )
}





