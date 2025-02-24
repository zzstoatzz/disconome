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
    message?: string;
}

export interface ClassificationResponse {
    success: boolean;
    labels: Label[];
    explanation?: string;
    error?: string;
    details?: string;
}

export type SuggestionsResponse = Array<{
    title: string;
    slug: string;
}>; 