// Shared art-side fractal bank relief; no game/runtime dependency.
const Shore = require('./shoreline.cjs');
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);
const amplitudes = [ .55, .33, .198, .1188, .07128, .042768 ];

function sample(u, v, frequency, dx, dy, wrapWidth = 0) {
    const period = wrapWidth ? Math.max(1, Math.round(wrapWidth / 2 * frequency)) : 0;
    const scale = period ? period / (wrapWidth / 2) : frequency;
    return Shore.noise(u * scale + dx, v * scale + dy, period);
}

function relief(u, v, pixels = Infinity, wrapWidth = 0) {
    const visible = smooth(clamp((pixels - 32) / 64));
    if (!visible)
        return 0;
    const warpU = .09 * (sample(u, v, 3.7, 42.3, -17.8, wrapWidth) - .5);
    const warpV = .09 * (sample(u, v, 3.7, -29.1, 71.2, wrapWidth) - .5);
    let detail = 0;
    for (let i = 0; i < amplitudes.length; i++) {
        const frequency = 6 * 2 ** i;
        const weight = smooth(clamp(pixels / (2 * frequency) - 1));
        if (weight)
            detail +=
                amplitudes[i] * weight *
                (sample(u + warpU, v + warpV, frequency, 12.7 + i * 17.1, -53.8 + i * 9.3, wrapWidth) - .5);
    }
    // The finite amplitude sum bounds relief below 0.656 in either direction.
    // A multiplicative width stays positive without clipping off fine detail.
    return detail * visible;
}

function field(u, v, segments, pixels = Infinity, wrapWidth = 0) {
    let result = 1;
    for (const r of segments) {
        if (u < r.left || u > r.right || v < r.top || v > r.bottom)
            continue;
        const dx = r.b[0] - r.a[0], dy = r.b[1] - r.a[1];
        const t = clamp(((u - r.a[0]) * dx + (v - r.a[1]) * dy) / (dx * dx + dy * dy || 1));
        const base = r.width + (r.endWidth - r.width) * t;
        const cu = r.a[0] + t * dx, cv = r.a[1] + t * dy;
        const distance = Math.hypot(u - cu, v - cv);
        // A segment cannot improve the current union outside its widest possible bank.
        const widest = base * 1.35 * 1.656;
        if (smooth(clamp((distance - widest * .55) / (widest * 1.10))) >= result)
            continue;
        // Sample a fixed radial bank profile, not the pixel's distance from the
        // channel. Each cross-section has one water-to-land crossing, preventing
        // the higher octaves from producing detached pools beside the river.
        const scale = distance ? base * 1.10 / distance : 0;
        const bu = cu + (u - cu) * scale, bv = cv + (v - cv) * scale;
        const modulation = (1 + .48 * (sample(bu, bv, 13.7, 4, -8, wrapWidth) - .5) +
                            .22 * (sample(bu, bv, 31.1, -7, 2, wrapWidth) - .5)) *
                           (1 + relief(bu, bv, pixels, wrapWidth));
        const width = base * modulation;
        result = Math.min(result, smooth(clamp((distance - width * .55) / (width * 1.10))));
        if (!result)
            break;
    }
    return result;
}

module.exports = {
    relief,
    sample,
    field
};
