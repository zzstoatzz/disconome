export type EntityStats = {
    title: string;
    views: number;
    labels?: string[];
    lastClassified?: number;
};

export type StatsMap = Record<string, EntityStats>; 