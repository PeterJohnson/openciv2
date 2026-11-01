// Rounded headlands and coves, with protected tile footprints and nested erosion.
const clamp = x => Math.max(0, Math.min(1, x));
const smooth = x => x * x * (3 - 2 * x);
const fract = x => x - Math.floor(x);

function noise(x, y, period = 0) {
    const a = Math.floor(x), b = Math.floor(y), u = smooth(fract(x)), v = smooth(fract(y));
    const hash = (i, j) => {
        if (period) {
            i = (i % period + period) % period;
            j = (j % period + period) % period;
        }
        return fract(Math.sin(i * 127.1 + j * 311.7 + 53.6) * 43758.5453123);
    };
    const top = hash(a, b) * (1 - u) + hash(a + 1, b) * u,
          bottom = hash(a, b + 1) * (1 - u) + hash(a + 1, b + 1) * u;
    return top * (1 - v) + bottom * v;
}

// Bays contain coves, rock notches and finer erosion. Native frequencies
// repeat exactly at tile boundaries; enhanced coordinates vary across the world.
// The minimum radius encloses the occupied land diamond without reintroducing
// a square envelope. The upper bound keeps even surrounded water centers open.
const nativeFrequencies = [ 2, 3, 7, 17, 41, 97 ];
const worldFrequencies = [ .73, 2.4, 6.1, 16.3, 40.7, 96.1 ];
const amplitudes = [ .28, .15, .08, .04, .024, .014 ];

function macroRadius(u, v, world = false, wrapWidth = 0, pixels = Infinity) {
    const worldNoise = (frequency, dx, dy) => {
        const period = wrapWidth ? Math.max(1, Math.round(wrapWidth / 2 * frequency)) : 0;
        const scale = period ? period / (wrapWidth / 2) : frequency;
        return noise(u * scale + dx, v * scale + dy, period);
    };
    const frequencies = world ? worldFrequencies : nativeFrequencies;
    let relief = 0;
    for (let i = 0; i < frequencies.length; i++) {
        const f = frequencies[i], dx = 17.31 + i * 7.13, dy = -9.53 + i * 4.71;
        // Retire detail below two projected pixels rather than sampling it as speckles.
        const weight = smooth(clamp(pixels / f - 1));
        if (!weight)
            continue;
        const n = world ? worldNoise(f, dx, dy) : noise(u * f + dx, v * f + dy, f);
        relief += amplitudes[i] * (n - .5) * weight;
    }
    return .815 + .06 * Math.tanh(relief / .055);
}

// An independent, domain-warped fractional Brownian detail layer. Applying it
// after the macro tanh preserves small coves even on nearly saturated headlands.
// Frequencies double and amplitudes decay, so notches contain smaller notches.
const detailAmplitudes = [ .065, .039, .0234, .014, .006, .002 ];

function detailRadius(u, v, base, world, wrapWidth, pixels) {
    const visible = smooth(clamp((pixels - 32) / 64));
    if (!visible)
        return base;
    const sample = (x, y, frequency, dx, dy) => {
        const period = world ? (wrapWidth ? Math.max(1, Math.round(wrapWidth / 2 * frequency)) : 0)
                             : Math.round(frequency);
        const scale = world ? (period ? period / (wrapWidth / 2) : frequency) : period;
        return noise(x * scale + dx, y * scale + dy, period);
    };
    // Low-frequency, periodic domain warping removes grid-aligned detail bands.
    const warpU = .10 * (sample(u, v, world ? 3.7 : 4, 37.1, -81.6) - .5);
    const warpV = .10 * (sample(u, v, world ? 3.7 : 4, -63.4, 21.7) - .5);
    let detail = 0;
    for (let i = 0; i < detailAmplitudes.length; i++) {
        const frequency = (world ? 7.9 : 8) * 2 ** i;
        // Allow for isometric foreshortening and the radial profile stretch.
        const weight = smooth(clamp(pixels / (2 * frequency) - 1));
        if (weight)
            detail += detailAmplitudes[i] * weight *
                      (sample(u + warpU, v + warpV, frequency, 31.7 + i * 13.2, -18.3 - i * 9.7) - .5);
    }
    // Reflect excess relief into the safe band rather than flattening it with
    // a clamp. Fine contours remain attached to the protected land footprint.
    const lower = .755, span = .12;
    const t = ((base + detail * visible - lower) % (2 * span) + 2 * span) % (2 * span);
    return lower + (t <= span ? t : 2 * span - t);
}

function radius(u, v, world = false, wrapWidth = 0, pixels = Infinity) {
    return detailRadius(u, v, macroRadius(u, v, world, wrapWidth, pixels), world, wrapWidth, pixels);
}

// Irregular cove banks retain one crossing along each ray. Sampling a fixed
// ring makes the relief angular, rather than changing with distance from shore.
// Broad uneven banks contain progressively smaller inlets; zoom filters the
// fine scales before they become isolated pixels.
function coveRelief(ox, oy, nx, ny, world, wrapWidth, pixels) {
    const frequencies = [ 2, 4, 8, 16, 32 ], amplitudes = [ .50, .25, .12, .06, .026 ];
    const u = ox + nx * .5, v = oy + ny * .5;
    let relief = 0;
    for (let i = 0; i < frequencies.length; i++) {
        const f = frequencies[i];
        const weight = smooth(clamp(pixels / (4 * f) - 1));
        if (!weight)
            continue;
        const period = world ? (wrapWidth ? Math.max(1, Math.round(wrapWidth / 2 * f)) : 0) : f;
        const scale = world && period ? period / (wrapWidth / 2) : f;
        relief += amplitudes[i] * weight *
                  (noise(u * scale + 8.71 + i * 12.31, v * scale - 15.37 + i * 9.17, period) - .5);
    }
    return .14 * Math.tanh(relief / .14);
}

function field(u, v, centers, world = false, wrapWidth = 0, pixels = Infinity) {
    if (!centers.length)
        return 0;
    const profiles =
        centers
            .map(([ x, y ]) => {
                const dx = u - x, dy = v - y, d = Math.hypot(dx, dy);
                if (!d)
                    return {base : -.81, detailed : -.81};
                // A fixed radial profile gives every land lobe one shore crossing.
                const scale = .81 / d, a = x + dx * scale, b = y + dy * scale;
                const base = macroRadius(a, b, world, wrapWidth, pixels);
                return {base : d - base, detailed : d - detailRadius(a, b, base, world, wrapWidth, pixels)};
            })
            .sort((a, b) => a.base - b.base);
    // Taper fine relief at concave lobe intersections, where two eroded rims
    // could pinch off a subpixel water pocket. Distant, unavailable neighbors
    // have zero influence, preserving the existing quarter/cell seam contract.
    const second = profiles[1];
    const join = second ? smooth(clamp((.14 - (second.base - profiles[0].base)) / .08)) *
                              smooth(clamp((.12 - second.base) / .01))
                        : 0;
    const ds = profiles.map(p => p.base + (p.detailed - p.base) * (1 - join)).sort((a, b) => a - b);
    // A compact power union rounds the actual land contour at inward joins.
    // Each lobe fades to zero before an unavailable neighboring quarter can
    // contribute. Unlike a distance-dependent blend radius, this aggregation
    // is monotone in every input: added land cannot turn existing land into water.
    // The exponent is above one for a continuous tangent at the support edge;
    // its broad join gives single-cell lakes rounded rather than diamond tips.
    const reach = .12, exponent = 1.25;
    let influence = 0;
    for (const d of ds)
        influence += Math.max(0, reach - d) ** exponent;
    let distance = influence ? reach - influence ** (1 / exponent) : ds[0];
    // Two perpendicular land neighbors enclose an inward water corner. Bound
    // that corner with an irregular cove based on their existing shore crossings.
    // Nested radial relief breaks up the ellipse. Easing at the quarter axes
    // keeps both quarters on the same boundary, without opposite neighbors.
    if (distance > -.055) {
        const ox = Math.round(u), oy = Math.round(v), du = u - ox, dv = v - oy;
        const sx = Math.sign(du), sy = Math.sign(dv);
        const occupied = (x, y) => centers.some(c => c[0] === x && c[1] === y);
        if (sx && sy && !occupied(ox, oy) && occupied(ox + sx, oy) && occupied(ox, oy + sy)) {
            const a = 1 - radius(ox + sx * .19, oy, world, wrapWidth, pixels);
            const b = 1 - radius(ox, oy + sy * .19, world, wrapWidth, pixels);
            const weight = smooth(clamp(Math.min(Math.abs(du), Math.abs(dv)) / .06));
            const length = Math.hypot(du / a, dv / b);
            const relief = coveRelief(ox, oy, du / a / length, dv / b / length, world, wrapWidth, pixels);
            const cap = (1 + relief - length) * Math.min(a, b);
            // A local smooth minimum preserves a continuous join to the
            // eroded headlands. It only adds land around the water corner.
            const blend = .02;
            const h = Math.max(blend - Math.abs(distance - cap), 0) / blend;
            const rounded = Math.min(distance, cap) - h * h * blend * .25;
            distance += (rounded - distance) * weight;
        }
    }
    return clamp(.5 - distance / (distance < 0 ? .11 : .23));
}

function corners(u, v, values, wrapWidth = 0, pixels = Infinity) {
    if (values.every(c => c.land === 1))
        return 1;
    const x = Math.floor(u), y = Math.floor(v);
    return field(u, v,
                 [ [ x, y ], [ x + 1, y ], [ x + 1, y + 1 ], [ x, y + 1 ] ].filter((_, i) => values[i].land),
                 true, wrapWidth, pixels);
}

module.exports = {
    field,
    corners,
    radius,
    macroRadius,
    noise
};
