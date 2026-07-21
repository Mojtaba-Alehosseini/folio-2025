import * as THREE from 'three/webgpu'

let top = 0
export class TextCanvas
{
    constructor(
        fontFamily = 'Comic Sans',
        fontWeight = '400',
        fontSize = 10,
        width = null,
        height = null,
        density = 1,
        horizontalAlign = 'center',
        lineHeight = 1
    )
    {
        this.lines = []
        this.fontFamily = fontFamily
        this.fontWeight = fontWeight
        this.fontSizePx = fontSize * density
        this.font = `${fontWeight} ${this.fontSizePx}px "${fontFamily}"`
        this.width = Math.ceil(width * density)
        this.height = Math.ceil(height * density)
        this.horizontalAlign = horizontalAlign
        this.lineHeight = lineHeight * density

        this.setCanvas()
        this.setTexture()
    }

    setCanvas()
    {
        this.canvas = document.createElement('canvas')
        this.canvas.width = this.width
        this.canvas.height = this.height
        this.canvas.style.position = 'fixed'
        this.canvas.style.zIndex = 999
        this.canvas.style.top = `${top}px`
        this.canvas.style.left = 0
        top += this.height + 10
        // document.body.append(this.canvas)

        this.context = this.canvas.getContext('2d')
        this.context.font = this.font
    }

    setTexture()
    {
        this.texture = new THREE.Texture(this.canvas)
        this.texture.colorSpace = THREE.SRGBColorSpace
        this.texture.minFilter = THREE.NearestFilter
        this.texture.magFilter = THREE.NearestFilter
        this.texture.flipY = false
        this.texture.generateMipmaps = false
    }

    updateText(text)
    {
        this.lines = []

        if(typeof text === 'string')
            this.lines.push(text)
        else if(text instanceof Array)
            this.lines = text

        this.draw()
    }

    getMeasure()
    {
        const output = {}
        output.width = 0
        
        for(const line of this.lines)
        {
            const measure = this.context.measureText(line)

            if(measure.width > output.width)
                output.width = measure.width
        }

        return output
    }

    /**
     * Shrink the font until the longest line fits. Without this, anything
     * wider than the canvas is silently cropped mid-glyph — which is what the
     * longer repository URLs used to do.
     */
    fitFont()
    {
        this.context.font = this.font

        let widest = 0

        for(const line of this.lines)
            widest = Math.max(widest, this.context.measureText(line).width)

        const usable = this.width * 0.98

        if(widest > usable && widest > 0)
        {
            const size = Math.max(1, Math.floor(this.fontSizePx * (usable / widest)))
            this.context.font = `${this.fontWeight} ${size}px "${this.fontFamily}"`
        }
    }

    draw()
    {
        this.fitFont()

        // Clear
        this.context.fillStyle = '#000000'
        this.context.fillRect(0, 0, this.width, this.height)

        this.context.textAlign = this.horizontalAlign
        this.context.textBaseline = 'middle'
        this.context.fillStyle = '#ffffff'

        let i = 0
        for(const line of this.lines)
        {
            // const y = this.height / (this.lines.length + 1) * (i + 1)
            const y = this.height / 2 + (i - (this.lines.length - 1) / 2) * this.lineHeight

            let x = null
            if(this.horizontalAlign === 'center')
                x = this.width / 2
            else if(this.horizontalAlign === 'left')
                x = 0
            else if(this.horizontalAlign === 'right')
                x = this.width

            this.context.fillText(line, x, y)

            i++
        }

        this.texture.needsUpdate = true
    }
}