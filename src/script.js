import * as THREE from 'three'
import { GLTFLoader, ThreeMFLoader } from 'three/examples/jsm/Addons.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import GUI from 'lil-gui'
// SETUP

var paused = false

const PICK_UP_TIME = 2.335
const INSERT_TIME = 6.639
const SELECTION_FLOPPY_SPACING = 2.5
const SELECTION_FLOPPY_Y_OFFSET = 7

var FLOPPY_OPTIONS = {
    'PERSONAL_PROFILE': {name: 'Personal Profile', colour: '#ff0000'},
    'WORK_EXPERIENCE': {name: 'Work Experience', colour: '#00ff00'},
    'PROJECTS': {name: 'Projects', colour: '#0000ff'},
    'LINKS': {name: 'Links', colour: '#ffff00'},
    'CONTACT': {name: 'Contact', colour: '#ff00ff'}
}

// get the screen height of the device not the window
const screenHeight = window.screen.height

console.log(screenHeight)
console.log(window.innerHeight)

const canvasHeight = screenHeight / 2.0
const insertedFloppyPosition = new THREE.Vector3(6.19,-1.12,6)

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

// /** Controls */
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true
// //controls.update()

/**
 * Models
 */

var floppy = null
var movingFloppy = null
var insertedFloppy = null
var robotArm = null
var mixer = null
var robotPickupAnimation = null
// list to track the 5 selectable floppy discs
var selection_floppies = [] 

/**
 * Labels
 */

// offsets/sizes are fractions of the floppy face size; tune with the 'Label' GUI folder
const LABEL_CONFIG = {
    canvasWidth: 512,
    widthRatio: 0.7,
    heightRatio: 0.35,
    offsetU: 0,
    offsetV: -0.07,
    spin: 0,
    flip: true,
    paperColour: '#f4f1e6',
    inkColour: '#1a1a1a',
    ruleColour: '#9fb7d9',
    font: '"Courier New", monospace'
}

const labels = []

const drawLabel = (labelCanvas, text) => {
    const ctx = labelCanvas.getContext('2d')
    const w = labelCanvas.width
    const h = labelCanvas.height

    ctx.fillStyle = LABEL_CONFIG.paperColour
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = LABEL_CONFIG.ruleColour
    ctx.lineWidth = Math.max(1, h * 0.01)
    for (let y = h * 0.3; y < h; y += h * 0.2) {
        ctx.beginPath()
        ctx.moveTo(w * 0.05, y)
        ctx.lineTo(w * 0.95, y)
        ctx.stroke()
    }

    let fontSize = h * 0.4
    ctx.font = `bold ${fontSize}px ${LABEL_CONFIG.font}`
    while (ctx.measureText(text).width > w * 0.9 && fontSize > 10) {
        fontSize -= 2
        ctx.font = `bold ${fontSize}px ${LABEL_CONFIG.font}`
    }
    ctx.fillStyle = LABEL_CONFIG.inkColour
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, w / 2, h / 2)
}

const findBodyMesh = (root) => {
    let body = null
    root.traverse((child) => {
        if (!body && child.isMesh && !child.userData.isLabel) body = child
    })
    return body
}

const layoutLabel = (label) => {
    const geometry = label.parent.geometry
    if (!geometry.boundingBox) geometry.computeBoundingBox()
    const size = geometry.boundingBox.getSize(new THREE.Vector3())
    const center = geometry.boundingBox.getCenter(new THREE.Vector3())

    // the thinnest bbox axis is the face normal
    const thin = ['x', 'y', 'z'].reduce((a, b) => (size[b] < size[a] ? b : a))
    const [uAxis, vAxis] = thin === 'x' ? ['z', 'y'] : thin === 'y' ? ['x', 'z'] : ['x', 'y']
    const sign = LABEL_CONFIG.flip ? -1 : 1

    label.position.copy(center)
    label.position[thin] += sign * size[thin] * 0.51
    label.position[uAxis] += LABEL_CONFIG.offsetU * size[uAxis]
    label.position[vAxis] += LABEL_CONFIG.offsetV * size[vAxis]

    const xDir = new THREE.Vector3()
    // negating x (not y) on flip turns the label round its vertical axis so it stays upright
    xDir[uAxis] = sign
    const zDir = new THREE.Vector3()
    zDir[thin] = sign
    const yDir = new THREE.Vector3().crossVectors(zDir, xDir)
    label.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xDir, yDir, zDir))
    label.rotateZ(LABEL_CONFIG.spin)

    label.scale.set(LABEL_CONFIG.widthRatio * size[uAxis], LABEL_CONFIG.heightRatio * size[vAxis], 1)
}

// call after any clone() of floppyRoot, otherwise clones share the label material
const addLabel = (floppyRoot, text) => {
    const body = findBodyMesh(floppyRoot)
    if (!body) return null

    // not disposed: an existing label may share its material with the object it was cloned from
    const existing = body.children.find((child) => child.userData.isLabel)
    if (existing) {
        body.remove(existing)
        labels.splice(labels.indexOf(existing), 1)
    }

    const material = new THREE.MeshStandardMaterial({
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1
    })
    const label = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material)
    label.name = 'floppyLabel'
    label.userData.isLabel = true
    body.add(label)
    layoutLabel(label)

    const labelCanvas = document.createElement('canvas')
    labelCanvas.width = LABEL_CONFIG.canvasWidth
    labelCanvas.height = Math.round(LABEL_CONFIG.canvasWidth * label.scale.y / label.scale.x)
    drawLabel(labelCanvas, text)

    const texture = new THREE.CanvasTexture(labelCanvas)
    texture.colorSpace = THREE.SRGBColorSpace
    // the model's transform mirrors the label vertically, so undo it here
    texture.flipY = false
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()
    material.map = texture

    labels.push(label)
    return label
}

const setLabelText = (floppyRoot, text) => {
    const label = floppyRoot.getObjectByName('floppyLabel')
    if (!label) return addLabel(floppyRoot, text)
    drawLabel(label.material.map.image, text)
    label.material.map.needsUpdate = true
    return label
}

const setChosenLabel = (text) => {
    [floppy, movingFloppy, insertedFloppy].forEach((f) => f && setLabelText(f, text))
}

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

        mixer.addEventListener('finished', () => {
        animationPlaying = false
        console.log('animation finished')
})

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
        
        // create another floppy instance for insertion
        insertedFloppy = floppy.clone()
        insertedFloppy.children[0].rotateOnAxis(new THREE.Vector3(0, 1, 0), Math.PI)
        insertedFloppy.position.copy(insertedFloppyPosition)
        scene.add(insertedFloppy)
        insertedFloppy.visible = false

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
        movingFloppy.visible = false

        if(insertedFloppy)
        {
            const insertedFloppyFolder = gui.addFolder('Inserted Floppy')
            insertedFloppyFolder.add(insertedFloppy.position, 'x', -10, 10)
            insertedFloppyFolder.add(insertedFloppy.position, 'y', -10, 10)
            insertedFloppyFolder.add(insertedFloppy.position, 'z', -10, 10)
        }

        // Iterate through each entry in FLOPPY_OPTIONS and create a selection floppy
        Object.values(FLOPPY_OPTIONS).forEach((option, index) => {
            const floppyOption = floppy.clone()
            floppyOption.position.y = SELECTION_FLOPPY_Y_OFFSET
            floppyOption.position.x = index * SELECTION_FLOPPY_SPACING 
            floppyOption.name = option.name
            // change floppy colour to option colour
            // floppyOption.traverse((child) => {
            //     if (child.isMesh && !child.userData.isLabel) {
            //         child.material = child.material.clone()
            //         child.material.color.set(option.colour)
            //     }
            // })


            addLabel(floppyOption, option.name)
            scene.add(floppyOption)
            selection_floppies.push(floppyOption)
        })

        const defaultLabel = Object.values(FLOPPY_OPTIONS)[0].name
        addLabel(floppy, defaultLabel)
        addLabel(movingFloppy, defaultLabel)
        addLabel(insertedFloppy, defaultLabel)

        if(selection_floppies[0])
        {
            const firstSelectionFloppy = selection_floppies[0]
            const selectionFloppyFolder = gui.addFolder('Selection Floppy')
            selectionFloppyFolder.add(firstSelectionFloppy.position, 'x', -10, 10)
            selectionFloppyFolder.add(firstSelectionFloppy.position, 'y', -10, 10)
            selectionFloppyFolder.add(firstSelectionFloppy.position, 'z', -10, 10)
            selectionFloppyFolder.add({spacing: SELECTION_FLOPPY_SPACING}, 'spacing', 0, 10).onChange(editFloppySpacing)
        }

        floppy.visible = false
        
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

const editFloppySpacing = (spacing) => {
            selection_floppies.forEach((floppy, index) => {
                floppy.position.x = index * spacing
            })
        }


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
animationFolder.add(
    {label: Object.values(FLOPPY_OPTIONS)[0].name},
    'label',
    Object.values(FLOPPY_OPTIONS).map((option) => option.name)
).onChange(setChosenLabel)

const relayoutLabels = () => labels.forEach(layoutLabel)
const labelFolder = gui.addFolder('Label')
labelFolder.add(LABEL_CONFIG, 'offsetU', -0.5, 0.5, 0.01).onChange(relayoutLabels)
labelFolder.add(LABEL_CONFIG, 'offsetV', -0.5, 0.5, 0.01).onChange(relayoutLabels)
labelFolder.add(LABEL_CONFIG, 'widthRatio', 0.1, 1, 0.01).onChange(relayoutLabels)
labelFolder.add(LABEL_CONFIG, 'heightRatio', 0.1, 1, 0.01).onChange(relayoutLabels)
labelFolder.add(LABEL_CONFIG, 'spin', -Math.PI, Math.PI, Math.PI / 2).onChange(relayoutLabels)
labelFolder.add(LABEL_CONFIG, 'flip').onChange(relayoutLabels)


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

var animationPlaying = false

const playAnimation = (loop = false) =>
{
    if(!robotPickupAnimation) return

    movingFloppy.visible = false
    insertedFloppy.visible = false
    floppy.visible = true

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
    animationPlaying = true
    console.log('playAnimation called')

    paused = false
}

const pauseAnimation = () =>
{
    if(robotPickupAnimation)
    {
        paused = true
        animationPlaying = false    
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
            if (robotPickupAnimation && floppy && movingFloppy && insertedFloppy && animationPlaying)
            {
                const time = robotPickupAnimation.time

                floppy.visible = time < PICK_UP_TIME
                movingFloppy.visible = time >= PICK_UP_TIME && time < INSERT_TIME
                insertedFloppy.visible = time >= INSERT_TIME
            }
        }
    }

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()


