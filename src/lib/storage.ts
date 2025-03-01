import { createClient } from '@supabase/supabase-js';
import { JsonValue, CacheEntry } from "@/lib/types";

// Simple in-memory cache to store data for a short time
const cache = new Map<string, CacheEntry<JsonValue>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

// Check if Supabase is properly configured
const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

console.log(`🔧 Storage - Supabase configuration:`, {
    url: supabaseUrl ? '✓ Set' : '✗ Missing',
    key: supabaseKey ? '✓ Set' : '✗ Missing',
    isConfigured: isSupabaseConfigured,
});

if (!isSupabaseConfigured) {
    console.warn(`⚠️ Storage - WARNING: Supabase is not properly configured. SUPABASE_URL and/or SUPABASE_KEY are missing.`);
}

export interface StorageInterface {
    get<T extends JsonValue>(path: string): Promise<T | null>;
    getWithVersion<T extends JsonValue>(path: string): Promise<{ data: T | null; version: string }>;
    put<T extends JsonValue>(path: string, data: T): Promise<void>;
    putWithVersion<T extends JsonValue>(path: string, data: T, expectedVersion: string): Promise<boolean>;
    list(prefix?: string): Promise<string[]>;
    delete(path: string): Promise<void>;
    clearCache(path?: string): number;
    clearAll(): Promise<void>;
}

class SupabaseStorage implements StorageInterface {
    // Table name in Supabase
    private tableName = 'entities';

    async get<T extends JsonValue>(path: string): Promise<T | null> {
        console.log(`📥 Storage - Fetching data: ${path}`);

        // Check cache first
        const entry = cache.get(path);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Storage - Cache hit for ${path}`);
            return entry.data as T;
        }

        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('data, version')
                .eq('path', path)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - entity doesn't exist
                    console.log(`❌ Storage - Data not found: ${path}`);
                    return null;
                }
                throw error;
            }

            if (!data) {
                console.log(`❌ Storage - Data not found: ${path}`);
                return null;
            }

            console.log(`📥 Storage - Successfully fetched data: ${path}`);

            // Update cache
            cache.set(path, { 
                data: data.data, 
                timestamp: Date.now(),
                version: data.version
            });
            console.log(`💾 Storage - Cached data: ${path}`);

            return data.data as T;
        } catch (error) {
            console.error(`❌ Storage - Error fetching data: ${path}`, error);
            return null;
        }
    }

    async getWithVersion<T extends JsonValue>(path: string): Promise<{ data: T | null; version: string }> {
        console.log(`📥 Storage - Fetching data with version: ${path}`);

        // Check cache first
        const entry = cache.get(path);
        if (entry && Date.now() - entry.timestamp < CACHE_TTL_MS) {
            console.log(`🔄 Storage - Cache hit for ${path}`);
            return { 
                data: entry.data as T, 
                version: entry.version || "0" 
            };
        }

        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('data, version')
                .eq('path', path)
                .single();

            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - entity doesn't exist
                    return { data: null, version: "0" };
                }
                throw error;
            }

            if (!data) {
                return { data: null, version: "0" };
            }

            // Update cache with version
            cache.set(path, { 
                data: data.data, 
                timestamp: Date.now(), 
                version: data.version 
            });
            console.log(`💾 Storage - Cached data: ${path} with version ${data.version}`);

            return { 
                data: data.data as T, 
                version: data.version 
            };
        } catch (error) {
            console.error(`❌ Storage - Error fetching data with version: ${path}`, error);
            return { data: null, version: "0" };
        }
    }

    async put<T extends JsonValue>(path: string, data: T): Promise<void> {
        console.log(`📤 Storage - Putting data: ${path}`);

        try {
            // Generate a new version (timestamp)
            const version = new Date().toISOString();

            // Use upsert with ON CONFLICT DO UPDATE to handle existing paths
            const { error } = await supabase
                .from(this.tableName)
                .upsert({ 
                    path, 
                    data, 
                    version,
                    updated_at: new Date()
                }, {
                    onConflict: 'path',
                    ignoreDuplicates: false
                });

            if (error) throw error;

            console.log(`✅ Storage - Successfully put data: ${path}`);

            // Update cache
            cache.set(path, { 
                data, 
                timestamp: Date.now(),
                version
            });
        } catch (error) {
            console.error(`❌ Storage - Error putting data: ${path}`, error);
            throw error;
        }
    }

    async putWithVersion<T extends JsonValue>(path: string, data: T, expectedVersion: string): Promise<boolean> {
        console.log(`📤 Storage - Putting data: ${path} with expected version ${expectedVersion}`);

        try {
            // Get current version
            const { version: currentVersion } = await this.getWithVersion(path);

            // Version mismatch - someone else updated the data
            if (currentVersion !== expectedVersion) {
                console.log(`⚠️ Storage - Version mismatch for ${path}: expected ${expectedVersion}, got ${currentVersion}`);
                return false;
            }

            // Generate a new version (timestamp)
            const newVersion = new Date().toISOString();

            // Version matches, safe to update
            const { error } = await supabase
                .from(this.tableName)
                .upsert({ 
                    path, 
                    data, 
                    version: newVersion,
                    updated_at: new Date()
                }, {
                    onConflict: 'path',
                    ignoreDuplicates: false
                });

            if (error) throw error;

            // Update cache with new version
            cache.set(path, { 
                data, 
                timestamp: Date.now(), 
                version: newVersion 
            });
            console.log(`💾 Storage - Updated data: ${path} with new version ${newVersion}`);

            return true;
        } catch (error) {
            console.error(`❌ Storage - Error putting data with version: ${path}`, error);
            throw error;
        }
    }

    async list(prefix: string = ""): Promise<string[]> {
        console.log(`📋 Storage - Listing data with prefix: ${prefix}`);

        try {
            const { data, error } = await supabase
                .from(this.tableName)
                .select('path')
                .like('path', `${prefix}%`);

            if (error) throw error;

            if (!data || data.length === 0) {
                console.log(`📋 Storage - No data found with prefix: ${prefix}`);
                return [];
            }

            const paths = data.map(item => item.path);
            console.log(`📋 Storage - Found ${paths.length} items with prefix: ${prefix}`);
            
            return paths;
        } catch (error) {
            console.error(`❌ Storage - Error listing data: ${prefix}`, error);
            return [];
        }
    }

    async delete(path: string): Promise<void> {
        console.log(`🗑️ Storage - Deleting data: ${path}`);

        try {
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .eq('path', path);

            if (error) throw error;

            console.log(`✅ Storage - Successfully deleted data: ${path}`);

            // Remove from cache
            cache.delete(path);
        } catch (error) {
            console.error(`❌ Storage - Error deleting data: ${path}`, error);
            throw error;
        }
    }

    clearCache(path?: string): number {
        if (path) {
            const hadKey = cache.has(path);
            cache.delete(path);
            console.log(`🧹 Storage - Cleared cache for: ${path}`);
            return hadKey ? 1 : 0;
        } else {
            const size = cache.size;
            cache.clear();
            console.log(`🧹 Storage - Cleared entire cache with ${size} entries`);
            return size;
        }
    }

    /**
     * Clear all data from the database
     * Use with caution - this will delete all data!
     */
    async clearAll(): Promise<void> {
        console.log(`🧹 Storage - Clearing all data from database`);

        try {
            // Delete all rows from the table
            const { error } = await supabase
                .from(this.tableName)
                .delete()
                .neq('id', 0); // This will match all rows

            if (error) throw error;

            // Clear the cache
            this.clearCache();
            
            console.log(`✅ Storage - Successfully cleared all data from database`);
        } catch (error) {
            console.error(`❌ Storage - Error clearing all data:`, error);
            throw error;
        }
    }
}

// Export a singleton instance
export const storage = new SupabaseStorage();

// Export types for use elsewhere
export type { CacheEntry, JsonValue };