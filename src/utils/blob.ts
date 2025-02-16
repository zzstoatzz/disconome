import { list } from "@vercel/blob";
import { CACHE_DURATION } from "@/app/constants";

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

const cacheMap = new Map<string, CacheEntry<any>>();

export async function fetchBlobWithCache<T>(
    path: string,
    options: {
        cacheDuration?: number;
        timeout?: number;
    } = {}
): Promise<T | null> {
    const {
        cacheDuration = CACHE_DURATION,
        timeout = 5000
    } = options;

    // Check cache first
    const cached = cacheMap.get(path);
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
        return cached.data as T;
    }

    try {
        const { blobs } = await list({ prefix: path });
        if (blobs.length === 0) return null;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            const response = await fetch(blobs[0].url, {
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Update cache
            cacheMap.set(path, {
                data,
                timestamp: Date.now()
            });

            return data as T;
        } catch (fetchError) {
            if (fetchError instanceof Error && fetchError.name === 'AbortError') {
                console.error(`Fetch timeout for ${path}`);
            }
            throw fetchError;
        }
    } catch (error) {
        console.error(`Error fetching blob ${path}:`, error);
        return null;
    }
} 