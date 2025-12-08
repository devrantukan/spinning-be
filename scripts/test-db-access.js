const { PrismaClient } = require('@prisma/client');

async function testDatabaseAccess() {
  console.log('Testing database connection...\n');
  
  // Check if DATABASE_URL is set
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    console.log('Please check your .env file');
    process.exit(1);
  }

  // Extract connection info (without password)
  const dbUrl = process.env.DATABASE_URL;
  const urlMatch = dbUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)/);
  if (urlMatch) {
    const [, user, , host, port, database] = urlMatch;
    console.log(`Connection details:`);
    console.log(`  Host: ${host}`);
    console.log(`  Port: ${port}`);
    console.log(`  Database: ${database}`);
    console.log(`  User: ${user}`);
    console.log(`  Using pooler: ${port === '6543' ? 'Yes (recommended)' : 'No (direct connection)'}\n`);
  }

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    console.log('Attempting to connect...');
    
    // Test 1: Simple query
    console.log('Test 1: Testing basic connection...');
    const result = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic connection successful');
    
    // Test 2: Check database version
    console.log('\nTest 2: Checking database version...');
    const version = await prisma.$queryRaw`SELECT version()`;
    console.log('✅ Database version:', version[0].version);
    
    // Test 3: Count users
    console.log('\nTest 3: Counting users...');
    const userCount = await prisma.user.count();
    console.log(`✅ Found ${userCount} users in database`);
    
    // Test 4: Count organizations
    console.log('\nTest 4: Counting organizations...');
    const orgCount = await prisma.organization.count();
    console.log(`✅ Found ${orgCount} organizations in database`);
    
    // Test 5: Test a findUnique query (the one that's failing)
    console.log('\nTest 5: Testing findUnique query (simulating auth flow)...');
    const firstUser = await prisma.user.findFirst({
      select: { supabaseUserId: true }
    });
    
    if (firstUser) {
      const testUser = await prisma.user.findUnique({
        where: { supabaseUserId: firstUser.supabaseUserId },
        include: { organization: true },
      });
      console.log(`✅ findUnique query successful (found user: ${testUser?.email || 'N/A'})`);
    } else {
      console.log('⚠️  No users found to test findUnique query');
    }
    
    console.log('\n✅ All database tests passed!');
    
  } catch (error) {
    console.error('\n❌ Database connection failed:');
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    
    if (error.code === 'P1001') {
      console.error('\n💡 This is a connection timeout error.');
      console.error('Possible solutions:');
      console.error('  1. Check if your database is running');
      console.error('  2. Verify your DATABASE_URL is correct');
      console.error('  3. For Supabase, try using the pooler connection (port 6543)');
      console.error('  4. Check your network connection');
    } else if (error.code === 'P1000') {
      console.error('\n💡 This is an authentication error.');
      console.error('Possible solutions:');
      console.error('  1. Check your database password in DATABASE_URL');
      console.error('  2. Verify your database user has proper permissions');
    } else if (error.code === undefined && error.message.includes("Can't reach database server")) {
      console.error('\n💡 This is a PrismaClientInitializationError.');
      console.error('Possible solutions:');
      console.error('  1. The database server might be unreachable');
      console.error('  2. Check your DATABASE_URL host and port');
      console.error('  3. For Supabase, ensure you\'re using the correct connection string');
      console.error('  4. Try using the pooler connection (port 6543) instead of direct (5432)');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('\nDisconnected from database');
  }
}

testDatabaseAccess().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});


