"use client";

import React, {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";

type Node = {
  slug: string;
  x: number;
  y: number;
  size: number;
  count: number;
  title: string;
  labels?: string[];
  isClassified?: boolean;
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
  const MAX_VISIBLE_NODES = 30;
  const svgRef = useRef<SVGSVGElement>(null);
  const [time, setTime] = useState(0);
  const animationFrameRef = useRef<number | null>(null);
  const [nodeVisibility, setNodeVisibility] = useState<boolean[]>([]);

  // Add loading states
  const [nodesLoaded, setNodesLoaded] = useState(false);
  const [labelsLoaded, setLabelsLoaded] = useState(false);

  // Add a new theme state
  const [isDarkTheme, setIsDarkTheme] = useState(false);

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

  const calculateNodeSize = (count: number, data: { count: number }[]) => {
    const maxCount = Math.max(...data.map((d) => d.count));
    return 6 + (count / maxCount) * 12; // Reduced from 8 + ... * 16
  };

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

  // Center calculation helper
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

  useEffect(() => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    fetch("/api/track-visit")
      .then((res) => res.json())
      .then((data) => {
        const center = getCenter();
        const radius = Math.min(center.x, center.y) * 0.7;

        // Sort and slice before distribution
        const topNodes = data
          .sort(
            (a: { count: number }, b: { count: number }) => b.count - a.count,
          )
          .slice(0, MAX_VISIBLE_NODES)
          .map((entity: Node) => ({
            ...entity,
            size: calculateNodeSize(
              entity.count,
              data.slice(0, MAX_VISIBLE_NODES),
            ),
            labels: entity.labels || [], // Keep existing labels if any
          }));

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
            // Create a map of new classifications
            const newClassifications = new Map(
              nodesToClassify.map((node, i) => [
                node.title,
                classifications[i].labels || [],
              ]),
            );

            const nodesWithLabels = distributedNodes.map((node) => ({
              ...node,
              labels: newClassifications.get(node.title) || node.labels || [],
              x: node.x,
              y: node.y,
            }));
            setNodes(nodesWithLabels);
            setEdges(calculateEdges());
          });
        } else {
          // If all nodes have labels, just calculate edges
          setEdges(calculateEdges());
        }
      });
  }, [dimensions, calculateEdges, getCenter]);

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

  // Get unique labels for legend - memoized to prevent recalculation and limit to top 5
  const uniqueLabels = useMemo(() => {
    const labelCounts = new Map<string, number>();
    nodes.forEach((node) => {
      node.labels?.forEach((label) =>
        labelCounts.set(label, (labelCounts.get(label) || 0) + 1),
      );
    });

    // Sort by frequency and take top 5
    return Array.from(labelCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
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

  // Simplify node color handling
  const getNodeColor = (node: Node, index: number) => {
    if (!node.labels?.length) {
      return "hsla(0, 0%, 75%, 0.7)";
    }

    if (hoveredLabel) {
      return node.labels.includes(hoveredLabel)
        ? categoryColors.get(hoveredLabel) ||
            `hsla(${index * 55}, 70%, 65%, 0.9)`
        : isDarkTheme
          ? "hsla(0, 0%, 75%, 0.4)"
          : "hsla(0, 0%, 25%, 0.4)";
    }

    return (
      categoryColors.get(node.labels[0]) || `hsla(${index * 55}, 70%, 65%, 0.7)`
    );
  };

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

  // Enhance SVG filters for better glow effect
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
    </defs>
  );

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

  useEffect(() => {
    const animate = () => {
      setTime((prev) => {
        console.log("Time:", prev); // Debug log
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

  return (
    <div ref={containerRef} className="fixed inset-0 z-0">
      <svg ref={svgRef} width="100%" height="100%" className="z-10">
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
          return (
            <g
              key={node.slug}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => router.push(`/wiki/${node.slug}`)}
              className="group cursor-pointer"
              style={getNodeStyle(i)}
            >
              <circle
                r={node.size}
                fill={getNodeColor(node, i)}
                stroke={
                  isDarkTheme
                    ? "rgba(255, 255, 255, 0.3)"
                    : "rgba(0, 0, 0, 0.3)"
                }
                strokeWidth={0.25}
                className="transition-all duration-150 hover:opacity-90 hover:scale-110"
                transform={`scale(${nodeVisibility[i] ? 1 : 0.5})`}
              />
              <text
                dy="-10"
                textAnchor="middle"
                className={`text-xs transition-opacity duration-150 pointer-events-none 
                  ${isDarkTheme ? "fill-white" : "fill-gray-800"} 
                  ${
                    hoveredLabel && node.labels?.includes(hoveredLabel)
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
              >
                {node.title}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Replace the existing legend div with this new responsive version */}
      <div className="fixed top-0 left-0 right-0 p-2 bg-white/90 dark:bg-gray-900/90 backdrop-blur-sm z-20 transition-colors duration-200">
        <div className="max-w-screen-lg mx-auto">
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
  );
};

export default EntityGraph;
