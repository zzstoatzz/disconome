import { put, list } from "@vercel/blob";

// Simple in-memory cache to store blob data for a short time
type CacheEntry = { data: any; timestamp: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Namespace prefix for all blob keys
const NAMESPACE = process.env.BLOB_NAMESPACE || "dev";

// Utility function to build the full namespaced key
function withNamespace(path: string): string {
    return NAMESPACE.replace(/\/$/, "") + "/" + path.replace(/^\/*/, "");
}

export interface StorageInterface {
    get(path: string): Promise<any | null>;
    put(path: string, data: any): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    delete(path: string): Promise<void>;
}

class BlobStorage implements StorageInterface {
    async get(path: string): Promise<any | null> {
        const key = withNamespace(path);

        // Check cache first
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Cache hit for ${key}`);
            return entry.data;
        }

        console.log(`📥 Fetching blob: ${key}`);
        const { blobs } = await list({ prefix: key });
        if (blobs.length === 0) {
            console.log(`❌ Blob not found: ${key}`);
            return null;
        }

        try {
            const response = await fetch(blobs[0].url);
            const data = await response.json();

            // Update cache
            cache.set(key, { data, timestamp: Date.now() });
            console.log(`💾 Cached blob: ${key}`);

            return data;
        } catch (error) {
            console.error(`❌ Error fetching blob: ${key}`, error);
            return null;
        }
    }

    async put(path: string, data: any): Promise<void> {
        const key = withNamespace(path);
        console.log(`📤 Putting blob: ${key}`);

        try {
            await put(key, JSON.stringify(data), {
                access: 'public',
                addRandomSuffix: false
            });

            // Immediately cache the new data
            cache.set(key, { data, timestamp: Date.now() });
            console.log(`💾 Cached new blob: ${key}`);
        } catch (error) {
            console.error(`❌ Error putting blob: ${key}`, error);
            throw error;
        }
    }

    async list(prefix: string = ""): Promise<string[]> {
        const key = withNamespace(prefix);
        console.log(`📋 Listing blobs with prefix: ${key}`);

        try {
            const { blobs } = await list({ prefix: key });
            // Strip namespace from results
            return blobs.map(blob => blob.pathname.replace(new RegExp(`^${NAMESPACE}/`), ""));
        } catch (error) {
            console.error(`❌ Error listing blobs: ${key}`, error);
            return [];
        }
    }

    async delete(path: string): Promise<void> {
        const key = withNamespace(path);
        console.log(`🗑️ Deleting blob: ${key}`);

        // Note: Vercel Blob doesn't have a direct delete method
        // We might want to implement this differently
        console.warn('Delete not implemented for BlobStorage');

        // Still remove from cache
        cache.delete(key);
    }
}

// Export a singleton instance
export const storage = new BlobStorage();

// Export types for use elsewhere
export type { StorageInterface, CacheEntry }; 