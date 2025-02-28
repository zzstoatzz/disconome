"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Node, Edge, Label, GraphDimensions, NodePositions } from "./types";
import SvgFilters from "./svg/SvgFilters";
import { useGraphTheme } from "./hooks/useGraphTheme";
import { useNodeAnimation } from "./hooks/useNodeAnimation";
import { useTrendingTopics } from "./hooks/useTrendingTopics";
import { useGraphData } from "./hooks/useGraphData";
import { getNodeColor, getEdgeStyle, getNodeStyle } from "./utils/graphCalculations";
import { processUniqueLabels, distributeLabels, generateCategoryColors } from "./utils/labelProcessing";
import { injectAnimationStyles, createConnectingLines } from "./utils/animationHelpers";

const EntityGraph: React.FC = () => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const labelsContainerRef = useRef<HTMLDivElement>(null);

    // Router
    const router = useRouter();

    // State
    const [dimensions, setDimensions] = useState<GraphDimensions>({ width: 0, height: 0 });
    const [hoveredLabel, setHoveredLabel] = useState<Label | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [initialNodePositions, setInitialNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});

    // Custom hooks
    const { isDarkTheme } = useGraphTheme();
    const { orbitalNodes, animationProgress, getAnimatedPosition } = useNodeAnimation(
        isInitialLoading,
        isTransitioning
    );
    const { trendingTopics } = useTrendingTopics();
    const { nodes, edges, isLoading } = useGraphData(
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

    // Generate category colors for labels
    const categoryColors = useMemo(() => {
        return generateCategoryColors(uniqueLabels);
    }, [uniqueLabels]);

    // Update dimensions on resize
    useEffect(() => {
        const updateDimensions = () => {
            if (containerRef.current) {
                setDimensions({
                    width: containerRef.current.clientWidth,
                    height: containerRef.current.clientHeight,
                });
            }
        };

        updateDimensions();
        window.addEventListener("resize", updateDimensions);
        return () => window.removeEventListener("resize", updateDimensions);
    }, []);

    // Inject animation styles
    useEffect(() => {
        injectAnimationStyles();
    }, []);

    // Create connecting lines for loading animation
    useEffect(() => {
        if (isInitialLoading && orbitalNodes.length > 0) {
            createConnectingLines(orbitalNodes);
        }
    }, [isInitialLoading, orbitalNodes]);

    // Animation timing
    const time = Date.now() / 1000;

    return (
        <div
            ref={containerRef}
            className="relative w-full h-full overflow-hidden bg-white dark:bg-gray-950 transition-colors duration-200"
        >
            <SvgFilters />

            {/* Loading Screen */}
            {isInitialLoading && (
                <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white dark:bg-gray-950 transition-colors duration-200">
                    <div className="relative w-64 h-64">
                        {/* Orbital Animation */}
                        <svg
                            className="w-full h-full"
                            viewBox="-100 -100 200 200"
                        >
                            {orbitalNodes.map((node, i) => (
                                <g
                                    key={`orbital-${i}`}
                                    className="orbital-node"
                                    style={{
                                        ...node.style,
                                        opacity: 0.8,
                                    }}
                                >
                                    <circle
                                        r={node.size}
                                        fill={node.color}
                                        className="orbital-circle"
                                    />
                                </g>
                            ))}
                            <g className="connecting-lines"></g>
                        </svg>
                    </div>
                </div>
            )}

            {/* Main Graph */}
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                className={`transition-opacity duration-500 ${isInitialLoading ? "opacity-0" : "opacity-100"}`}
            >
                <g className="edges">
                    {!isTransitioning && !isInitialLoading && edges.map((edge, i) => {
                        const edgeKey = `edge-${edge.source.slug}-${edge.target.slug}-${i}`;
                        return (
                            <g key={edgeKey}>
                                <line
                                    x1={edge.source.x}
                                    y1={edge.source.y}
                                    x2={edge.target.x}
                                    y2={edge.target.y}
                                    style={getEdgeStyle(edge, hoveredLabel, categoryColors, isDarkTheme, time)}
                                    className="transition-all duration-300"
                                />
                            </g>
                        );
                    })}
                </g>

                {nodes.map((node, i) => {
                    const nodeKey = `node-${node.slug}-${i}`;
                    const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
                    const isTrending = trendingTopics.some(topic =>
                        topic.name.toLowerCase().replace(/\s+/g, '-') === nodeSlug
                    );
                    const activeLabel = hoveredLabel;
                    const isHighlighted = activeLabel && node.labels?.some(l => l.name === activeLabel.name);

                    // Get center position for initial animation
                    const center = {
                        x: dimensions.width / 2,
                        y: dimensions.height / 2
                    };

                    // Calculate animated position
                    const animatedNode = isTransitioning
                        ? getAnimatedPosition(node, center)
                        : node;

                    return (
                        <g
                            key={nodeKey}
                            transform={`translate(${animatedNode.x},${animatedNode.y})`}
                            onClick={() => router.push(`/wiki/${node.slug}`)}
                            className="group cursor-pointer"
                            style={getNodeStyle(i)}
                        >
                            <circle
                                r={node.size}
                                fill={getNodeColor(node, i, hoveredLabel, categoryColors, isDarkTheme)}
                                stroke={
                                    isTrending
                                        ? "rgba(14, 165, 233, 0.8)"
                                        : isDarkTheme
                                            ? "rgba(255, 255, 255, 0.3)"
                                            : "rgba(0, 0, 0, 0.3)"
                                }
                                strokeWidth={isTrending ? 0.75 : 0.25}
                                className={`transition-all duration-300 hover:opacity-90`}
                                filter={isTrending ? "url(#trending-glow)" : undefined}
                                style={isTrending ? {
                                    animation: 'pulse 3s ease-in-out infinite'
                                } : undefined}
                            />
                            <text
                                dy="-10"
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
                                <g transform={`translate(${-node.size * 0.6}, ${-node.size * 3})`}
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
            </svg>

            {/* Labels Section */}
            <div className="fixed top-0 left-0 right-0 z-20">
                <div className="flex flex-col">
                    {uniqueLabels.length > 0 && (
                        <div className="p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm transition-colors duration-200">
                            <div className="max-w-screen-2xl mx-auto">
                                <div className="flex flex-col space-y-2">
                                    <div className="flex items-center justify-between">
                                        <div className="text-xs text-gray-500 dark:text-gray-400 font-medium"></div>
                                        <div className="text-xs text-gray-400 dark:text-gray-500">
                                            {/* Removed scroll indicator text for cleaner UI */}
                                        </div>
                                    </div>
                                    <div
                                        ref={labelsContainerRef}
                                        className="labels-container flex flex-nowrap space-x-2 overflow-x-auto pb-2 max-w-full">
                                        {uniqueLabels.map((label) => {
                                            const labelKey = `label-${label.name}-${label.source}`;
                                            return (
                                                <div
                                                    key={labelKey}
                                                    className={`flex items-center space-x-2 cursor-pointer 
                                  hover:bg-gray-100/50 dark:hover:bg-gray-800/50
                                  px-3 py-1.5 rounded-full transition-colors whitespace-nowrap
                                  ${selectedLabel?.name === label.name ? 'bg-gray-100/80 dark:bg-gray-800/80 ring-2 ring-sky-300 dark:ring-sky-700' : ''}
                                  ${label.isHistorical ? 'border border-dashed border-sky-300 dark:border-sky-700' : 'border border-transparent'}`}
                                                    onMouseEnter={() => setHoveredLabel(label)}
                                                    onMouseLeave={() => setHoveredLabel(null)}
                                                    onClick={() => {
                                                        // If this label is already selected, navigate to Bluesky
                                                        if (selectedLabel && selectedLabel.name === label.name) {
                                                            if (label.source === 'trending') {
                                                                window.open(`https://bsky.app/search?q=${encodeURIComponent(label.name)}`, '_blank');
                                                            }
                                                            setSelectedLabel(null);
                                                        } else {
                                                            // First tap - just select the label and show hover state
                                                            setSelectedLabel(label);
                                                            setHoveredLabel(label);
                                                        }
                                                    }}
                                                    onTouchStart={() => {
                                                        // For touch devices, show the hover state
                                                        setHoveredLabel(label);
                                                    }}
                                                    onTouchEnd={(e) => {
                                                        // Prevent default to avoid immediate navigation
                                                        if (selectedLabel?.name !== label.name) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    {label.source === 'trending' ? (
                                                        <svg
                                                            className={`w-2.5 h-2.5 ${label.isHistorical ? 'text-sky-300 dark:text-sky-700' : 'text-sky-500'}`}
                                                            viewBox="0 0 24 24"
                                                            fill="none"
                                                            stroke="currentColor"
                                                            strokeWidth="2"
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                        >
                                                            <path d="M23 6l-9.5 9.5-5-5L1 18" />
                                                            <path d="M17 6h6v6" />
                                                        </svg>
                                                    ) : (
                                                        <div
                                                            className="w-2 h-2 rounded-full"
                                                            style={{ backgroundColor: categoryColors.get(label.name) }}
                                                        />
                                                    )}
                                                    <span className={`text-xs ${label.isHistorical
                                                        ? 'text-gray-500 dark:text-gray-400 italic'
                                                        : 'text-gray-800 dark:text-white/90'
                                                        } font-medium`}>
                                                        {label.name}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default EntityGraph; 