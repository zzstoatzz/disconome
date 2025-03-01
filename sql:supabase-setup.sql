-- Create entities table for storing all entity data
CREATE TABLE IF NOT EXISTS entities (
  id SERIAL PRIMARY KEY,
  path TEXT UNIQUE NOT NULL,
  data JSONB NOT NULL,
  version TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on path for faster lookups
CREATE INDEX IF NOT EXISTS entities_path_idx ON entities (path);

-- Create index on path prefix for faster list operations
CREATE INDEX IF NOT EXISTS entities_path_prefix_idx ON entities USING btree (path text_pattern_ops);

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update the updated_at timestamp
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON entities
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Add RLS (Row Level Security) policies
ALTER TABLE entities ENABLE ROW LEVEL SECURITY;

-- IMPORTANT: First disable RLS for the service role (your application)
CREATE POLICY "Service role bypass RLS"
ON entities
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Create policy to allow all operations for authenticated users
CREATE POLICY "Allow all operations for authenticated users"
ON entities
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Create policy to allow read-only access for anonymous users
CREATE POLICY "Allow read-only access for anonymous users"
ON entities
FOR SELECT
TO anon
USING (true);

-- IMPORTANT: If you're still having issues, you can temporarily disable RLS completely
-- Uncomment the line below to disable RLS (for development only)
-- ALTER TABLE entities DISABLE ROW LEVEL SECURITY; 