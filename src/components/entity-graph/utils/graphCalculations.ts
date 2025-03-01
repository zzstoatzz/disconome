import { Node, Edge, Label } from '../types';
import { IGNORED_LABELS } from "@/app/constants";

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

    // Log the first few nodes to verify positions
    nodes.slice(0, 3).forEach((node, i) => {
        console.log(`🔍 calculateEdges - Node ${i} (${node.title}): Position (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
    });

    nodes.forEach((source) => {
        nodes.forEach((target) => {
            if (source === target) return;

            const pairKey = [source.slug, target.slug].sort().join("-");
            if (processedPairs.has(pairKey)) return;
            processedPairs.add(pairKey);

            // Check if nodes share the hovered label
            const shareHoveredLabel = hoveredLabel &&
                source.labels?.some(l => l.name === hoveredLabel.name) &&
                target.labels?.some(l => l.name === hoveredLabel.name);

            // Only connect nodes if they share AI-generated labels or the hovered label
            const sharedAiLabels = source.labels?.filter((label) =>
                label.source === 'ai' && target.labels?.some(tl => tl.name === label.name && tl.source === 'ai')
            ) || [];

            if (sharedAiLabels.length > 0 || shareHoveredLabel) {
                const strength = (source.count + target.count) / 2;

                // If they share the hovered label but not AI labels, create a temporary label array
                const edgeLabels = shareHoveredLabel && sharedAiLabels.length === 0
                    ? [hoveredLabel]
                    : sharedAiLabels;

                // Create edge with direct references to source and target nodes
                // This ensures that edge positions update when node positions update
                newEdges.push({
                    source,
                    target,
                    sourceX: source.x,
                    sourceY: source.y,
                    targetX: target.x,
                    targetY: target.y,
                    labels: edgeLabels,
                    label: hoveredLabel && edgeLabels.some(l => l.name === hoveredLabel.name)
                        ? hoveredLabel
                        : edgeLabels[0],
                    strength,
                });
            }
        });
    });

    // Log the first few edges to verify positions
    newEdges.slice(0, 3).forEach((edge, i) => {
        console.log(`🔍 calculateEdges - Edge ${i}: (${edge.sourceX.toFixed(0)}, ${edge.sourceY.toFixed(0)}) → (${edge.targetX.toFixed(0)}, ${edge.targetY.toFixed(0)})`);
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
    // Ensure we have valid nodes
    if (!nodes || nodes.length === 0) {
        console.warn("No nodes to distribute");
        return [];
    }

    // Ensure center is valid
    const validCenter = {
        x: isNaN(center.x) || center.x <= 0 ? 500 : center.x,
        y: isNaN(center.y) || center.y <= 0 ? 500 : center.y
    };

    // Ensure radius is valid - use a fixed minimum radius
    const validRadius = Math.max(isNaN(radius) || radius <= 0 ? 300 : radius, 300);

    console.log(`🔍 distributeNodes - Using center: (${validCenter.x}, ${validCenter.y}), radius: ${validRadius}, nodes: ${nodes.length}`);

    // Calculate angle step based on number of nodes
    const angleStep = (2 * Math.PI) / nodes.length;

    // Map each node to its distributed position
    return nodes.map((node, i) => {
        // Calculate angle for this node (start from top)
        const angle = i * angleStep - Math.PI / 2;

        // Calculate final position using trigonometry
        const finalX = validCenter.x + validRadius * Math.cos(angle);
        const finalY = validCenter.y + validRadius * Math.sin(angle);

        // For debugging
        if (i < 3) {
            console.log(`🔍 Node ${i} (${node.title}): Final position (${finalX.toFixed(0)}, ${finalY.toFixed(0)})`);
        }

        // During transition, use initial position from center
        // Otherwise use the calculated final position
        if (isTransitioning && initialNodePositions[node.slug]) {
            // Store final position for animation
            node.finalX = finalX;
            node.finalY = finalY;

            // Keep current position from initialNodePositions
            node.x = initialNodePositions[node.slug].x;
            node.y = initialNodePositions[node.slug].y;

            if (i < 3) {
                console.log(`🔍 Node ${i} (${node.title}): Using transition position (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
            }
        } else {
            // Set both current and final positions
            node.x = finalX;
            node.y = finalY;
            node.finalX = finalX;
            node.finalY = finalY;

            if (i < 3) {
                console.log(`🔍 Node ${i} (${node.title}): Using final position (${node.x.toFixed(0)}, ${node.y.toFixed(0)})`);
            }
        }

        // Return the modified node
        return node;
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
            ? categoryColors.get(hoveredLabel.name) || `hsla(${index * 55}, 80%, 65%, 1)`
            : isDarkTheme ? "hsla(0, 0%, 75%, 0.3)" : "hsla(0, 0%, 25%, 0.3)";
    }

    if (!validLabels.length) {
        return isDarkTheme ? "hsla(210, 70%, 60%, 0.8)" : "hsla(210, 70%, 50%, 0.8)";
    }

    // Use more vibrant colors with higher opacity
    return categoryColors.get(validLabels[0].name) || `hsla(${index * 55}, 80%, 65%, 0.9)`;
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
    containerRef: React.RefObject<HTMLDivElement | null>,
    dimensions: { width: number; height: number }
): { x: number; y: number } => {
    // First try to get dimensions from the container element
    let width = 0;
    let height = 0;

    if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        width = rect.width;
        height = rect.height;

        console.log(`🔍 getCenter - Container dimensions from getBoundingClientRect:`, {
            width: width.toFixed(0),
            height: height.toFixed(0)
        });
    }

    // If container dimensions are not available, use the provided dimensions
    if (width <= 0 || height <= 0) {
        width = dimensions.width;
        height = dimensions.height;

        console.log(`🔍 getCenter - Using provided dimensions:`, {
            width: width.toFixed(0),
            height: height.toFixed(0)
        });
    }

    // If both are invalid, use default values
    if (width <= 0 || height <= 0) {
        width = 1000;  // Default width
        height = 800;  // Default height

        console.log(`🔍 getCenter - Using default dimensions:`, {
            width,
            height
        });
    }

    // Calculate center
    const center = {
        x: width / 2,
        y: height / 2
    };

    console.log(`🔍 getCenter - Final center: (${center.x.toFixed(0)}, ${center.y.toFixed(0)})`);

    return center;
}; 