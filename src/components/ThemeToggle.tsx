"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const initialTheme = savedTheme || (prefersDark ? "dark" : "light");

    document.documentElement.classList.add(initialTheme);
    setIsDark(initialTheme === "dark");
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const html = document.documentElement;
    const currentTheme = html.classList.contains("dark") ? "dark" : "light";
    const newTheme = currentTheme === "light" ? "dark" : "light";

    html.classList.remove(currentTheme);
    html.classList.add(newTheme);
    localStorage.setItem("theme", newTheme);
    setIsDark(newTheme === "dark");
  };

  if (!mounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="fixed top-4 right-4 p-2 rounded-lg
                text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 
                transition-colors duration-200"
      aria-label="Toggle theme"
      style={{ zIndex: 1000 }}
    >
      {isDark ? "☀️" : "🌙"}
    </button>
  );
}
