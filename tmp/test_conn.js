const { Client } = require('pg');

const client = new Client({
  connectionString: "postgresql://neondb_owner:npg_bACdu2wS0UTO@ep-lucky-dust-am10acgf-pooler.c-5.us-east-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require",
});

async function run() {
  try {
    console.log('Connecting to Neon...');
    await client.connect();
    console.log('Connected successfully!');
    const res = await client.query('SELECT NOW()');
    console.log('Current time from DB:', res.rows[0]);
  } catch (err) {
    console.error('Connection failed:', err.message);
  } finally {
    await client.end();
  }
}

run();
