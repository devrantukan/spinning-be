'use client'

import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import { useTheme } from '@/contexts/ThemeContext'

export default function OrganizationsPage() {
  const { t } = useLanguage()
  const { theme } = useTheme()
  const [authToken, setAuthToken] = useState('')
  const [organizations, setOrganizations] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingOrg, setEditingOrg] = useState<any>(null)
  const [formData, setFormData] = useState({ 
    name: '', 
    slug: '', 
    description: '',
    contactUserId: '',
    address: '',
    phone: '',
    website: '',
    email: '',
    facebook: '',
    twitter: '',
    instagram: '',
    linkedin: ''
  })
  const [search, setSearch] = useState('')

  useEffect(() => {
    const savedToken = localStorage.getItem('admin_auth_token')
    if (savedToken) {
      setAuthToken(savedToken)
      fetchOrganizations(savedToken)
      fetchUsers(savedToken)
    }
  }, [])

  const fetchUsers = async (token?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    try {
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })
      if (res.ok) {
        const data = await res.json()
        setUsers(Array.isArray(data) ? data : [])
      }
    } catch (error) {
      console.error('Error fetching users:', error)
    }
  }

  const fetchOrganizations = async (token?: string, searchTerm?: string) => {
    const tokenToUse = token || authToken
    if (!tokenToUse) return

    setLoading(true)
    try {
      const url = new URL('/api/admin/organizations', window.location.origin)
      if (searchTerm) {
        url.searchParams.set('search', searchTerm)
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${tokenToUse}`
        }
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to fetch organizations')
      }

      const data = await res.json()
      setOrganizations(Array.isArray(data) ? data : [])
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authToken) {
      alert('Not authenticated')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create organization')
      }

      const newOrg = await res.json()
      setOrganizations([newOrg, ...organizations])
      setShowForm(false)
      setFormData({ 
        name: '', 
        slug: '', 
        description: '',
        contactUserId: '',
        address: '',
        phone: '',
        website: '',
        email: '',
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: ''
      })
      alert(t('organizations.created'))
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authToken || !editingOrg) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/organizations/${editingOrg.id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to update organization')
      }

      const updated = await res.json()
      setOrganizations(organizations.map(org => org.id === updated.id ? updated : org))
      setEditingOrg(null)
      setFormData({ 
        name: '', 
        slug: '', 
        description: '',
        contactUserId: '',
        address: '',
        phone: '',
        website: '',
        email: '',
        facebook: '',
        twitter: '',
        instagram: '',
        linkedin: ''
      })
      setShowForm(false)
      alert(t('organizations.updated'))
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm(t('organizations.deleteConfirm'))) {
      return
    }

    if (!authToken) return

    setLoading(true)
    try {
      const res = await fetch(`/api/admin/organizations/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to delete organization')
      }

      setOrganizations(organizations.filter(org => org.id !== id))
      alert(t('organizations.deleted'))
    } catch (error: any) {
      alert(`Error: ${error.message}`)
    } finally {
      setLoading(false)
    }
  }

  const startEdit = (org: any) => {
    setEditingOrg(org)
    setFormData({ 
      name: org.name || '', 
      slug: org.slug || '', 
      description: org.description || '',
      contactUserId: org.contactUserId || '',
      address: org.address || '',
      phone: org.phone || '',
      website: org.website || '',
      email: org.email || '',
      facebook: org.facebook || '',
      twitter: org.twitter || '',
      instagram: org.instagram || '',
      linkedin: org.linkedin || ''
    })
    setShowForm(true)
  }

  const cancelForm = () => {
    setShowForm(false)
    setEditingOrg(null)
    setFormData({ 
      name: '', 
      slug: '', 
      description: '',
      contactUserId: '',
      address: '',
      phone: '',
      website: '',
      email: '',
      facebook: '',
      twitter: '',
      instagram: '',
      linkedin: ''
    })
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1>{t('organizations.title')}</h1>
        <button
          onClick={() => {
            cancelForm()
            setShowForm(!showForm)
          }}
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
          {showForm ? t('common.cancel') : `+ ${t('organizations.newOrganization')}`}
        </button>
      </div>

      {showForm && (
        <div style={{
          backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
          color: theme === 'dark' ? '#ffffff' : '#1a1a1a',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}>
          <h2>{editingOrg ? t('organizations.editOrganization') : t('organizations.createOrganization')}</h2>
          {editingOrg && (
            <div style={{ 
              marginBottom: '1rem', 
              padding: '0.75rem', 
              backgroundColor: '#f5f5f5', 
              borderRadius: '4px',
              fontSize: '0.9rem'
            }}>
              <strong>{t('organizations.organizationId')}:</strong> <code style={{ 
                fontSize: '0.85rem', 
                backgroundColor: '#e0e0e0', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px',
                marginLeft: '0.5rem'
              }}>{editingOrg.id}</code>
            </div>
          )}
          <form onSubmit={editingOrg ? handleUpdate : handleCreate}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.name')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.slug')} *
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {t('organizations.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    resize: 'vertical',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.contactUser')}
                </label>
                <select
                  value={formData.contactUserId}
                  onChange={(e) => setFormData({ ...formData, contactUserId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                >
                  <option value="">{t('organizations.selectUser')}</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name || user.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.email')}
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.phone')}
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  {t('organizations.website')}
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://example.com"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
                />
              </div>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {t('organizations.address')}
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={2}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                    borderRadius: '4px',
                    resize: 'vertical',
                    backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                    color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                  }}
              />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                {t('organizations.socialMedia')}
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    {t('organizations.facebook')}
                  </label>
                  <input
                    type="url"
                    value={formData.facebook}
                    onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                    placeholder="https://facebook.com/..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    {t('organizations.twitter')}
                  </label>
                  <input
                    type="url"
                    value={formData.twitter}
                    onChange={(e) => setFormData({ ...formData, twitter: e.target.value })}
                    placeholder="https://twitter.com/..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    {t('organizations.instagram')}
                  </label>
                  <input
                    type="url"
                    value={formData.instagram}
                    onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                    placeholder="https://instagram.com/..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                    {t('organizations.linkedin')}
                  </label>
                  <input
                    type="url"
                    value={formData.linkedin}
                    onChange={(e) => setFormData({ ...formData, linkedin: e.target.value })}
                    placeholder="https://linkedin.com/..."
                    style={{
                      width: '100%',
                      padding: '0.5rem',
                      border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
                      borderRadius: '4px',
                      fontSize: '0.9rem',
                      backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                    }}
                  />
                </div>
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
              {loading ? t('common.loading') : editingOrg ? t('organizations.updateOrganization') : t('organizations.createOrganization')}
            </button>
          </form>
        </div>
      )}

      <div style={{ marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder={t('organizations.searchPlaceholder')}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            fetchOrganizations(authToken, e.target.value)
          }}
          style={{
            width: '100%',
            maxWidth: '400px',
            padding: '0.75rem',
            border: `1px solid ${theme === 'dark' ? '#444' : '#ccc'}`,
            borderRadius: '4px',
            fontSize: '1rem',
            backgroundColor: theme === 'dark' ? '#2d2d2d' : 'white',
            color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
          }}
        />
      </div>

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
          <strong>{t('organizations.allOrganizations')} ({organizations.length})</strong>
          <button
            onClick={() => fetchOrganizations()}
            disabled={loading}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#f5f5f5',
              border: '1px solid #ccc',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? t('common.loading') : t('common.refresh')}
          </button>
        </div>
        {loading && organizations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme === 'dark' ? '#ffffff' : '#1a1a1a' }}>{t('common.loading')}</div>
        ) : organizations.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: theme === 'dark' ? '#999' : '#999' }}>{t('organizations.noOrganizations')}</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: theme === 'dark' ? '#3a3a3a' : '#f5f5f5' }}>
                <th style={{ 
                  padding: '1rem', 
                  textAlign: 'left', 
                  borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}`,
                  color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                }}>ID</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('organizations.name')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('organizations.slug')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('organizations.contactUser')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('organizations.phone')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('admin.users')}</th>
                <th style={{ padding: '1rem', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.id} style={{ 
                  borderBottom: `1px solid ${theme === 'dark' ? '#444' : '#e0e0e0'}`,
                  color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                }}>
                  <td style={{ padding: '1rem' }}>
                    <code style={{ 
                      fontSize: '0.75rem', 
                      backgroundColor: theme === 'dark' ? '#3a3a3a' : '#f5f5f5', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      color: theme === 'dark' ? '#b0b0b0' : '#666',
                      fontFamily: 'monospace'
                    }}>
                      {org.id.substring(0, 8)}...
                    </code>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <strong>{org.name}</strong>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    <code style={{ 
                      fontSize: '0.85rem', 
                      backgroundColor: theme === 'dark' ? '#3a3a3a' : '#f5f5f5', 
                      padding: '0.25rem 0.5rem', 
                      borderRadius: '4px',
                      color: theme === 'dark' ? '#ffffff' : '#1a1a1a'
                    }}>
                      {org.slug}
                    </code>
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {org.contactUser ? (
                      <div>
                        <div style={{ fontWeight: '500' }}>{org.contactUser.name || 'N/A'}</div>
                        <div style={{ fontSize: '0.85rem', color: '#666' }}>{org.contactUser.email}</div>
                      </div>
                    ) : (
                      <span style={{ color: '#999' }}>No contact</span>
                    )}
                  </td>
                  <td style={{ padding: '1rem' }}>
                    {org.phone || <span style={{ color: theme === 'dark' ? '#666' : '#999' }}>—</span>}
                  </td>
                  <td style={{ padding: '1rem' }}>{org._count?.users || 0}</td>
                  <td style={{ padding: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => startEdit(org)}
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
                        {t('common.edit')}
                      </button>
                      <button
                        onClick={() => handleDelete(org.id)}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#d32f2f',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          fontSize: '0.85rem',
                          cursor: 'pointer'
                        }}
                      >
                        {t('common.delete')}
                      </button>
                    </div>
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
