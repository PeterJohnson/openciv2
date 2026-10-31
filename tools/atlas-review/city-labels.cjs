// Enhanced-only label composition; native source commands remain in their original order.
const C = require('./common.cjs'), Font = require('./font.cjs');

function splitCityBadges(trace) {
    const commands = [], badges = [];
    for (let i = 0; i < trace.commands.length; i++) {
        const city = trace.commands[i];
        commands.push(city);
        if (!city.asset.startsWith('city/'))
            continue;
        if (trace.commands[i + 1]?.asset.startsWith('flag/'))
            commands.push(trace.commands[++i]);
        if (trace.commands[i + 1]?.asset !== 'frame')
            continue; // Disorder has its own sprite.
        const badge = [ trace.commands[++i] ];
        if (trace.commands[i + 1]?.asset !== 'rect')
            throw Error('Missing city size fill');
        badge.push(trace.commands[++i]);
        while (trace.commands[i + 1]?.asset === 'text')
            badge.push(trace.commands[++i]);
        if (badge.length < 3 || !badge.slice(2).every(c => /^\d+$/.test(c.text)))
            throw Error('Unrecognized city size commands');
        badges.push({city, commands : badge});
    }
    return {trace : {...trace, commands}, badges};
}

function intersects(a, b, gap = 2) {
    return a.x < b.x + b.width + gap && a.x + a.width + gap > b.x && a.y < b.y + b.height + gap &&
           a.y + a.height + gap > b.y;
}

function bounds(commands) {
    const boxes = commands.map(c => {
        if (c.asset === 'text') {
            const f = Font.get(c.face, c.fontHeight, c.style);
            return {...c, width : Font.width(c.text, f), height : f.cellHeight + 4};
        }
        return c;
    });
    const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
    return {
        x,
        y,
        width : Math.max(...boxes.map(b => b.x + b.width)) - x,
        height : Math.max(...boxes.map(b => b.y + b.height)) - y
    };
}

function unitObstacles(objects, detail) {
    if (!detail)
        return []; // Overview uses small markers, without unit tags.
    const boxes = objects.commands.filter(c => c.asset === 'shield').map(c => ({
                                                                             x : c.x - 3,
                                                                             y : c.y - 3,
                                                                             width : c.width + 9,
                                                                             height : c.height + 6,
                                                                             kind : 'unit-tag'
                                                                         }));
    for (const c of objects.commands.filter(c => c.asset === 'text' && c.text === '+'))
        boxes.push({
            x : c.x - c.height * .7,
            y : c.y - c.height * .7,
            width : c.height * 1.4,
            height : c.height * 1.8,
            kind : 'stack-mark'
        });
    return boxes;
}

function place(preferred, reserved, width, height, range) {
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const origin = {
        ...preferred,
        x : clamp(preferred.x, 2, width - preferred.width - 2),
        y : clamp(preferred.y, 2, height - preferred.height - 2)
    };
    const valid = b => b.x >= 2 && b.y >= 2 && b.x + b.width <= width - 2 && b.y + b.height <= height - 2 &&
                       !reserved.some(o => intersects(b, o));
    if (valid(origin))
        return origin;
    const candidates = [];
    for (let dy = -range; dy <= range; dy += 4)
        for (let dx = -range; dx <= range; dx += 4)
            candidates.push({dx, dy, distance : dx * dx + dy * dy});
    candidates.sort((a, b) => a.distance - b.distance || b.dy - a.dy || a.dx - b.dx);
    for (const c of candidates) {
        const next = {...origin, x : origin.x + c.dx, y : origin.y + c.dy};
        if (valid(next))
            return next;
    }
    throw Error('No clear city-label position within the bounded search');
}

function layout(scene, sizes, names, objects) {
    const detail = scene.tileWidth >= 48, width = names.width, height = names.height;
    const obstacles = unitObstacles(objects, detail), reserved = [...obstacles ], items = [];

    function add(kind, commands, identity) {
        const preferred = bounds(commands);
        const box = place(preferred, reserved, width, height, Math.max(64, scene.tileWidth));
        const dx = box.x - preferred.x, dy = box.y - preferred.y;
        items.push({
            kind,
            identity,
            preferred,
            box,
            dx,
            dy,
            commands : commands.map(c => ({...c, x : c.x + dx, y : c.y + dy}))
        });
        reserved.push({...box, kind});
    }

    if (detail)
        for (const b of splitCityBadges(sizes).badges) {
            const c = b.city;
            const centerX = c.x + c.width / 2, centerY = c.y + c.height * 2 / 3;
            if (centerX < 0 || centerY < 0 || centerX >= width || centerY >= height)
                continue;
            add('city-size', b.commands, c.asset + '@' + c.x + ',' + c.y);
        }
    let group = [];
    for (const c of names.commands) {
        group.push(c);
        if (c.color >= 200 && c.color < 208) {
            const b = bounds(group);
            if (b.x + b.width > 0 && b.y + b.height > 0 && b.x < width && b.y < height)
                add('city-name', group, c.text);
            group = [];
        }
    }
    if (group.length)
        throw Error('Unterminated city-name shadow group');
    return {width, height, detail, obstacles, items};
}

module.exports = {
    splitCityBadges,
    intersects,
    bounds,
    layout
};
