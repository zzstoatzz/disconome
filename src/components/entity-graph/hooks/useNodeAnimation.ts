import { useState, useEffect, useRef } from 'react';
import { Node, NodePositions } from '../types';

// Define a type for orbital nodes used in the loading animation
type OrbitalNode = {
    size: number;
    color: string;
    style: React.CSSProperties;
};

export const useNodeAnimation = (
    isInitialLoading: boolean,
    isTransitioning: boolean
) => {
    const [orbitalNodes, setOrbitalNodes] = useState<OrbitalNode[]>([]);
    const [animationProgress, setAnimationProgress] = useState(0);
    const animationFrameRef = useRef<number | null>(null);

    // Generate orbital nodes for the loading animation
    useEffect(() => {
        if (isInitialLoading) {
            // Generate a set of orbital nodes with varying properties
            const nodes: OrbitalNode[] = [];

            // Create 12 orbital nodes with varying properties
            for (let i = 0; i < 12; i++) {
                // Calculate position based on angle
                const angle = (i / 12) * Math.PI * 2;
                const radius = 50; // Fixed radius for cleaner orbit

                // Generate a color from a pleasing palette
                const colors = [
                    '#38bdf8', // sky-400
                    '#818cf8', // indigo-400
                    '#a78bfa', // purple-400
                    '#f472b6', // pink-400
                    '#34d399', // emerald-400
                    '#fb923c', // orange-400
                ];
                const color = colors[i % colors.length];

                // Create the node
                nodes.push({
                    size: 3 + (i % 3),
                    color,
                    style: {
                        transform: `translate(${Math.cos(angle) * radius}px, ${Math.sin(angle) * radius}px)`,
                        animation: `orbit ${8 + (i % 4) * 2}s linear infinite`,
                    },
                });
            }

            setOrbitalNodes(nodes);
        }
    }, [isInitialLoading]);

    // Animation for node movement during transition
    useEffect(() => {
        if (isTransitioning) {
            let startTime: number | null = null;
            const duration = 1200; // Animation duration in ms

            const animate = (timestamp: number) => {
                if (!startTime) startTime = timestamp;
                const elapsed = timestamp - startTime;
                const progress = Math.min(elapsed / duration, 1);

                // Use easing function for smooth animation
                // Starts slow, accelerates, then slows down at the end
                const easeInOutCubic = (t: number) =>
                    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

                const easedProgress = easeInOutCubic(progress);
                setAnimationProgress(easedProgress);

                if (progress < 1) {
                    animationFrameRef.current = requestAnimationFrame(animate);
                }
            };

            animationFrameRef.current = requestAnimationFrame(animate);

            return () => {
                if (animationFrameRef.current) {
                    cancelAnimationFrame(animationFrameRef.current);
                }
            };
        } else {
            setAnimationProgress(0);
        }
    }, [isTransitioning]);

    // Helper function to calculate node position during animation
    const getAnimatedPosition = (node: Node, initialPos: { x: number, y: number }) => {
        if (!node.finalX || !node.finalY) return node;

        // Calculate the current position based on progress
        const x = initialPos.x + (node.finalX - initialPos.x) * animationProgress;
        const y = initialPos.y + (node.finalY - initialPos.y) * animationProgress;

        return {
            ...node,
            x,
            y
        };
    };

    return {
        orbitalNodes,
        animationProgress,
        getAnimatedPosition
    };
}; 