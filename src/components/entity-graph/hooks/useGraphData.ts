import { useState, useEffect, useRef, useCallback } from 'react';
import { Node, Edge, Label } from '../types';
import { calculateEdges, distributeNodes } from '../utils/graphCalculations';

// Static variable to prevent duplicate fetching in strict mode
const isDataFetched = { current: false };

export const useGraphData = (
    containerRef: React.RefObject<HTMLDivElement>,
    dimensions: { width: number; height: number },
    hoveredLabel: Label | null,
    isTransitioning: boolean,
    initialNodePositions: { [key: string]: { x: number; y: number } },
    trendingTopics: Label[],
    setIsInitialLoading: (value: boolean) => void
) => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);
    const [nodesLoaded, setNodesLoaded] = useState(false);
    const [labelsLoaded, setLabelsLoaded] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const dataFetchedRef = useRef(false);
    const dataFetchingInProgressRef = useRef(false);

    // Calculate node size based on count and trending status
    const calculateNodeSize = useCallback((count: number, data: { count: number }[], slug: string) => {
        const maxCount = Math.max(...data.map((d) => d.count));
        // Increase the base size to make nodes more visible
        const baseSize = 10 + (count / maxCount) * 15;
        // Use the same slug normalization for size calculation
        const nodeSlug = slug.toLowerCase().replace(/\s+/g, '-');
        
        // Ensure trendingTopics is an array before using .some()
        const topicsArray = Array.isArray(trendingTopics) ? trendingTopics : [];
        const isTrending = topicsArray.some(topic => {
            const topicSlug = topic.name.toLowerCase().replace(/\s+/g, '-');
            return nodeSlug === topicSlug;
        });
        
        return isTrending ? baseSize * 1.5 : baseSize;
    }, [trendingTopics]);

    // Track when labels are loaded via classification
    useEffect(() => {
        const hasLabels = nodes.some((node) => (node.labels || []).length > 0);
        if (hasLabels && !labelsLoaded) {
            setLabelsLoaded(true);
        }
    }, [nodes, labelsLoaded]);

    // Helper function to process entities in batches - defined as a callback
    const processEntitiesInBatches = useCallback((data: { slug: string; title: string; count: number; labels: { name: string; source: string; }[] }[]) => {
        console.log(`Processing ${data.length} entities`);

        // Process all entities at once
        const processedNodes = data.map((entity) => {
            // Calculate proper node size based on count
            const size = calculateNodeSize(entity.count, data, entity.slug);

            // Create a node with default position in the center of the viewBox
            const node: Node = {
                slug: entity.slug,
                title: entity.title,
                count: entity.count,
                labels: entity.labels ? entity.labels.map(label => ({
                    name: label.name,
                    source: label.source === 'trending' ? 'trending' : 'ai' // Ensure source is either 'trending' or 'ai'
                })) : [],
                x: 500, // Center of viewBox
                y: 500, // Center of viewBox
                size: size, // Use calculated size
            };

            return node;
        });

        console.log(`Created ${processedNodes.length} nodes`);

        // Distribute nodes in a circle
        const center = { x: 500, y: 500 }; // Center of SVG viewBox
        const radius = 350; // Reduced radius to prevent overlap with label bar

        // Distribute nodes in a circle
        const distributedNodes = distributeNodes(
            processedNodes,
            center,
            radius,
            false, // Not transitioning initially
            {} // No initial positions
        );

        console.log(`Distributed ${distributedNodes.length} nodes`);

        // Set nodes state
        setNodes(distributedNodes);
        setNodesLoaded(true);

        // Calculate edges
        const newEdges = calculateEdges(distributedNodes, null);
        console.log(`Calculated ${newEdges.length} edges`);
        setEdges(newEdges);

        // End loading state immediately
        dataFetchingInProgressRef.current = false;
        setIsInitialLoading(false);
        setIsLoading(false);
        console.log("Loading state ended after processing entities");
    }, [calculateNodeSize, setNodes, setNodesLoaded, setEdges, setIsInitialLoading, setIsLoading]);

    // Function to fetch and process data
    const fetchAndProcessData = useCallback(() => {
        if (dataFetchingInProgressRef.current) {
            console.log("🚫 useGraphData - Data fetching already in progress, skipping");
            return;
        }

        console.log("🚀 useGraphData - Starting data fetch");
        dataFetchingInProgressRef.current = true;
        isDataFetched.current = true;

        // Fetch data immediately without delay
        console.log("🔍 useGraphData - Fetching data from /api/track-visit");
        fetch(`/api/track-visit?_=${Date.now()}`)
            .then((res) => {
                console.log(`🔍 useGraphData - Response status: ${res.status}`);
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                return res.json();
            })
            .then((data) => {
                console.log(`🔍 useGraphData - Received data:`, {
                    isArray: Array.isArray(data),
                    length: Array.isArray(data) ? data.length : 'N/A',
                    type: typeof data
                });

                // Debug: Log the first few items to check structure
                if (Array.isArray(data) && data.length > 0) {
                    console.log("🔍 useGraphData - First data item sample:", {
                        slug: data[0].slug,
                        title: data[0].title,
                        count: data[0].count,
                        labels: data[0].labels
                    });
                }

                if (!data || !Array.isArray(data)) {
                    console.error("❌ useGraphData - Invalid data format received:", data);
                    dataFetchingInProgressRef.current = false;
                    setIsInitialLoading(false);
                    setIsLoading(false);
                    return;
                }

                // If no data was returned, create some fallback nodes
                if (data.length === 0) {
                    console.log("⚠️ useGraphData - No data returned from API, using fallback data");

                    // Create fallback data
                    const fallbackData = [
                        { slug: "artificial-intelligence", title: "Artificial Intelligence", count: 100, labels: [{ name: "Technology", source: "fallback" }] },
                        { slug: "machine-learning", title: "Machine Learning", count: 85, labels: [{ name: "Technology", source: "fallback" }] },
                        { slug: "neural-networks", title: "Neural Networks", count: 70, labels: [{ name: "Technology", source: "fallback" }] },
                        { slug: "deep-learning", title: "Deep Learning", count: 65, labels: [{ name: "Technology", source: "fallback" }] },
                        { slug: "natural-language-processing", title: "Natural Language Processing", count: 60, labels: [{ name: "Technology", source: "fallback" }] }
                    ];
                    processEntitiesInBatches(fallbackData);
                    return;
                }

                // Process the data immediately
                processEntitiesInBatches(data);
            })
            .catch(error => {
                console.error("❌ useGraphData - Error fetching data:", error);
                dataFetchingInProgressRef.current = false;
                setIsInitialLoading(false);
                setIsLoading(false);
            });
    }, [processEntitiesInBatches, setIsInitialLoading, setIsLoading]);

    // Initial data fetch
    useEffect(() => {
        if (dataFetchedRef.current) {
            console.log("🚫 useGraphData - Data already fetched, skipping");
            return;
        }

        fetchAndProcessData();

        // Reset the dataFetchedRef when the component unmounts
        // This ensures fresh data is fetched when the user returns to the graph
        return () => {
            console.log("🔄 useGraphData - Component unmounting, resetting dataFetchedRef");
            dataFetchedRef.current = false;
            isDataFetched.current = false;
        };
    }, [fetchAndProcessData]);

    // Add effect to recalculate edges when nodes are updated or hoveredLabel changes
    useEffect(() => {
        if (nodes.length > 0) {
            // Only recalculate edges when nodes change or hoveredLabel changes
            // Use a debounce to prevent too frequent updates
            const timer = setTimeout(() => {
                console.log(`useGraphData: Recalculating edges for ${nodes.length} nodes with ${hoveredLabel ? 'hovered label: ' + hoveredLabel.name : 'no hovered label'}`);
                const newEdges = calculateEdges(nodes, hoveredLabel);
                console.log(`useGraphData: Calculated ${newEdges.length} edges`);
                setEdges(newEdges);
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [nodes, hoveredLabel]);

    // Add handler for random node selection
    useEffect(() => {
        const handleRandomNode = () => {
            // Filter for nodes with lower view counts (bottom 70%)
            const sortedNodes = [...nodes].sort((a, b) => b.count - a.count);
            const cutoffIndex = Math.floor(nodes.length * 0.3);
            const lessViewedNodes = sortedNodes.slice(cutoffIndex);

            // Select random node from less viewed nodes
            if (lessViewedNodes.length > 0) {
                const randomNode =
                    lessViewedNodes[Math.floor(Math.random() * lessViewedNodes.length)];
                window.location.href = `/wiki/${randomNode.slug}`;
            }
        };

        document.addEventListener("selectRandomNode", handleRandomNode);
        return () =>
            document.removeEventListener("selectRandomNode", handleRandomNode);
    }, [nodes]);

    // Reset the static isDataFetched variable when the user navigates away
    useEffect(() => {
        // Listen for navigation events
        const handleBeforeUnload = () => {
            console.log("🔄 useGraphData - User navigating away, resetting isDataFetched");
            isDataFetched.current = false;
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        // Also reset when the component unmounts
        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
            isDataFetched.current = false;
        };
    }, []);

    // Function to refresh data
    const refreshData = useCallback(() => {
        console.log("🔄 useGraphData - Manually refreshing data");
        // Reset the dataFetchedRef to allow fetching again
        dataFetchedRef.current = false;
        isDataFetched.current = false;
        // Trigger a new data fetch
        setIsLoading(true);
        // Force re-run of the data fetching effect
        setTimeout(() => {
            dataFetchingInProgressRef.current = false;
        }, 100);
    }, []);

    return {
        nodes,
        edges,
        setEdges,
        isLoading,
        nodesLoaded,
        labelsLoaded,
        refreshData // Export the refresh function
    };
}; 