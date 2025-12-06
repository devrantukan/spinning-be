'use client'

export default function InstructorsPage() {
  return (
    <div>
      <h1>Instructors</h1>
      <div style={{
        backgroundColor: 'white',
        padding: '2rem',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <p>Instructor management will be available here.</p>
        <p style={{ color: '#666', fontSize: '0.9rem' }}>
          Instructors are linked to users. Create an instructor by assigning a user the INSTRUCTOR role.
        </p>
      </div>
    </div>
  )
}


