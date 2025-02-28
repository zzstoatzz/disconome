export type Label = {
    name: string;
    source: 'trending' | 'ai';
    timestamp?: number;
    isHistorical?: boolean;
};

export type Classification = {
    labels: Label[];
    explanation?: string;
    timestamp: number;
    title: string;
};

export type StatsData = {
    title: string;
    views: number;
    labels?: Label[];
    lastVisited?: number;
};

export type StatsMap = Record<string, StatsData>;

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type CacheEntry<T> = {
    data: T;
    timestamp: number;
    version?: string;
}; 