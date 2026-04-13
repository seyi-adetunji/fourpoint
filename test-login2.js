const fetch = require('node-fetch');

async function testNextAuth() {
  try {
    const resCsrf = await fetch('http://localhost:3000/api/auth/csrf');
    const csrfData = await resCsrf.json();
    const csrfToken = csrfData.csrfToken;
    const cookies = resCsrf.headers.raw()['set-cookie'] || [];
    const formattedCookies = cookies.map(c => c.split(';')[0]).join('; ');

    const params = new URLSearchParams();
    params.append('email', 'admin@fourpoints.com');
    params.append('password', 'password123');
    params.append('csrfToken', csrfToken);
    params.append('json', 'true'); // Important to get back JSON for CredentialsProvider

    const resLogin = await fetch('http://localhost:3000/api/auth/callback/credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cookie': formattedCookies
      },
      body: params.toString()
    });

    console.log('Status:', resLogin.status);
    const json = await resLogin.json();
    console.log('Response JSON:', json);
  } catch (err) {
    console.error(err);
  }
}

testNextAuth();
