"use client";

import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const MAX_NODES = 30; // We can adjust this number as needed

const EntityGraph = () => {
  const [nodes, setNodes] = useState([]);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch entities from the API
  useEffect(() => {
    fetch("/api/track-visit")
      .then((res) => res.json())
      .then((data) => {
        // Sort by count and take top N nodes
        const topNodes = data
          .sort(
            (a: { count: number }, b: { count: number }) => b.count - a.count,
          )
          .slice(0, MAX_NODES);

        const centerX = dimensions.width * 0.5;
        const centerY = dimensions.height * 0.5;
        const radius = Math.min(dimensions.width, dimensions.height) * 0.35;

        const transformedNodes = topNodes.map(
          (entity: { count: number }, index: number) => {
            const angle = (index / topNodes.length) * Math.PI * 2;

            return {
              ...entity,
              x: centerX + radius * Math.cos(angle),
              y: centerY + radius * Math.sin(angle),
              size: calculateNodeSize(entity.count, topNodes),
            };
          },
        );
        setNodes(transformedNodes);
      })
      .catch((error) => console.error("Error fetching entities:", error));
  }, [dimensions]);

  const calculateNodeSize = (count: number, data: { count: number }[]) => {
    const maxCount = Math.max(...data.map((d) => d.count));
    const minSize = 4;
    const maxSize = 12;
    return minSize + (count / maxCount) * (maxSize - minSize);
  };

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleNodeClick = (slug: string) => {
    router.push(`/wiki/${slug}`);
  };

  // Add the style in a useEffect
  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
            @keyframes fadeIn {
                0% { opacity: 0; }
                50% { opacity: 0; }  /* Stay invisible for half the duration */
                100% { opacity: 1; }
            }
        `;
    document.head.appendChild(style);

    // Cleanup
    return () => {
      document.head.removeChild(style);
    };
  }, []); // Empty dependency array means this runs once on mount

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 w-full h-full"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 0, // Ensure graph is behind the leaderboard
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        className="bg-transparent"
        style={{ position: "absolute" }}
      >
        {nodes.map(
          (
            node: {
              slug: string;
              x: number;
              y: number;
              size: number;
              count: number;
              title: string;
            },
            i: number,
          ) => (
            <g
              key={node.slug}
              transform={`translate(${node.x},${node.y})`}
              onClick={() => handleNodeClick(node.slug)}
              className="cursor-pointer group"
              style={{
                pointerEvents: "all",
                animation: `fadeIn ${1 + i * 0.2}s ease-in forwards`,
              }}
            >
              {/* Node circle with hover effects */}
              <circle
                r={node.size}
                className="transition-all duration-800"
                style={{
                  fill: `hsl(${(i * 55) % 360}, 100%, ${65 + ((i * 5) % 15)}%)`,
                  opacity: 0.25,
                  stroke: "black",
                  strokeWidth: 0.1,
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.opacity = "0.6";
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.opacity = "0.2";
                }}
              />

              {/* Node label */}
              <text
                dy="-10"
                textAnchor="middle"
                className="fill-gray-700 dark:fill-gray-300 text-xs opacity-0 
                                     group-hover:opacity-100 transition-opacity duration-300
                                     font-mono select-none"
              >
                {node.title}
              </text>

              {/* View count */}
              <text
                dy="20"
                textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400 text-xs opacity-0 
                                     group-hover:opacity-100 transition-opacity duration-300
                                     select-none"
              >
                {node.count} views
              </text>
            </g>
          ),
        )}
      </svg>
    </div>
  );
};

// Remove the style creation from outside the component
export default EntityGraph;
