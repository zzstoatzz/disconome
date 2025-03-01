import { CSSProperties } from 'react';

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
export const createConnectingLines = () => {
  // Don't create connecting lines - this is causing the random SVG rendering in the top left
  return;
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