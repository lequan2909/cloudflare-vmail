-- v1.2.0 Database Migration
-- Add read status and priority fields

-- Add new fields to emails table
ALTER TABLE emails ADD COLUMN is_read INTEGER DEFAULT 0;
ALTER TABLE emails ADD COLUMN read_at INTEGER;
ALTER TABLE emails ADD COLUMN priority TEXT DEFAULT 'normal';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_to ON emails(message_to);
CREATE INDEX IF NOT EXISTS idx_created_at_desc ON emails(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_is_read ON emails(is_read);
CREATE INDEX IF NOT EXISTS idx_composite_inbox ON emails(message_to, created_at DESC, is_read);
