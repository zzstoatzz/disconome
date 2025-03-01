import React from 'react';
import { useRouter } from "next/navigation";
import { Node, Label, Edge } from '../types';
import { getNodeColor, getNodeStyle } from '../utils/graphCalculations';

interface NodeRendererProps {
    nodes: Node[];
    edges: Edge[];
    hoveredLabel: Label | null;
    categoryColors: Record<string, string> | Map<string, string>;
    isDarkTheme: boolean;
    trendingTopics: Label[];
    onContextMenu?: (e: React.MouseEvent, node: Node) => void;
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
    nodes,
    edges,
    hoveredLabel,
    categoryColors,
    isDarkTheme,
    trendingTopics,
    onContextMenu
}) => {
    const router = useRouter();

    // Always render nodes if they exist, regardless of loading state
    if (nodes.length === 0) {
        console.log("NodeRenderer: Not rendering nodes - no nodes available");
        return null;
    }

    console.log(`NodeRenderer: Rendering ${nodes.length} nodes`);

    return (
        <g className="nodes-container">
            {nodes.map((node, i) => {
                // Ensure node has valid coordinates
                if (typeof node.x !== 'number' || typeof node.y !== 'number' ||
                    isNaN(node.x) || isNaN(node.y)) {
                    console.warn(`NodeRenderer: Node ${node.slug} has invalid coordinates:`, { x: node.x, y: node.y });
                    return null; // Skip rendering this node
                }

                const nodeKey = `node-${node.slug}-${i}`;
                const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
                const isTrending = Array.isArray(trendingTopics) && trendingTopics.some(topic =>
                    topic.name.toLowerCase().replace(/\s+/g, '-') === nodeSlug
                );
                const isHighlighted = hoveredLabel && node.labels?.some(l => l.name === hoveredLabel.name);

                // Find all edges where this node is the source or target
                const nodeEdges = edges.filter(edge =>
                    edge.source.slug === node.slug || edge.target.slug === node.slug
                );

                // Default to node's own coordinates
                let nodeX = node.x;
                let nodeY = node.y;

                if (nodeEdges.length > 0) {
                    // Use the first edge's coordinates if they exist and are valid
                    const edge = nodeEdges[0];
                    if (edge.source.slug === node.slug) {
                        if (typeof edge.sourceX === 'number' && !isNaN(edge.sourceX)) {
                            nodeX = edge.sourceX;
                        }
                        if (typeof edge.sourceY === 'number' && !isNaN(edge.sourceY)) {
                            nodeY = edge.sourceY;
                        }
                    } else {
                        if (typeof edge.targetX === 'number' && !isNaN(edge.targetX)) {
                            nodeX = edge.targetX;
                        }
                        if (typeof edge.targetY === 'number' && !isNaN(edge.targetY)) {
                            nodeY = edge.targetY;
                        }
                    }
                }

                // Apply custom transition style if provided by the node
                const nodeStyle = {
                    ...getNodeStyle(i),
                    pointerEvents: 'auto',
                    ...(node.style || {}) // Apply any custom style from the node object
                };

                return (
                    <g
                        key={nodeKey}
                        onClick={() => router.push(`/wiki/${node.slug}`)}
                        onContextMenu={(e) => onContextMenu && onContextMenu(e, node)}
                        className="group cursor-pointer"
                        style={nodeStyle as React.CSSProperties}
                    >
                        <circle
                            cx={nodeX}
                            cy={nodeY}
                            r={node.size || 10} // Provide default size
                            fill={getNodeColor(node, i, hoveredLabel, categoryColors, isDarkTheme)}
                            stroke={
                                isTrending
                                    ? "rgba(14, 165, 233, 0.8)"
                                    : isDarkTheme
                                        ? "rgba(255, 255, 255, 0.6)"
                                        : "rgba(0, 0, 0, 0.6)"
                            }
                            strokeWidth={isTrending ? 2 : 1}
                            className={`transition-all duration-300 hover:opacity-90`}
                            filter="url(#node-shadow)"
                            style={isTrending ? { animation: 'pulse 3s ease-in-out infinite' } : {}}
                        />
                        <text
                            x={nodeX}
                            y={nodeY - 10}
                            textAnchor="middle"
                            className={`text-xs transition-opacity duration-300 pointer-events-none 
                            ${isDarkTheme ? "fill-white" : "fill-gray-800"} 
                            ${(isHighlighted) || isTrending
                                    ? "opacity-100"
                                    : "opacity-0 group-hover:opacity-100"
                                }`}
                        >
                            {node.title}
                        </text>
                        {isTrending && (
                            <g transform={`translate(${nodeX - (node.size || 0) * 0.6}, ${nodeY - (node.size || 0) * 3})`}
                                className={`transition-all duration-300 ${isHighlighted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <image
                                    href="/bsky-logo.png"
                                    width={node.size ? node.size * 1.2 : 0}
                                    height={node.size ? node.size * 1.2 : 0}
                                    x={0}
                                    y={0}
                                    className="transition-all duration-300"
                                    opacity={0.95}
                                    filter="url(#trending-glow)"
                                />
                            </g>
                        )}
                    </g>
                );
            })}
        </g>
    );
};

export default NodeRenderer; 