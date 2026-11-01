// Rounded tile support with layered, continuous shore relief.
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

// Broad coves, secondary headlands and small erosion detail. Native frequencies
// repeat exactly at tile boundaries; enhanced coordinates vary across the world.
// The lower bound retains the whole land tile. The upper bound leaves water
// centers open, even with eight surrounding land neighbors.
function radius(u, v, world = false, wrapWidth = 0) {
    const worldNoise = (frequency, dx, dy) => {
        const period = wrapWidth ? Math.max(1, Math.round(wrapWidth / 2 * frequency)) : 0;
        const scale = period ? period / (wrapWidth / 2) : frequency;
        return noise(u * scale + dx, v * scale + dy, period);
    };
    const broad = world ? worldNoise(1.37, 17.31, -9.53) : noise(u * 2 + .31, v * 2 + .47, 2);
    const mid = world ? worldNoise(4.7, -3.8, 23.1) : noise(u * 5 + 1.17, v * 5 + 3.21, 5);
    const fine = world ? worldNoise(13.1, 6.2, 4.8) : noise(u * 13 + 7.21, v * 13 + 5.38, 13);
    return Math.min(.78, .625 + .10 * smooth(clamp((broad - .2) / .6)) + .045 * mid + .025 * fine);
}

function field(u, v, centers, world = false, wrapWidth = 0) {
    if (!centers.length)
        return 0;
    const ds =
        centers.map(([ x, y ]) => (Math.abs(u - x) ** 4 + Math.abs(v - y) ** 4) ** .25).sort((a, b) => a - b);
    let distance = ds[0];
    // Compact joins exclude distant centers unavailable in an adjacent coast quarter.
    for (const d of ds.slice(1)) {
        const h = Math.max(.12 - Math.abs(distance - d), 0) / .12;
        distance = Math.min(distance, d) - h * h * .12 * .25;
    }
    return clamp((radius(u, v, world, wrapWidth) + .08 - distance) / .16);
}

function corners(u, v, values, wrapWidth = 0) {
    if (values.every(c => c.land === 1))
        return 1;
    const x = Math.floor(u), y = Math.floor(v);
    return field(u, v,
                 [ [ x, y ], [ x + 1, y ], [ x + 1, y + 1 ], [ x, y + 1 ] ].filter((_, i) => values[i].land),
                 true, wrapWidth);
}

module.exports = {
    field,
    corners,
    radius
};
