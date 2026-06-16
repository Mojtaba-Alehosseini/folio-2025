import { clamp } from 'three/src/math/MathUtils.js'
import { Game } from './Game.js'

/**
 * MinimapHUD – a small always-visible radar in the bottom-right corner.
 *
 * Reuses the same map-day / map-night images as the full-screen Map
 * modal but renders as a permanent HUD element while the player drives.
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
        this.previousTextureUrl = null
        this.previousRoundedX   = null
        this.previousRoundedZ   = null
        this.previousNightState = null   // last known inInterval value

        // Wire up the texture load fade-in
        this.textureElement.addEventListener('load', () =>
        {
            this.textureElement.classList.add('is-visible')
        })

        // Start with the day map; update() will switch when night arrives
        this._setTexture('ui/map/map-day.webp')

        // Runs every tick after physics (priority 15)
        this.game.ticker.events.on('tick', () =>
        {
            this.update()
        }, 15)
    }

    // ─────────────────────────────────────────────────────────────────

    _setTexture(url)
    {
        if (url === this.previousTextureUrl) return
        this.textureElement.classList.remove('is-visible')
        this.previousTextureUrl = url
        this.textureElement.src = url
    }

    _isNight()
    {
        try
        {
            const nightInterval = this.game.dayCycles.intervalEvents.get('night')
            return nightInterval ? nightInterval.inInterval : false
        }
        catch (e)
        {
            return false
        }
    }

    // ─────────────────────────────────────────────────────────────────

    worldToMap(x, z)
    {
        const size = this.game.terrain.size
        let mx = clamp(x / size + 0.5, 0, 1)
        let my = clamp(z / size + 0.5, 0, 1)
        return { x: mx, y: my }
    }

    // ─────────────────────────────────────────────────────────────────

    update()
    {
        // ── Texture day/night swap (polled, no event dependency) ──────
        const isNight = this._isNight()
        if (isNight !== this.previousNightState)
        {
            this.previousNightState = isNight
            this._setTexture(isNight ? 'ui/map/map-night.webp' : 'ui/map/map-day.webp')
        }

        // ── Player marker ─────────────────────────────────────────────
        const px = Math.round(this.game.player.position.x)
        const pz = Math.round(this.game.player.position.z)

        if (px === this.previousRoundedX && pz === this.previousRoundedZ) return

        this.previousRoundedX = px
        this.previousRoundedZ = pz

        const mapPos = this.worldToMap(px, pz)

        this.playerElement.style.left      = `${mapPos.x * 100}%`
        this.playerElement.style.top       = `${mapPos.y * 100}%`
        this.playerElement.style.transform =
            `translate(-50%, -50%) rotate(${-this.game.physicalVehicle.yRotation}rad)`
    }
}
