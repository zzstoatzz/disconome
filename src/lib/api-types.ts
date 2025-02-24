import { Label } from './types';

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    details?: string;
}

export interface TrendingResponse {
    topics: Array<{ topic: string }>;
    labels: Label[];
    error?: string;
    timestamp: string;
}

export interface TrackVisitResponse {
    success: boolean;
    error?: string;
    message?: string;
    data?: {
        title: string;
        views: number;
        lastVisited: number;
        labels: Array<{ name: string; source: string }>;
    };
    totalEntities?: number;
}

export interface ClassificationResponse {
    success?: boolean;
    labels: Label[];  // AI-generated labels
    trendingLabels?: Label[];  // Trending topics
    explanation?: string;
    error?: string;
    details?: string;
}

export type SuggestionsResponse = Array<{
    title: string;
    slug: string;
}>; 