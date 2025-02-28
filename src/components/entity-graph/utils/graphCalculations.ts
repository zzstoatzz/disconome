import { Node, Edge, Label } from '../types';
import { IGNORED_LABELS, IGNORED_PAGES } from "@/app/constants";

// Calculate node size based on count and trending status
export const calculateNodeSize = (
    count: number,
    data: { count: number }[],
    slug: string,
    trendingTopics: Label[]
): number => {
    const maxCount = Math.max(...data.map((d) => d.count));
    const baseSize = 6 + (count / maxCount) * 12;
    // Use the same slug normalization for size calculation
    const nodeSlug = slug.toLowerCase().replace(/\s+/g, '-');
    const isTrending = trendingTopics.some(topic => {
        const topicSlug = topic.name.toLowerCase().replace(/\s+/g, '-');
        return nodeSlug === topicSlug;
    });
    return isTrending ? baseSize * 1.5 : baseSize;
};

// Calculate edges between nodes based on shared labels
export const calculateEdges = (
    nodes: Node[],
    hoveredLabel: Label | null
): Edge[] => {
    const newEdges: Edge[] = [];
    const processedPairs = new Set<string>();

    // Only process if we have nodes
    if (!nodes.length) return newEdges;

    nodes.forEach((source) => {
        nodes.forEach((target) => {
            if (source === target) return;

            const pairKey = [source.slug, target.slug].sort().join("-");
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

            // Only connect nodes if they share AI-generated labels
            const sharedAiLabels = source.labels?.filter((label) =>
                label.source === 'ai' && target.labels?.some(tl => tl.name === label.name && tl.source === 'ai')
            ) || [];

            if (sharedAiLabels.length > 0) {
                const strength = (source.count + target.count) / 2;
                newEdges.push({
                    source,
                    target,
                    labels: sharedAiLabels,
                    label: hoveredLabel && sharedAiLabels.some(l => l.name === hoveredLabel.name)
                        ? hoveredLabel
                        : sharedAiLabels[0],
                    strength,
                });
            }
        });
    });

    return newEdges;
};

// Distribute nodes in a circular pattern
export const distributeNodes = (
    nodes: Node[],
    center: { x: number; y: number },
    radius: number,
    isTransitioning: boolean,
    initialNodePositions: { [key: string]: { x: number; y: number } }
): Node[] => {
    const angleStep = (2 * Math.PI) / nodes.length;

    return nodes.map((node, i) => {
        // Calculate the final position
        const finalX = center.x + radius * Math.cos(i * angleStep - Math.PI / 2);
        const finalY = center.y + radius * Math.sin(i * angleStep - Math.PI / 2);

        // During transition, use the initial position (center)
        if (isTransitioning && initialNodePositions[node.slug]) {
            return {
                ...node,
                x: initialNodePositions[node.slug].x,
                y: initialNodePositions[node.slug].y,
                finalX: finalX,
                finalY: finalY,
            };
        }

        return {
            ...node,
            x: finalX,
            y: finalY,
        };
    });
};

// Get node color based on labels and theme
export const getNodeColor = (
    node: Node,
    index: number,
    hoveredLabel: Label | null,
    categoryColors: Map<string, string>,
    isDarkTheme: boolean
): string => {
    const validLabels = node.labels?.filter(label => !IGNORED_LABELS.has(label.name)) || [];

    if (hoveredLabel && validLabels.length > 0) {
        return validLabels.some(l => l.name === hoveredLabel.name)
            ? categoryColors.get(hoveredLabel.name) || `hsla(${index * 55}, 70%, 65%, 0.9)`
            : isDarkTheme ? "hsla(0, 0%, 75%, 0.1)" : "hsla(0, 0%, 25%, 0.1)";
    }

    if (!validLabels.length) {
        return "hsla(0, 0%, 75%, 0.4)";
    }

    return categoryColors.get(validLabels[0].name) || `hsla(${index * 55}, 70%, 65%, 0.7)`;
};

// Get edge style based on hover state and theme
export const getEdgeStyle = (
    edge: Edge,
    hoveredLabel: Label | null,
    categoryColors: Map<string, string>,
    isDarkTheme: boolean,
    time: number
): React.CSSProperties => {
    const isHighlighted = hoveredLabel && edge.labels.some(l => l.name === hoveredLabel.name);

    if (isHighlighted) {
        const categoryColor =
            categoryColors.get(hoveredLabel.name) || "hsl(210, 100%, 75%)";
        const hue = parseInt(categoryColor.match(/hsl\((\d+)/)?.[1] || "210");

        const dashLength = 1.5 + Math.sin(time * 0.1) * 0.5;
        const gapLength = 1.5 + Math.cos(time * 0.15) * 0.5;
        const flicker = 0.4 + Math.sin(time * 0.3) * 0.1;

        return {
            stroke: `hsl(${hue}, 80%, 75%, ${flicker})`,
            filter: "url(#glow)",
            strokeWidth: 1.0,
            strokeDasharray: `${dashLength},${gapLength}`,
            strokeDashoffset: -time % 8,
            transition: "stroke 0.3s ease-in-out",
        };
    }

    return {
        stroke: isDarkTheme ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
        strokeWidth: 0.3,
        strokeDasharray: "2,4",
        transition: "all 0.3s ease-in-out",
    };
};

// Get node style for animation and transitions
export const getNodeStyle = (index: number): React.CSSProperties => {
    return {
        opacity: 1,
        transform: 'scale(1)',
        transition: `opacity 0.5s ease-out ${index * 0.02}s, transform 0.5s ease-out ${index * 0.02}s`,
    };
};

// Helper to get center coordinates
export const getCenter = (
    containerRef: React.RefObject<HTMLDivElement>,
    dimensions: { width: number; height: number }
): { x: number; y: number } => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
        x: rect ? rect.width / 2 : dimensions.width / 2,
        y: rect ? rect.height / 2 : dimensions.height / 2,
    };
}; 