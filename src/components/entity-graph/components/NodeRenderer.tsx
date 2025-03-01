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
    isInitialLoading: boolean;
    trendingTopics: Label[];
}

const NodeRenderer: React.FC<NodeRendererProps> = ({
    nodes,
    edges,
    hoveredLabel,
    categoryColors,
    isDarkTheme,
    isInitialLoading,
    trendingTopics
}) => {
    const router = useRouter();

    if (isInitialLoading || nodes.length === 0) {
        return null;
    }

    return (
        <g className="nodes-container">
            {nodes.map((node, i) => {
                const nodeKey = `node-${node.slug}-${i}`;
                const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
                const isTrending = trendingTopics.some(topic =>
                    topic.name.toLowerCase().replace(/\s+/g, '-') === nodeSlug
                );
                const isHighlighted = hoveredLabel && node.labels?.some(l => l.name === hoveredLabel.name);

                // Find all edges where this node is the source or target
                const nodeEdges = edges.filter(edge =>
                    edge.source.slug === node.slug || edge.target.slug === node.slug
                );

                // If we found edges for this node, use their coordinates
                let nodeX = node.x;
                let nodeY = node.y;

                if (nodeEdges.length > 0) {
                    // Use the first edge's coordinates
                    const edge = nodeEdges[0];
                    if (edge.source.slug === node.slug) {
                        nodeX = edge.sourceX;
                        nodeY = edge.sourceY;
                    } else {
                        nodeX = edge.targetX;
                        nodeY = edge.targetY;
                    }
                }

                return (
                    <g
                        key={nodeKey}
                        onClick={() => router.push(`/wiki/${node.slug}`)}
                        className="group cursor-pointer"
                        style={{
                            ...getNodeStyle(i),
                            pointerEvents: 'auto'
                        }}
                    >
                        <circle
                            cx={nodeX}
                            cy={nodeY}
                            r={node.size}
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
                            <g transform={`translate(${nodeX - node.size * 0.6}, ${nodeY - node.size * 3})`}
                                className={`transition-all duration-300 ${isHighlighted ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <image
                                    href="/bsky-logo.png"
                                    width={node.size * 1.2}
                                    height={node.size * 1.2}
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