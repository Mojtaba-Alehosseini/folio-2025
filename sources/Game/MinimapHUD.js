import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'

/**
 * MinimapHUD – a small always-visible radar in the bottom-right corner.
 *
 * It reuses the same map images (map-day.webp / map-night.webp) and the
 * same worldToMap coordinate conversion as the full-screen Map.js, but
 * renders as a compact HUD element that is permanently shown while the
 * player is driving.
 */
export class MinimapHUD
{
    constructor()
    {
        this.game = Game.getInstance()

        this.element        = this.game.domElement.querySelector('.js-minimap')
        this.textureElement = this.element.querySelector('.js-minimap-texture')
        this.playerElement  = this.element.querySelector('.js-minimap-player')

        // Track previous values to avoid unnecessary style writes
        this.previousTextureUrl  = null
        this.previousRoundedX    = null
        this.previousRoundedZ    = null

        this.setTexture()

        // Update on every tick (runs after physics, priority 15)
        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 15)

        // Swap day/night texture whenever the day cycle ticks
        this.game.dayCycles.intervalEvents.get('night').events.on('change', () =>
        {
            this.updateTexture()
        })
    }

    // ------------------------------------------------------------------

    setTexture()
    {
        this.textureElement.addEventListener('load', () =>
        {
            this.textureElement.classList.add('is-visible')
        })

        this.updateTexture()
    }

    updateTexture()
    {
        const url = this.game.dayCycles.intervalEvents.get('night').inInterval
            ? 'ui/map/map-night.webp'
            : 'ui/map/map-day.webp'

        if (url !== this.previousTextureUrl)
        {
            this.textureElement.classList.remove('is-visible')
            this.previousTextureUrl = url
            this.textureElement.src = url
        }
    }

    // ------------------------------------------------------------------

    worldToMap(x, z)
    {
        let mx = x / this.game.terrain.size + 0.5
        let my = z / this.game.terrain.size + 0.5
        mx = clamp(mx, 0, 1)
        my = clamp(my, 0, 1)
        return { x: mx, y: my }
    }

    // ------------------------------------------------------------------

    update()
    {
        const px = Math.round(this.game.player.position.x)
        const pz = Math.round(this.game.player.position.z)

        if (px === this.previousRoundedX && pz === this.previousRoundedZ)
            return

        this.previousRoundedX = px
        this.previousRoundedZ = pz

        const mapPos = this.worldToMap(px, pz)

        // Position the player dot
        this.playerElement.style.left      = `${mapPos.x * 100}%`
        this.playerElement.style.top       = `${mapPos.y * 100}%`
        this.playerElement.style.transform = `translate(-50%, -50%) rotate(${-this.game.physicalVehicle.yRotation}rad)`
    }
}
