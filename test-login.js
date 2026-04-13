const fetch = require('node-fetch');

async function testLogin() {
  try {
    // 1. Get CSRF token
    const csrfRes = await fetch('http://localhost:3000/api/auth/csrf');
    const csrfData = await csrfRes.json();
    const csrfToken = csrfData.csrfToken;
    console.log('CSRF Token:', csrfToken);

    // 2. Submit login
    const loginRes = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        email: 'admin@fourpoints.com',
        password: 'password123',
        csrfToken: csrfToken,
        json: 'true'
      })
    });

    console.log('Login Status:', loginRes.status);
    const text = await loginRes.text();
    console.log('Login Result text:', text);
  } catch (err) {
    console.error('Error logging in:', err);
  }
}

testLogin();
