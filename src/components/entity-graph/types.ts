export type Label = {
    name: string;
    source: 'trending' | 'ai';
    isHistorical?: boolean;
};

export interface Node {
    slug: string;
    title: string;
    count: number;
    labels?: Label[];
    x: number;
    y: number;
    size?: number;
    finalX?: number;
    finalY?: number;
    style?: React.CSSProperties;
}

export type Link = {
    source: string;
    target: string;
    value: number;
};

export type Edge = {
    source: Node;
    target: Node;
    sourceX?: number;
    sourceY?: number;
    targetX?: number;
    targetY?: number;
    label: Label;
    labels: Label[];
    strength?: number;
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