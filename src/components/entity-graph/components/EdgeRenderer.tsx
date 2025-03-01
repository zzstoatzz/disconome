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
    isInitialLoading,
}) => {
    const [hasReceivedEdges, setHasReceivedEdges] = useState(false);

    useEffect(() => {
        console.log(`EdgeRenderer: Received ${edges.length} edges for rendering`);
        if (edges.length > 0 && !hasReceivedEdges) {
            setHasReceivedEdges(true);
            console.log("EdgeRenderer: First time receiving edges");
        }
    }, [edges, hasReceivedEdges]);

    // Don't render edges during initial loading or transitions
    if (isInitialLoading) {
        console.log(`EdgeRenderer: Not rendering edges - initial loading`);
        return null;
    }

    // During transitions, still render edges but with a transition effect
    const transitionClass = isTransitioning ? "opacity-50 transition-opacity duration-900" : "transition-opacity duration-300";

    // Don't render if no edges
    if (!edges || edges.length === 0) {
        if (hasReceivedEdges) {
            console.warn("EdgeRenderer: No edges to render after previously having edges");
        } else {
            console.log("EdgeRenderer: No edges to render (initial state)");
        }
        return null;
    }

    console.log(`EdgeRenderer: Rendering ${edges.length} edges, transitioning: ${isTransitioning}`);

    return (
        <g className={`edges-container ${transitionClass}`}>
            {edges.map((edge, i) => {
                const edgeKey = `edge-${edge.source.slug}-${edge.target.slug}-${i}`;
                const isHighlighted = hoveredLabel && edge.labels.some(l => l.name === hoveredLabel.name);

                return (
                    <React.Fragment key={edgeKey}>
                        {/* Base edge */}
                        <line
                            x1={edge.sourceX}
                            y1={edge.sourceY}
                            x2={edge.targetX}
                            y2={edge.targetY}
                            style={getEdgeStyle(edge, hoveredLabel, categoryColors, isDarkTheme)}
                            className="transition-all duration-300"
                        />

                        {/* Simple electricity effect for highlighted edges */}
                        {isHighlighted && (
                            <line
                                x1={edge.sourceX}
                                y1={edge.sourceY}
                                x2={edge.targetX}
                                y2={edge.targetY}
                                stroke={`url(#electricityPattern)`}
                                strokeWidth={4}
                                strokeLinecap="round"
                                style={{
                                    opacity: 0.9
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </g>
    );
};

export default EdgeRenderer; 