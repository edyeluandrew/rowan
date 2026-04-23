import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();
const { Client } = pg;

const client = new Client({ connectionString: process.env.DATABASE_URL });

await client.connect();

console.log('\n📋 Creating trader_notifications table if not exists...\n');

const result = await client.query(`
  CREATE TABLE IF NOT EXISTS trader_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trader_id UUID NOT NULL REFERENCES traders(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_trader_notifications_trader_id 
    ON trader_notifications(trader_id, created_at DESC);
  
  CREATE INDEX IF NOT EXISTS idx_trader_notifications_unread 
    ON trader_notifications(trader_id, is_read) 
    WHERE is_read = FALSE;
`);

console.log('✅ trader_notifications table created successfully!');

await client.end();
