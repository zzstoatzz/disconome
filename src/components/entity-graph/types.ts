import { ClassificationResponse } from "@/lib/api-types";

export type Label = {
    name: string;
    source: 'trending' | 'ai';
    isHistorical?: boolean;
};

export type Node = {
    slug: string;
    x: number;
    y: number;
    size: number;
    count: number;
    title: string;
    labels?: Label[];
    explanation?: string;
    isClassified?: boolean;
    loggedMatch?: boolean;
    finalX?: number;
    finalY?: number;
};

export type Link = {
    source: string;
    target: string;
    value: number;
};

export type Edge = {
    source: Node;
    target: Node;
    label: Label;
    labels: Label[];
    strength: number;
};

export type GraphDimensions = {
    width: number;
    height: number
};

export type NodePositions = {
    [key: string]: {
        x: number;
        y: number
    }
}; 