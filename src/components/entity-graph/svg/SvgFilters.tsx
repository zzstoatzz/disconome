import React from 'react';
import { useGraphTheme } from '../hooks/useGraphTheme';

const SvgFilters: React.FC = () => {
    const { isDarkTheme } = useGraphTheme();

    const glowValues = isDarkTheme
        ? "0 0 0 0 0.5  0 0 0 0 0.7  0 0 0 0 1  0 0 0 1 0"
        : "0 0 0 0 0.2  0 0 0 0 0.4  0 0 0 0 0.8  0 0 0 1 0";

    const svgContent = `
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
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
    `;

    return (
        <defs dangerouslySetInnerHTML={{ __html: svgContent }} />
    );
};

export default SvgFilters; 