
    import * as THREE from '../build/three.module.js';
    import { PointerLockControls } from 'https://esm.sh/three@0.165.0/examples/jsm/controls/PointerLockControls.js';
    import RAPIER from 'https://esm.sh/@dimforge/rapier3d-compat';

    await RAPIER.init();

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1020);

    const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(0, 2, 7);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    document.body.appendChild(renderer.domElement);

    const controls = new PointerLockControls(camera, document.body);
    scene.add(controls.getObject());

    const overlay = document.getElementById('overlay');
    overlay.addEventListener('click', () => controls.lock());

    controls.addEventListener('lock', () => {
    overlay.style.display = 'none';
});

    controls.addEventListener('unlock', () => {
    overlay.style.display = 'flex';
});

    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x222244, 1.5);
    scene.add(ambientLight);

    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(6, 10, 4);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    scene.add(sun);

    const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

    const floorMesh = new THREE.Mesh(
    new THREE.BoxGeometry(30, 0.4, 30),
    new THREE.MeshStandardMaterial({ color: 0x26324f, roughness: 0.75 })
    );
    floorMesh.position.y = -0.2;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    const floorBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.2, 0);
    const floorBody = world.createRigidBody(floorBodyDesc);
    const floorCollider = RAPIER.ColliderDesc.cuboid(15, 0.2, 15).setFriction(1.0);
    world.createCollider(floorCollider, floorBody);

    const cubeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.48, metalness: 0.08 })
    );
    cubeMesh.castShadow = true;
    scene.add(cubeMesh);

    const cubeBodyDesc = RAPIER.RigidBodyDesc.dynamic()
    .setTranslation(0, 3, 0)
    .setLinearDamping(0.35)
    .setAngularDamping(0.6);

    const cubeBody = world.createRigidBody(cubeBodyDesc);
    const cubeCollider = RAPIER.ColliderDesc.cuboid(0.5, 0.5, 0.5)
    .setDensity(1.2)
    .setRestitution(0.25)
    .setFriction(0.8);
    world.createCollider(cubeCollider, cubeBody);

    const backWallMesh = new THREE.Mesh(
    new THREE.BoxGeometry(30, 5, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x151d33, roughness: 0.9 })
    );
    backWallMesh.position.set(0, 2.3, -10);
    backWallMesh.receiveShadow = true;
    scene.add(backWallMesh);

    const wallBodyDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(0, 2.3, -10);
    const wallBody = world.createRigidBody(wallBodyDesc);
    world.createCollider(RAPIER.ColliderDesc.cuboid(15, 2.5, 0.2).setFriction(0.8), wallBody);

    const keys = {
    forward: false,
    backward: false,
    left: false,
    right: false
};

    document.addEventListener('keydown', (event) => {
    if (event.code === 'KeyW') keys.forward = true;
    if (event.code === 'KeyS') keys.backward = true;
    if (event.code === 'KeyA') keys.left = true;
    if (event.code === 'KeyD') keys.right = true;
});

    document.addEventListener('keyup', (event) => {
    if (event.code === 'KeyW') keys.forward = false;
    if (event.code === 'KeyS') keys.backward = false;
    if (event.code === 'KeyA') keys.left = false;
    if (event.code === 'KeyD') keys.right = false;
});

    const raycaster = new THREE.Raycaster();
    const centre = new THREE.Vector2(0, 0);
    const cameraForward = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const moveDirection = new THREE.Vector3();
    const previousGrabPosition = new THREE.Vector3();
    const currentGrabPosition = new THREE.Vector3();
    const grabVelocity = new THREE.Vector3();
    const targetPosition = new THREE.Vector3();

    let isMouseDown = false;
    let isGrabbing = false;
    let grabDistance = 4;

    const maxGrabDistance = 7;
    const grabPullStrength = 14;
    const throwStrength = 10;

    document.addEventListener('mousedown', (event) => {
    if (!controls.isLocked || event.button !== 0) return;
    isMouseDown = true;

    raycaster.setFromCamera(centre, camera);
    const hits = raycaster.intersectObject(cubeMesh);

    if (hits.length > 0 && hits[0].distance <= maxGrabDistance) {
    isGrabbing = true;
    grabDistance = THREE.MathUtils.clamp(hits[0].distance, 2, maxGrabDistance);

    const position = cubeBody.translation();
    previousGrabPosition.set(position.x, position.y, position.z);
    currentGrabPosition.copy(previousGrabPosition);

    cubeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);
}
});

    document.addEventListener('mouseup', (event) => {
    if (event.button !== 0) return;
    isMouseDown = false;

    if (isGrabbing) {
    camera.getWorldDirection(cameraForward);

    const releaseVelocity = {
    x: grabVelocity.x + cameraForward.x * throwStrength,
    y: grabVelocity.y + cameraForward.y * throwStrength + 1.5,
    z: grabVelocity.z + cameraForward.z * throwStrength
};

    cubeBody.setLinvel(releaseVelocity, true);
    isGrabbing = false;
}
});

    function updatePlayer(delta) {
    if (!controls.isLocked) return;

    camera.getWorldDirection(cameraForward);
    cameraForward.y = 0;
    cameraForward.normalize();

    cameraRight.crossVectors(cameraForward, camera.up).normalize();

    moveDirection.set(0, 0, 0);
    if (keys.forward) moveDirection.add(cameraForward);
    if (keys.backward) moveDirection.sub(cameraForward);
    if (keys.right) moveDirection.add(cameraRight);
    if (keys.left) moveDirection.sub(cameraRight);

    if (moveDirection.lengthSq() > 0) {
    moveDirection.normalize();
    controls.getObject().position.addScaledVector(moveDirection, delta * 5.5);
}

    controls.getObject().position.y = 2;
}

    function updateGrab(delta) {
    if (!isGrabbing || !isMouseDown) return;

    camera.getWorldDirection(cameraForward);
    targetPosition.copy(camera.position).addScaledVector(cameraForward, grabDistance);

    const cubePosition = cubeBody.translation();
    currentGrabPosition.set(cubePosition.x, cubePosition.y, cubePosition.z);

    const desiredVelocity = {
    x: (targetPosition.x - cubePosition.x) * grabPullStrength,
    y: (targetPosition.y - cubePosition.y) * grabPullStrength,
    z: (targetPosition.z - cubePosition.z) * grabPullStrength
};

    cubeBody.setLinvel(desiredVelocity, true);
    cubeBody.setAngvel({ x: 0, y: 0, z: 0 }, true);

    grabVelocity.copy(currentGrabPosition).sub(previousGrabPosition).divideScalar(Math.max(delta, 0.001));
    previousGrabPosition.copy(currentGrabPosition);
}

    function syncCubeMesh() {
    const position = cubeBody.translation();
    const rotation = cubeBody.rotation();

    cubeMesh.position.set(position.x, position.y, position.z);
    cubeMesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
}

    const clock = new THREE.Clock();
    let physicsAccumulator = 0;
    const fixedStep = 1 / 60;

    function animate() {
    requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);
    updatePlayer(delta);
    updateGrab(delta);

    physicsAccumulator += delta;
    while (physicsAccumulator >= fixedStep) {
    world.timestep = fixedStep;
    world.step();
    physicsAccumulator -= fixedStep;
}

    syncCubeMesh();
    renderer.render(scene, camera);
}

    animate();

    window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
