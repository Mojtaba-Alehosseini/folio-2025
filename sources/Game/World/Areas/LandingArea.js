import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'
import { LetterJGeometry } from '../../Geometries/LetterJGeometry.js'

export class LandingArea extends Area
{
    // The letters modelled in areas.glb, in reading order along the baseline
    static SOURCE_LETTERS = 'BRUNOSIMON'

    // Gap between the letters of the word the area actually spells
    static LETTER_GAP = 0.28

    constructor(model)
    {
        super(model)

        this.localTime = uniform(0)

        this.setLetters()
        this.setKiosk()
        this.setControls()
        this.setBonfire()
        this.setAchievement()
    }

    setLetters()
    {
        const references = this.references.items.get('letters')

        if(!references || references.length < LandingArea.SOURCE_LETTERS.length)
            return

        // The letters baked into areas.glb spell "BRUNOSIMON". Sorting them
        // along the baseline recovers reading order, which stays correct even
        // if the GLB is re-exported with a different node order.
        const sorted = [ ...references ].sort((a, b) => a.position.x - b.position.x)

        const pick = (character, occurrence = 0) =>
        {
            let seen = 0

            for(let i = 0; i < LandingArea.SOURCE_LETTERS.length; i++)
            {
                if(LandingArea.SOURCE_LETTERS[i] !== character)
                    continue

                if(seen === occurrence)
                    return sorted[i]

                seen++
            }

            return null
        }

        const widthOf = (reference) =>
        {
            if(!reference.geometry.boundingBox)
                reference.geometry.computeBoundingBox()

            const box = reference.geometry.boundingBox

            return box.max.x - box.min.x
        }

        // "MOJI" — M, O and I are reused as-is; there is no J in "BRUNOSIMON",
        // so the spare U donates its mesh and physics body to a generated one.
        const letterM = pick('M')
        const letterO = pick('O')
        const letterI = pick('I')
        const letterJ = pick('U')

        if(!letterM || !letterO || !letterI || !letterJ)
        {
            console.warn('LandingArea: could not resolve the letters for "MOJI"')
            return
        }

        letterJ.geometry = new LetterJGeometry()

        const layout = [
            { reference: letterM, width: widthOf(letterM) },
            { reference: letterO, width: widthOf(letterO) },
            { reference: letterJ, width: LetterJGeometry.WIDTH },
            { reference: letterI, width: widthOf(letterI) }
        ]

        // Space the letters by their real widths so the gaps read evenly,
        // then centre the word on the baseline the original one occupied.
        const span =
            layout.reduce((total, item) => total + item.width, 0) +
            LandingArea.LETTER_GAP * (layout.length - 1)

        const first = sorted[0].position
        const last = sorted[sorted.length - 1].position
        const center = new THREE.Vector3().addVectors(first, last).multiplyScalar(0.5)
        const direction = new THREE.Vector3().subVectors(last, first).normalize()

        let cursor = - span * 0.5

        for(const item of layout)
        {
            const offset = cursor + item.width * 0.5
            cursor += item.width + LandingArea.LETTER_GAP

            const reference = item.reference
            const physical = reference.userData.object.physical
            const position = center.clone().addScaledVector(direction, offset)

            reference.position.copy(position)
            physical.body.setTranslation(position, true)

            // Reset and respawn should bring the letters back here, not to
            // wherever "BRUNO SIMON" used to stand
            physical.initialState.position = { x: position.x, y: position.y, z: position.z }

            const collider = physical.colliders[0]

            // Keep the box collider in step with the letter it now represents
            if(typeof collider.setHalfExtents === 'function')
            {
                const halfExtents = collider.halfExtents()

                if(halfExtents)
                    collider.setHalfExtents({ ...halfExtents, x: item.width * 0.5 })
            }

            collider.setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            collider.setContactForceEventThreshold(5)

            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }

        // Retire every letter the new word does not use
        for(const reference of references)
        {
            if(!layout.some(item => item.reference === reference))
                this.game.objects.disable(reference.userData.object)
        }
    }

    setKiosk()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('kioskInteractivePoint')[0].position,
            'Map',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.modals.open('map')
                // interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // this.game.map.items.get('map').events.on('close', () =>
        // {
        //     interactivePoint.show()
        // })
    }

    setControls()
    {
        // Interactive point
        const interactivePoint = this.game.interactivePoints.create(
            this.references.items.get('controlsInteractivePoint')[0].position,
            'Controls',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.inputs.interactiveButtons.clearItems()
                this.game.menu.open('controls')
                interactivePoint.hide()
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )

        // Menu instance
        const menuInstance = this.game.menu.items.get('controls')

        menuInstance.events.on('close', () =>
        {
            interactivePoint.show()
        })

        menuInstance.events.on('open', () =>
        {
            if(this.game.inputs.mode === Inputs.MODE_GAMEPAD)
                menuInstance.tabs.goTo('gamepad')
            else if(this.game.inputs.mode === Inputs.MODE_MOUSEKEYBOARD)
                menuInstance.tabs.goTo('mouse-keyboard')
            else if(this.game.inputs.mode === Inputs.MODE_TOUCH)
                menuInstance.tabs.goTo('touch')
        })
    }

    setBonfire()
    {
        const position = this.references.items.get('bonfireHashes')[0].position

        // Particles
        let particles = null
        {
            const emissiveMaterial = this.game.materials.getFromName('emissiveOrangeRadialGradient')
    
            const count = 30
            const elevation = uniform(5)
            const positions = new Float32Array(count * 3)
            const scales = new Float32Array(count)
    
    
            for(let i = 0; i < count; i++)
            {
                const i3 = i * 3
    
                const angle = Math.PI * 2 * Math.random()
                const radius = Math.pow(Math.random(), 1.5) * 1
                positions[i3 + 0] = Math.cos(angle) * radius
                positions[i3 + 1] = Math.random()
                positions[i3 + 2] = Math.sin(angle) * radius
    
                scales[i] = 0.02 + Math.random() * 0.06
            }
            
            const positionAttribute = instancedArray(positions, 'vec3').toAttribute()
            const scaleAttribute = instancedArray(scales, 'float').toAttribute()
    
            const material = new THREE.SpriteNodeMaterial()
            material.outputNode = emissiveMaterial.outputNode
    
            const progress = float(0).toVar()
    
            material.positionNode = Fn(() =>
            {
                const newPosition = positionAttribute.toVar()
                progress.assign(newPosition.y.add(this.localTime.mul(newPosition.y)).fract())
    
                newPosition.y.assign(progress.mul(elevation))
                newPosition.xz.addAssign(this.game.wind.direction.mul(progress))
    
                const progressHide = step(0.8, progress).mul(100)
                newPosition.y.addAssign(progressHide)
                
                return newPosition
            })()
            material.scaleNode = Fn(() =>
            {
                const progressScale = progress.remapClamp(0.5, 1, 1, 0)
                return scaleAttribute.mul(progressScale)
            })()
    
            const geometry = new THREE.CircleGeometry(0.5, 8)
    
            particles = new THREE.Mesh(geometry, material)
            particles.visible = false
            particles.position.copy(position)
            particles.count = count
            this.game.scene.add(particles)
        }

        // Hashes
        {
            const alphaNode = Fn(() =>
            {
                const baseUv = uv(1)
                const distanceToCenter = baseUv.sub(0.5).length()
    
                const voronoi = texture(
                    this.game.noises.voronoi,
                    baseUv
                ).g
    
                voronoi.subAssign(distanceToCenter.remap(0, 0.5, 0.3, 0))
    
                return voronoi
            })()
    
            const material = new MeshDefaultMaterial({
                colorNode: color(0x6F6A87),
                alphaNode: alphaNode,
                hasWater: false,
                hasLightBounce: false
            })
    
            const mesh = this.references.items.get('bonfireHashes')[0]
            mesh.material = material
        }

        // Burn
        const burn = this.references.items.get('bonfireBurn')[0]
        burn.visible = false

        // Interactive point
        this.game.interactivePoints.create(
            this.references.items.get('bonfireInteractivePoint')[0].position,
            'Res(e)t',
            InteractivePoints.ALIGN_RIGHT,
            InteractivePoints.STATE_CONCEALED,
            () =>
            {
                this.game.reset()

                gsap.delayedCall(2, () =>
                {
                    // Bonfire
                    particles.visible = true
                    burn.visible = true
                    this.game.ticker.wait(2, () =>
                    {
                        particles.geometry.boundingSphere.center.y = 2
                        particles.geometry.boundingSphere.radius = 2
                    })

                    // Sound
                    this.game.audio.groups.get('campfire').items[0].positions.push(position)
                })
            },
            () =>
            {
                this.game.inputs.interactiveButtons.addItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            },
            () =>
            {
                this.game.inputs.interactiveButtons.removeItems(['interact'])
            }
        )
    }

    setAchievement()
    {
        this.events.on('boundingIn', () =>
        {
            this.game.achievements.setProgress('areas', 'landing')
        })
        this.events.on('boundingOut', () =>
        {
            this.game.achievements.setProgress('landingLeave', 1)
        })
    }

    update()
    {
        this.localTime.value += this.game.ticker.deltaScaled * 0.1
    }
}