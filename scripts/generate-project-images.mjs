/**
 * Draws the projects-area artwork and compresses it to KTX2.
 *
 *   node scripts/generate-project-images.mjs [--png <dir>]
 *
 * Every card is built from vector paths using the Pally faces that already
 * ship in static/fonts, so output does not depend on system fonts and is
 * byte-reproducible. Text is laid out here rather than in Blender because the
 * card content is derived from the repositories themselves — see
 * scripts/projects-data.mjs.
 *
 * Encoding matches the ETC1S preset the rest of the static assets use
 * (see scripts/compress.js), but goes through ktx2-encoder's Node build so it
 * works without a local toktx install.
 */
import fs from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import opentype from 'opentype.js'
import { encodeToKTX2 } from 'ktx2-encoder'
import { PROJECTS, PALETTE } from './projects-data.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = path.join(ROOT, 'static/projects/images')
// Inputs live under resources/ so they are not copied into the build
const PHOTO_DIR = path.join(ROOT, 'resources/projects')

const W = 960
const H = 540
const PAD = 58

const svgFlag = process.argv.indexOf('--svg')
const svgDir = svgFlag > -1 ? process.argv[svgFlag + 1] : null

/* ---------------------------------------------------------------- fonts -- */

const loadFont = (file) =>
{
    const buffer = readFileSync(path.join(ROOT, 'static/fonts', file))
    return opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
}

const fonts = {
    bold: loadFont('Pally-Bold.ttf'),
    medium: loadFont('Pally-Medium.ttf'),
    regular: loadFont('Pally-Regular.ttf')
}

const widthOf = (font, text, size) => font.getAdvanceWidth(text, size)

/**
 * Serialise a glyph outline ourselves instead of using Path.toPathData().
 *
 * opentype.js rounds with `Math.round(decimalPart + "e+" + places)`. When a
 * coordinate's fractional part is small enough that JS stringifies it in
 * exponential form, that builds "4.9e-14e+2", which parses as NaN — so glyphs
 * silently render as fragments at some sub-pixel offsets but not others.
 */
function pathData(path, places = 2)
{
    const factor = 10 ** places
    const n = (value) => String(Math.round(value * factor) / factor)
    let out = ''

    for(const command of path.commands)
    {
        if(command.type === 'M') out += `M${n(command.x)} ${n(command.y)}`
        else if(command.type === 'L') out += `L${n(command.x)} ${n(command.y)}`
        else if(command.type === 'Q') out += `Q${n(command.x1)} ${n(command.y1)} ${n(command.x)} ${n(command.y)}`
        else if(command.type === 'C') out += `C${n(command.x1)} ${n(command.y1)} ${n(command.x2)} ${n(command.y2)} ${n(command.x)} ${n(command.y)}`
        else if(command.type === 'Z') out += 'Z'
    }

    return out
}

/** Text as filled vector paths — no font lookup happens at render time. */
function text(font, string, { x, y, size, fill, anchor = 'start', opacity = 1, tracking = 0 })
{
    let advance = widthOf(font, string, size)

    if(tracking)
        advance += tracking * (string.length - 1)

    let originX = x

    if(anchor === 'middle') originX = x - advance / 2
    else if(anchor === 'end') originX = x - advance

    // opentype has no letter-spacing, so place glyph by glyph when tracking
    if(!tracking)
    {
        const d = pathData(font.getPath(string, originX, y, size))
        return `<path d="${d}" fill="${fill}" fill-opacity="${opacity}"/>`
    }

    let cursor = originX
    let out = ''

    for(const character of string)
    {
        out += `<path d="${pathData(font.getPath(character, cursor, y, size))}" fill="${fill}" fill-opacity="${opacity}"/>`
        cursor += widthOf(font, character, size) + tracking
    }

    return out
}

function wrap(font, string, size, maxWidth)
{
    const lines = []
    let line = ''

    for(const word of string.split(' '))
    {
        const candidate = line ? `${line} ${word}` : word

        if(line && widthOf(font, candidate, size) > maxWidth)
        {
            lines.push(line)
            line = word
        }
        else line = candidate
    }

    if(line) lines.push(line)

    return lines
}

/* --------------------------------------------------------------- chrome -- */

/** Deterministic PRNG so re-running the script reproduces identical art. */
function rng(seed)
{
    let state = seed >>> 0
    return () =>
    {
        state = (state + 0x6D2B79F5) >>> 0
        let t = Math.imul(state ^ (state >>> 15), 1 | state)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

const seedOf = (key) => [ ...key ].reduce((total, character) => total + character.charCodeAt(0), 0)

function frame(project, index, total)
{
    const label = `${String(index + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`

    return [
        `<rect width="${W}" height="${H}" fill="${PALETTE.ink}"/>`,
        `<rect x="0" y="0" width="${W}" height="6" fill="${project.accent}"/>`,
        text(fonts.medium, label, { x: PAD, y: H - PAD + 6, size: 20, fill: PALETTE.muted, tracking: 2 }),
        text(fonts.medium, 'MOJTABA ALEHOSSEINI', {
            x: W - PAD, y: H - PAD + 6, size: 18, fill: PALETTE.muted, anchor: 'end', opacity: 0.75, tracking: 3
        })
    ].join('')
}

function chips(project, y)
{
    let out = ''
    let cursor = PAD

    for(const item of project.stack)
    {
        const size = 22
        const width = widthOf(fonts.medium, item, size) + 34

        out += `<rect x="${cursor}" y="${y - 26}" width="${width.toFixed(1)}" height="38" rx="19" fill="${project.accent}" fill-opacity="0.14"/>`
        out += text(fonts.medium, item, { x: cursor + 17, y, size, fill: project.accent })
        cursor += width + 12
    }

    return out
}

/* ---------------------------------------------------------------- faces -- */

function coverFace(project, index, total)
{
    const titleSize = 74
    const titleLines = wrap(fonts.bold, project.title, titleSize, W - PAD * 2)
    const blurbLines = wrap(fonts.regular, project.blurb, 27, W - PAD * 2 - 120)

    let out = frame(project, index, total)
    let y = 190 - (titleLines.length - 1) * 40

    out += `<circle cx="${PAD + 9}" cy="112" r="9" fill="${project.accent}"/>`

    for(const line of titleLines)
    {
        out += text(fonts.bold, line, { x: PAD, y, size: titleSize, fill: PALETTE.paper })
        y += 80
    }

    y += 6
    out += `<rect x="${PAD}" y="${y}" width="72" height="3" fill="${project.accent}"/>`
    y += 48

    for(const line of blurbLines)
    {
        out += text(fonts.regular, line, { x: PAD, y, size: 27, fill: PALETTE.paper, opacity: 0.62 })
        y += 38
    }

    return out + chips(project, H - PAD - 52)
}

function notesFace(project, index, total)
{
    let out = frame(project, index, total)

    out += text(fonts.medium, 'HIGHLIGHTS', { x: PAD, y: 110, size: 20, fill: project.accent, tracking: 4 })

    const face = project.faces.find(item => item.kind === 'notes')
    let y = 208

    for(const [ i, note ] of face.notes.entries())
    {
        out += text(fonts.bold, String(i + 1).padStart(2, '0'), {
            x: PAD, y, size: 30, fill: project.accent, opacity: 0.5
        })
        out += text(fonts.medium, note, { x: PAD + 68, y, size: 34, fill: PALETTE.paper })
        out += `<rect x="${PAD}" y="${y + 30}" width="${W - PAD * 2}" height="1" fill="${PALETTE.paper}" fill-opacity="0.1"/>`
        y += 92
    }

    return out
}

// Where a real plot is inset on a photo card
const PHOTO_BOX = { x: PAD, y: 140, width: W - PAD * 2, height: H - 140 - 108 }

function photoFace(project, index, total, face)
{
    return frame(project, index, total)
        + text(fonts.medium, face.caption.toUpperCase(), { x: PAD, y: 110, size: 20, fill: project.accent, tracking: 4 })
}

/* -------------------------------------------------------------- graphics -- */

const graphics = {
    // Two hand skeletons bracketing a framed region
    handFrame(project)
    {
        const accent = project.accent
        const cx = W / 2
        const cy = 300
        const boxW = 300
        const boxH = 190
        let out = ''

        out += `<rect x="${cx - boxW / 2}" y="${cy - boxH / 2}" width="${boxW}" height="${boxH}" fill="${accent}" fill-opacity="0.08"/>`

        // corner brackets
        for(const [ sx, sy ] of [ [ -1, -1 ], [ 1, -1 ], [ -1, 1 ], [ 1, 1 ] ])
        {
            const x = cx + sx * boxW / 2
            const y = cy + sy * boxH / 2
            out += `<path d="M ${x - sx * 46} ${y} L ${x} ${y} L ${x} ${y - sy * 40}" stroke="${accent}" stroke-width="5" fill="none" stroke-linecap="square"/>`
        }

        // a hand: wrist plus five splayed fingers of landmark dots
        const hand = (originX, originY, flip) =>
        {
            let hOut = ''
            const spread = [ -0.95, -0.45, 0, 0.45, 0.9 ]

            for(const [ f, angle ] of spread.entries())
            {
                let x = originX
                let y = originY
                const joints = f === 0 ? 3 : 4
                const length = f === 0 ? 30 : 34 - Math.abs(angle) * 8

                for(let j = 0; j < joints; j++)
                {
                    const nx = x + Math.sin(angle) * length * flip
                    const ny = y - Math.cos(angle) * length
                    hOut += `<line x1="${x.toFixed(1)}" y1="${y.toFixed(1)}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${accent}" stroke-width="2.5" stroke-opacity="0.85"/>`
                    hOut += `<circle cx="${nx.toFixed(1)}" cy="${ny.toFixed(1)}" r="4.5" fill="${accent}"/>`
                    x = nx
                    y = ny
                }
            }

            hOut += `<circle cx="${originX}" cy="${originY}" r="7" fill="${accent}"/>`
            return hOut
        }

        out += hand(cx - boxW / 2 - 78, cy + 96, 1)
        out += hand(cx + boxW / 2 + 78, cy + 96, -1)

        return out
    },

    // Sampled throughput bars with an energy trace laid over them
    gauge(project)
    {
        const accent = project.accent
        const random = rng(seedOf(project.key))
        const baseY = 400
        const count = 16
        const gap = 40
        const startX = PAD + 20
        let out = ''
        const points = []

        for(let i = 0; i < count; i++)
        {
            const height = 52 + random() * 150
            const x = startX + i * gap
            out += `<rect x="${x}" y="${(baseY - height).toFixed(1)}" width="22" height="${height.toFixed(1)}" rx="3" fill="${accent}" fill-opacity="${(0.28 + (height / 260) * 0.6).toFixed(2)}"/>`
            points.push([ x + 11, baseY - height - 26 - random() * 34 ])
        }

        out += `<polyline points="${points.map(([ x, y ]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${PALETTE.paper}" stroke-width="2.5" stroke-opacity="0.55"/>`

        for(const [ x, y ] of points)
            out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${PALETTE.paper}" fill-opacity="0.75"/>`

        out += `<line x1="${PAD}" y1="${baseY}" x2="${W - PAD}" y2="${baseY}" stroke="${PALETTE.paper}" stroke-width="1.5" stroke-opacity="0.22"/>`
        out += text(fonts.medium, 'samples / watt', { x: W - PAD, y: baseY + 34, size: 20, fill: PALETTE.muted, anchor: 'end' })

        return out
    },

    // Data -> train -> gate -> registry, as a small DAG
    pipeline(project)
    {
        const accent = project.accent
        const stages = [ 'data', 'train', 'eval', 'gate', 'registry' ]
        const y = 300
        const startX = PAD + 46
        const step = (W - PAD * 2 - 92) / (stages.length - 1)
        let out = ''

        for(let i = 0; i < stages.length - 1; i++)
        {
            const x1 = startX + i * step + 34
            const x2 = startX + (i + 1) * step - 34
            out += `<line x1="${x1.toFixed(1)}" y1="${y}" x2="${x2.toFixed(1)}" y2="${y}" stroke="${accent}" stroke-width="3" stroke-opacity="0.5"/>`
            out += `<path d="M ${(x2 - 11).toFixed(1)} ${y - 7} L ${x2.toFixed(1)} ${y} L ${(x2 - 11).toFixed(1)} ${y + 7} Z" fill="${accent}" fill-opacity="0.8"/>`
        }

        for(const [ i, stage ] of stages.entries())
        {
            const x = startX + i * step
            const isGate = stage === 'gate'
            out += `<circle cx="${x.toFixed(1)}" cy="${y}" r="32" fill="${PALETTE.ink}" stroke="${accent}" stroke-width="${isGate ? 5 : 2.5}" stroke-opacity="${isGate ? 1 : 0.75}"/>`

            if(isGate)
                out += `<circle cx="${x.toFixed(1)}" cy="${y}" r="12" fill="${accent}"/>`

            out += text(fonts.medium, stage, { x, y: y + 68, size: 22, fill: PALETTE.paper, anchor: 'middle', opacity: 0.75 })
        }

        // a dashed feedback arc from the gate back to training
        const gateX = startX + 3 * step
        const trainX = startX + step
        out += `<path d="M ${gateX} ${y - 34} C ${gateX} ${y - 120}, ${trainX} ${y - 120}, ${trainX} ${y - 34}" fill="none" stroke="${PALETTE.paper}" stroke-width="2" stroke-opacity="0.3" stroke-dasharray="7 7"/>`

        return out
    },

    // Difference blobs with tracker boxes
    blobs(project)
    {
        const accent = project.accent
        const random = rng(seedOf(project.key))
        let out = `<rect x="${PAD}" y="150" width="${W - PAD * 2}" height="290" fill="${PALETTE.paper}" fill-opacity="0.03"/>`

        for(let x = PAD; x <= W - PAD; x += 61)
            out += `<line x1="${x}" y1="150" x2="${x}" y2="440" stroke="${PALETTE.paper}" stroke-width="1" stroke-opacity="0.06"/>`

        for(let i = 0; i < 5; i++)
        {
            const cx = PAD + 90 + random() * (W - PAD * 2 - 190)
            // keep the box and its id label inside the panel
            const cy = 234 + random() * 140
            const r = 26 + random() * 28

            let blob = ''
            const steps = 12

            for(let s = 0; s < steps; s++)
            {
                const angle = (s / steps) * Math.PI * 2
                const radius = r * (0.68 + random() * 0.5)
                const px = cx + Math.cos(angle) * radius
                const py = cy + Math.sin(angle) * radius * 0.82
                blob += `${s === 0 ? 'M' : 'L'} ${px.toFixed(1)} ${py.toFixed(1)} `
            }

            out += `<path d="${blob}Z" fill="${accent}" fill-opacity="0.42"/>`
            out += `<rect x="${(cx - r - 12).toFixed(1)}" y="${(cy - r - 10).toFixed(1)}" width="${(r * 2 + 24).toFixed(1)}" height="${(r * 2 + 20).toFixed(1)}" fill="none" stroke="${accent}" stroke-width="2" stroke-dasharray="6 5"/>`
            out += text(fonts.medium, `id ${i + 1}`, { x: cx - r - 12, y: cy - r - 18, size: 17, fill: accent })
        }

        return out
    },

    // A population scattering then tightening, with a fitness trace
    evolution(project)
    {
        const accent = project.accent
        const random = rng(seedOf(project.key))
        const left = PAD
        const right = W - PAD
        const baseY = 386
        const topY = 176
        let out = ''
        const generations = 22

        for(let g = 0; g < generations; g++)
        {
            const t = g / (generations - 1)
            const x = left + t * (right - left)
            const spread = (1 - t) ** 1.6 * 110 + 6

            for(let p = 0; p < 7; p++)
            {
                const y = baseY - t * (baseY - topY) - (random() - 0.5) * spread * 2
                out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2.4 + random() * 2.6).toFixed(1)}" fill="${accent}" fill-opacity="${(0.25 + t * 0.6).toFixed(2)}"/>`
            }
        }

        const trace = []

        for(let g = 0; g < generations; g++)
        {
            const t = g / (generations - 1)
            trace.push([ left + t * (right - left), baseY - (1 - (1 - t) ** 2.2) * (baseY - topY) ])
        }

        out += `<polyline points="${trace.map(([ x, y ]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}" fill="none" stroke="${PALETTE.paper}" stroke-width="3" stroke-opacity="0.6"/>`
        out += `<line x1="${left}" y1="${baseY + 16}" x2="${right}" y2="${baseY + 16}" stroke="${PALETTE.paper}" stroke-width="1.5" stroke-opacity="0.22"/>`
        out += text(fonts.medium, 'generations', { x: left, y: baseY + 48, size: 20, fill: PALETTE.muted })
        out += text(fonts.medium, 'best fitness', { x: right, y: topY - 22, size: 20, fill: PALETTE.muted, anchor: 'end' })

        return out
    },

    // Loader / scale / haul served queue network
    queue(project)
    {
        const accent = project.accent
        const y = 292
        const servers = [ 'loader', 'scale', 'haul' ]
        const startX = PAD + 96
        const step = 268
        let out = ''

        for(const [ i, server ] of servers.entries())
        {
            const x = startX + i * step

            // waiting trucks
            for(let q = 0; q < 3 - i; q++)
            {
                const qx = x - 62 - q * 26
                out += `<rect x="${qx}" y="${y - 13}" width="18" height="26" rx="3" fill="${accent}" fill-opacity="${(0.65 - q * 0.16).toFixed(2)}"/>`
            }

            out += `<rect x="${x - 34}" y="${y - 40}" width="68" height="80" rx="6" fill="${PALETTE.ink}" stroke="${accent}" stroke-width="3"/>`
            out += `<circle cx="${x}" cy="${y - 8}" r="12" fill="${accent}" fill-opacity="0.85"/>`
            out += text(fonts.medium, server, { x, y: y + 26, size: 19, fill: PALETTE.paper, anchor: 'middle', opacity: 0.8 })

            if(i < servers.length - 1)
            {
                const x2 = x + step - 96
                out += `<line x1="${x + 40}" y1="${y}" x2="${x2}" y2="${y}" stroke="${accent}" stroke-width="2.5" stroke-opacity="0.45"/>`
                out += `<path d="M ${x2 - 11} ${y - 7} L ${x2} ${y} L ${x2 - 11} ${y + 7} Z" fill="${accent}" fill-opacity="0.8"/>`
            }
        }

        // return leg
        const firstX = startX
        const lastX = startX + (servers.length - 1) * step
        out += `<path d="M ${lastX} ${y + 46} C ${lastX} ${y + 150}, ${firstX} ${y + 150}, ${firstX} ${y + 46}" fill="none" stroke="${PALETTE.paper}" stroke-width="2" stroke-opacity="0.32" stroke-dasharray="8 7"/>`
        out += text(fonts.medium, 'return', { x: (firstX + lastX) / 2, y: y + 152, size: 20, fill: PALETTE.muted, anchor: 'middle' })

        return out
    }
}

function graphicFace(project, index, total, face)
{
    return frame(project, index, total)
        + text(fonts.medium, project.title.toUpperCase(), { x: PAD, y: 110, size: 20, fill: project.accent, tracking: 4 })
        + graphics[face.graphic](project)
}

/* ----------------------------------------------------------------- build -- */

const imageDecoder = async (buffer) =>
{
    const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
    return { data: new Uint8Array(data), width: info.width, height: info.height }
}

async function render(project, faceIndex, total)
{
    const face = project.faces[faceIndex]
    let body

    if(face.kind === 'cover') body = coverFace(project, faceIndex, total)
    else if(face.kind === 'notes') body = notesFace(project, faceIndex, total)
    else if(face.kind === 'photo') body = photoFace(project, faceIndex, total, face)
    else body = graphicFace(project, faceIndex, total, face)

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`

    if(svgDir)
        await fs.writeFile(path.join(svgDir, `${project.key}-${faceIndex + 1}.svg`), svg)

    let image = sharp(Buffer.from(svg))

    if(face.kind === 'photo')
    {
        // Inset the real plot, keeping its own white background so it still
        // reads as a screenshot rather than a chart we redrew. Trim first:
        // matplotlib leaves a wide margin that would otherwise dominate.
        const margin = 18
        const plate = await sharp(path.join(PHOTO_DIR, face.photo))
            .flatten({ background: '#ffffff' })
            .trim({ background: '#ffffff', threshold: 12 })
            .resize(PHOTO_BOX.width - margin * 2, PHOTO_BOX.height - margin * 2, {
                fit: 'inside',
                withoutEnlargement: false
            })
            .extend({ top: margin, bottom: margin, left: margin, right: margin, background: '#ffffff' })
            .toBuffer()

        const { width: plateW, height: plateH } = await sharp(plate).metadata()

        image = sharp(await image.png().toBuffer()).composite([ {
            input: plate,
            left: Math.round(PHOTO_BOX.x + (PHOTO_BOX.width - plateW) / 2),
            top: Math.round(PHOTO_BOX.y + (PHOTO_BOX.height - plateH) / 2)
        } ])
    }

    return image.png({ compressionLevel: 9 }).toBuffer()
}

async function main()
{
    const pngFlag = process.argv.indexOf('--png')
    const pngDir = pngFlag > -1 ? process.argv[pngFlag + 1] : null

    if(pngDir) await fs.mkdir(pngDir, { recursive: true })
    if(svgDir) await fs.mkdir(svgDir, { recursive: true })
    await fs.mkdir(OUT_DIR, { recursive: true })

    for(const project of PROJECTS)
    {
        for(let i = 0; i < project.faces.length; i++)
        {
            const png = await render(project, i, project.faces.length)
            const name = `${project.key}-${i + 1}`

            if(pngDir) await fs.writeFile(path.join(pngDir, `${name}.png`), png)

            const ktx = await encodeToKTX2(new Uint8Array(png), {
                isUASTC: false,
                qualityLevel: 255,
                isPerceptual: true,
                isSetKTX2SRGBTransferFunc: true,
                generateMipmap: false,
                isKTX2File: true,
                kvData: { KTXorientation: 'rd' },
                imageDecoder
            })

            await fs.writeFile(path.join(OUT_DIR, `${name}.ktx`), Buffer.from(ktx))
            console.log(`  ${name}.ktx  ${(ktx.byteLength / 1024).toFixed(1)} KB`)
        }
    }
}

await main()
