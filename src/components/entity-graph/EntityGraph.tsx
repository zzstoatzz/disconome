"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Label, GraphDimensions } from "./types";
import SvgFilters from "./svg/SvgFilters";
import { useGraphTheme } from "./hooks/useGraphTheme";
import { useNodeAnimation } from "./hooks/useNodeAnimation";
import { useTrendingTopics } from "./hooks/useTrendingTopics";
import { useGraphData } from "./hooks/useGraphData";
import { processUniqueLabels, generateCategoryColors } from "./utils/labelProcessing";
import { injectAnimationStyles, createConnectingLines } from "./utils/animationHelpers";
import { calculateEdges } from "./utils/graphCalculations";
import { EdgeRenderer, NodeRenderer, LabelRenderer } from "./components";

const EntityGraph: React.FC = () => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);

    // State
    const [dimensions, setDimensions] = useState<GraphDimensions>({ width: 0, height: 0 });
    const [hoveredLabel, setHoveredLabel] = useState<Label | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [initialNodePositions, setInitialNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});

    // Custom hooks
    const { isDarkTheme } = useGraphTheme();
    const { orbitalNodes } = useNodeAnimation(
        isInitialLoading,
        isTransitioning
    );
    const { trendingTopics } = useTrendingTopics();
    const { nodes, edges, setEdges } = useGraphData(
        containerRef,
        dimensions,
        hoveredLabel,
        isTransitioning,
        initialNodePositions,
        trendingTopics,
        setIsInitialLoading,
        setIsTransitioning,
        setInitialNodePositions
    );

    // Process labels
    const uniqueLabels = useMemo(() => {
        return processUniqueLabels(nodes, trendingTopics);
    }, [nodes, trendingTopics]);

    // Generate category colors
    const categoryColors = useMemo(() => {
        return generateCategoryColors(uniqueLabels);
    }, [uniqueLabels]);

    // Inject animation styles
    useEffect(() => {
        injectAnimationStyles();
    }, []);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                const { width, height } = containerRef.current.getBoundingClientRect();
                setDimensions({ width, height });
            }
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    // Create connecting lines for orbital nodes
    useEffect(() => {
        if (isInitialLoading && svgRef.current) {
            createConnectingLines(svgRef.current, orbitalNodes, isDarkTheme);
        }
    }, [isInitialLoading, orbitalNodes, isDarkTheme]);

    // Ensure edges are visible after initial loading
    useEffect(() => {
        if (!isInitialLoading && !isTransitioning && edges.length === 0 && nodes.length > 0) {
            console.log("EntityGraph: No edges after loading completed. Forcing edge recalculation.");
            // This is a fallback in case edges weren't calculated properly
            const recalculatedEdges = calculateEdges(nodes, hoveredLabel);
            if (recalculatedEdges.length > 0) {
                console.log(`EntityGraph: Recalculated ${recalculatedEdges.length} edges`);
                // Update the edges state in the useGraphData hook
                setEdges(recalculatedEdges);
            }
        }
    }, [isInitialLoading, isTransitioning, edges.length, nodes, hoveredLabel, setEdges]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-200"
        >
            {/* Loading state */}
            {isInitialLoading && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                    <div className="text-center">
                        <div className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
                            Loading Knowledge Graph
                        </div>
                        <div className="flex justify-center space-x-2">
                            {orbitalNodes.map((node, i) => (
                                <div
                                    key={`orbital-${i}`}
                                    className="w-3 h-3 rounded-full bg-sky-500"
                                    style={{
                                        animation: `orbit ${3 + i * 0.5}s infinite linear`,
                                        opacity: 0.7 + i * 0.1,
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* SVG Graph */}
            <svg
                width="100%"
                height="100%"
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    zIndex: 30,
                    pointerEvents: 'none',
                    overflow: 'visible'
                }}
                ref={svgRef}
            >
                <defs>
                    <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
                        <feDropShadow dx="0" dy="0" stdDeviation="2" floodOpacity="0.3" />
                    </filter>
                </defs>

                <SvgFilters />

                {/* Render edges using EdgeRenderer component */}
                <EdgeRenderer
                    edges={edges}
                    hoveredLabel={hoveredLabel}
                    categoryColors={Object.fromEntries(categoryColors)}
                    isDarkTheme={isDarkTheme}
                    isTransitioning={isTransitioning}
                    isInitialLoading={isInitialLoading}
                />

                {/* Render nodes using NodeRenderer component */}
                <NodeRenderer
                    nodes={nodes}
                    edges={edges}
                    hoveredLabel={hoveredLabel}
                    categoryColors={categoryColors}
                    isDarkTheme={isDarkTheme}
                    isInitialLoading={isInitialLoading}
                    trendingTopics={trendingTopics}
                />
            </svg>

            {/* Render labels using LabelRenderer component */}
            <LabelRenderer
                uniqueLabels={uniqueLabels}
                hoveredLabel={hoveredLabel}
                selectedLabel={selectedLabel}
                categoryColors={categoryColors}
                isDarkTheme={isDarkTheme}
                onLabelHover={setHoveredLabel}
                onLabelSelect={setSelectedLabel}
            />
        </div>
    );
};

export default EntityGraph; 