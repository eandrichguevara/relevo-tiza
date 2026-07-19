const fetch = (await import('node-fetch')).default;

async function testAPI() {
  console.log('=== API ENDPOINTS ===');
  
  // Health check
  try {
    const res = await fetch('http://127.0.0.1:8000/api/health');
    console.log(`GET /api/health: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`GET /api/health: FAILED - ${e.message}`);
  }
  
  // Register
  try {
    const testEmail = `test_${Date.now()}@example.com`;
    const res = await fetch('http://127.0.0.1:8000/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: testEmail, 
        password: 'TestPass123!',
        name: 'Test User'
      })
    });
    console.log(`POST /api/auth/register: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`POST /api/auth/register: FAILED - ${e.message}`);
  }
  
  // Login
  try {
    const res = await fetch('http://127.0.0.1:8000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: 'test@example.com', 
        password: 'TestPass123!' 
      })
    });
    console.log(`POST /api/auth/login: ${res.status} ${res.statusText}`);
    const data = await res.json();
    console.log(`   Response: ${JSON.stringify(data)}`);
  } catch (e) {
    console.log(`POST /api/auth/login: FAILED - ${e.message}`);
  }
}

testAPI().catch(console.error);
