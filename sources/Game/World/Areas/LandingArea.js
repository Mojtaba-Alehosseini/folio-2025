import * as THREE from 'three/webgpu'
import { color, float, Fn, instancedArray, mix, normalWorld, positionGeometry, step, texture, uniform, uv, vec2, vec3, vec4 } from 'three/tsl'
import { Inputs } from '../../Inputs/Inputs.js'
import { InteractivePoints } from '../../InteractivePoints.js'
import { Area } from './Area.js'
import gsap from 'gsap'
import { MeshDefaultMaterial } from '../../Materials/MeshDefaultMaterial.js'

export class LandingArea extends Area
{
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

        if (!references || references.length < 10) return

        // 1. Get original positions of first and last letters to compute center and direction
        const pos_0 = references[0].position.clone()
        const pos_9 = references[9].position.clone()
        const center = new THREE.Vector3().addVectors(pos_0, pos_9).multiplyScalar(0.5)
        const dir = new THREE.Vector3().subVectors(pos_9, pos_0).normalize()
        
        // 2. Define the letter layout for "MOJI"
        // Correct index mappings determined from bounding-box width analysis of areas.glb:
        //   index 2 → width 1.490 = M (widest)
        //   index 1 → width 1.433, height 1.512 = O (tall round, two identical at 1 & 5)
        //   index 6 → confirmed U shape in-game (screenshot)
        //   index 3 → width 0.364 = I (uniquely narrow)
        const targetLetters = [
            { index: 2, offset:  1.55 }, // M  (widest — camera LEFT, first letter of MOJI)
            { index: 1, offset:  0.35 }, // O
            { index: 6, offset: -0.60, isJ: true }, // J (morphed from U)
            { index: 3, offset: -1.40 }  // I  (narrowest — camera RIGHT, last letter of MOJI)
        ]

        const spacing = 1.4

        // 3. Position and morph the letters we want to keep
        for (const item of targetLetters) {
            const reference = references[item.index]
            const physical = reference.userData.object.physical

            // Calculate new position centered along the original baseline
            const pos = center.clone().addScaledVector(dir, item.offset * spacing)

            // Morph U into J:
            // U vertex layout: 4 Y rows: -0.724 (bottom), -0.137, +0.137, +0.724 (top)
            //                  X columns: -0.619 (left outer), -0.255 (left inner),
            //                             +0.255 (right inner), +0.619 (right outer)
            //
            // Strategy: push left-side vertices (x < 0) DOWNWARD to y = -0.7237
            //   • y = -0.7237 row  (x < 0, threshold -0.7237 > -0.7 is FALSE) → KEPT
            //     → the bottom bridge / J hook remains intact on the left
            //   • y = -0.137, +0.137, +0.724 rows (x < 0) → COLLAPSED to y = -0.7237
            //     → the left column folds flat (degenerate faces) and vanishes
            //   • All right-side vertices (x > 0) are untouched → right stem stays full height
            // Result: J shape — tall right stem + flat bottom hook extending left.
            if (item.isJ) {
                try {
                    // Clone geometry so we don't mutate a shared GLB buffer
                    const cloned = reference.geometry.clone()
                    reference.geometry = cloned

                    const posAttr = cloned.attributes.position
                    const mutable = new Float32Array(posAttr.array)
                    const BOTTOM_Y = -0.7237
                    for (let i = 0; i < posAttr.count; i++) {
                        const x = mutable[i * 3]
                        // Collapse everything to the left of the right stem (x < 0.255) to the bottom
                        if (x < 0.255) {
                            mutable[i * 3 + 1] = BOTTOM_Y
                        }
                    }
                    cloned.setAttribute('position', new THREE.BufferAttribute(mutable, 3))
                    cloned.computeVertexNormals()
                    cloned.computeBoundingBox()
                    cloned.computeBoundingSphere()
                } catch(e) {
                    console.warn('J morph failed, using U shape:', e)
                }
            }

            // Move the Rapier physics body
            physical.body.setTranslation({ x: pos.x, y: pos.y, z: pos.z }, true)
            reference.position.copy(pos)

            // Save new initial state so resets/restarts return the letters here
            physical.initialState.position = { x: pos.x, y: pos.y, z: pos.z }

            // Configure contact events and collision sounds
            physical.colliders[0].setActiveEvents(this.game.RAPIER.ActiveEvents.CONTACT_FORCE_EVENTS)
            physical.colliders[0].setContactForceEventThreshold(5)
            physical.onCollision = (force, position) =>
            {
                this.game.audio.groups.get('hitBrick').playRandomNext(force, position)
            }
        }

        // 4. Disable and hide all unused letter meshes and physics bodies
        for (let i = 0; i < references.length; i++) {
            if (!targetLetters.some(item => item.index === i)) {
                this.game.objects.disable(references[i].userData.object)
            }
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