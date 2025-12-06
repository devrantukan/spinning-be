# Spinning App Backend

A Next.js backend application for a multi-tenant spinning studio management system, built with Supabase for authentication and database, and Prisma as the ORM.

## Features

- 🔐 **Supabase Authentication** - Secure user authentication handled by Supabase
- 🏢 **Multi-Tenant Architecture** - Each organization has isolated data
- 📊 **Prisma ORM** - Type-safe database access
- 🚀 **Next.js API Routes** - RESTful API endpoints
- 👥 **Role-Based Access Control** - Admin, Instructor, and Member roles

## Tech Stack

- **Framework**: Next.js 14
- **Database**: PostgreSQL (via Supabase)
- **ORM**: Prisma
- **Authentication**: Supabase Auth
- **Language**: TypeScript

## Prisma Models

The application includes the following multi-tenant models:

- **Organization** - Root tenant model
- **User** - Users linked to Supabase auth
- **Member** - Class participants
- **Instructor** - Class instructors
- **Class** - Class types (e.g., "Morning Spin", "Evening Power")
- **Session** - Specific class instances at date/time
- **Booking** - Member bookings for sessions

All models are scoped by `organizationId` to ensure data isolation.

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Supabase project created
- PostgreSQL database (via Supabase)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp env.template .env
```

Fill in your Supabase credentials (found in your Supabase Dashboard → Settings):

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
  - Location: Settings → API → Project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
  - Location: Settings → API → Project API keys → `anon` `public` key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)
  - Location: Settings → API → Project API keys → `service_role` `secret` key
  - ⚠️ Keep this secret! Never expose it in client-side code.
- `DATABASE_URL` - Your Supabase PostgreSQL connection string
  - Location: Settings → Database → Connection string
  - Select "Connection pooling" (Session mode) or "Direct connection"
  - Copy the connection string and replace `[YOUR-PASSWORD]` with your database password
  - Format: `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`

3. Set up the database schema:

```bash
# Generate Prisma Client
npm run db:generate

# Push schema to database (for development)
npm run db:push

# Or create a migration (for production)
npm run db:migrate
```

4. Start the development server:

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api`

## API Endpoints

### Authentication

All API requests require authentication via Bearer token in the Authorization header:

```
Authorization: Bearer <supabase_access_token>
```

### Organization Context

The organization ID can be provided via:

- Query parameter: `?organizationId=<id>`
- Header: `X-Organization-ID: <id>`
- Default: User's default organization (from their user record)

### Available Endpoints

#### Organizations

- `GET /api/organizations` - Get current user's organization

#### Classes

- `GET /api/classes` - Get all classes for organization
- `POST /api/classes` - Create a new class (Admin/Instructor only)

#### Sessions

- `GET /api/sessions` - Get all sessions (with optional filters: startDate, endDate, classId, status)
- `POST /api/sessions` - Create a new session (Admin/Instructor only)
- `GET /api/sessions/[id]` - Get a specific session
- `PATCH /api/sessions/[id]` - Update a session (Admin/Instructor only)
- `DELETE /api/sessions/[id]` - Delete a session (Admin only)

#### Bookings

- `GET /api/bookings` - Get all bookings (with optional filters: sessionId, memberId, status)
- `POST /api/bookings` - Create a new booking
- `GET /api/bookings/[id]` - Get a specific booking
- `PATCH /api/bookings/[id]` - Update a booking (cancel, check-in, etc.)
- `DELETE /api/bookings/[id]` - Cancel/delete a booking

## User Roles

- **ADMIN** - Full access to all operations
- **INSTRUCTOR** - Can create/update classes and sessions
- **MEMBER** - Can view and book sessions

## Multi-Tenant Architecture

The application enforces data isolation at multiple levels:

1. **Database Level**: All models include `organizationId` with foreign key constraints
2. **API Level**: Middleware automatically filters queries by organization
3. **Auth Level**: Users are validated to ensure they belong to the requested organization

## Development

### Database Management

```bash
# Generate Prisma Client after schema changes
npm run db:generate

# Push schema changes (development)
npm run db:push

# Create and apply migration (production)
npm run db:migrate

# Open Prisma Studio (database GUI)
npm run db:studio
```

### Project Structure

```
├── app/
│   └── api/              # API routes
│       ├── organizations/
│       ├── classes/
│       ├── sessions/
│       └── bookings/
├── lib/
│   ├── supabase.ts      # Supabase client configuration
│   ├── prisma.ts        # Prisma client
│   ├── auth.ts          # Authentication utilities
│   └── middleware.ts    # Organization context middleware
├── prisma/
│   └── schema.prisma    # Database schema
└── package.json
```

## Security Considerations

1. **Authentication**: All endpoints require valid Supabase JWT tokens
2. **Authorization**: Role-based access control enforced at API level
3. **Data Isolation**: Organization-scoped queries prevent cross-tenant data access
4. **Input Validation**: Add validation for all user inputs in production

## Making a User Admin

To make a user an admin, you can use the provided script:

```bash
npm run make-admin <email>
```

Example:

```bash
npm run make-admin user@example.com
```

Or run directly:

```bash
node scripts/make-admin.js user@example.com
```

**Note**: The user must have logged in at least once (so they exist in the database) before you can make them an admin.

Alternatively, you can update the user directly in the database using Prisma Studio:

```bash
npm run db:studio
```

Then find your user and change the `role` field to `ADMIN`.

## Next Steps

1. Add input validation (e.g., using Zod)
2. Add rate limiting
3. Add comprehensive error handling
4. Add API documentation (e.g., Swagger/OpenAPI)
5. Add unit and integration tests
6. Set up CI/CD pipeline

## License

MIT
