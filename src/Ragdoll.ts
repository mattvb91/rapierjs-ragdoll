import RAPIER, { RigidBody, World } from "@dimforge/rapier3d-compat";
import { Camera, Group, Mesh, MeshStandardMaterial, Object3D, Object3DEventMap, Plane, Quaternion, Raycaster, Scene, Vector2, Vector3 } from "three";
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

    private static readonly boneMapping = {
        head: 'head',
        torso: 'spine',
        armUpperLeft: 'upperArml',
        armUpperRight: 'upperArmr',
        armLowerLeft: 'lowerArmL',
        armLowerRight: 'lowerArmR',
        thighLeft: 'hipl',
        thighRight: 'hipr',
        shinLeft: 'shinl',
        shinRight: 'shinr'
    };
    private initialBoneWorldQuaternions: Map<string, Quaternion> = new Map();

    pullingBodyRigid?: RigidBody | null;

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
                        o.material = new MeshStandardMaterial({ color: randomColor });

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
                for (const [_, boneName] of Object.entries(Ragdoll.boneMapping)) {
                    const bone = this.mesh.getObjectByName(boneName);
                    if (bone) {
                        const quat = new Quaternion();
                        bone.getWorldQuaternion(quat);
                        this.initialBoneWorldQuaternions.set(boneName, quat);
                    }
                }

                this.createRagdoll();
            },


            // called while loading is progressing
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100) + '% loaded');
            },
            function (error) {
                console.log('An error happened');
            }
        );
    }

    private createRagdoll() {

        // Adjust this to make it more flexible
        const stiffness = 0.02

        const torsoWidth = 0.4
        const torsoHeight = .4

        const initialSpawn = new Vector3(0, 10, 0)

        const torsoDesc = RAPIER.ColliderDesc.cuboid(torsoWidth / 2, torsoHeight / 2, 0.1);
        const torsoBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(...initialSpawn.toArray())
        this.torso = this.world.createRigidBody(torsoBodyDesc);
        this.world.createCollider(torsoDesc, this.torso);

        const headSize = 0.2;
        const headDesc = RAPIER.ColliderDesc.cuboid(headSize / 2, headSize / 2, headSize / 2);
        const headBodyDesc = RAPIER.RigidBodyDesc
            .dynamic()
            .setTranslation(0, this.torso.translation().y + headSize / 2 + torsoHeight / 2 + stiffness, 0)
        this.head = this.world.createRigidBody(headBodyDesc);
        this.world.createCollider(headDesc, this.head);

        const armLength = 0.4
        const armThickness = 0.15

        const armUpperRDesc = RAPIER.ColliderDesc.cuboid(armLength / 2, armThickness / 2, armThickness / 2);
        const armUpperRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth + stiffness, this.torso.translation().y + 0.1, 0);
        this.armUpperRight = this.world.createRigidBody(armUpperRBodyDesc);
        this.world.createCollider(armUpperRDesc, this.armUpperRight);

        const armLowerRDesc = RAPIER.ColliderDesc.cuboid(armLength / 2, armThickness / 2, armThickness / 2);
        const armLowerRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth + armLength + stiffness * 2, this.torso.translation().y + 0.1, 0)
        this.armLowerRight = this.world.createRigidBody(armLowerRBodyDesc);
        this.world.createCollider(armLowerRDesc, this.armLowerRight);

        const armUpperLDesc = RAPIER.ColliderDesc.cuboid(armLength / 2, armThickness / 2, armThickness / 2);
        const armUpperLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth - stiffness, this.torso.translation().y + 0.1, 0)
        this.armUpperLeft = this.world.createRigidBody(armUpperLBodyDesc);
        this.world.createCollider(armUpperLDesc, this.armUpperLeft);

        const armLowerLDesc = RAPIER.ColliderDesc.cuboid(armLength / 2, armThickness / 2, armThickness / 2);
        const armLowerLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth - armLength - stiffness * 2, this.torso.translation().y + 0.1, 0)
        this.armLowerLeft = this.world.createRigidBody(armLowerLBodyDesc);
        this.world.createCollider(armLowerLDesc, this.armLowerLeft);

        const legSegmentHeight = torsoHeight * 0.8
        const legthickness = 0.18

        const legUpperRDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, legSegmentHeight / 2, legthickness / 2)
        const legUpperRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(torsoWidth / 2 - 0.1, torsoBodyDesc.translation.y - torsoHeight / 2 - legSegmentHeight / 2 - stiffness, 0)
        this.thighRight = this.world.createRigidBody(legUpperRBodyDesc)
        this.world.createCollider(legUpperRDesc, this.thighRight);

        const legLowerRDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, legSegmentHeight / 2, legthickness / 2)
        const legLowerRBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(legUpperRBodyDesc.translation.x, legUpperRBodyDesc.translation.y - legSegmentHeight - stiffness, 0)
        this.shinRight = this.world.createRigidBody(legLowerRBodyDesc)
        this.world.createCollider(legLowerRDesc, this.shinRight);

        const legUpperLDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, legSegmentHeight / 2, legthickness / 2)
        const legUpperLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(-torsoWidth / 2 + 0.1, torsoBodyDesc.translation.y - torsoHeight / 2 - legSegmentHeight / 2 - stiffness, 0)
        this.thighLeft = this.world.createRigidBody(legUpperLBodyDesc)
        this.world.createCollider(legUpperLDesc, this.thighLeft);

        const legLowerLDesc = RAPIER.ColliderDesc.cuboid(legthickness / 2, legSegmentHeight / 2, legthickness / 2)
        const legLowerLBodyDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(legUpperLBodyDesc.translation.x, legUpperRBodyDesc.translation.y - legSegmentHeight - stiffness, 0)
        this.shinLeft = this.world.createRigidBody(legLowerLBodyDesc)
        this.world.createCollider(legLowerLDesc, this.shinLeft);

        const localAnchorHead = { x: 0, y: -headSize / 2 - stiffness, z: 0 };
        const localAnchorNeck = { x: 0, y: torsoHeight / 2, z: 0 };

        const localAnchorRTorso = { x: (torsoWidth / 2) + stiffness, y: 0.1, z: 0 };
        const localAnchorRArm = { x: -armLength / 2, y: 0, z: 0 };

        const localAnchorRArmBottom = { x: (armLength / 2) + stiffness, y: 0 / 2, z: 0.0 };
        const localAnchorRArmLower = { x: -armLength / 2, y: 0 / 2, z: 0 };

        const localAnchorLTorso = { x: -(torsoWidth / 2) - stiffness, y: 0.1, z: 0 };
        const localAnchorLArm = { x: armLength / 2, y: 0, z: 0 };

        const localAnchorLArmBottom = { x: -(armLength / 2) - stiffness, y: 0 / 2, z: 0.0 };
        const localAnchorLArmLower = { x: armLength / 2, y: 0 / 2, z: 0 };

        const localAnchorRTorsoBottom = { x: (torsoWidth / 2) - legthickness / 2, y: -torsoHeight / 2 - stiffness, z: 0 };
        const localAnchorRLegUpper = { x: 0, y: legSegmentHeight / 2, z: 0 };

        const localAnchorLTorsoBottom = { x: -(torsoWidth / 2) + legthickness / 2, y: -torsoHeight / 2 - stiffness, z: 0 };
        const localAnchorLLegUpper = { x: 0, y: legSegmentHeight / 2, z: 0 };

        const localAnchorRLegUpperLower = { x: 0, y: -legSegmentHeight / 2 - stiffness, z: 0 };
        const localAnchorRLegLowerTop = { x: 0, y: legSegmentHeight / 2, z: 0 };

        const localAnchorLLegUpperLower = { x: 0, y: -legSegmentHeight / 2 - stiffness, z: 0 };
        const localAnchorLLegLowerTop = { x: 0, y: legSegmentHeight / 2, z: 0 };

        const createJoint = (anchor1: RAPIER.Vector, anchor2: RAPIER.Vector, parent1: RAPIER.RigidBody, parent2: RAPIER.RigidBody ) => {
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
        const enabled = true;

        for (const [key, _] of Object.entries(Ragdoll.boneMapping)) {
            this[key as RagdollParts].setEnabled(enabled)
        }
    }

    public update(_delta: number) {

        if (!this.mesh) return

        this.updateRagdoll()

        const keys = ["torso"]
        const positions = keys.map(k => this[k as RagdollParts].translation())

        const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
        const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length
        const avgZ = positions.reduce((sum, p) => sum + p.z, 0) / positions.length

        this.position.set(avgX, avgY, avgZ)
        this.mesh?.position.set(this.position.x, this.position.y, this.position.z)
    }

    updateRagdoll() {
        if (!this.mesh) return;

        for (const [key, boneName] of Object.entries(Ragdoll.boneMapping)) {
            const bone = this.mesh.getObjectByName(boneName);
            const body = this[key as RagdollParts];
    
            if (bone && body) {
                const translation = body.translation();
                const rotation = body.rotation();
    
                const bodyPos = new Vector3(translation.x, translation.y, translation.z);
                const bodyQuat = new Quaternion(rotation.x, rotation.y, rotation.z, rotation.w);
    
                const parent = bone.parent as Object3D;
                if (parent) {
                    parent.worldToLocal(bodyPos);
                    bone.position.copy(bodyPos);
    
                    const parentQuat = new Quaternion();
                    parent.getWorldQuaternion(parentQuat);
    
                    const initialQuat = this.initialBoneWorldQuaternions.get(boneName);
                    if (initialQuat) {
                        const relativeQuat = bodyQuat.multiply(initialQuat);
                        bone.quaternion.copy(parentQuat.invert()).multiply(relativeQuat);
                    } else {
                        const combinedQuat = bodyQuat.multiply(parentQuat);
                        bone.quaternion.copy(combinedQuat);
                    }
                }
            }
        }
    }

    public releasePull() {
        console.log('Released')
        this.pullingBodyRigid = null
    }

    mousePull(cursor: Vector2, camera: Camera, target: Vector3) {
        if (!this.pullingBodyRigid) {
            this.pullingBodyRigid = this.findClosestBody(target)
        }

        this.pullingBodyRigid?.applyImpulse({ x: 0, y: 0.018, z: 0 }, true)

        // Todo the impusle should follow the mouse pointer
    }

    private findClosestBody(point: Vector3): RAPIER.RigidBody | null {
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
