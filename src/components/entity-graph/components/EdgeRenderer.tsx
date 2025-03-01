import React, { useEffect, useState } from 'react';
import { Edge, Label } from '../types';
import { getEdgeStyle } from '../utils/graphCalculations';

interface EdgeRendererProps {
    edges: Edge[];
    hoveredLabel: Label | null;
    categoryColors: Record<string, string>;
    isDarkTheme: boolean;
    isTransitioning: boolean;
    isInitialLoading: boolean;
}

const EdgeRenderer: React.FC<EdgeRendererProps> = ({
    edges,
    hoveredLabel,
    categoryColors,
    isDarkTheme,
    isTransitioning,
}) => {
    const [hasReceivedEdges, setHasReceivedEdges] = useState(false);

    useEffect(() => {
        console.log(`EdgeRenderer: Received ${edges.length} edges for rendering`);
        if (edges.length > 0 && !hasReceivedEdges) {
            setHasReceivedEdges(true);
            console.log("EdgeRenderer: First time receiving edges");
        }
    }, [edges, hasReceivedEdges]);

    // Don't render if no edges
    if (!edges || edges.length === 0) {
        if (hasReceivedEdges) {
            console.warn("EdgeRenderer: No edges to render after previously having edges");
        } else {
            console.log("EdgeRenderer: No edges to render (initial state)");
        }
        return null;
    }

    // During transitions, still render edges but with a transition effect
    const transitionClass = isTransitioning ? "opacity-50 transition-opacity duration-900" : "transition-opacity duration-300";

    console.log(`EdgeRenderer: Rendering ${edges.length} edges, transitioning: ${isTransitioning}`);

    return (
        <g className={`edges-container ${transitionClass}`}>
            {edges.map((edge, i) => {
                // Validate edge coordinates
                const sourceX = typeof edge.source.x === 'number' && !isNaN(edge.source.x) ? edge.source.x : 0;
                const sourceY = typeof edge.source.y === 'number' && !isNaN(edge.source.y) ? edge.source.y : 0;
                const targetX = typeof edge.target.x === 'number' && !isNaN(edge.target.x) ? edge.target.x : 0;
                const targetY = typeof edge.target.y === 'number' && !isNaN(edge.target.y) ? edge.target.y : 0;

                // Skip rendering edges with invalid coordinates
                if (sourceX === 0 && sourceY === 0 && targetX === 0 && targetY === 0) {
                    console.warn(`EdgeRenderer: Edge ${i} has invalid coordinates`);
                    return null;
                }

                const edgeKey = `edge-${edge.source.slug}-${edge.target.slug}-${i}`;
                const isHighlighted = hoveredLabel && edge.labels.some(l => l.name === hoveredLabel.name);

                return (
                    <React.Fragment key={edgeKey}>
                        {/* Base edge */}
                        <line
                            x1={sourceX}
                            y1={sourceY}
                            x2={targetX}
                            y2={targetY}
                            style={getEdgeStyle(edge, hoveredLabel, categoryColors, isDarkTheme)}
                            className="transition-all duration-300"
                        />

                        {/* Improved electricity effect for highlighted edges */}
                        {isHighlighted && (
                            <>
                                <line
                                    x1={sourceX}
                                    y1={sourceY}
                                    x2={targetX}
                                    y2={targetY}
                                    stroke={`url(#electricityPattern)`}
                                    strokeWidth={2}
                                    strokeLinecap="round"
                                    style={{
                                        opacity: 0.7
                                    }}
                                />
                                {/* Additional subtle glow line */}
                                <line
                                    x1={sourceX}
                                    y1={sourceY}
                                    x2={targetX}
                                    y2={targetY}
                                    stroke={isDarkTheme ? "rgba(180, 220, 255, 0.3)" : "rgba(100, 180, 255, 0.3)"}
                                    strokeWidth={3}
                                    strokeLinecap="round"
                                    style={{
                                        opacity: 0.4,
                                        filter: "blur(2px)"
                                    }}
                                />
                            </>
                        )}
                    </React.Fragment>
                );
            })}
        </g>
    );
};

export default EdgeRenderer; 