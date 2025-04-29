import RAPIER from "@dimforge/rapier3d-compat"
import { Scene, LineSegments, BufferGeometry, LineBasicMaterial, BufferAttribute } from "three"

export class RapierDebugRenderer {
    mesh
    world
    enabled

    constructor(scene: Scene, world: RAPIER.World, enabled: boolean) {
        this.world = world
        this.mesh = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff, vertexColors: true }))
        this.mesh.frustumCulled = false
        this.enabled = enabled
        scene.add(this.mesh)
    }

    toggleVisible(visible: boolean) {
        this.enabled = visible
    }

    update() {
        if (this.enabled) {
            const { vertices, colors } = this.world.debugRender()
            this.mesh.geometry.setAttribute('position', new BufferAttribute(vertices, 3))
            this.mesh.geometry.setAttribute('color', new BufferAttribute(colors, 4))
            this.mesh.visible = true
        } else {
            this.mesh.visible = false
        }
    }
}