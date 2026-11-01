// Shared rounded tile footprints. No gameplay or asset-selection changes.
const clamp = x => Math.max(0, Math.min(1, x));

function field(u, v, centers) {
    if (!centers.length)
        return 0;
    const distances =
        centers.map(([ x, y ]) => (Math.abs(u - x) ** 4 + Math.abs(v - y) ** 4) ** .25).sort((a, b) => a - b);
    let distance = distances[0];
    for (const d of distances.slice(1)) {
        const h = Math.max(.25 - Math.abs(distance - d), 0) / .25;
        distance = Math.min(distance, d) - h * h * .25 * .25;
    }
    // Periodic erosion matches both native tile edges and quarter boundaries.
    // The full half-tile square remains land, including its diagonal tips.
    const tau = Math.PI * 2;
    const erosion = .008 * Math.sin(tau * u) * Math.sin(tau * v) + .004 * Math.sin(tau * (u + v) * 3) +
                    .003 * Math.sin(tau * (u - v) * 5);
    return clamp((.69 + erosion - distance) / .16);
}

function corners(u, v, values) {
    if (values.every(c => c.land === 1))
        return 1;
    const x = Math.floor(u), y = Math.floor(v);
    return field(u, v,
                 [ [ x, y ], [ x + 1, y ], [ x + 1, y + 1 ], [ x, y + 1 ] ].filter((_, i) => values[i].land));
}

module.exports = {
    field,
    corners
};
