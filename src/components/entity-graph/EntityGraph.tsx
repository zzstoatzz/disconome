"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { Label, GraphDimensions } from "./types";
import SvgFilters from "./svg/SvgFilters";
import { useGraphTheme } from "./hooks/useGraphTheme";
import { useTrendingTopics } from "./hooks/useTrendingTopics";
import { useGraphData } from "./hooks/useGraphData";
import { processUniqueLabels, generateCategoryColors } from "./utils/labelProcessing";
import { injectAnimationStyles } from "./utils/animationHelpers";
import { calculateEdges } from "./utils/graphCalculations";
import { EdgeRenderer, NodeRenderer, LabelRenderer } from "./components";

const EntityGraph: React.FC = () => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
    const svgRef = useRef<SVGSVGElement>(null);

    // State
    const [dimensions, setDimensions] = useState<GraphDimensions>({ width: 0, height: 0 });
    const [hoveredLabel, setHoveredLabel] = useState<Label | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(false); // Start with false to show graph immediately
    const [isTransitioning] = useState(false);
    const [initialNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});

    // Custom hooks
    const { isDarkTheme } = useGraphTheme();
    const { trendingTopics } = useTrendingTopics();
    const { nodes, edges, setEdges } = useGraphData(
        containerRef,
        dimensions,
        hoveredLabel,
        isTransitioning,
        initialNodePositions,
        trendingTopics,
        setIsInitialLoading
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

    // Recalculate edges when transitioning ends
    useEffect(() => {
        if (!isTransitioning && nodes.length > 0) {
            console.log("EntityGraph: Transition ended, recalculating edges");
            const recalculatedEdges = calculateEdges(nodes, hoveredLabel);
            setEdges(recalculatedEdges);
        }
    }, [isTransitioning, nodes, hoveredLabel, setEdges]);

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-200"
            style={{
                minHeight: '600px'
            }}
        >
            {/* SVG Graph - fixed positioning and z-index */}
            <svg
                width="100%"
                height="100%"
                viewBox="0 0 1000 1000"
                preserveAspectRatio="xMidYMid meet"
                className="absolute inset-0 z-30"
                ref={svgRef}
                style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    overflow: 'visible',
                    minHeight: '600px'
                }}
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