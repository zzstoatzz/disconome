import React from 'react';
import { useGraphTheme } from '../hooks/useGraphTheme';

const SvgFilters: React.FC = () => {
    const { isDarkTheme } = useGraphTheme();

    const glowValues = isDarkTheme
        ? "0 0 0 0 0.5  0 0 0 0 0.7  0 0 0 0 1  0 0 0 1 0"
        : "0 0 0 0 0.2  0 0 0 0 0.4  0 0 0 0 0.8  0 0 0 1 0";

    const svgContent = `
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feColorMatrix
                in="coloredBlur"
                type="matrix"
                values="${glowValues}"
            />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        
        <filter id="trending-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feColorMatrix
                in="coloredBlur"
                type="matrix"
                values="0 0 0 0 0.055  0 0 0 0 0.647  0 0 0 0 0.914  0 0 0 0.5 0"
            />
            <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>
        
        <filter id="node-shadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="0" stdDeviation="2.5" flood-opacity="0.5" flood-color="${isDarkTheme ? '#ffffff' : '#000000'}" />
        </filter>
        
        <filter id="electricity-blur" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.8" result="blurred" />
            <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" result="noise" seed="0">
                <animate attributeName="seed" from="0" to="100" dur="1s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="blurred" in2="noise" scale="2" xChannelSelector="R" yChannelSelector="G" />
            <feMerge>
                <feMergeNode in="SourceGraphic" />
            </feMerge>
        </filter>

        <!-- Improved electricity animation with crackling effect -->
        <pattern id="electricityPattern" patternUnits="userSpaceOnUse" width="30" height="6" patternTransform="rotate(0)">
            <animateTransform attributeName="patternTransform" 
                              attributeType="XML" 
                              type="translate" 
                              from="0 0" 
                              to="30 0" 
                              dur="0.7s" 
                              repeatCount="indefinite" />
            <path d="M0,3 L2,1 L4,3 L6,0 L8,4 L10,2 L12,3 L14,1 L16,4 L18,0 L20,3 L22,1 L24,4 L26,2 L28,3 L30,1" 
                  stroke="${isDarkTheme ? 'rgba(180, 220, 255, 0.9)' : 'rgba(100, 180, 255, 0.9)'}" 
                  stroke-width="1" 
                  filter="url(#electricity-blur)"
                  fill="none" />
        </pattern>
    `;

    return (
        <defs dangerouslySetInnerHTML={{ __html: svgContent }} />
    );
};

export default SvgFilters; 