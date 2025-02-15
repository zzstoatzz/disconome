# discono.me

render a timeline for a given thing on wikipedia

## features
- 📊 Timeline generation for Wikipedia articles
- 📈 Most viewed entities leaderboard


## development

requires:
- [Bun](https://bun.sh) installed on your machine
- A Vercel account (for deployment and Blob storage)
- OpenAI API key for timeline generation

the following environment variables in a `.env.local` file:
```bash
OPENAI_API_KEY=your_openai_api_key
BLOB_READ_WRITE_TOKEN=your_vercel_blob_token
```

1. clone the repository:
```bash
gh repo clone zzstoatzz/disconome
cd disconome
```

2. Install dependencies:
```bash
bun install
```

3. Start the development server:
```bash
bun dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser


# 🚧 under construction 🚧

## routes
- `/api/lineage` - Generates timeline data for a given topic
- `/api/track-visit` - Tracks page views and maintains leaderboard
- `/api/blob` - Handles Vercel Blob storage operations

## stack
- [Next.js 14](https://nextjs.org/) with App Router
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Vercel Blob Storage](https://vercel.com/docs/storage/vercel-blob) for caching
- [OpenAI API](https://openai.com/api/) via [Vercel AI SDK](https://sdk.vercel.ai/)

## development log

### entity graph visualization
Current state:
- ✅ Basic force-directed graph with nodes representing viewed entities
- ✅ Node size scales with view count
- ✅ Nodes evenly distributed in circular layout
- ✅ Subtle connection lines with opacity based on combined view count
- ✅ Efficient classification system with blob storage versioning (v3)
- ✅ Immediate node rendering with async classification loading
- ✅ Top 5 most effective categories shown in legend

Still needed:
- [ ] Performance optimization
  - Consider WebGL renderer for larger graphs
  - Implement node culling for off-screen elements
  - Batch classification requests more efficiently
- [ ] Connection visualization refinement
  - Add subtle "electricity" effect on connections
  - Improve hover state transitions
  - Consider curved edges for better visual flow
- [ ] Category system improvements
  - Implement smarter category rotation based on connection strength
  - Add visual feedback during category cleanup
  - Consider hierarchical categories for better organization

Next steps:
1. Implement WebGL renderer for better performance
2. Add subtle animation effects to connections
3. Improve category system with hierarchical organization
4. Add visual feedback during cleanup operations
5. Optimize classification batching and caching

Technical debt to address:
- Clean up old blob storage versions
- Consolidate shared types and utilities
- Add error boundaries for graph visualization
- Improve test coverage for classification system
