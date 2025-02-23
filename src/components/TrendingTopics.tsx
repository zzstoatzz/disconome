import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type Topic = {
    topic: string;
    link: string;
};

interface TrendingTopicsProps {
    onTrendingTopicsChange?: (topics: string[]) => void;
    onTopicHover?: (topic: string | null) => void;
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
    const [topics, setTopics] = useState<Topic[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [hoveredTopic, setHoveredTopic] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const fetchTopics = async () => {
            try {
                const response = await fetch('/api/trending');
                const data = await response.json();
                setTopics(data);

                // Notify parent of trending topics with consistent slug formatting
                if (onTrendingTopicsChange) {
                    const topicNames = data.map((t: Topic) => t.topic);
                    // Only log once when topics are initially loaded
                    console.log('Loaded trending topics:', topicNames.length);
                    onTrendingTopicsChange(topicNames);
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

    const handleTopicClick = (topic: string) => {
        const slug = topic.toLowerCase().replace(/\s+/g, '-');
        router.push(`/wiki/${slug}`);
    };

    const handleTopicHover = (topic: string | null) => {
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
        <div className={`transition-all duration-300 ease-in-out ${isExpanded ? 'w-48' : 'w-12'}`}>
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-2 px-3 py-2 text-sky-600 dark:text-sky-400
                         hover:bg-sky-50 dark:hover:bg-sky-900/30 rounded-lg transition-colors
                         ${isExpanded ? 'w-48' : 'w-auto'}`}
                title={isExpanded ? "Collapse trending topics" : "Show trending topics"}
            >
                <span className="whitespace-nowrap text-sm font-medium">Trending on</span>
                <Image
                    src="/bsky-logo.png"
                    alt="Bluesky"
                    width={20}
                    height={20}
                    className="opacity-80 hover:opacity-100 transition-opacity"
                />
            </button>

            <div className={`
                overflow-hidden transition-all duration-300 ease-in-out
                ${isExpanded ? 'opacity-100 max-h-[calc(100vh-6rem)]' : 'opacity-0 max-h-0'}
            `}>
                <div className="mt-2 space-y-1.5">
                    {topics.map((topic) => {
                        const key = `topic-${topic.topic.toLowerCase().replace(/\s+/g, '-')}`;
                        const isHovered = hoveredTopic === topic.topic;
                        return (
                            <button
                                key={key}
                                onClick={() => handleTopicClick(topic.topic)}
                                onMouseEnter={() => handleTopicHover(topic.topic)}
                                onMouseLeave={() => handleTopicHover(null)}
                                className={`
                                    flex items-center w-full px-3 py-2 rounded-lg
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
                                <span className="truncate text-sm">{topic.topic}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
} 