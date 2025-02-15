"use client";

import React, { useEffect, useState, useRef, useMemo } from "react";
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
};

const EntityGraph = () => {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const animationRef = useRef<number>();
  const dataFetchedRef = useRef(false); // Prevent duplicate fetches
  const MAX_VISIBLE_NODES = 15; // Limit visible nodes for performance

  const calculateNodeSize = (count: number, data: { count: number }[]) => {
    const maxCount = Math.max(...data.map((d) => d.count));
    return 6 + (count / maxCount) * 12; // Reduced from 8 + ... * 16
  };

  // Calculate edges between nodes that share labels
  const calculateEdges = (nodes: Node[]) => {
    const newEdges: Edge[] = [];
    const processedPairs = new Set<string>();

    nodes.forEach((source) => {
      nodes.forEach((target) => {
        if (source === target) return;

        const pairKey = [source.slug, target.slug].sort().join('-');
        if (processedPairs.has(pairKey)) return;
        processedPairs.add(pairKey);

        const sharedLabels = source.labels?.filter(label =>
          target.labels?.includes(label)
        ) || [];

        if (sharedLabels.length > 0) {
          newEdges.push({
            source,
            target,
            label: sharedLabels[0] // Use first shared label for simplicity
          });
        }
      });
    });
    return newEdges;
  };

  useEffect(() => {
    if (dataFetchedRef.current) return;
    dataFetchedRef.current = true;

    fetch("/api/track-visit")
      .then((res) => res.json())
      .then((data) => {
        // Sort by view count and take top N nodes
        const topNodes = data
          .filter(d => d.labels?.length > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, MAX_VISIBLE_NODES);

        console.log("Node stats:", {
          total: data.length,
          classified: data.filter(d => d.labels?.length > 0).length,
          showing: topNodes.length,
          labels: new Set(topNodes.flatMap(d => d.labels || [])).size
        });

        const transformedNodes = topNodes.map((entity: Node, index: number) => {
          const angle = (index / topNodes.length) * Math.PI * 2;
          const radius = Math.min(dimensions.width, dimensions.height) * 0.35;

          return {
            ...entity,
            x: (dimensions.width * 0.5) + (radius * Math.cos(angle)),
            y: (dimensions.height * 0.5) + (radius * Math.sin(angle)),
            size: calculateNodeSize(entity.count, topNodes),
            labels: entity.labels || [],
          };
        });

        setNodes(transformedNodes);
        const newEdges = calculateEdges(transformedNodes);
        setEdges(newEdges);
      });
  }, [dimensions]);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Get unique labels for legend - memoized to prevent recalculation
  const uniqueLabels = useMemo(() => {
    const labels = new Set<string>();
    nodes.forEach(node => {
      node.labels?.forEach(label => labels.add(label));
    });
    return Array.from(labels);
  }, [nodes]);

  // Only log unique labels when they change and exist
  useEffect(() => {
    if (uniqueLabels.length > 0) {
      console.log("🏷️ Categories:", uniqueLabels.length);
    }
  }, [uniqueLabels]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-0">
      <svg width="100%" height="100%" className="z-10">
        {/* Draw edges first so they appear behind nodes */}
        <g className="edges">
          {edges.map((edge, i) => (
            <line
              key={`edge-${i}`}
              x1={edge.source.x}
              y1={edge.source.y}
              x2={edge.target.x}
              y2={edge.target.y}
              stroke={hoveredLabel === edge.label ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.2)'}
              strokeWidth={hoveredLabel === edge.label ? 2 : 1}
              className="transition-all duration-150"
            />
          ))}
        </g>

        {nodes.map((node, i) => (
          <g
            key={node.slug}
            transform={`translate(${node.x},${node.y})`}
            onClick={() => router.push(`/wiki/${node.slug}`)}
            className="group cursor-pointer"
          >
            <circle
              r={node.size}
              fill={`hsla(${i * 55}, 80%, 65%, ${hoveredLabel ?
                (node.labels?.includes(hoveredLabel) ? 0.9 : 0.2) :
                0.7
                })`}
              stroke="white"
              strokeWidth={0.5}
              className="transition-all duration-150 hover:opacity-90 hover:scale-110"
            />
            <text
              dy="-10"
              textAnchor="middle"
              className="text-xs fill-white opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
            >
              {node.title}
            </text>
          </g>
        ))}
      </svg>

      {/* Label legend with higher z-index */}
      <div className="fixed bottom-4 left-4 p-4 bg-gray-900/90 rounded-lg z-20 shadow-lg">
        <div className="text-xs text-gray-200 font-medium mb-2">Categories</div>
        <div className="space-y-2">
          {uniqueLabels.map((label) => (
            <div
              key={label}
              className="flex items-center space-x-2 cursor-pointer hover:bg-gray-800/50 px-2 py-1 rounded transition-colors"
              onMouseEnter={() => setHoveredLabel(label)}
              onMouseLeave={() => setHoveredLabel(null)}
            >
              <div className="w-2 h-2 rounded-full bg-white/80" />
              <span className="text-xs text-white/90">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EntityGraph;
