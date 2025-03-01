import React from 'react';
import { Label } from '../types';

interface LabelRendererProps {
    uniqueLabels: Label[];
    hoveredLabel: Label | null;
    selectedLabel: Label | null;
    categoryColors: Record<string, string> | Map<string, string>;
    isDarkTheme: boolean;
    onLabelHover: (label: Label | null) => void;
    onLabelSelect: (label: Label | null) => void;
}

const LabelRenderer: React.FC<LabelRendererProps> = ({
    uniqueLabels,
    hoveredLabel,
    selectedLabel,
    categoryColors,
    isDarkTheme,
    onLabelHover,
    onLabelSelect
}) => {
    if (uniqueLabels.length === 0) {
        return null;
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-20">
            <div className="flex flex-col">
                <div className="p-2 bg-white dark:bg-gray-950 transition-colors duration-200">
                    <div className="max-w-screen-2xl mx-auto">
                        <div className="flex flex-col space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium"></div>
                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                    {/* Removed scroll indicator text for cleaner UI */}
                                </div>
                            </div>
                            <div className="labels-container flex flex-nowrap space-x-2 overflow-x-auto pb-2 max-w-full justify-center">
                                {uniqueLabels.map((label) => {
                                    const labelKey = `label-${label.name}-${label.source}`;
                                    return (
                                        <div
                                            key={labelKey}
                                            className={`flex items-center space-x-2 cursor-pointer 
                                                hover:bg-gray-100/50 dark:hover:bg-gray-800/50
                                                px-2.5 py-1 rounded-full transition-colors whitespace-nowrap
                                                ${selectedLabel?.name === label.name ? 'bg-gray-100/80 dark:bg-gray-800/80 ring-2 ring-sky-300 dark:ring-sky-700' : ''}
                                                ${label.isHistorical ? 'border border-dashed border-sky-300 dark:border-sky-700' : 'border border-transparent'}`}
                                            onMouseEnter={() => onLabelHover(label)}
                                            onMouseLeave={() => onLabelHover(null)}
                                            onClick={() => {
                                                // If this label is already selected, navigate to Bluesky
                                                if (selectedLabel && selectedLabel.name === label.name) {
                                                    if (label.source === 'trending') {
                                                        window.open(`https://bsky.app/search?q=${encodeURIComponent(label.name)}`, '_blank');
                                                    }
                                                    onLabelSelect(null);
                                                } else {
                                                    // First tap - just select the label and show hover state
                                                    onLabelSelect(label);
                                                    onLabelHover(label);
                                                }
                                            }}
                                            onTouchStart={() => {
                                                // For touch devices, show the hover state
                                                onLabelHover(label);
                                            }}
                                            onTouchEnd={(e) => {
                                                // Prevent default to avoid immediate navigation
                                                if (selectedLabel?.name !== label.name) {
                                                    e.preventDefault();
                                                }
                                            }}
                                            style={{
                                                backgroundColor: hoveredLabel?.name === label.name
                                                    ? `${isDarkTheme ? 'rgba(14, 165, 233, 0.15)' : 'rgba(14, 165, 233, 0.1)'}`
                                                    : '',
                                                color: hoveredLabel?.name === label.name
                                                    ? `${isDarkTheme ? 'rgb(186, 230, 253)' : 'rgb(3, 105, 161)'}`
                                                    : `${isDarkTheme ? 'rgb(226, 232, 240)' : 'rgb(15, 23, 42)'}`,
                                            }}
                                        >
                                            <div className="w-2.5 h-2.5 rounded-full" style={{
                                                backgroundColor: categoryColors instanceof Map
                                                    ? categoryColors.get(label.name) || (isDarkTheme ? 'white' : 'black')
                                                    : categoryColors[label.name] || (isDarkTheme ? 'white' : 'black'),
                                                opacity: hoveredLabel?.name === label.name ? 1 : 0.7,
                                                transition: 'all 0.2s ease-in-out'
                                            }}></div>
                                            <div className="text-xs font-medium">{label.name}</div>
                                            {label.source === 'trending' && (
                                                <div className="ml-1 opacity-70">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                        <path fillRule="evenodd" d="M15.22 6.268a.75.75 0 01.44.97l-2.47 7.41c-.06.183-.213.308-.398.31a.75.75 0 01-.554-.22l-1.657-1.656-2.829 2.83a.75.75 0 01-1.06-1.061l2.829-2.83-1.656-1.656a.75.75 0 01.22-.554c.001-.185.127-.338.31-.397l7.41-2.47a.75.75 0 01.53.13zm-1.31 1.31l-5.32 1.773 1.178 1.178 1.773 1.774 2.369-4.724z" clipRule="evenodd" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LabelRenderer; 