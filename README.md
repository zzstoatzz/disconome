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
- ✅ Nodes repel from center creating a "donut" effect around the search box
- ✅ Basic color scheme implemented with HSL rotation
- ✅ Smooth animations and transitions

Still needed:
- [ ] Entity classification system integration
  - Classification API is set up but not yet connected to visualization
  - Need to verify classification data flow from API to frontend
- [ ] Connection visualization between related entities
  - Labels should appear on edges between nodes sharing categories
  - Edge thickness could represent strength of relationship
- [ ] Performance optimization for larger graphs
  - Consider using WebGL or Canvas for better performance
  - Implement node culling for off-screen elements

Next steps:
1. Debug classification data flow from API to frontend
2. Implement edge rendering between related nodes
3. Add interactive features (hover states, zoom, pan)
4. Optimize performance for larger datasets
