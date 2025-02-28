import { useState, useEffect } from 'react';

export const useGraphTheme = () => {
    const [isDarkTheme, setIsDarkTheme] = useState(false);

    useEffect(() => {
        // Check initial theme
        setIsDarkTheme(document.documentElement.classList.contains("dark"));

        // Listen for theme changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === "class") {
                    setIsDarkTheme(document.documentElement.classList.contains("dark"));
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, []);

    return { isDarkTheme };
}; 