# Disconome

A web application for managing entity classifications and storage.

## Setup

### Prerequisites

- Node.js (v16+)
- npm or yarn
- Supabase account

### Supabase Setup

1. Create a new Supabase project at [https://app.supabase.com](https://app.supabase.com)
2. Once your project is created, go to the SQL Editor
3. Copy the contents of `supabase-setup.sql` from this repository
4. Run the SQL script to create the necessary tables and policies
5. Go to Project Settings > API to get your project URL and anon/public key
6. Copy these values to your `.env.local` file:

```
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
```

### Fixing Row-Level Security (RLS) Issues

If you encounter errors like `new row violates row-level security policy for table "entities"`, you need to:

1. Go to the Supabase dashboard > SQL Editor
2. Run one of these SQL commands:

   **Option 1: Create a policy for the service role (recommended)**
   ```sql
   CREATE POLICY "Service role bypass RLS"
   ON entities
   FOR ALL
   TO service_role
   USING (true)
   WITH CHECK (true);
   ```

   **Option 2: Temporarily disable RLS completely (development only)**
   ```sql
   ALTER TABLE entities DISABLE ROW LEVEL SECURITY;
   ```

3. After fixing the RLS policy, you can remove any default data by calling:
   ```
   POST /api/debug
   {"action": "removeDefaultData"}
   ```

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
# or
yarn install
```

3. Start the development server:

```bash
npm run dev
# or
yarn dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### `/api/track-visit`

- `GET`: Get all entities
- `POST`: Track a visit to an entity

### `/api/classify`

- `POST`: Classify an entity based on its extract

### `/api/debug`

- `GET`: Get debug information
- `POST`: Perform debug actions

## Debug Actions

- `removeEntity`: Remove an entity from the graph
- `examineClassification`: Examine a classification
- `listAllClassifications`: List all classifications
- `resetReclassificationFlags`: Reset reclassification flags
- `forceCreateClassifications`: Force create classifications for all entities
- `getGraphState`: Get the current state of the graph
- `listAllEntities`: List all entities in the database
- `clearCache`: Clear the cache
- `checkConstants`: Check constants

## Migration from Vercel Blob

This project was migrated from Vercel Blob to Supabase for more reliable storage with true deletion capabilities. If you're migrating existing data, you'll need to:

1. Export your data from Vercel Blob
2. Transform it to match the Supabase schema
3. Import it into your Supabase database

## License

MIT
