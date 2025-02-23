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
  IGNORED_PAGES
} from "@/app/constants";
import TrendingTopics from "./TrendingTopics";

type Node = {
  slug: string;
  x: number;
  y: number;
  size: number;
  count: number;
  title: string;
  labels?: string[];
  isClassified?: boolean;
  loggedMatch?: boolean;
};

type Edge = {
  source: Node;
  target: Node;
  label: string;
  labels: string[];
  strength: number; // Combined view count
};

const EntityGraph = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const dataFetchedRef = useRef(false); // Prevent duplicate fetches
  const svgRef = useRef<SVGSVGElement>(null);
  const [time, setTime] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const [nodeVisibility, setNodeVisibility] = useState<boolean[]>([]);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);

  // Add loading states
  const [nodesLoaded, setNodesLoaded] = useState(false);
  const [labelsLoaded, setLabelsLoaded] = useState(false);

  // Add a new theme state
  const [isDarkTheme, setIsDarkTheme] = useState(false);

  // Add state for hovering trending topics
  const [hoveredTrendingTopic, setHoveredTrendingTopic] = useState<string | null>(null);

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
      const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');
      return nodeSlug === topicSlug;
    });
    return isTrending ? baseSize * 1.5 : baseSize;
  }, [trendingTopics]);

  // Convert calculateEdges to useCallback and fix the nodes parameter issue
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

        const sharedLabels =
          source.labels?.filter((label) => target.labels?.includes(label)) ||
          [];

        if (sharedLabels.length > 0) {
          const strength = (source.count + target.count) / 2;
          newEdges.push({
            source,
            target,
            labels: sharedLabels,
            label:
              hoveredLabel && sharedLabels.includes(hoveredLabel)
                ? hoveredLabel
                : sharedLabels[0],
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
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

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

        // Only classify nodes that don't have labels
        const nodesToClassify = distributedNodes.filter(
          (node) => !node.labels?.length,
        );

        if (nodesToClassify.length > 0) {
          Promise.all(
            nodesToClassify.map((node) =>
              fetch("/api/classify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: node.title }),
              }).then((res) => res.json()),
            ),
          ).then((classifications) => {
            const newClassifications = new Map(
              nodesToClassify.map((node, i) => [
                node.slug,
                classifications[i].labels || [],
              ]),
            );

            const nodesWithLabels = distributedNodes.map((node) => ({
              ...node,
              labels: newClassifications.get(node.slug) || node.labels || [],
            }));
            setNodes(nodesWithLabels);
            setEdges(calculateEdges());
          });
        } else {
          setEdges(calculateEdges());
        }
      });
  }, [dimensions, calculateEdges, getCenter, calculateNodeSize]);

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

  // Modify the uniqueLabels filtering to show more connections
  const uniqueLabels = useMemo(() => {
    const labelCounts = new Map<string, { count: number; nodeCount: number }>();

    nodes
      .filter(node => !IGNORED_PAGES.has(node.title as never))
      .forEach((node) => {
        (node.labels || [])
          .filter(label => !IGNORED_LABELS.has(label))
          .forEach((label) => {
            const current = labelCounts.get(label) || { count: 0, nodeCount: 0 };
            labelCounts.set(label, {
              count: current.count + (node.count || 0),
              nodeCount: current.nodeCount + 1,
            });
          });
      });

    // Only show labels that have 2+ visible nodes
    return Array.from(labelCounts.entries())
      .filter(([, stats]) => stats.nodeCount >= 2) // Require 2+ nodes
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, MAX_VISIBLE_LABELS)
      .map(([label]) => label);
  }, [nodes]);

  // Only log unique labels when they change and exist
  useEffect(() => {
    if (uniqueLabels.length > 0) {
      console.log("🏷️ Categories:", uniqueLabels.length);
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
      colors.set(label, `hsl(${hue}, 70%, 65%)`);
    });

    return colors;
  }, [uniqueLabels]);

  // Update node color to properly highlight trending and hovered nodes
  const getNodeColor = useCallback((node: Node, index: number) => {
    const validLabels = node.labels?.filter(label => !IGNORED_LABELS.has(label)) || [];
    const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
    const isTrending = trendingTopics.some(topic => {
      const topicSlug = topic.toLowerCase().replace(/\s+/g, '-');
      return nodeSlug === topicSlug;
    });
    const isHoveredTrending = hoveredTrendingTopic &&
      nodeSlug === hoveredTrendingTopic.toLowerCase().replace(/\s+/g, '-');

    // Trending topic hover takes precedence
    if (isHoveredTrending) {
      return isDarkTheme ? "rgba(14, 165, 233, 1)" : "rgba(14, 165, 233, 1)"; // Full opacity sky-500
    }

    // Active trending topic
    if (isTrending) {
      return isDarkTheme ? "rgba(14, 165, 233, 0.8)" : "rgba(14, 165, 233, 0.8)"; // sky-500
    }

    // Rest of the color logic...
    if (hoveredLabel && validLabels.length > 0) {
      return validLabels.includes(hoveredLabel)
        ? categoryColors.get(hoveredLabel) || `hsla(${index * 55}, 70%, 65%, 0.9)`
        : isDarkTheme ? "hsla(0, 0%, 75%, 0.1)" : "hsla(0, 0%, 25%, 0.1)"; // More contrast for non-matching
    }

    if (!validLabels.length) {
      return "hsla(0, 0%, 75%, 0.4)";
    }

    return categoryColors.get(validLabels[0]) || `hsla(${index * 55}, 70%, 65%, 0.7)`;
  }, [hoveredLabel, categoryColors, isDarkTheme, trendingTopics, hoveredTrendingTopic]);

  // Enhance edge styling for category-colored electricity
  const getEdgeStyle = (edge: Edge) => {
    const isHighlighted = hoveredLabel && edge.labels.includes(hoveredLabel);

    if (isHighlighted) {
      const categoryColor =
        categoryColors.get(hoveredLabel!) || "hsl(210, 100%, 75%)";
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

  return (
    <div ref={containerRef} className="fixed inset-0 z-0">
      <svg ref={svgRef} width="100%" height="100%" className="z-10 pt-16">
        <SvgFilters />
        <g className="edges">
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.source.x}
              y1={edge.source.y}
              x2={edge.target.x}
              y2={edge.target.y}
              style={getEdgeStyle(edge)}
              className="transition-all duration-300"
            />
          ))}
        </g>

        {nodes.map((node, i) => {
          const nodeKey = `node-${node.slug}-${i}`;
          const nodeSlug = node.title.toLowerCase().replace(/\s+/g, '-');
          const isTrending = trendingTopics.some(topic =>
            topic.toLowerCase().replace(/\s+/g, '-') === nodeSlug
          );
          const isHoveredTrending = hoveredTrendingTopic &&
            nodeSlug === hoveredTrendingTopic.toLowerCase().replace(/\s+/g, '-');

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
                  isHoveredTrending || isTrending
                    ? "rgba(14, 165, 233, 0.5)"
                    : isDarkTheme
                      ? "rgba(255, 255, 255, 0.3)"
                      : "rgba(0, 0, 0, 0.3)"
                }
                strokeWidth={isHoveredTrending ? 1.5 : isTrending ? 0.75 : 0.25}
                className={`transition-all duration-300 hover:opacity-90`}
                filter={isTrending ? "url(#trending-glow)" : undefined}
                style={isTrending ? {
                  animation: isHoveredTrending ? 'none' : 'pulse 3s ease-in-out infinite'
                } : undefined}
              />
              <text
                dy="-10"
                textAnchor="middle"
                className={`text-xs transition-opacity duration-300 pointer-events-none 
                  ${isDarkTheme ? "fill-white" : "fill-gray-800"} 
                  ${(hoveredLabel && node.labels?.includes(hoveredLabel)) || isHoveredTrending
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100"
                  }`}
              >
                {node.title}
              </text>
              {isTrending && (
                <g transform={`translate(${-node.size * 0.6}, ${-node.size * 5})`}
                  className={`transition-all duration-300 ${isHoveredTrending || hoveredTrendingTopic === node.title ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
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

      {/* Move TrendingTopics to top */}
      <div className="fixed top-0 left-0 right-0 z-20">
        <div className="flex flex-col">
          {/* Trending Topics */}
          <div className="flex justify-center px-4 py-2">
            <TrendingTopics
              onTrendingTopicsChange={setTrendingTopics}
              onTopicHover={setHoveredTrendingTopic}
            />
          </div>

          {/* Popular Categories */}
          <div className="p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm transition-colors duration-200">
            <div className="max-w-screen-lg mx-auto">
              <div className="flex flex-col items-center">
                <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">
                  popular categories
                </span>
                <div className="flex flex-wrap items-center justify-center gap-2">
                  {uniqueLabels.map((label) => (
                    <div
                      key={label}
                      className="flex items-center space-x-2 cursor-pointer 
                               hover:bg-gray-100/50 dark:hover:bg-gray-800/50 
                               px-3 py-1.5 rounded-full transition-colors"
                      onMouseEnter={() => setHoveredLabel(label)}
                      onMouseLeave={() => setHoveredLabel(null)}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: categoryColors.get(label) }}
                      />
                      <span className="text-xs text-gray-800 dark:text-white/90 font-medium">
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EntityGraph;
