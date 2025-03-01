import React from 'react';
import { CSSProperties } from 'react';

// Type for orbital nodes used in the createConnectingLines function
type OrbitalNodeType = {
  size: number;
  color: string;
  style: React.CSSProperties;
};

// Inject animation styles for orbital loading and node transitions
export const injectAnimationStyles = () => {
  // Remove any existing style element
  const existingStyle = document.getElementById('entity-graph-animations');
  if (existingStyle) {
    existingStyle.remove();
  }

  // Create a new style element
  const style = document.createElement('style');
  style.id = 'entity-graph-animations';
  style.innerHTML = `
        @keyframes orbit {
            0% {
                transform: rotate(0deg) translateX(50px) rotate(0deg);
            }
            100% {
                transform: rotate(360deg) translateX(50px) rotate(-360deg);
            }
        }
        
        @keyframes pulse {
            0%, 100% {
                opacity: 0.8;
                transform: scale(1);
            }
            50% {
                opacity: 1;
                transform: scale(1.05);
            }
        }
        
        /* Custom scrollbar for labels */
        .labels-container::-webkit-scrollbar {
            height: 4px;
        }
        
        .labels-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.05);
            border-radius: 2px;
        }
        
        .labels-container::-webkit-scrollbar-thumb {
            background: rgba(0, 0, 0, 0.15);
            border-radius: 2px;
        }
        
        .dark .labels-container::-webkit-scrollbar-track {
            background: rgba(255, 255, 255, 0.05);
        }
        
        .dark .labels-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
        }
    `;

  document.head.appendChild(style);
};

// Create connecting lines between orbital nodes
export const createConnectingLines = (orbitalNodes: OrbitalNodeType[]) => {
  // Get the SVG element that contains the orbital nodes
  const orbitalSvg = document.querySelector('.orbital-node')?.closest('svg');
  if (!orbitalSvg) return;

  // Get the connecting lines group
  const linesGroup = orbitalSvg.querySelector('.connecting-lines');
  if (!linesGroup) return;

  // Clear existing lines
  while (linesGroup.firstChild) {
    linesGroup.removeChild(linesGroup.firstChild);
  }

  // Create a subset of connections (not all nodes should connect)
  // This creates a more pleasing visual effect
  for (let i = 0; i < orbitalNodes.length; i++) {
    // Connect to 2-3 other nodes
    const numConnections = 2 + Math.floor(Math.random());

    for (let j = 0; j < numConnections; j++) {
      // Connect to a random node that's not too far away
      const targetIndex = (i + 1 + Math.floor(Math.random() * 5)) % orbitalNodes.length;

      // Create the line element
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');

      // Set attributes
      line.setAttribute('x1', '0');
      line.setAttribute('y1', '0');
      line.setAttribute('x2', '0');
      line.setAttribute('y2', '0');
      line.setAttribute('stroke', 'rgba(255, 255, 255, 0.15)');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '1,2');

      // Add animation
      const animateElement = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animateElement.setAttribute('attributeName', 'stroke-dashoffset');
      animateElement.setAttribute('from', '0');
      animateElement.setAttribute('to', '12');
      animateElement.setAttribute('dur', '8s');
      animateElement.setAttribute('repeatCount', 'indefinite');

      line.appendChild(animateElement);
      linesGroup.appendChild(line);

      // Update line positions based on orbital node positions
      const updateLinePosition = () => {
        const sourceNode = orbitalSvg.querySelectorAll('.orbital-node')[i];
        const targetNode = orbitalSvg.querySelectorAll('.orbital-node')[targetIndex];

        if (sourceNode && targetNode) {
          // Get the transform matrix to extract position
          const sourceTransform = window.getComputedStyle(sourceNode).transform;
          const targetTransform = window.getComputedStyle(targetNode).transform;

          // Extract translation values (simplified approach)
          const sourceMatch = sourceTransform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
          const targetMatch = targetTransform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);

          if (sourceMatch && targetMatch) {
            const sourceX = parseFloat(sourceMatch[1]);
            const sourceY = parseFloat(sourceMatch[2]);
            const targetX = parseFloat(targetMatch[1]);
            const targetY = parseFloat(targetMatch[2]);

            line.setAttribute('x1', sourceX.toString());
            line.setAttribute('y1', sourceY.toString());
            line.setAttribute('x2', targetX.toString());
            line.setAttribute('y2', targetY.toString());
          }
        }

        requestAnimationFrame(updateLinePosition);
      };

      updateLinePosition();
    }
  }
};

// Get node style for animation
export const getNodeStyle = (index: number, nodeVisibility: boolean[] = []) => {
  const style: CSSProperties = {
    opacity: nodeVisibility[index] ? 1 : 0,
    transform: `scale(${nodeVisibility[index] ? 1 : 0})`,
    transition: `opacity 0.5s ease-out ${index * 0.02}s, transform 0.5s ease-out ${index * 0.02}s`,
  };

  return style;
}; 