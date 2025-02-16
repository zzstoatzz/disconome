import useSWR from 'swr';

const fetcher = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
};

export function useData<T>(
    path: string | null,
    options: {
        revalidateOnFocus?: boolean;
        refreshInterval?: number;
    } = {}
) {
    const {
        revalidateOnFocus = false,
        refreshInterval = 0
    } = options;

    return useSWR<T>(
        path ? `/api/blob?path=${encodeURIComponent(path)}` : null,
        fetcher,
        {
            revalidateOnFocus,
            refreshInterval,
            shouldRetryOnError: false
        }
    );
} 