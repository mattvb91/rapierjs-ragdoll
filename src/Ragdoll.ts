import RAPIER, { World } from "@dimforge/rapier3d-compat";
import { Group, Mesh, MeshNormalMaterial, MeshStandardMaterial, Object3D, Object3DEventMap, Quaternion, Scene, Vector3 } from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";

type RagdollParts = 'head' | 'torso' | 'armUpperRight' | 'armLowerRight' | 'armUpperLeft' | 'armLowerLeft' | 'thighRight' | 'shinRight' | 'thighLeft' | 'shinLeft';

/**
 * Live demo: https://mavon.ie/demos/rapierjs-ragdoll
 */
export class Ragdoll extends Object3D {
    world: World;

    head!: RAPIER.RigidBody;
    torso!: RAPIER.RigidBody;
    armUpperRight!: RAPIER.RigidBody;
    armLowerRight!: RAPIER.RigidBody;
    armUpperLeft!: RAPIER.RigidBody;
    armLowerLeft!: RAPIER.RigidBody;
    thighRight!: RAPIER.RigidBody;
    shinRight!: RAPIER.RigidBody;
    thighLeft!: RAPIER.RigidBody;
    shinLeft!: RAPIER.RigidBody;

    mesh: Group<Object3DEventMap> | null = null;

    private static readonly torsoHeight = 0.55;

    private static readonly boneMapping = {
        head: 'head',
        torso: 'spine',
        armUpperLeft: 'upperArml',
        armUpperRight: 'upperArmr',
        armLowerLeft: 'lowerArml',
        armLowerRight: 'lowerArmr',
        thighLeft: 'hipl',
        thighRight: 'hipr',
        shinLeft: 'shinl',
        shinRight: 'shinr'
    };
    private initialBoneWorldQuaternions: Map<string, Quaternion> = new Map();

    constructor(world: World, scene: Scene, loader: GLTFLoader) {
        super()

        this.world = world;

        // Load a glTF resource
        loader.load(
            '/character.glb',
            (glTF) => {
                glTF.scene.traverse(o => {
                    if (o instanceof Mesh) {
                        const colors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];
                        const randomColor = colors[Math.floor(Math.random() * colors.length)];
                        o.material = Math.random() > 0.5 ? new MeshNormalMaterial() : new MeshStandardMaterial({ color: randomColor });

                        o.castShadow = true
                        o.receiveShadow = true
                        o.frustumCulled = false
                    }
                })

                this.mesh = glTF.scene
                this.mesh.position.set(0, 10, 0)
                scene.add(this.mesh)

                /**
                 * Store initial bone orientation from the blender mesh
                 * This is very important otherwise your mesh will be twisted
                 */
                const boneNames = new Set(Object.values(Ragdoll.boneMapping));

                const traverseAndMapBones = (object: Object3D) => {

                    // Lets see what we can find in the mesh and match it up with our mapping above
                    console.log(object)

                    if (boneNames.has(object.name)) {
                        const quat = new Quaternion();
                        object.getWorldQuaternion(quat);
                        this.initialBoneWorldQuaternions.set(object.name, quat);
                    }
                    for (const child of object.children) {
                        traverseAndMapBones(child);
                    }
                };

                traverseAndMapBones(this.mesh);

                this.createRagdoll();
            },


            // called while loading is progressing
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function (error) {
                console.log('An error happened:', error);
            }
        );
    }

    private createRagdoll() {

        // Adjust this to make it more flexible
        const stiffness = 0.03
        const density = 0.16

        //Taken from blender bone lengths
        const torsoWidth = 0.4
        const thighLength = .38 - (stiffness * 2) // Remove the extra length added from the stiffness gap
        const shinLength = .43 - (stiffness * 2)
        const upperArmLength = .3 - (stiffness * 2)
        const lowerArmLength = .42 - (stiffness * 2)

        const initialSpawn = new Vector3(0, 10, 0)

        const torsoDesc = RAPIER.ColliderDesc.cuboid(torsoWidth / 2, Ragdoll.torsoHeight / 2, 0.1);
        const torsoBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...initialSpawn.toArray())
        this.torso = this.world.createRigidBody(torsoBodyDesc);
        this.world.createCollider(torsoDesc, this.torso);

        const headSize = 0.2;
        const headDesc = RAPIER.ColliderDesc.cuboid(headSize / 2, headSize / 2, headSize / 2);
        const headBodyDesc = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(0, this.torso.translation().y + headSize / 2 + Ragdoll.torsoHeight / 2 + stiffness, 0)
        this.head = this.world.createRigidBody(headBodyDesc);
        this.world.createCollider(headDesc, this.head).setDensity(density)

        const armThickness = 0.15

        const armUpperRDesc = RAPIER.ColliderDesc.cuboid(upperArmLength / 2, armThickness / 2, armThickness / 2);
        const armUpperRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth + stiffness, this.torso.translation().y + 0.1, 0);
        this.armUpperRight = this.world.createRigidBody(armUpperRBodyDesc);
        this.world.createCollider(armUpperRDesc, this.armUpperRight).setDensity(density)

        const armLowerRDesc = RAPIER.ColliderDesc.cuboid(lowerArmLength / 2, armThickness / 2, armThickness / 2);
        const armLowerRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth + lowerArmLength + stiffness * 2, this.torso.translation().y + 0.1, 0)
        this.armLowerRight = this.world.createRigidBody(armLowerRBodyDesc);
        this.world.createCollider(armLowerRDesc, this.armLowerRight).setDensity(density)

        const armUpperLDesc = RAPIER.ColliderDesc.cuboid(upperArmLength / 2, armThickness / 2, armThickness / 2);
        const armUpperLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth - stiffness, this.torso.translation().y + 0.1, 0)
        this.armUpperLeft = this.world.createRigidBody(armUpperLBodyDesc);
        this.world.createCollider(armUpperLDesc, this.armUpperLeft).setDensity(density)

        const armLowerLDesc = RAPIER.ColliderDesc.cuboid(lowerArmLength / 2, armThickness / 2, armThickness / 2);
        const armLowerLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth - lowerArmLength - stiffness * 2, this.torso.translation().y + 0.1, 0)
        this.armLowerLeft = this.world.createRigidBody(armLowerLBodyDesc);
        this.world.createCollider(armLowerLDesc, this.armLowerLeft).setDensity(density)

        const legthickness = 0.18

        const legUpperRDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, thighLength /2, legthickness / 2)
        const legUpperRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth / 2 - 0.1, torsoBodyDesc.translation.y - Ragdoll.torsoHeight / 2 - thighLength / 2 - stiffness, 0)
        this.thighRight = this.world.createRigidBody(legUpperRBodyDesc)
        this.world.createCollider(legUpperRDesc, this.thighRight).setDensity(density)

        const legLowerRDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, shinLength / 2, legthickness / 2)
        const legLowerRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(legUpperRBodyDesc.translation.x, legUpperRBodyDesc.translation.y - shinLength - stiffness, 0)
        this.shinRight = this.world.createRigidBody(legLowerRBodyDesc)
        this.world.createCollider(legLowerRDesc, this.shinRight).setDensity(density)

        const legUpperLDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, thighLength / 2, legthickness / 2)
        const legUpperLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth / 2 + 0.1, torsoBodyDesc.translation.y - Ragdoll.torsoHeight / 2 - thighLength / 2 - stiffness, 0)
        this.thighLeft = this.world.createRigidBody(legUpperLBodyDesc)
        this.world.createCollider(legUpperLDesc, this.thighLeft).setDensity(density)

        const legLowerLDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, shinLength / 2, legthickness / 2)
        const legLowerLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(legUpperLBodyDesc.translation.x, legUpperRBodyDesc.translation.y - shinLength - stiffness, 0)
        this.shinLeft = this.world.createRigidBody(legLowerLBodyDesc)
        this.world.createCollider(legLowerLDesc, this.shinLeft).setDensity(density)

        const localAnchorHead = { x: 0, y: -headSize / 2 - stiffness, z: 0 };
        const localAnchorNeck = { x: 0, y: Ragdoll.torsoHeight / 2, z: 0 };

        const localAnchorRTorso = { x: (torsoWidth / 2) + stiffness, y: torsoWidth / 2, z: 0 };
        const localAnchorRArm = { x: -upperArmLength / 2, y: 0, z: 0 };

        const localAnchorRArmBottom = { x: (upperArmLength / 2) + stiffness, y: 0, z: 0.0 };
        const localAnchorRArmLower = { x: -lowerArmLength / 2, y: 0, z: 0 };

        const localAnchorLTorso = { x: -(torsoWidth / 2) - stiffness, y: torsoWidth / 2, z: 0 };
        const localAnchorLArm = { x: upperArmLength / 2, y: 0, z: 0 };

        const localAnchorLArmBottom = { x: -(upperArmLength / 2) - stiffness, y: 0, z: 0.0 };
        const localAnchorLArmLower = { x: lowerArmLength / 2, y: 0, z: 0 };

        const localAnchorRTorsoBottom = { x: (torsoWidth / 2) - legthickness / 2, y: -Ragdoll.torsoHeight / 2 - stiffness, z: 0 };
        const localAnchorRLegUpper = { x: 0, y: thighLength / 2, z: 0 };

        const localAnchorLTorsoBottom = { x: -(torsoWidth / 2) + legthickness / 2, y: -Ragdoll.torsoHeight / 2 - stiffness, z: 0 };
        const localAnchorLLegUpper = { x: 0, y: thighLength / 2, z: 0 };

        const localAnchorRLegUpperLower = { x: 0, y: -shinLength / 2 - stiffness, z: 0 };
        const localAnchorRLegLowerTop = { x: 0, y: shinLength / 2, z: 0 };

        const localAnchorLLegUpperLower = { x: 0, y: -shinLength / 2 - stiffness, z: 0 };
        const localAnchorLLegLowerTop = { x: 0, y: shinLength / 2, z: 0 };

        const createJoint = (anchor1: RAPIER.Vector, anchor2: RAPIER.Vector, parent1: RAPIER.RigidBody, parent2: RAPIER.RigidBody) => {
            const joint = RAPIER.JointData.spherical(anchor1, anchor2);
            this.world.createImpulseJoint(joint, parent1, parent2, true);
        }

        createJoint(localAnchorHead, localAnchorNeck, this.head, this.torso)                                // Neck Joint
        createJoint(localAnchorRTorso, localAnchorRArm, this.torso, this.armUpperRight)                     // Shoulder Joint Right
        createJoint(localAnchorRArmBottom, localAnchorRArmLower, this.armUpperRight, this.armLowerRight)    // Elbow Joint right
        createJoint(localAnchorLTorso, localAnchorLArm, this.torso, this.armUpperLeft)                      // Shoulder Joint Left
        createJoint(localAnchorLArmBottom, localAnchorLArmLower, this.armUpperLeft, this.armLowerLeft)      // Elbow joint left
        createJoint(localAnchorLTorsoBottom, localAnchorLLegUpper, this.torso, this.thighLeft)              // hip joint left
        createJoint(localAnchorRTorsoBottom, localAnchorRLegUpper, this.torso, this.thighRight)             // hip joint right
        createJoint(localAnchorRLegUpperLower, localAnchorRLegLowerTop, this.thighRight, this.shinRight)    // knee joint right
        createJoint(localAnchorLLegUpperLower, localAnchorLLegLowerTop, this.thighLeft, this.shinLeft)      // knee joint left

        // For debuging you can disable this to freeze it and see joints in initial state
        const enabled = true

        for (const [key, _] of Object.entries(Ragdoll.boneMapping)) {
            this[key as RagdollParts].setEnabled(enabled)
        }
    }

    public update(_delta: number) {

        if (!this.mesh) return

        this.mesh.updateMatrixWorld(true);

        // Walk top-down so child bones read fresh parent world transforms.
        const orderedKeys: RagdollParts[] = [
            'torso',
            'head',
            'armUpperLeft', 'armLowerLeft',
            'armUpperRight', 'armLowerRight',
            'thighLeft', 'shinLeft',
            'thighRight', 'shinRight',
        ];

        for (const key of orderedKeys) {
            const boneName = Ragdoll.boneMapping[key];

            const bone = this.mesh.getObjectByName(boneName);
            const body = this[key];
            if (!bone || !body) continue;

            const parent = bone.parent as Object3D;
            if (!parent) continue;

            const rotation = body.rotation();
            const bodyQuat = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);

            // Only the root bone gets its position from physics. Child bones keep
            // their rest-pose offsets so the skinned mesh isn't stretched.
            if (key === 'torso') {
                const t = body.translation();
                // Offset is in the body's local frame, so rotate it into world space
                // before applying — otherwise the bone drifts as the rigid bodies move.
                const offset = new Vector3(0, -Ragdoll.torsoHeight / 2, 0).applyQuaternion(bodyQuat);
                const bodyPos = new Vector3(t.x + offset.x, t.y + offset.y, t.z + offset.z);
                parent.worldToLocal(bodyPos);
                bone.position.copy(bodyPos);
            }

            const parentQuat = new Quaternion();
            parent.getWorldQuaternion(parentQuat);

            const initialQuat = this.initialBoneWorldQuaternions.get(boneName);
            const targetWorld = initialQuat
                ? bodyQuat.clone().multiply(initialQuat)
                : bodyQuat.clone();

            bone.quaternion.copy(parentQuat.invert()).multiply(targetWorld);
            bone.updateMatrixWorld(true);
        }
    }

    public ownsRigidBody(body: RAPIER.RigidBody | null): boolean {
        if (!body) return false;
        for (const key of Object.keys(Ragdoll.boneMapping) as RagdollParts[]) {
            if (this[key]?.handle === body.handle) return true;
        }
        return false;
    }

    public findClosestBody(point: Vector3): RAPIER.RigidBody | null {
        if(!point) return null
        
        let closest: RAPIER.RigidBody | null = null;
        let minDist = Infinity;

        for (const part of Object.keys(Ragdoll.boneMapping) as RagdollParts[]) {
            const body = this[part];
            const pos = body.translation();
            const dist = point.distanceTo(new Vector3(pos.x, pos.y, pos.z));

            if (dist < minDist) {
                minDist = dist;
                closest = body;
            }
        }

        return closest;
    }

}
