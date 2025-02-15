// New file for wave calculations
export const calculateCircularWave = (
    angle: number,  // Current angle of node in radians
    time: number,   // Current time
    radius: number, // Distance from center
    count: number   // Node's view count
) => {
    const WAVE_SPEED = 0.0005; // Very slow
    const BASE_AMPLITUDE = 2;   // Small amplitude

    // Simple circular wave
    const wave = Math.sin(angle + time * WAVE_SPEED) * BASE_AMPLITUDE;

    // Subtle view count scaling
    const viewScale = Math.log10(count || 1) * 0.05;

    return wave * (1 + viewScale);
};

// Simplify connection flow
export const calculateConnectionFlow = (
    time: number,
    strength: number
) => {
    return strength * 0.4; // Just return a constant fraction
}; 