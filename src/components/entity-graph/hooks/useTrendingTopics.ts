import { useState, useEffect } from 'react';
import { Label } from '../types';

// Static variable to prevent duplicate fetching in strict mode
const isTrendingFetched = { current: false };

export const useTrendingTopics = () => {
    const [trendingTopics, setTrendingTopics] = useState<Label[]>([]);

    // Fetch trending topics
    useEffect(() => {
        const trendingFetchedRef = { current: false };
        const trendingFetchingInProgressRef = { current: false };

        const fetchTrendingTopics = async () => {
            // Skip if already fetching
            if (trendingFetchingInProgressRef.current || (isTrendingFetched.current && !trendingFetchedRef.current)) return;
            trendingFetchingInProgressRef.current = true;

            try {
                const response = await fetch('/api/trending');
                const data = await response.json();
                const topics = data.labels.map((label: Label) => ({
                    ...label,
                    source: 'trending' as const
                }));
                setTrendingTopics(topics);
                trendingFetchedRef.current = true;
                isTrendingFetched.current = true;
            } catch (error) {
                console.error('Error fetching trending topics:', error);
            } finally {
                trendingFetchingInProgressRef.current = false;
            }
        };

        fetchTrendingTopics();

        // Only set up interval if we're in the browser
        let interval: NodeJS.Timeout | null = null;
        if (typeof window !== 'undefined') {
            interval = setInterval(fetchTrendingTopics, 15 * 60 * 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, []);

    return { trendingTopics };
}; 