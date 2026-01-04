
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();

// Ensure environment variables are loaded (ts-node usually loads .env if configured, otherwise rely on shell env)
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  console.error('Make sure you are running this script with environment variables loaded.');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function ensureSupabaseUser() {
  const email = process.argv[2];

  if (!email) {
    console.error('Usage: npx ts-node scripts/ensure-supabase-user.ts <email>');
    process.exit(1);
  }

  try {
    console.log(`Checking Supabase Auth for ${email}...`);
    
    // 1. Check if user exists in Supabase
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) {
        throw new Error(`Failed to list users: ${listError.message}`);
    }

    // In a real app with many users, looking up by email via listUsers is inefficient/limited,
    // but for admin scripts it's often the only way or we use getUserById if we knew it.
    // 'listUsers' is paginated, so strictly speaking this might miss users if there are many.
    // Better to attempt creation and catch "already exists" or use a dedicated method if available.
    // However, Supabase verify/lookup by email is not directly exposed in admin API simply.
    // Let's iterate or assume listUsers returns enough or try creating first?
    // Actually, create user will fail if exists.

    // Let's try to CREATE first. If it fails with "User already registered", then we search for them.
    let supabaseUserId;
    
    // Attempt to create user
    console.log('Attempting to create user in Supabase Auth...');
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true, // Auto confirm so they can sign in / reset password
      // password: 'tempPassword123!', // Optional: set a temp password
    });

    if (createError) {
      if (createError.message.includes('already registered') || createError.status === 422) {
        console.log('User already exists in Supabase. Finding their ID...');
        // Find them
        // Note: listUsers isn't filterable by email in all versions, but let's try
        // or iterate. With thousands of users this script is bad.
        // Assuming moderate user count or we can use another trick.
        
        // Trick: generating a link or something might reveal it? No.
        // Let's fetch the list (default 50).
        // If we can't find it easily, we might be stuck.
        // BUT, supabase.auth.admin.listUsers() doesn't accept email filter.
        // HOWEVER, we can't easily get ID by email in Admin API V2 without potentially iterating.
        
        // Wait, if I created the user previously via the app, they exist.
        // If I created them via my script with FAKE ID, they DON'T exist in Supabase (unless user also signed up).
        
        // If the user SAYS "Reset password says user not found", it implies:
        // 1. Prisma user exists (checked)
        // 2. Supabase user with that ID (fake) does NOT exist.
        
        // But does a Supabase user with that EMAIL exist?
        // If they just asked me to create the user, likely NOT.
        
        // So `createUser` should SUCCEED.
        
        // If it fails, I'll iterate listUsers to find the ID.
        // (Assuming dev/test env with manageable user count).
        const { data: { users: allUsers } } = await supabase.auth.admin.listUsers({ per_page: 1000 });
        const existingUser = allUsers.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        
        if (existingUser) {
          supabaseUserId = existingUser.id;
          console.log(`Found existing Supabase user ID: ${supabaseUserId}`);
        } else {
           throw new Error('User reported as existing, but could not be found in first 1000 users.');
        }

      } else {
        throw createError;
      }
    } else {
      supabaseUserId = createData.user.id;
      console.log(`✅ Created new Supabase user. ID: ${supabaseUserId}`);
    }

    // 2. Update Prisma User
    console.log(`Updating Prisma user with Supabase ID: ${supabaseUserId}...`);
    
    // First, find the user to ensure they exist in DB
    const dbUser = await prisma.user.findFirst({
        where: { email } // Use findFirst because email might not be unique in schema (though usually is for auth)
    });

    if (!dbUser) {
        // Create DB user if missing? (Should allow this script to do both)
        console.log('User not found in Postgres. Creating...');
        // Need org ID. Hardcode Spin8 for now or fail?
        // Let's assume user exists because of previous task.
        throw new Error(`User with email ${email} not found in Postgres database. Please run make-tenant-admin.ts first.`);
    }

    const updated = await prisma.user.updateMany({
        where: { email }, // Update all records with this email? Schema says supabaseUserId is unique.
        // If multiple users share email, this will fail on unique constraint if we update all to same ID.
        // But usually Schema User.email is unique or SupabaseUserId is unique.
        // User model: email String (not unique marked in lines 68-96, but unique typically).
        // Line 71: email String. Not unique?
        // Line 70: supabaseUserId String @unique.
        // Line 94: @@index([email]).
        
        // If email is not unique, we have a problem mapping 1 Supabase User to N Prisma Users.
        // But let's assume 1-to-1 for now or Update the one we found.
        // We'll update by ID.
    });

    // Update by ID to be safe
     const result = await prisma.user.update({
        where: { id: dbUser.id },
        data: { supabaseUserId }
    });


    console.log(`✅ Successfully linked Postgres user ${dbUser.id} to Supabase user ${supabaseUserId}`);
    console.log(`You can now request a password reset for this user.`);

  } catch (error) {
    console.error('Error:', (error as any).message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

ensureSupabaseUser();
