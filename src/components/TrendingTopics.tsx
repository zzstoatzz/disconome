import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Label = {
    name: string;
    source: 'trending' | 'ai';
    timestamp?: number;
};

interface TrendingTopicsProps {
    onTrendingTopicsChange?: (topics: Label[]) => void;
    onTopicHover?: (topic: Label | null) => void;
}

const TrendingIcon = ({ className }: { className?: string }) => (
    <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M23 6l-9.5 9.5-5-5L1 18" />
        <path d="M17 6h6v6" />
    </svg>
);

export default function TrendingTopics({ onTrendingTopicsChange, onTopicHover }: TrendingTopicsProps) {
    const [topics, setTopics] = useState<Label[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [hoveredTopic, setHoveredTopic] = useState<Label | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const response = await fetch('/api/trending');
                const data = await response.json();
                // Take first 6 labels (they come pre-sorted from Bluesky)
                const limitedTopics = data.labels.slice(0, 6).map((label: Label) => ({
                    ...label,
                    source: 'trending' as const
                }));
                setTopics(limitedTopics);

                if (onTrendingTopicsChange) {
                    console.log('Loaded trending topics:', limitedTopics.length);
                    onTrendingTopicsChange(limitedTopics);
                }
            } catch (error) {
                console.error('Error fetching trending topics:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchTopics();
        const interval = setInterval(fetchTopics, 5 * 60 * 1000);
        return () => clearInterval(interval);
    }, [onTrendingTopicsChange]);

    const handleTopicClick = (topic: Label) => {
        const slug = topic.name.toLowerCase().replace(/\s+/g, '-');
        router.push(`/wiki/${slug}`);
    };

    const handleTopicHover = (topic: Label | null) => {
        setHoveredTopic(topic);
        if (onTopicHover) {
            onTopicHover(topic);
        }
    };

    if (isLoading) {
        return (
            <div className="w-12 h-12 flex items-center justify-center">
                <div className="animate-pulse">
                    <TrendingIcon className="w-4 h-4" />
                </div>
            </div>
        );
    }

    return (
        <div className="w-full max-w-screen-lg mx-auto">
            <div className="flex items-center justify-center gap-2 mb-2">
                <span className="text-sm font-medium text-sky-600 dark:text-sky-400">
                    trending on
                </span>
                <Image
                    src="/bsky-logo.png"
                    alt="Bluesky"
                    width={20}
                    height={20}
                    className="opacity-80 hover:opacity-100 transition-opacity"
                />
            </div>

            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                {topics.map((topic) => {
                    const key = `topic-${topic.name.toLowerCase().replace(/\s+/g, '-')}`;
                    const isHovered = hoveredTopic?.name === topic.name;
                    return (
                        <button
                            key={key}
                            onClick={() => handleTopicClick(topic)}
                            onMouseEnter={() => handleTopicHover(topic)}
                            onMouseLeave={() => handleTopicHover(null)}
                            className={`
                                flex-shrink-0 flex items-center px-2 py-1 rounded-lg whitespace-nowrap
                                ${isHovered
                                    ? 'bg-sky-100 dark:bg-sky-900/50 shadow-[0_0_15px_rgba(14,165,233,0.4)]'
                                    : 'hover:bg-sky-50 dark:hover:bg-sky-900/30'}
                                text-sky-600 dark:text-sky-300
                                transition-all duration-300
                                group
                            `}
                            style={{
                                animation: isHovered ? 'none' : undefined,
                                transform: isHovered ? 'scale(1.02)' : 'scale(1)'
                            }}
                        >
                            <TrendingIcon className={`
                                w-3 h-3 mr-2 transition-all duration-300
                                ${isHovered ? 'text-sky-500 scale-110' : 'text-sky-400/50 group-hover:text-sky-400'}
                            `} />
                            <span className="text-sm">{topic.name}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
} 