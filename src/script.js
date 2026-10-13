import * as THREE from 'three'
import { GLTFLoader, ThreeMFLoader } from 'three/examples/jsm/Addons.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
// SETUP

var paused = false

// get the screen height of the device not the window
const screenHeight = window.screen.height

console.log(screenHeight)
console.log(window.innerHeight)

const canvasHeight = screenHeight / 2.0

// keep width consistent with window size but fix height to 1/3 of screen height
const sizes = {
    width: window.innerWidth, 
    height: canvasHeight}

// Canvas
const canvas = document.querySelector('canvas.webgl')

window.addEventListener('resize', () => {
    // Update sizes
    sizes.width = window.innerWidth
    sizes.height = canvasHeight

    camera.aspect = sizes.width /sizes.height
    camera.updateProjectionMatrix()

    renderer.setSize(sizes.width, sizes.height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})

// Set up theejs scene
const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
scene.add(camera)



/**
 * Light
 */ 
const light = new THREE.DirectionalLight(0xffffff, 2)
light.position.set(5, 5, 5)
scene.add(light)

//add ambient light
const ambientLight = new THREE.AmbientLight(0xffffff, 1)
scene.add(ambientLight)

/** Controls */
const controls = new OrbitControls(camera, canvas)
controls.enableDamping = true
//controls.update()

/**
 * Models
 */

var floppy = null
var movingFloppy = null
var robotArm = null
var mixer = null
var robotPickupAnimation = null

const gltfLoader = new GLTFLoader()
gltfLoader.setMeshoptDecoder(MeshoptDecoder)

gltfLoader.load(
    '/models/robot_arm/robot_arm.glb',
    (gltf) => 
    {
        robotArm = gltf.scene
        robotArm.rotation.set(0, -Math.PI/2, 0)
        console.log('robotArm', robotArm)
        scene.add(robotArm)

        mixer = new THREE.AnimationMixer(robotArm)
        robotPickupAnimation = mixer.clipAction(gltf.animations[0])

    },
    (progress) =>
    {
    },
    (error) =>
    {
        console.log('error')
        console.log(error)
    }
)

gltfLoader.load(
    '/models/floppy/floppy.glb',
    (gltf) => 
    {
        floppy = gltf.scene
        floppy.rotation.set(0, -Math.PI/2, 0)
        console.log('floppy',floppy)
        scene.add(floppy)

        movingFloppy = floppy.clone()
        //scene.add(movingFloppy)
        movingFloppy.children[0].position.set(0.2,-2.15, 0.05)

        // find mesh with name cylinder005
        const cylinder005 = robotArm.getObjectByName('Cylinder005')
        // move movingFloppy down its relative y axis

        movingFloppy.rotation.set(cylinder005.rotation.x, cylinder005.rotation.y, cylinder005.rotation.z)
        movingFloppy.rotation.x += Math.PI / 2
        movingFloppy.rotation.y += Math.PI / 2
        console.log('Cylinder005', cylinder005)

        cylinder005.add(movingFloppy)

        // var outlineMaterial = new THREE.MeshBasicMaterial({ color: 'red', side: THREE.BackSide })
        // var outlineMesh = new THREE.Mesh(floppy.children[0].geometry, outlineMaterial)
        // console.log('floppy', floppy)
        // floppy.add(outlineMesh)
        // outlineMesh.position.copy(floppy.children[0].position)
        // outlineMesh.scale.copy(floppy.children[0].scale)
        // outlineMesh.scale.multiplyScalar(1.1)
        // outlineMesh.position.y += 0.05
        // console.log('outlineMesh', outlineMesh)

    },
    (progress) =>
    {
  
    },
    (error) =>
    {
        console.log('error')
        console.log(error)
    }
)





/**
 * Debug
 */

const gui = new GUI()

// add camera position to debug GUI
const cameraFolder = gui.addFolder('Camera')
cameraFolder.add(camera.position, 'x', -10, 10)
cameraFolder.add(camera.position, 'y', -10, 10)
cameraFolder.add(camera.position, 'z', -10, 10)
cameraFolder.open()

const animationFolder = gui.addFolder('Animations')
// add button to play animation
animationFolder.add({play: () => playAnimation()}, 'play')
animationFolder.add({pause: () => pauseAnimation()}, 'pause')

// Renderer
const renderer = new THREE.WebGLRenderer({
    canvas: canvas
})

renderer.setSize(sizes.width, sizes.height)
// dark grey background
renderer.setClearColor('darkgrey')


// render
renderer.render(scene, camera)

camera.position.set(0, 2.8, 9.7)

const clock = new THREE.Clock()
let previousTime = 0

const playAnimation = (loop = false) =>
{
    if(!robotPickupAnimation) return

    if(paused){
        paused = false
    }

    if(loop)
    {
        robotPickupAnimation.setLoop(THREE.LoopRepeat)
    } else {
        robotPickupAnimation.setLoop(THREE.LoopOnce)
    }

    robotPickupAnimation.play().reset()
    paused = false
}

const pauseAnimation = () =>
{
    if(robotPickupAnimation)
    {
        paused = true
        //robotPickupAnimation.stop()
    }
}

const tick = () =>
{

    const elapsedTime = clock.getElapsedTime()
    const deltaTime = elapsedTime - previousTime
    previousTime = elapsedTime

    if(mixer)
    {
        if(!paused)
        {
            mixer.update(deltaTime)
        }
    }

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()


