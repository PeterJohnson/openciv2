// Protected tile footprints with six nested scales of continuous shoreline relief.
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
// The lower bound retains the whole land tile. The upper bound leaves water
// centers open, even with eight surrounding land neighbors.
const nativeFrequencies = [ 2, 5, 11, 23, 47, 97 ];
const worldFrequencies = [ 1.37, 4.7, 10.9, 23.3, 47.9, 97.1 ];
const amplitudes = [ .11, .075, .05, .032, .021, .014 ];

function radius(u, v, world = false, wrapWidth = 0, pixels = Infinity) {
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
    return .7025 + .0775 * Math.tanh(relief / .0775);
}

function field(u, v, centers, world = false, wrapWidth = 0, pixels = Infinity) {
    if (!centers.length)
        return 0;
    const ds = centers
                   .map(([ x, y ]) => {
                       const dx = u - x, dy = v - y, d = (Math.abs(dx) ** 4 + Math.abs(dy) ** 4) ** .25;
                       if (!d)
                           return -.7025;
                       // Sample relief around a fixed contour: each ray has one shore crossing,
                       // so fine erosion cannot create stray islands or enclosed water specks.
                       const scale = .7 / d;
                       return d - radius(x + dx * scale, y + dy * scale, world, wrapWidth, pixels);
                   })
                   .sort((a, b) => a - b);
    let distance = ds[0];
    // Compact joins exclude distant centers unavailable in an adjacent coast quarter.
    for (const d of ds.slice(1)) {
        const h = Math.max(.12 - Math.abs(distance - d), 0) / .12;
        distance = Math.min(distance, d) - h * h * .12 * .25;
    }
    return clamp((.08 - distance) / .16);
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
    radius
};
