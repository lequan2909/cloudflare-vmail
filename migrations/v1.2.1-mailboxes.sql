-- v1.2.1 Database Migration
-- Create mailboxes table for claimed mailboxes

CREATE TABLE IF NOT EXISTS mailboxes (
  address TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_login_at INTEGER
);

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_mailboxes_expires ON mailboxes(expires_at);
