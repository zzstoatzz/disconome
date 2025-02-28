"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import {
  MAX_VISIBLE_LABELS,
  MAX_VISIBLE_NODES,
  IGNORED_LABELS,
  IGNORED_PAGES,
} from "@/app/constants";
import { Label } from "@/lib/types";
import { ClassificationResponse } from "@/lib/api-types";

// Static variables to prevent duplicate fetching in strict mode
const isDataFetched = { current: false };
const isTrendingFetched = { current: false };

type Node = {
  slug: string;
  x: number;
  y: number;
  size: number;
  count: number;
  title: string;
  labels?: Label[];
  explanation?: string;
  isClassified?: boolean;
  loggedMatch?: boolean;
};

type Edge = {
  source: Node;
  target: Node;
  label: Label;
  labels: Label[];
  strength: number;
};

const EntityGraph = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredLabel, setHoveredLabel] = useState<Label | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dataFetchedRef = useRef(false);
  const dataFetchingInProgressRef = useRef(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const [time, setTime] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const [nodeVisibility, setNodeVisibility] = useState<boolean[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<Label[]>([]);

  // Add loading states
  const [nodesLoaded, setNodesLoaded] = useState(false);
  const [labelsLoaded, setLabelsLoaded] = useState(false);

  // Add a new theme state
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Add a ref for the scrollable container
  const labelsContainerRef = useRef<HTMLDivElement>(null);

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
    }
  }, [nodes, nodesLoaded]);

  // Add useEffect to check theme after mount
  useEffect(() => {
    setIsDarkTheme(document.documentElement.classList.contains("dark"));

    // Optional: Listen for theme changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          setIsDarkTheme(document.documentElement.classList.contains("dark"));
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Update node size calculation to account for trending status
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

  // Update calculateEdges to include explanations
  const calculateEdges = useCallback(() => {
    const newEdges: Edge[] = [];
    const processedPairs = new Set<string>();

    // Only process if we have nodes
    if (!nodes.length) return newEdges;

    nodes.forEach((source) => {
      nodes.forEach((target) => {
        if (source === target) return;

        const pairKey = [source.slug, target.slug].sort().join("-");
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        // Only connect nodes if they share AI-generated labels
        const sharedAiLabels = source.labels?.filter((label) =>
          label.source === 'ai' && target.labels?.some(tl => tl.name === label.name && tl.source === 'ai')
        ) || [];

        if (sharedAiLabels.length > 0) {
          const strength = (source.count + target.count) / 2;
          newEdges.push({
            source,
            target,
            labels: sharedAiLabels,
            label: hoveredLabel && sharedAiLabels.some(l => l.name === hoveredLabel.name)
              ? hoveredLabel
              : sharedAiLabels[0],
            strength,
          });
        }
      });
    });

    return newEdges;
  }, [nodes, hoveredLabel]);

  // Update the useEffect that uses calculateEdges
  useEffect(() => {
    if (nodes.length > 0) {
      setEdges(calculateEdges());
    }
  }, [nodes, calculateEdges]);

  // Center calculation helper - simplified
  const getCenter = useCallback(() => {
    const rect = containerRef.current?.getBoundingClientRect();
    return {
      x: rect ? rect.width / 2 : dimensions.width / 2,
      y: rect ? rect.height / 2 : dimensions.height / 2,
    };
  }, [dimensions.width, dimensions.height]);

  // Update node distribution
  const distributeNodes = (
    nodes: Node[],
    center: { x: number; y: number },
    radius: number,
  ) => {
    const angleStep = (2 * Math.PI) / nodes.length;

    return nodes.map((node, i) => ({
      ...node,
      x: center.x + radius * Math.cos(i * angleStep - Math.PI / 2), // Start from top
      y: center.y + radius * Math.sin(i * angleStep - Math.PI / 2), // Offset by -90 degrees
    }));
  };

  // Update the data fetching effect to use the new calculateNodeSize
  useEffect(() => {
    // Prevent duplicate fetches
    if (dataFetchedRef.current || dataFetchingInProgressRef.current || isDataFetched.current) return;
    dataFetchingInProgressRef.current = true;
    isDataFetched.current = true;

    fetch("/api/track-visit")
      .then((res) => res.json())
      .then((data) => {
        const center = getCenter();
        const radius = Math.min(center.x, center.y) * 0.7;

        // Deduplicate nodes by slug
        const uniqueNodes = new Map();
        data.forEach((entity: Node) => {
          if (!uniqueNodes.has(entity.slug)) {
            uniqueNodes.set(entity.slug, {
              ...entity,
              size: calculateNodeSize(entity.count, data, entity.slug),
              labels: entity.labels || [],
            });
          }
        });

        // Convert back to array and distribute
        const topNodes = Array.from(uniqueNodes.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_VISIBLE_NODES);

        // Distribute nodes evenly
        const distributedNodes = distributeNodes(topNodes, center, radius);
        setNodes(distributedNodes);
        dataFetchedRef.current = true;

        // Only classify nodes that don't have AI-generated labels
        const nodesToClassify = distributedNodes.filter(
          (node) => !node.labels?.some(label => label.source === 'ai')
        );

        if (nodesToClassify.length > 0) {
          console.log(`🔍 Classifying ${nodesToClassify.length} nodes`);

          // Use Promise.all with a map to create all promises at once
          const classificationPromises = nodesToClassify.map((node) =>
            // First get Wikipedia data
            fetch(`https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&titles=${encodeURIComponent(node.title)}&origin=*`)
              .then(res => res.json())
              .then(data => {
                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];
                const extract = pageId !== "-1" ? pages[pageId].extract : "";

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
                  console.error('Error in classification:', data.error);
                  return { labels: [], explanation: '' };
                }

                return {
                  labels: data.labels, // Only use AI labels from classification
                  explanation: data.explanation || ''
                };
              })
              .catch((error) => {
                console.error('Error classifying node:', error);
                return { labels: [], explanation: '' };
              })
          );

          Promise.all(classificationPromises).then((classifications) => {
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

            console.log("Updated nodes with labels:", nodesWithLabels.map(n => ({
              title: n.title,
              labels: n.labels?.map(l => `${l.name} (${l.source})`)
            })));

            setNodes(nodesWithLabels);
            setEdges(calculateEdges());
            dataFetchingInProgressRef.current = false;
          });
        } else {
          console.log("No nodes need classification");
          setEdges(calculateEdges());
          dataFetchingInProgressRef.current = false;
        }
      })
      .catch(error => {
        console.error("Error fetching data:", error);
        dataFetchingInProgressRef.current = false;
      });
  }, [dimensions, calculateEdges, getCenter, calculateNodeSize]);

  // Add effect to recalculate edges when nodes are updated
  useEffect(() => {
    if (nodes.length > 0) {
      setEdges(calculateEdges());
    }
  }, [nodes, calculateEdges]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Modify the uniqueLabels filtering to include trending topics
  const uniqueLabels = useMemo(() => {
    const labelCounts = new Map<string, {
      count: number;
      nodeCount: number;
      source: 'trending' | 'ai';
      hasNodes: boolean; // Track if label has associated nodes
      isHistorical?: boolean; // Flag for historical trending topics
    }>();

    // First add trending topics
    trendingTopics.forEach(topic => {
      labelCounts.set(topic.name, {
        count: 1,
        nodeCount: 0, // Start with 0 node count for trending topics
        source: 'trending',
        hasNodes: false, // Will be updated when processing nodes
        isHistorical: false // Current trending topics are not historical
      });
    });

    // Then add node labels, preserving trending source if it exists
    nodes
      .filter(node => !IGNORED_PAGES.has(node.title as never))
      .forEach((node) => {
        (node.labels || [])
          .filter(label => !IGNORED_LABELS.has(label.name))
          .forEach((label) => {
            const current = labelCounts.get(label.name);
            if (current) {
              labelCounts.set(label.name, {
                count: current.count + (node.count || 0),
                nodeCount: current.nodeCount + 1,
                source: current.source === 'trending' ? 'trending' : label.source,
                hasNodes: true, // This label has associated nodes
                // If it's a trending topic with nodes but not in current trending topics,
                // mark it as historical
                isHistorical: current.source === 'trending' &&
                  !trendingTopics.some(t => t.name === label.name)
              });
            } else {
              labelCounts.set(label.name, {
                count: node.count || 0,
                nodeCount: 1,
                source: label.source,
                hasNodes: true,
                isHistorical: false
              });
            }
          });
      });

    // Get all labels that meet our criteria
    const allLabels = Array.from(labelCounts.entries())
      .filter(([, stats]) => {
        // Keep trending topics that are current
        if (stats.source === 'trending' && !stats.isHistorical) return true;
        // Keep historical trending topics only if they have nodes
        if (stats.source === 'trending' && stats.isHistorical) return stats.hasNodes;
        // Keep AI topics with at least 2 nodes
        return stats.nodeCount >= 2;
      })
      .sort((a, b) => b[1].count - a[1].count);

    // Distribute labels by category with priority and limits
    const distributeLabelsByCategory = (
      allLabels: Array<[string, {
        count: number;
        nodeCount: number;
        source: 'trending' | 'ai';
        hasNodes: boolean;
        isHistorical?: boolean;
      }]>
    ) => {
      // Filter labels by category
      const currentTrendingCandidates = allLabels
        .filter(([, stats]) => stats.source === 'trending' && !stats.isHistorical);

      const historicalTrendingCandidates = allLabels
        .filter(([, stats]) => stats.source === 'trending' && stats.isHistorical && stats.hasNodes);

      const aiCandidates = allLabels
        .filter(([, stats]) => stats.source === 'ai');

      // Simple approach: take all labels up to MAX_VISIBLE_LABELS

      // Take all current trending labels first (up to a reasonable limit)
      const maxCurrentTrending = Math.min(currentTrendingCandidates.length, 5);

      // Take all historical trending labels with nodes
      const maxHistoricalTrending = historicalTrendingCandidates.length;

      // Calculate how many AI labels we can include
      const remainingForAi = MAX_VISIBLE_LABELS - maxCurrentTrending - maxHistoricalTrending;
      const maxAiLabels = Math.max(0, remainingForAi);

      // If we don't have enough labels total, adjust the AI count
      const finalAiCount = Math.min(aiCandidates.length, maxAiLabels);

      // Create the final label arrays
      const currentTrendingLabels = currentTrendingCandidates
        .slice(0, maxCurrentTrending)
        .map(([name]) => ({
          name,
          source: 'trending' as const,
          isHistorical: false
        }));

      const historicalTrendingLabels = historicalTrendingCandidates
        .slice(0, maxHistoricalTrending)
        .map(([name]) => ({
          name,
          source: 'trending' as const,
          isHistorical: true
        }));

      let aiLabels = aiCandidates
        .slice(0, finalAiCount)
        .map(([name]) => ({
          name,
          source: 'ai' as const,
          isHistorical: false
        }));

      // Check if we need to add more labels to reach MAX_VISIBLE_LABELS
      let allLabelsArray = [...currentTrendingLabels, ...historicalTrendingLabels, ...aiLabels];

      // If we have fewer than MAX_VISIBLE_LABELS, add more AI labels if available
      if (allLabelsArray.length < MAX_VISIBLE_LABELS && aiCandidates.length > finalAiCount) {
        const additionalAiNeeded = MAX_VISIBLE_LABELS - allLabelsArray.length;
        const additionalAiAvailable = aiCandidates.length - finalAiCount;
        const additionalAiToAdd = Math.min(additionalAiNeeded, additionalAiAvailable);

        const moreAiLabels = aiCandidates
          .slice(finalAiCount, finalAiCount + additionalAiToAdd)
          .map(([name]) => ({
            name,
            source: 'ai' as const,
            isHistorical: false
          }));

        aiLabels = [...aiLabels, ...moreAiLabels];
        allLabelsArray = [...currentTrendingLabels, ...historicalTrendingLabels, ...aiLabels];
      }

      // Ensure we don't exceed MAX_VISIBLE_LABELS
      allLabelsArray = allLabelsArray.slice(0, MAX_VISIBLE_LABELS);

      // Debug logging for label distribution
      console.log("Label distribution:", {
        maxVisible: MAX_VISIBLE_LABELS,
        currentTrending: currentTrendingLabels.length,
        historicalTrending: historicalTrendingLabels.length,
        ai: allLabelsArray.length - (currentTrendingLabels.length + historicalTrendingLabels.length),
        totalShown: allLabelsArray.length
      });

      // Return the categories separately for the caller to combine as needed
      return {
        currentTrendingLabels: allLabelsArray.filter(l => l.source === 'trending' && !l.isHistorical),
        historicalTrendingLabels: allLabelsArray.filter(l => l.source === 'trending' && l.isHistorical),
        aiLabels: allLabelsArray.filter(l => l.source === 'ai')
      };
    };

    // Use our new distribution function
    const { currentTrendingLabels, historicalTrendingLabels, aiLabels } =
      distributeLabelsByCategory(allLabels);

    // Combine all categories in the desired order
    return [...currentTrendingLabels, ...historicalTrendingLabels, ...aiLabels];
  }, [nodes, trendingTopics]);

  // Only log unique labels when they change and exist
  useEffect(() => {
    if (uniqueLabels.length > 0) {
      const trendingCount = uniqueLabels.filter(label => label.source === 'trending' && !label.isHistorical).length;
      const historicalCount = uniqueLabels.filter(label => label.source === 'trending' && label.isHistorical).length;
      const aiCount = uniqueLabels.filter(label => label.source === 'ai').length;

      console.log("🏷️ Categories:", {
        total: uniqueLabels.length,
        trending: trendingCount,
        historical: historicalCount,
        ai: aiCount
      });
    }
  }, [uniqueLabels]);

  // Add CSS class for node transitions
  const getNodeStyle = useCallback(
    (index: number) => {
      return {
        opacity: nodeVisibility[index] ? 1 : 0,
        transition: `opacity 150ms ${index * 15}ms, transform 150ms ${index * 15}ms`,
      };
    },
    [nodeVisibility],
  );

  // Single effect to trigger all nodes
  useEffect(() => {
    if (nodes.length > 0) {
      // Start all nodes as invisible
      setNodeVisibility(new Array(nodes.length).fill(false));
      // Trigger reflow
      requestAnimationFrame(() => {
        setNodeVisibility(new Array(nodes.length).fill(true));
      });
    }
  }, [nodes]);

  // Add category colors
  const categoryColors = useMemo(() => {
    const colors = new Map<string, string>();

    uniqueLabels.forEach((label, index) => {
      // Generate a pleasing HSL color
      const hue = (index * 137.508) % 360; // Golden angle approximation
      colors.set(label.name, `hsl(${hue}, 70%, 65%)`);
    });

    return colors;
  }, [uniqueLabels]);

  // Update node color calculation
  const getNodeColor = useCallback((node: Node, index: number) => {
    const validLabels = node.labels?.filter(label => !IGNORED_LABELS.has(label.name)) || [];

    if (hoveredLabel && validLabels.length > 0) {
      return validLabels.some(l => l.name === hoveredLabel.name)
        ? categoryColors.get(hoveredLabel.name) || `hsla(${index * 55}, 70%, 65%, 0.9)`
        : isDarkTheme ? "hsla(0, 0%, 75%, 0.1)" : "hsla(0, 0%, 25%, 0.1)";
    }

    if (!validLabels.length) {
      return "hsla(0, 0%, 75%, 0.4)";
    }

    return categoryColors.get(validLabels[0].name) || `hsla(${index * 55}, 70%, 65%, 0.7)`;
  }, [hoveredLabel, categoryColors, isDarkTheme]);

  // Update getEdgeStyle to handle Labels
  const getEdgeStyle = (edge: Edge) => {
    const isHighlighted = hoveredLabel && edge.labels.some(l => l.name === hoveredLabel.name);

    if (isHighlighted) {
      const categoryColor =
        categoryColors.get(hoveredLabel.name) || "hsl(210, 100%, 75%)";
      const hue = parseInt(categoryColor.match(/hsl\((\d+)/)?.[1] || "210");

      const dashLength = 1.5 + Math.sin(time * 0.1) * 0.5;
      const gapLength = 1.5 + Math.cos(time * 0.15) * 0.5;
      const flicker = 0.4 + Math.sin(time * 0.3) * 0.1;

      return {
        stroke: `hsl(${hue}, 80%, 75%, ${flicker})`,
        filter: "url(#glow)",
        strokeWidth: 1.0,
        strokeDasharray: `${dashLength},${gapLength}`,
        strokeDashoffset: -time % 8,
        transition: "stroke 0.3s ease-in-out",
      };
    }

    return {
      stroke: isDarkTheme ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.2)",
      strokeWidth: 0.3,
      strokeDasharray: "2,4",
      transition: "all 0.3s ease-in-out",
    };
  };

  // Add SVG definition for the glow effect
  const SvgFilters = () => (
    <defs>
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
        <feColorMatrix
          in="coloredBlur"
          type="matrix"
          values={
            isDarkTheme
              ? "0 0 0 0 0.5  0 0 0 0 0.7  0 0 0 0 1  0 0 0 1 0"
              : "0 0 0 0 0.2  0 0 0 0 0.4  0 0 0 0 0.8  0 0 0 1 0"
          }
        />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="trending-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
        <feColorMatrix
          in="coloredBlur"
          type="matrix"
          values="0 0 0 0 0.055  0 0 0 0 0.647  0 0 0 0 0.914  0 0 0 0.3 0"
        />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>
  );

  useEffect(() => {
    const animate = () => {
      setTime((prev) => {
        return prev + 1;
      });
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (containerRef.current && nodes.length > 0) {
      const newEdges = calculateEdges();
      setEdges(newEdges);
    }
  }, [containerRef, nodes, calculateEdges, getCenter]);

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
        router.push(`/wiki/${randomNode.slug}`);
      }
    };

    document.addEventListener("selectRandomNode", handleRandomNode);
    return () =>
      document.removeEventListener("selectRandomNode", handleRandomNode);
  }, [nodes, router]);

  // Add the pulse animation style
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { filter: url(#trending-glow) brightness(0.95); }
        50% { filter: url(#trending-glow) brightness(1.05); }
        100% { filter: url(#trending-glow) brightness(0.95); }
      }
    `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Add custom scrollbar styling
  useEffect(() => {
    const scrollbarStyle = document.createElement('style');
    scrollbarStyle.textContent = `
      /* Custom scrollbar styling for Chrome, Safari and Opera */
      .labels-container::-webkit-scrollbar {
        height: 2px;
        width: 2px;
      }
      
      .labels-container::-webkit-scrollbar-track {
        background: transparent;
      }
      
      .labels-container::-webkit-scrollbar-thumb {
        background-color: rgba(0, 0, 0, 0.15);
        border-radius: 10px;
      }

      .labels-container::-webkit-scrollbar-thumb:hover {
        background-color: rgba(0, 0, 0, 0.25);
      }
      
      /* Custom scrollbar for Firefox */
      .labels-container {
        scrollbar-width: none;
      }
      
      /* Dark mode adjustments */
      .dark .labels-container::-webkit-scrollbar-thumb {
        background-color: rgba(255, 255, 255, 0.15);
      }

      .dark .labels-container::-webkit-scrollbar-thumb:hover {
        background-color: rgba(255, 255, 255, 0.25);
      }
    `;
    document.head.appendChild(scrollbarStyle);

    return () => {
      document.head.removeChild(scrollbarStyle);
    };
  }, []);

  // Add handler for trending topics changes
  const handleTrendingTopicsChange = useCallback((topics: Label[]) => {
    setTrendingTopics(topics);
    // Update nodes with trending labels
    setNodes(prevNodes => prevNodes.map(node => {
      const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
      const matchingTopic = topics.find(topic =>
        topic.name.toLowerCase().replace(/\s+/g, '-') === nodeSlug
      );

      if (matchingTopic) {
        // Keep all existing labels, only update/add trending ones
        const existingNonTrendingLabels = (node.labels || []).filter(l => l.source === 'ai');
        return {
          ...node,
          labels: [...existingNonTrendingLabels, { ...matchingTopic, source: 'trending', isHistorical: false }]
        };
      }

      // If no matching topic, remove any old trending labels but keep AI ones
      return {
        ...node,
        labels: (node.labels || []).filter(l => l.source === 'ai')
      };
    }));
  }, []);

  // Add trending topics fetching
  useEffect(() => {
    const trendingFetchedRef = { current: false };
    const trendingFetchingInProgressRef = { current: false };

    const fetchTrendingTopics = async () => {
      // Skip if already fetching
      if (trendingFetchingInProgressRef.current || (isTrendingFetched.current && !trendingFetchedRef.current)) return;
      trendingFetchingInProgressRef.current = true;

      try {
        const response = await fetch('/api/trending');
        const data = await response.json();
        const topics = data.labels.map((label: Label) => ({
          ...label,
          source: 'trending' as const
        }));
        handleTrendingTopicsChange(topics);
        trendingFetchedRef.current = true;
        isTrendingFetched.current = true;
      } catch (error) {
        console.error('Error fetching trending topics:', error);
      } finally {
        trendingFetchingInProgressRef.current = false;
      }
    };

    fetchTrendingTopics();

    // Only set up interval if we're in the browser
    let interval: NodeJS.Timeout | null = null;
    if (typeof window !== 'undefined') {
      interval = setInterval(fetchTrendingTopics, 5 * 60 * 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [handleTrendingTopicsChange]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-0"
      onClick={(e) => {
        // Only clear if clicking directly on the container (not on a child element)
        if (e.target === e.currentTarget) {
          setSelectedLabel(null);
          setHoveredLabel(null);
        }
      }}
    >
      <svg ref={svgRef} width="100%" height="100%" className="z-10 pt-16">
        <SvgFilters />
        <g className="edges">
          {edges.map((edge, i) => {
            return (
              <g
                key={`edge-${i}`}
                className="group"
                onMouseEnter={() => setHoveredLabel(edge.label)}
                onMouseLeave={() => setHoveredLabel(null)}
                onTouchStart={() => setHoveredLabel(edge.label)}
                onTouchEnd={() => setHoveredLabel(null)}
              >
                <line
                  x1={edge.source.x}
                  y1={edge.source.y}
                  x2={edge.target.x}
                  y2={edge.target.y}
                  style={getEdgeStyle(edge)}
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

          return (
            <g
              key={nodeKey}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => router.push(`/wiki/${node.slug}`)}
              className="group cursor-pointer"
              style={getNodeStyle(i)}
            >
              <circle
                r={node.size}
                fill={getNodeColor(node, i)}
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

      {/* Single unified labels section */}
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