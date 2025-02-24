import { put, list } from "@vercel/blob";
import { JsonValue, CacheEntry } from "@/lib/types";

// Simple in-memory cache to store blob data for a short time
const cache = new Map<string, CacheEntry<JsonValue>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Namespace prefix for all blob keys
const NAMESPACE = process.env.BLOB_NAMESPACE || "dev";

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

        // Check cache first
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Cache hit for ${key}`);
            return entry.data as T;
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

            return data as T;
        } catch (error) {
            console.error(`❌ Error fetching blob: ${key}`, error);
            return null;
        }
    }

    async getWithVersion<T extends JsonValue>(path: string): Promise<{ data: T | null; version: string }> {
        const key = withNamespace(path);

        // Check cache first
        const entry = cache.get(key);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Cache hit for ${key}`);
            return { data: entry.data as T, version: entry.version || "0" };
        }

        console.log(`📥 Fetching blob: ${key}`);
        const { blobs } = await list({ prefix: key });
        if (blobs.length === 0) {
            console.log(`❌ Blob not found: ${key}`);
            return { data: null, version: "0" };
        }

        try {
            const response = await fetch(blobs[0].url);
            const data = await response.json();
            const version = blobs[0].uploadedAt?.toISOString() || "0";

            // Update cache with version
            cache.set(key, { data, timestamp: Date.now(), version });
            console.log(`💾 Cached blob: ${key} with version ${version}`);

            return { data: data as T, version };
        } catch (error) {
            console.error(`❌ Error fetching blob: ${key}`, error);
            return { data: null, version: "0" };
        }
    }

    async put<T extends JsonValue>(path: string, data: T): Promise<void> {
        const key = withNamespace(path);
        console.log(`📤 Putting blob: ${key}`);

        try {
            await put(key, JSON.stringify(data), {
                access: 'public',
                addRandomSuffix: false
            });

            // Immediately cache the new data with version
            const version = new Date().toISOString();
            cache.set(key, { data, timestamp: Date.now(), version });
            console.log(`💾 Cached new blob: ${key}`);
        } catch (error) {
            console.error(`❌ Error putting blob: ${key}`, error);
            throw error;
        }
    }

    async putWithVersion<T extends JsonValue>(path: string, data: T, expectedVersion: string): Promise<boolean> {
        const key = withNamespace(path);
        console.log(`📤 Putting blob: ${key} with expected version ${expectedVersion}`);

        try {
            // Get current version
            const { version: currentVersion } = await this.getWithVersion(path);

            // Version mismatch - someone else updated the file
            if (currentVersion !== expectedVersion) {
                console.log(`⚠️ Version mismatch for ${key}: expected ${expectedVersion}, got ${currentVersion}`);
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
            console.log(`💾 Updated blob: ${key} with new version ${newVersion}`);

            return true;
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
export type { CacheEntry, JsonValue }; 