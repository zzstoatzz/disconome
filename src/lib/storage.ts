import { put, list } from "@vercel/blob";
import { JsonValue, CacheEntry } from "@/lib/types";

// Simple in-memory cache to store blob data for a short time
const cache = new Map<string, CacheEntry<JsonValue>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Namespace prefix for all blob keys
const NAMESPACE = process.env.NODE_ENV === 'production'
    ? 'dev'
    : (process.env.BLOB_NAMESPACE || "dev");

// Check if Vercel Blob is properly configured
const BLOB_READ_WRITE_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const isBlobConfigured = !!BLOB_READ_WRITE_TOKEN;

console.log(`🔧 Storage - Vercel Blob configuration:`, {
    namespace: NAMESPACE,
    isConfigured: isBlobConfigured,
    hasToken: !!BLOB_READ_WRITE_TOKEN,
});

if (!isBlobConfigured) {
    console.warn(`⚠️ Storage - WARNING: Vercel Blob is not properly configured. BLOB_READ_WRITE_TOKEN is missing.`);
}

// Utility function to build the full namespaced key
function withNamespace(path: string): string {
    return NAMESPACE.replace(/\/$/, "") + "/" + path.replace(/^\/*/, "");
}

export interface StorageInterface {
    get<T extends JsonValue>(path: string): Promise<T | null>;
    getWithVersion<T extends JsonValue>(path: string): Promise<{ data: T | null; version: string }>;
    put<T extends JsonValue>(path: string, data: T): Promise<void>;
    putWithVersion<T extends JsonValue>(path: string, data: T, expectedVersion: string): Promise<boolean>;
    list(prefix?: string): Promise<string[]>;
    delete(path: string): Promise<void>;
}

class BlobStorage implements StorageInterface {
    async get<T extends JsonValue>(path: string): Promise<T | null> {
        const key = withNamespace(path);
        console.log(`📥 Storage - Fetching blob: ${key}`);

        // Check cache first
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Storage - Cache hit for ${key}`);
            return entry.data as T;
        }

        try {
            console.log(`📥 Storage - Listing blobs with prefix: ${key}`);
            const { blobs } = await list({ prefix: key });
            console.log(`📥 Storage - Found ${blobs.length} blobs matching prefix: ${key}`);

            if (blobs.length === 0) {
                console.log(`❌ Storage - Blob not found: ${key}`);
                return null;
            }

            // Sort blobs by uploadedAt to get the latest version
            const latestBlob = blobs
                .sort((a, b) => (b.uploadedAt?.getTime() || 0) - (a.uploadedAt?.getTime() || 0))[0];

            console.log(`📥 Storage - Using latest blob: ${latestBlob.pathname} (uploaded: ${latestBlob.uploadedAt})`);
            console.log(`📥 Storage - Fetching content from URL: ${latestBlob.url}`);

            const response = await fetch(latestBlob.url);
            if (!response.ok) {
                console.error(`❌ Storage - HTTP error fetching blob: ${key}, status: ${response.status}`);
                return null;
            }

            const data = await response.json();
            console.log(`📥 Storage - Successfully fetched blob: ${key}`);

            // Check if this is a tombstone (deleted) object
            if (data && typeof data === 'object' && data.__deleted === true) {
                console.log(`🗑️ Storage - Blob marked as deleted: ${key}`);
                return null;
            }

            // Update cache
            cache.set(key, { data, timestamp: Date.now() });
            console.log(`💾 Storage - Cached blob: ${key}`);

            return data as T;
        } catch (error) {
            console.error(`❌ Storage - Error fetching blob: ${key}`, error);
            return null;
        }
    }

    async getWithVersion<T extends JsonValue>(path: string): Promise<{ data: T | null; version: string }> {
        const key = withNamespace(path);

        // Check cache first
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Storage - Cache hit for ${key}`);
            return { data: entry.data as T, version: entry.version || "0" };
        }

        console.log(`📥 Storage - Fetching blob: ${key}`);
        const { blobs } = await list({ prefix: key });
        if (blobs.length === 0) {
            console.log(`❌ Storage - Blob not found: ${key}`);
            return { data: null, version: "0" };
        }

        try {
            const response = await fetch(blobs[0].url);
            const data = await response.json();
            const version = blobs[0].uploadedAt?.toISOString() || "0";

            // Check if this is a tombstone (deleted) object
            if (data && typeof data === 'object' && data.__deleted === true) {
                console.log(`🗑️ Storage - Blob marked as deleted: ${key}`);
                return { data: null, version };
            }

            // Update cache with version
            cache.set(key, { data, timestamp: Date.now(), version });
            console.log(`💾 Storage - Cached blob: ${key} with version ${version}`);

            return { data: data as T, version };
        } catch (error) {
            console.error(`❌ Storage - Error fetching blob: ${key}`, error);
            return { data: null, version: "0" };
        }
    }

    async put<T extends JsonValue>(path: string, data: T): Promise<void> {
        const key = withNamespace(path);
        console.log(`📤 Storage - Putting blob: ${key}`);

        try {
            // Get existing data first
            const existingData = await this.get<T>(path);

            // Merge data if it's an object, otherwise use new data
            const mergedData = (existingData && typeof existingData === 'object' && typeof data === 'object')
                ? { ...existingData, ...data }
                : data;

            await put(key, JSON.stringify(mergedData), {
                access: 'public',
                addRandomSuffix: false,
                cacheControlMaxAge: 0, // Disable caching
                contentType: 'application/json'
            });
            console.log(`✅ Storage - Successfully put blob: ${key}`);

            // Update cache
            cache.set(key, { data: mergedData, timestamp: Date.now() });
        } catch (error) {
            console.error(`❌ Storage - Error putting blob: ${key}`, error);
            throw error;
        }
    }

    async putWithVersion<T extends JsonValue>(path: string, data: T, expectedVersion: string): Promise<boolean> {
        const key = withNamespace(path);
        console.log(`📤 Storage - Putting blob: ${key} with expected version ${expectedVersion}`);

        try {
            // Get current version
            const { version: currentVersion } = await this.getWithVersion(path);

            // Version mismatch - someone else updated the file
            if (currentVersion !== expectedVersion) {
                console.log(`⚠️ Storage - Version mismatch for ${key}: expected ${expectedVersion}, got ${currentVersion}`);
                return false;
            }

            // Version matches, safe to update
            await put(key, JSON.stringify(data), {
                access: 'public',
                addRandomSuffix: false
            });

            // Update cache with new version (use current timestamp as version)
            const newVersion = new Date().toISOString();
            cache.set(key, { data, timestamp: Date.now(), version: newVersion });
            console.log(`💾 Storage - Updated blob: ${key} with new version ${newVersion}`);

            return true;
        } catch (error) {
            console.error(`❌ Storage - Error putting blob: ${key}`, error);
            throw error;
        }
    }

    async list(prefix: string = ""): Promise<string[]> {
        const key = withNamespace(prefix);
        console.log(`📋 Storage - Listing blobs with prefix: ${key}`);

        try {
            const { blobs } = await list({ prefix: key });
            console.log(`📋 Storage - Found ${blobs.length} blobs with prefix: ${key}`);

            if (blobs.length === 0) {
                console.log(`📋 Storage - No blobs found with prefix: ${key}`);
                return [];
            }

            // Filter out deleted files
            const filteredBlobs = [];
            console.log(`📋 Storage - Checking ${blobs.length} blobs for deleted status`);

            for (const blob of blobs) {
                try {
                    console.log(`📋 Storage - Checking blob: ${blob.pathname}`);
                    const response = await fetch(blob.url);
                    if (!response.ok) {
                        console.error(`❌ Storage - HTTP error fetching blob: ${blob.pathname}, status: ${response.status}`);
                        continue;
                    }

                    const data = await response.json();

                    // Skip files marked as deleted
                    if (data && typeof data === 'object' && data.__deleted === true) {
                        console.log(`🗑️ Storage - Skipping deleted blob: ${blob.pathname}`);
                        continue;
                    }

                    filteredBlobs.push(blob);
                    console.log(`📋 Storage - Added valid blob: ${blob.pathname}`);
                } catch (error) {
                    // If we can't read the file, include it anyway
                    console.error(`⚠️ Storage - Error reading blob: ${blob.pathname}, including it anyway`, error);
                    filteredBlobs.push(blob);
                }
            }

            console.log(`📋 Storage - Filtered to ${filteredBlobs.length} non-deleted blobs`);

            // Strip namespace from results
            const results = filteredBlobs.map(blob => blob.pathname.replace(new RegExp(`^${NAMESPACE}/`), ""));
            console.log(`📋 Storage - Returning ${results.length} paths after stripping namespace`);

            return results;
        } catch (error) {
            console.error(`❌ Storage - Error listing blobs: ${key}`, error);
            return [];
        }
    }

    async delete(path: string): Promise<void> {
        const key = withNamespace(path);
        console.log(`🗑️ Storage - Deleting blob: ${key}`);

        try {
            // Since Vercel Blob doesn't have a direct delete method in the SDK,
            // we'll mark the file as deleted by overwriting it with a tombstone object
            await put(key, JSON.stringify({
                __deleted: true,
                __deletedAt: new Date().toISOString(),
                __originalPath: path
            }), {
                access: 'public',
                addRandomSuffix: false,
                contentType: 'application/json'
            });

            console.log(`✅ Storage - Successfully marked blob as deleted: ${key}`);

            // Remove from cache
            cache.delete(key);
        } catch (error) {
            console.error(`❌ Storage - Error marking blob as deleted: ${key}`, error);
            throw error;
        }
    }
}

// Export a singleton instance
export const storage = new BlobStorage();

// Export types for use elsewhere
export type { CacheEntry, JsonValue };