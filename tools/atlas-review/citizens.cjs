const C = require('./common.cjs');
const assert = require('node:assert/strict');
const eras = [ 'ancient', 'medieval', 'industrial', 'modern' ];
const roles = [ 'happy', 'content', 'unhappy', 'angry', 'entertainer', 'tax-collector', 'scientist' ];

function binding(id) {
    assert(Number.isInteger(id) && id >= 100 && id < 144, 'Citizen sprite id');
    const index = id - 100, era = eras[Math.floor(index / 11)], slot = index % 11,
          role = roles[slot < 8 ? Math.floor(slot / 2) : slot - 4],
          gender = slot < 8 ? [ 'man', 'woman' ][slot % 2] : null;
    return {
        id,
        era,
        slot,
        role,
        gender,
        file : gender ? `sprites/citizen-pairs/${era}-${role}-${gender}.png`
                      : `sprites/citizens/${era}-${role}.png`
    };
}

// Small, shape-distinct cues supplement the painted expression/props only in the proposal.
function cue(role) {
    const colors = [ '#e5bd62', '#9bbdb1', '#99a9c2', '#dc8571', '#c5a1cc', '#e4bf6c', '#97cbd0' ];
    const index = roles.indexOf(role), ink = '#1a302e';
    const shapes = [
        '<path d="M9 18Q16 26 23 18"/>', '<path d="M10 20H22"/>', '<path d="M9 23Q16 14 23 23"/>',
        '<path d="M7 10L13 13M19 13L25 10M9 23Q16 16 23 23"/>',
        '<path d="M14 23V8L24 6V20M14 12L24 10"/><ellipse cx="10" cy="24" rx="4" ry="3" fill="#1a302e"/><ellipse cx="20" cy="21" rx="4" ry="3" fill="#1a302e"/>',
        '<ellipse cx="13" cy="19" rx="7" ry="8"/><ellipse cx="20" cy="14" rx="7" ry="8" fill="#e4bf6c"/><path d="M20 10V18"/>',
        '<path d="M12 6H21M14 6V15L7 25H26L19 15V6M11 21H23"/>'
    ];
    assert(index >= 0);
    const eyes =
        index < 4
            ? '<circle cx="11" cy="13" r="1.5" fill="#1a302e"/><circle cx="21" cy="13" r="1.5" fill="#1a302e"/>'
            : '';
    return `<circle cx="16" cy="16" r="15" fill="${
        colors[index]}" stroke="#162a27" stroke-width="2"/><g fill="none" stroke="${
        ink}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${shapes[index]}</g>${eyes}`;
}

async function draw(p, id, x, y, w, h, proposed) {
    const b = binding(id);
    await p.image(b.file, x, y, w, h);
    if (proposed)
        await badge(p, id, x, y, w, h);
}

async function badge(p, id, x, y, w, h) {
    const b = binding(id), size = Math.max(7, Math.min(10, w * .34));
    await p.image(`interface/citizens/${b.role}.png`, x + w - size, y + h - size, size, size,
                  {contain : false});
}

async function buildAssets() {
    const entries = [];
    for (const role of roles) {
        const vector = `interface/citizens/${role}.svg`, file = vector.replace('.svg', '.png'),
              source = C.svg(32, 32, cue(role)),
              bytes = await C.sharp(Buffer.from(source)).resize(128, 128).png().toBuffer();
        C.write(C.path.join(C.pack, vector), source);
        C.write(C.path.join(C.pack, file), bytes);
        entries.push({
            id : `citizen-cue.${role}`,
            label : role,
            category : 'citizen cues',
            kind : 'vector',
            file,
            vector,
            width : 128,
            height : 128,
            sha256 : C.sha(bytes),
            sourceSha256 : C.sha(Buffer.from(source))
        });
    }
    const m = C.read(C.path.join(C.pack, 'manifest.json'));
    m.entries = m.entries.filter(e => !e.id.startsWith('citizen-cue.')).concat(entries);
    C.json(C.path.join(C.pack, 'manifest.json'), m);
    C.json(C.path.join(C.pack, 'interface/citizens/bindings.json'), {
        source : [
            'src/auto/city.cpp:12165-12284', 'src/auto/graphics.cpp:999-1044', 'src/auto/civ.cpp:2907-2930'
        ],
        eraRequirements :
            [ 'default', 'Invention AND Philosophy', 'Industrialization', 'Electronics AND Automobile' ],
        ordinaryOrder :
            'Continuous man/woman alternation across mood groups; specialists use one role portrait per era.',
        bindings : Array.from({length : 44}, (_, i) => binding(100 + i))
    });
}

async function review(W) {
    const E = require('./economy.cjs'), rows = [], checks = [];
    for (let era = 0; era < 4; era++) {
        const fixture = `review/fixtures/citizens-${eras[era]}.txt`;
        C.write(C.path.join(C.pack, fixture), `11 40 30 2 4 3\n${E.yieldFixture}citizens ${era} 2\n`);
        const trace = W.windowEngine('city-window', C.path.join(C.pack, fixture));
        assert.deepEqual(trace, W.windowEngine('city-window', C.path.join(C.pack, fixture), 'Debug'));
        const citizens = trace.commands.filter(c => !c.shade && /^icon\/1\d\d$/.test(c.asset));
        const ids = citizens.map(c => +c.asset.split('/')[1]);
        assert.deepEqual(ids, Array.from({length : 11}, (_, i) => 100 + era * 11 + i));
        rows.push(ids);
        checks.push({era : eras[era], fixture, sourceSpriteIds : ids, debugReleaseEqual : true});
    }
    const originalPath = C.path.join(C.pack, 'review/original-local/bindings.json'),
          originals = C.fs.existsSync(originalPath) ? C.read(originalPath).bindings : null;
    for (const stage of ['current', 'hd', 'proposed', ...(originals ? [ 'original' ] : [])]) {
        const p = new W.Painter(1110, 710, 1);
        await p.text('Citizen eras · all 11 source slots', 18, 7, 1050, 22);
        await p.text(
            'Large: 3× logical size. Small: native 27×30. Mood/profession badges appear only in the enhanced proposal.',
            18, 36, 1070, 12);
        for (let row = 0; row < 4; row++) {
            const y = 70 + row * 158;
            await p.text(eras[row], 12, y + 30, 120, 16);
            for (let col = 0; col < 11; col++) {
                const id = rows[row][col], b = binding(id), x = 132 + col * 88;
                let bytes;
                if (stage === 'original')
                    bytes = C.fs.readFileSync(C.path.join(C.pack, originals[`icon/${id}`].file));
                else {
                    const tile = new W.Painter(27, 30, stage === 'current' ? 1 : 2);
                    await draw(tile, id, 0, 0, 27, 30, stage === 'proposed');
                    bytes = await tile.finish();
                }
                C.blit(p.dst,
                       await C.raw(bytes, 81, 90,
                                   stage === 'current' || stage === 'original' ? 'nearest' : 'lanczos3'),
                       x, y);
                C.blit(p.dst, await C.raw(bytes, 27, 30), x + 27, y + 95);
                await p.text(b.role === 'tax-collector' ? 'tax collector' : b.role, x - 1, y + 127, 87, 10,
                             '#ead6a2', 'middle');
                if (b.gender)
                    await p.text(b.gender, x, y + 139, 87, 10, '#b3c6bc', 'middle');
            }
        }
        const file =
            stage === 'original' ? 'review/original-local/citizens.png' : `review/citizens-${stage}.png`;
        C.write(C.path.join(C.pack, file), await p.finish());
    }
    const plans = C.read(C.path.join(C.pack, 'review/window-draw-plans.json'));
    for (const s of C.read(C.path.join(C.pack, 'review/scenes.json')).filter(s => s.mode === 'city-window')) {
        const trace = W.windowEngine(s.mode, C.path.join(C.pack, s.fixture)),
              commands = trace.commands.filter(c => !c.shade && /^icon\/1\d\d$/.test(c.asset));
        let ordinary = 0;
        for (const c of commands) {
            const b = binding(+c.asset.split('/')[1]);
            assert.equal(b.era, eras[s.citizenEra]);
            if (b.gender)
                assert.equal(b.gender, [ 'man', 'woman' ][ordinary++ % 2]);
        }
        for (const stage of ['current', 'hd', 'proposed']) {
            const portraits =
                plans[`${s.id}-${stage}`].filter(o => /sprites\/citizen(?:s|-pairs)\//.test(o.file));
            assert.deepEqual(portraits.slice(0, commands.length),
                             commands.map(c => ({
                                              file : binding(+c.asset.split('/')[1]).file,
                                              x : c.x,
                                              y : c.y,
                                              width : c.width,
                                              height : c.height
                                          })));
            const badges = plans[`${s.id}-${stage}`].filter(o => o.file.startsWith('interface/citizens/'));
            assert.equal(badges.length, stage === 'proposed' ? commands.length : 0);
            if (stage === 'proposed') {
                const ops = plans[`${s.id}-${stage}`];
                assert(ops.indexOf(badges[0]) > ops.indexOf(portraits[commands.length - 1]),
                       'Cues must follow the complete portrait row');
                badges.forEach((b, i) => {
                    const c = commands[i];
                    assert(b.x >= c.x && b.y >= c.y && b.x + b.width <= c.x + c.width + .001 &&
                               b.y + b.height <= c.y + c.height + .001,
                           'Cue inside source frame');
                    if (i)
                        assert(b.x >= badges[i - 1].x + badges[i - 1].width, 'Crowded cues remain separated');
                });
            }
        }
    }
    const edge = C.path.join(C.root, 'build/atlas-review/citizen-edge.txt'),
          valid = `11 40 30 2 4 3\n${E.yieldFixture}`;
    let rejectedStates = 0;
    for (const config of ['Debug', 'Release']) {
        for (const input of [valid + 'citizens 4 2\n', valid + 'citizens 2 5\n',
                             valid.replace('11 40 30 2 4 3', '11 40 30 2 4 4')]) {
            C.write(edge, input);
            assert.throws(() => W.windowEngine('city-window', edge, config), /fixture domain/);
            rejectedStates++;
        }
        C.write(edge, valid);
        const ids = W.windowEngine('city-window', edge, config)
                        .commands.filter(c => !c.shade && /^icon\/1\d\d$/.test(c.asset))
                        .map(c => +c.asset.split('/')[1]);
        assert(ids.every(id => id >= 122 && id < 133), 'Old fixtures default to industrial');
    }
    C.json(C.path.join(C.pack, 'review/citizen-validation.json'), {
        status : 'pass',
        rejectedStates,
        legacyEraDefault : 2,
        eraCases : checks,
        fullWindowStages : 6,
        uniquePortraits : new Set(Array.from({length : 44}, (_, i) => binding(100 + i).file)).size
    });
    const panels = [
        [ 'original', 'Original game artwork', 'original-local/citizens.png' ],
        [ 'current', 'Replacement · native resolution', 'citizens-current.png' ],
        [ 'hd', 'HD only', 'citizens-hd.png' ],
        [ 'proposed', 'HD + mood/profession cues', 'citizens-proposed.png' ]
    ];
    C.write(
        C.path.join(C.pack, 'review/citizens.html'),
        `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Citizen eras and roles</title><style>body{background:#132020;color:#eadfc6;font:16px/1.5 system-ui;margin:28px}a{color:#d9c28a}.panels{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;border:1px solid #4d6259;padding:12px}img{width:100%;height:auto}figcaption{font-weight:600;margin-bottom:12px}.missing{color:#ccbfa2}@media(max-width:1000px){.panels{grid-template-columns:1fr}}</style><a href="../index.html">Back to graphics review</a><h1>Citizens across four eras</h1><p>The source chooses 11 slots per era: happy, content, unhappy and angry male/female pairs, then entertainer, tax collector and scientist. Ordinary citizens alternate continuously across mood groups; specialists do not alternate.</p><p>Era thresholds: ancient by default; Invention + Philosophy; Industrialization; Electronics + Automobile. Era is based on technology, not the calendar year. Native and HD-only use the same portraits and logical frames. Enhanced adds small shape-distinct mood and profession cues.</p><div class="panels">${
            panels
                .map(
                    ([ stage, title, file ]) => `<figure><figcaption>${title}</figcaption><a href="${
                        file}"><img src="${file}" alt="${title}: all four eras and eleven citizen slots" ${
                        stage === 'original'
                            ? 'onerror="this.closest(\'figure\').innerHTML=\'<figcaption>Original game artwork</figcaption><p class=missing>Original artwork is not bundled. Build the local original bindings and rerun citizens.cjs.</p>\'"'
                            : ''}></a></figure>`)
                .join(
                    '')}</div><p>Original pixels stay in the ignored original-local folder. This is an artwork/renderer review; no game source changes are included. <a href="citizen-validation.json">Validation</a> · <a href="../interface/citizens/bindings.json">Sprite bindings and source references</a></p></html>`);
    console.log('Citizen review passed: four eras, 44 slots, six window variants');
}

module.exports = {
    eras,
    roles,
    binding,
    draw,
    badge,
    buildAssets,
    review
};
if (require.main === module)
    review(require('./windows.cjs')).catch(e => {
        console.error(e);
        process.exitCode = 1;
    });
