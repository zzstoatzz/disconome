import { useState, useEffect, useRef, useCallback } from 'react';
import { Node, Edge, Label, GraphDimensions } from '../types';
import { calculateEdges, distributeNodes, getCenter } from '../utils/graphCalculations';
import { ClassificationResponse } from "@/lib/api-types";
import { MAX_VISIBLE_NODES } from "@/app/constants";

// Static variable to prevent duplicate fetching in strict mode
const isDataFetched = { current: false };

export const useGraphData = (
    containerRef: React.RefObject<HTMLDivElement | null>,
    dimensions: GraphDimensions,
    hoveredLabel: Label | null,
    isTransitioning: boolean,
    initialNodePositions: { [key: string]: { x: number; y: number } },
    trendingTopics: Label[],
    setIsInitialLoading: (value: boolean) => void,
    setIsTransitioning: (value: boolean) => void,
    setInitialNodePositions: (positions: { [key: string]: { x: number; y: number } }) => void
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
        const baseSize = 6 + (count / maxCount) * 12;
        // Use the same slug normalization for size calculation
        const nodeSlug = slug.toLowerCase().replace(/\s+/g, '-');
        const isTrending = trendingTopics.some(topic => {
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

    // Restore the fade-in effect for nodes
    useEffect(() => {
        if (nodes.length > 0) {
            setNodesLoaded(true);

            // Instead of immediately hiding the loading screen, start the transition
            if (isDataFetched.current && !isTransitioning) {
                setIsTransitioning(true);

                // Capture initial positions at the center for animation
                const center = getCenter(containerRef, dimensions);
                const positions: { [key: string]: { x: number; y: number } } = {};

                nodes.forEach((node) => {
                    positions[node.slug] = {
                        x: center.x,
                        y: center.y
                    };
                });

                setInitialNodePositions(positions);

                // After a shorter delay, complete the loading
                setTimeout(() => {
                    setIsInitialLoading(false);

                    // After the transition completes, reset the transitioning state
                    // Reduced from 1500ms to 900ms to match the new animation duration
                    setTimeout(() => {
                        setIsTransitioning(false);
                    }, 900);
                }, 300); // Reduced from 500ms to 300ms for faster start
            }
        }
    }, [nodes, nodesLoaded, isTransitioning, containerRef, dimensions, setIsInitialLoading, setIsTransitioning, setInitialNodePositions]);

    // Update the data fetching effect to handle loading state
    useEffect(() => {
        // Prevent duplicate fetches
        if (dataFetchedRef.current || dataFetchingInProgressRef.current || isDataFetched.current) {
            console.log("🔄 useGraphData - Skipping fetch, already fetched or in progress");
            return;
        }

        console.log("🚀 useGraphData - Starting data fetch");
        dataFetchingInProgressRef.current = true;
        isDataFetched.current = true;
        setIsLoading(true);

        // Add a small delay before fetching to ensure loading animation is visible
        setTimeout(() => {
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
                            { slug: "natural-language-processing", title: "Natural Language Processing", count: 60, labels: [{ name: "Technology", source: "fallback" }] },
                            { slug: "computer-vision", title: "Computer Vision", count: 55, labels: [{ name: "Technology", source: "fallback" }] },
                            { slug: "robotics", title: "Robotics", count: 50, labels: [{ name: "Technology", source: "fallback" }] },
                            { slug: "data-science", title: "Data Science", count: 45, labels: [{ name: "Technology", source: "fallback" }] },
                            { slug: "quantum-computing", title: "Quantum Computing", count: 40, labels: [{ name: "Technology", source: "fallback" }] },
                            { slug: "blockchain", title: "Blockchain", count: 35, labels: [{ name: "Technology", source: "fallback" }] }
                        ];

                        data = fallbackData;
                        console.log(`🔍 useGraphData - Using ${data.length} fallback entities`);
                    }

                    // Process the data to create nodes and links
                    const uniqueNodes = new Map();
                    console.log(`🔍 useGraphData - Processing ${data.length} entities`);

                    // First pass: create nodes - process in batches for better performance
                    const processEntitiesInBatches = (entities: any[], batchSize = 10) => {
                        let index = 0;
                        let validCount = 0;
                        let invalidCount = 0;
                        let noLabelsCount = 0;

                        const processNextBatch = () => {
                            const batch = entities.slice(index, index + batchSize);
                            index += batchSize;
                            console.log(`🔍 useGraphData - Processing batch ${Math.ceil(index / batchSize)} of ${Math.ceil(entities.length / batchSize)}`);

                            batch.forEach((entity) => {
                                // Skip if entity is undefined or doesn't have required properties
                                if (!entity || !entity.title || !entity.slug) {
                                    console.log("⚠️ useGraphData - Skipping invalid entity:", entity);
                                    invalidCount++;
                                    return;
                                }

                                // Skip the problematic entity
                                if (entity.slug === "tyler-the-creator") {
                                    console.log("⚠️ useGraphData - Skipping known deleted entity:", entity.slug);
                                    invalidCount++;
                                    return;
                                }

                                // Skip entities without labels (likely deleted)
                                if (!entity.labels || entity.labels.length === 0) {
                                    console.log("⚠️ useGraphData - Skipping entity without labels:", entity.slug);
                                    noLabelsCount++;
                                    return;
                                }

                                if (!uniqueNodes.has(entity.slug)) {
                                    uniqueNodes.set(entity.slug, {
                                        ...entity,
                                        size: calculateNodeSize(entity.count, data, entity.slug),
                                        labels: entity.labels || [],
                                    });
                                    validCount++;
                                }
                            });

                            // If there are more entities to process, schedule the next batch
                            if (index < entities.length) {
                                setTimeout(processNextBatch, 0);
                            } else {
                                // All entities processed, continue with the rest of the logic
                                console.log(`🔍 useGraphData - Processed all entities: ${validCount} valid, ${invalidCount} invalid, ${noLabelsCount} without labels`);
                                finishProcessing();
                            }
                        };

                        // Start processing the first batch
                        processNextBatch();
                    };

                    const finishProcessing = () => {
                        // Convert back to array and distribute
                        const allNodes = Array.from(uniqueNodes.values());
                        console.log(`🔍 useGraphData - Total unique nodes: ${allNodes.length}`);

                        const topNodes = allNodes
                            .sort((a, b) => b.count - a.count)
                            .slice(0, MAX_VISIBLE_NODES);
                        console.log(`🔍 useGraphData - Selected top ${topNodes.length} nodes`);

                        // Distribute nodes evenly - they'll start at center and animate outward
                        const center = getCenter(containerRef, dimensions);
                        console.log(`🔍 useGraphData - Center position:`, center);

                        const distributedNodes = distributeNodes(
                            topNodes,
                            center,
                            Math.min(center.x, center.y) * 0.7,
                            isTransitioning,
                            initialNodePositions
                        );
                        console.log(`🔍 useGraphData - Distributed ${distributedNodes.length} nodes`);

                        setNodes(distributedNodes);
                        dataFetchedRef.current = true;

                        // Only classify nodes that don't have AI-generated labels
                        const nodesToClassify = distributedNodes.filter(
                            (node) => !node.labels?.some(label => label.source === 'ai')
                        );

                        if (nodesToClassify.length > 0) {
                            console.log(`🔍 useGraphData - Classifying ${nodesToClassify.length} nodes`);

                            // Use Promise.all with a map to create all promises at once
                            const classificationPromises = nodesToClassify.map((node) =>
                                // First get Wikipedia data
                                fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(node.title)}&origin=*`)
                                    .then(res => res.json())
                                    .then(data => {
                                        const pages = data.query.pages;
                                        const pageId = Object.keys(pages)[0];
                                        const extract = pageId !== "-1" ? pages[pageId].extract : "";
                                        console.log(`🔍 useGraphData - Got Wikipedia extract for ${node.title}: ${extract ? extract.slice(0, 50) + '...' : 'None'}`);

                                        // Then classify with the extract
                                        return fetch("/api/classify", {
                                            method: "POST",
                                            headers: { "Content-Type": "application/json" },
                                            body: JSON.stringify({
                                                title: node.title,
                                                extract: extract
                                            }),
                                        });
                                    })
                                    .then((res) => {
                                        if (!res.ok) {
                                            throw new Error(`HTTP error! status: ${res.status}`);
                                        }
                                        return res.json();
                                    })
                                    .then((data: ClassificationResponse) => {
                                        if (data.error) {
                                            console.error('❌ useGraphData - Error in classification:', data.error);
                                            return { labels: [], explanation: '' };
                                        }
                                        console.log(`🔍 useGraphData - Classification result:`, {
                                            labels: data.labels?.map(l => `${l.name} (${l.source})`),
                                            explanation: data.explanation?.slice(0, 50) + '...'
                                        });

                                        return {
                                            labels: data.labels, // Only use AI labels from classification
                                            explanation: data.explanation || ''
                                        };
                                    })
                                    .catch((error) => {
                                        console.error('❌ useGraphData - Error classifying node:', error);
                                        return { labels: [], explanation: '' };
                                    })
                            );

                            Promise.all(classificationPromises).then((classifications) => {
                                console.log(`🔍 useGraphData - Completed ${classifications.length} classifications`);

                                const newClassifications = new Map(
                                    nodesToClassify.map((node, i) => [
                                        node.slug,
                                        {
                                            labels: classifications[i].labels || [],
                                            explanation: classifications[i].explanation || ''
                                        }
                                    ]),
                                );

                                const nodesWithLabels = distributedNodes.map((node) => {
                                    const classification = newClassifications.get(node.slug);
                                    if (classification) {
                                        // Keep any existing trending labels
                                        const existingTrendingLabels = node.labels?.filter(l => l.source === 'trending') || [];
                                        return {
                                            ...node,
                                            labels: [...classification.labels, ...existingTrendingLabels],
                                            explanation: classification.explanation || node.explanation
                                        };
                                    }
                                    return node;
                                });

                                console.log(`🔍 useGraphData - Updated nodes with classifications`);
                                setNodes(nodesWithLabels);
                                setEdges(calculateEdges(nodesWithLabels, hoveredLabel));
                                dataFetchingInProgressRef.current = false;
                            });
                        } else {
                            console.log("🔍 useGraphData - No nodes need classification");
                            setEdges(calculateEdges(distributedNodes, hoveredLabel));
                            dataFetchingInProgressRef.current = false;
                        }

                        // Update loading state when processing is complete
                        setIsLoading(false);
                    };

                    // Start processing entities in batches
                    processEntitiesInBatches(data);
                })
                .catch(error => {
                    console.error("❌ useGraphData - Error fetching data:", error);
                    dataFetchingInProgressRef.current = false;
                    setIsInitialLoading(false);
                    setIsLoading(false);
                });
        }, 500); // Small delay to ensure loading animation is visible
    }, [dimensions, hoveredLabel, isTransitioning, initialNodePositions, calculateNodeSize, containerRef, setIsInitialLoading]);

    // Add effect to recalculate edges when nodes are updated or hoveredLabel changes
    useEffect(() => {
        if (nodes.length > 0) {
            setEdges(calculateEdges(nodes, hoveredLabel));
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

    return { nodes, setNodes, edges, isLoading };
}; 