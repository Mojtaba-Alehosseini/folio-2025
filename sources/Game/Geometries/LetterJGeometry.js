import * as THREE from 'three/webgpu'

/**
 * A block letter "J" built to match the other landing-area letters.
 *
 * The letters shipped in areas.glb spell "BRUNOSIMON", so there is no J to
 * reuse for "MOJI". Rather than mangling another letter's vertices, this
 * extrudes a proper J outline using the exact metrics measured from the GLB:
 *
 *   stroke  0.3644  (the "I" is a single stroke: x from -0.1822 to 0.1822)
 *   height  1.4474  (flat-topped letters: y from -0.7237 to 0.7237)
 *   depth   0.4600  (every letter: z from -0.23 to 0.23)
 *
 * The outline is a vertical stem on the right joined to a semicircular hook
 * that sweeps left along the baseline, so the silhouette matches the rounded
 * bottoms of the U, O and S rather than reading as a hard-cornered L.
 *
 * Every vertex carries the same UV as the other letters (0.7356, 0.5), which
 * is a single lookup into palette.png — that is what gives the letters their
 * colour, so the J tints identically without touching the material.
 */
export class LetterJGeometry extends THREE.ExtrudeGeometry
{
    static STROKE = 0.3644
    static HEIGHT = 1.4474
    static DEPTH = 0.46
    static WIDTH = 1.16
    static PALETTE_UV = [ 0.7356, 0.5 ]

    constructor(curveSegments = 10)
    {
        const halfWidth = LetterJGeometry.WIDTH * 0.5   // 0.58
        const halfHeight = LetterJGeometry.HEIGHT * 0.5 // 0.7237
        const stroke = LetterJGeometry.STROKE

        // The hook is a half-annulus: an outer semicircle of radius `outerRadius`
        // and an inner one of radius `innerRadius`, sharing a centre on the
        // vertical midline. Its lowest point is the baseline.
        const outerRadius = halfWidth                   // 0.58
        const innerRadius = outerRadius - stroke        // 0.2156
        const hookCenterY = - halfHeight + outerRadius  // -0.1437

        const shape = new THREE.Shape()

        // Top of the stem, left edge -> right edge
        shape.moveTo(innerRadius, halfHeight)
        shape.lineTo(outerRadius, halfHeight)

        // Right outer edge, down to where the hook begins
        shape.lineTo(outerRadius, hookCenterY)

        // Outer hook: sweep clockwise from the right side, through the
        // baseline, up to the left side
        shape.absarc(0, hookCenterY, outerRadius, 0, - Math.PI, true)

        // Flat cap across the top of the hook's left tip
        shape.lineTo(- innerRadius, hookCenterY)

        // Inner hook: sweep back counter-clockwise to the base of the stem
        shape.absarc(0, hookCenterY, innerRadius, - Math.PI, 0, false)

        // Inner edge of the stem, back up to the start
        shape.lineTo(innerRadius, halfHeight)

        super(shape, {
            depth: LetterJGeometry.DEPTH,
            bevelEnabled: false,
            curveSegments
        })

        this.type = 'LetterJGeometry'
        this.parameters = { curveSegments }

        // Extrusion runs from z = 0 to z = depth; recentre it on the origin so
        // the letter sits in its physics body the same way the others do
        this.translate(0, 0, - LetterJGeometry.DEPTH * 0.5)

        // Flatten every UV onto the letters' shared palette texel
        const uv = this.attributes.uv
        const [ paletteU, paletteV ] = LetterJGeometry.PALETTE_UV

        for(let i = 0; i < uv.count; i++)
        {
            uv.setXY(i, paletteU, paletteV)
        }

        uv.needsUpdate = true

        this.computeBoundingBox()
        this.computeBoundingSphere()
    }
}
