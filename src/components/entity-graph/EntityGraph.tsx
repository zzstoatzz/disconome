"use client";

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Label, GraphDimensions, Node } from "./types";
import SvgFilters from "./svg/SvgFilters";
import { useGraphTheme } from "./hooks/useGraphTheme";
import { useTrendingTopics } from "./hooks/useTrendingTopics";
import { useGraphData } from "./hooks/useGraphData";
import { processUniqueLabels, generateCategoryColors } from "./utils/labelProcessing";
import { injectAnimationStyles } from "./utils/animationHelpers";
import { calculateEdges, distributeNodes } from "./utils/graphCalculations";
import { EdgeRenderer, NodeRenderer, LabelRenderer } from "./components";

// Simple context menu component for node actions
const NodeContextMenu = ({
    node,
    position,
    onClose,
    onRemove
}: {
    node: Node | null;
    position: { x: number; y: number };
    onClose: () => void;
    onRemove: (node: Node) => void;
}) => {
    if (!node) return null;

    return (
        <div
            className="absolute z-50 bg-white dark:bg-gray-800 shadow-lg rounded-md p-2 border border-gray-200 dark:border-gray-700"
            style={{
                left: position.x,
                top: position.y,
                minWidth: '150px'
            }}
        >
            <div className="text-sm font-medium mb-2 border-b pb-1 dark:text-gray-200">
                {node.title}
            </div>
            <div className="flex flex-col gap-1">
                <button
                    onClick={() => {
                        window.location.href = `/wiki/${node.slug}`;
                        onClose();
                    }}
                    className="text-left text-xs py-1 px-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded dark:text-gray-300"
                >
                    View Entity
                </button>
                <button
                    onClick={() => {
                        onRemove(node);
                        onClose();
                    }}
                    className="text-left text-xs py-1 px-2 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-400 rounded"
                >
                    Remove from Graph
                </button>
            </div>
        </div>
    );
};

const EntityGraph: React.FC = () => {
    // Refs
    const containerRef = useRef<HTMLDivElement>(null) as React.RefObject<HTMLDivElement>;
    const svgRef = useRef<SVGSVGElement>(null);

    // State
    const [dimensions, setDimensions] = useState<GraphDimensions>({ width: 0, height: 0 });
    const [hoveredLabel, setHoveredLabel] = useState<Label | null>(null);
    const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
    const [isInitialLoading, setIsInitialLoading] = useState(false); // Start with false to show graph immediately
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [initialNodePositions] = useState<{ [key: string]: { x: number; y: number } }>({});

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        visible: boolean;
        position: { x: number; y: number };
        node: Node | null;
    }>({
        visible: false,
        position: { x: 0, y: 0 },
        node: null
    });

    // Custom hooks
    const { isDarkTheme } = useGraphTheme();
    const { trendingTopics } = useTrendingTopics();
    const { nodes, edges, setEdges, setNodes } = useGraphData(
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

    // Handle node right-click for context menu
    const handleNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            position: { x: e.clientX, y: e.clientY },
            node
        });
    }, []);

    // Handle removing a node from the graph
    const handleRemoveNode = useCallback(async (node: Node) => {
        try {
            // Call the debug API to remove the entity
            const response = await fetch('/api/debug', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'removeEntity',
                    title: node.title,
                    removeClassification: true // Remove classification so it can be re-classified
                }),
            });

            if (response.ok) {
                const result = await response.json();
                console.log(`Removed entity: ${node.title}`, result);


                // Remove the node from the local state
                const remainingNodes = nodes.filter(n => n.slug !== node.slug);

                // Set transition state for smooth animation
                setIsTransitioning(true);

                // Add CSS transition to each node
                const nodesWithTransition = remainingNodes.map(n => ({
                    ...n,
                    style: {
                        transition: 'all 0.5s ease-out'
                    }
                }));

                // Update nodes with transition style
                setNodes(nodesWithTransition);

                // Wait a moment for the style to be applied
                setTimeout(() => {
                    // Distribute nodes in a circle
                    const center = { x: 500, y: 500 }; // Center of SVG viewBox
                    const radius = 350; // Radius for node distribution

                    // Calculate new positions
                    const redistributedNodes = distributeNodes(
                        [...nodesWithTransition],
                        center,
                        radius,
                        false,
                        {}
                    );

                    // Update nodes with new positions while keeping the transition style
                    setNodes(redistributedNodes);

                    // Recalculate edges after nodes have moved
                    setTimeout(() => {
                        const newEdges = calculateEdges(redistributedNodes, hoveredLabel);
                        setEdges(newEdges);
                        setIsTransitioning(false);

                        // Show a success message
                        console.log(`Successfully removed "${node.title}" and redistributed the graph.`);
                    }, 600); // Wait for node transition to complete
                }, 50);
            } else {
                console.error('Failed to remove entity:', await response.json());
                alert('Failed to remove entity. See console for details.');
            }
        } catch (error) {
            console.error('Error removing entity:', error);
            alert('Error removing entity. See console for details.');
        }
    }, [nodes, setNodes, setEdges, hoveredLabel, setIsTransitioning]);

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (contextMenu.visible) {
                setContextMenu(prev => ({ ...prev, visible: false }));
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    }, [contextMenu.visible]);

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
                    onContextMenu={handleNodeContextMenu}
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

            {/* Node Context Menu */}
            {contextMenu.visible && (
                <NodeContextMenu
                    node={contextMenu.node}
                    position={contextMenu.position}
                    onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
                    onRemove={handleRemoveNode}
                />
            )}
        </div>
    );
};

export default EntityGraph; 