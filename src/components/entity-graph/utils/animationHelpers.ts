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
export const createConnectingLines = (
  svgElement: SVGSVGElement,
  orbitalNodes: OrbitalNodeType[],
  isDarkTheme: boolean
) => {
  if (!svgElement || orbitalNodes.length === 0) return;

  // Clear existing lines
  const existingLines = svgElement.querySelectorAll('.orbital-connecting-line');
  existingLines.forEach(line => line.remove());

  // Create a group for the lines if it doesn't exist
  let linesGroup = svgElement.querySelector('.connecting-lines-group');
  if (!linesGroup) {
    linesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    linesGroup.classList.add('connecting-lines-group');
    svgElement.appendChild(linesGroup);
  }

  // Create a subset of connections (not all nodes should connect)
  for (let i = 0; i < orbitalNodes.length; i++) {
    // Connect to 2-3 other nodes
    const numConnections = 2 + Math.floor(Math.random());

    for (let j = 0; j < numConnections; j++) {
      // Create the line element
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.classList.add('orbital-connecting-line');

      // Set attributes
      line.setAttribute('stroke', isDarkTheme ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)');
      line.setAttribute('stroke-width', '0.5');
      line.setAttribute('stroke-dasharray', '1,2');

      // Calculate positions based on orbital animation
      const sourceAngle = Math.random() * Math.PI * 2;
      const targetAngle = Math.random() * Math.PI * 2;
      const radius = 50; // Same as in the orbit animation

      const sourceX = Math.cos(sourceAngle) * radius;
      const sourceY = Math.sin(sourceAngle) * radius;
      const targetX = Math.cos(targetAngle) * radius;
      const targetY = Math.sin(targetAngle) * radius;

      line.setAttribute('x1', sourceX.toString());
      line.setAttribute('y1', sourceY.toString());
      line.setAttribute('x2', targetX.toString());
      line.setAttribute('y2', targetY.toString());

      // Add animation
      const animateElement = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      animateElement.setAttribute('attributeName', 'stroke-dashoffset');
      animateElement.setAttribute('from', '0');
      animateElement.setAttribute('to', '12');
      animateElement.setAttribute('dur', '8s');
      animateElement.setAttribute('repeatCount', 'indefinite');

      line.appendChild(animateElement);
      linesGroup.appendChild(line);
    }
  }
};

// Get node style for animation
export const getNodeStyle = (index: number) => {
  const style: CSSProperties = {
    opacity: 1,
    transform: 'scale(1)',
    transition: `opacity 0.5s ease-out ${index * 0.02}s, transform 0.5s ease-out ${index * 0.02}s`,
  };

  return style;
}; 