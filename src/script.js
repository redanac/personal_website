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
const SELECTION_FLOPPY_X_OFFSET = 1
const SELECTION_FLOPPY_Y_OFFSET = 7

const IDLE_CONFIG = {
    bobAmplitude: 0.01,
    bobSpeed: 1.75,
    swayAmplitude: 0.01,
    tiltAmplitude: 0.02,
    speedJitter: 0.25
}

const HOVER_CONFIG = {
    duration: 0.5,
    focusDistance: 1.5,
    spins: 1
}

const SELECT_CONFIG = {
    toBaseDuration: 0.5,
    returnDuration: 0.5,
    slideDuration: 0.35,
    slotClearance: 2
}

const skipRobot = document.getElementById('skip-robot')
const robotSpeed = document.getElementById('robot-speed')
const robotSpeedControls = document.getElementById('robot-speed-controls')
const robotSpeedValue = document.getElementById('robot-speed-value')

skipRobot.addEventListener('change', () => {
    robotSpeedControls.disabled = skipRobot.checked
})
robotSpeed.addEventListener('input', () => {
    robotSpeedValue.value = `${robotSpeed.value}×`
})

var FLOPPY_OPTIONS = {
    'PERSONAL_PROFILE': {name: 'Personal Profile', colour: '#ff0000', file: './screens/personal-profile.html'},
    'WORK_EXPERIENCE': {name: 'Work Experience', colour: '#00ff00', file: './screens/work-experience.html'},
    'PROJECTS': {name: 'Projects', colour: '#0000ff', file: './screens/projects.html'},
    'LINKS': {name: 'Links', colour: '#ffff00', file: './screens/links.html'},
    'CONTACT': {name: 'Contact', colour: '#ff00ff', file: './screens/contact.html'}
}

// each screen becomes its own chunk, loaded on demand as a raw string
const screenLoaders = import.meta.glob('./screens/*.html', { query: '?raw', import: 'default' })

// loaded up front; content is a promise so monitorOn can await it if it isn't ready yet
Object.values(FLOPPY_OPTIONS).forEach((option) => {
    const load = screenLoaders[option.file]
    option.content = (load ? load() : Promise.reject(new Error(`${option.file}: not found`))).catch((error) => {
        console.error(error)
        return `<p>&gt; ERROR: could not load ${option.name}</p>`
    })
})

const insertedFloppyPosition = new THREE.Vector3(6.19,-1.12,6)

// Canvas
const canvas = document.querySelector('canvas.webgl')

// Set up theejs scene
const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(75, 1)
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

const cubeGeometry = new THREE.BoxGeometry(15, 10, 15)
const cubeMaterial = new THREE.MeshStandardMaterial({ color: 0xd4d0c8 })
const cube = new THREE.Mesh(cubeGeometry, cubeMaterial)
cube.position.set(0, -5, 4)
scene.add(cube)

// add black hole on top for visual effect of floppy insertion
const insertHoleGeometry = new THREE.BoxGeometry(2.0, 0.1, 0.2)
const insertHoleMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 })
const insertHole = new THREE.Mesh(insertHoleGeometry, insertHoleMaterial)
insertHole.position.set(0, 0, 6.04)
scene.add(insertHole)

var floppy = null
var movingFloppy = null
var insertedFloppy = null
var robotArm = null
var mixer = null
var robotPickupAnimation = null
// list to track the 5 selectable floppy discs
var selection_floppies = [] 
const hoverHitAreas = []
let basePose = null
let insertPose = null

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
        // the last frame can jump past INSERT_TIME and finish in the same update
        checkMonitorInsert(true)
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
        Object.entries(FLOPPY_OPTIONS).forEach(([optionKey, option], index) => {
            const floppyOption = floppy.clone()
            floppyOption.position.y = SELECTION_FLOPPY_Y_OFFSET
            floppyOption.position.x = SELECTION_FLOPPY_X_OFFSET + index * SELECTION_FLOPPY_SPACING 
            floppyOption.name = option.name
            floppyOption.userData.optionKey = optionKey

            // the model sits ~6 below its origin, so re-pivot on its visual centre for spins and focus (rest pose unchanged)
            floppyOption.updateMatrixWorld(true)
            const visualCenter = new THREE.Box3().setFromObject(floppyOption).getCenter(new THREE.Vector3())
            const localCenter = floppyOption.worldToLocal(visualCenter.clone())
            floppyOption.children.forEach((child) => child.position.sub(localCenter))
            const pivotX = visualCenter.x - floppyOption.position.x
            floppyOption.position.copy(visualCenter)

            // plain numbers because userData is JSON-copied on clone()
            floppyOption.userData.idle = {
                pivotX,
                baseX: floppyOption.position.x,
                baseY: floppyOption.position.y,
                baseZ: floppyOption.position.z,
                baseRotX: floppyOption.rotation.x,
                baseRotY: floppyOption.rotation.y,
                baseRotZ: floppyOption.rotation.z,
                phase: Math.random() * Math.PI * 2,
                speed: 1 + (Math.random() - 0.5) * IDLE_CONFIG.speedJitter
            }
            floppyOption.userData.hover = { progress: 0 }
            floppyOption.userData.select = { state: 'idle' }
            // change floppy colour to option colour
            // floppyOption.traverse((child) => {
            //     if (child.isMesh && !child.userData.isLabel) {
            //         child.material = child.material.clone()
            //         child.material.color.set(option.colour)
            //     }
            // })


            addLabel(floppyOption, option.name)

            // stays at the rest slot so the floppy keeps hover after it moves out from under the cursor
            const box = new THREE.Box3().setFromObject(floppyOption)
            const hitArea = new THREE.Mesh(
                new THREE.BoxGeometry(...box.getSize(new THREE.Vector3()).toArray()),
                new THREE.MeshBasicMaterial({ visible: false })
            )
            hitArea.userData.offset = box.getCenter(new THREE.Vector3()).sub(floppyOption.position).toArray()
            hitArea.userData.floppy = floppyOption
            scene.add(hitArea)
            hoverHitAreas.push(hitArea)
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
            selectionFloppyFolder.add(firstSelectionFloppy.userData.idle, 'baseX', -10, 10).name('x')
            selectionFloppyFolder.add(firstSelectionFloppy.userData.idle, 'baseY', -10, 10).name('y')
            selectionFloppyFolder.add(firstSelectionFloppy.userData.idle, 'baseZ', -10, 10).name('z')
            selectionFloppyFolder.add({spacing: SELECTION_FLOPPY_SPACING}, 'spacing', 0, 10).onChange(editFloppySpacing)
        }

        floppy.visible = false

        const visualCentre = (object) => {
            object.updateMatrixWorld(true)
            return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3())
        }
        // selection floppies pivot on their visual centre, so matching centres lines them up with these models
        basePose = { position: visualCentre(floppy), rotY: floppy.rotation.y, rotZ: floppy.rotation.z }
        // insertedFloppy's inner mesh is turned PI, so the selection floppy needs the same turn
        insertPose = { position: visualCentre(insertedFloppy), rotY: insertedFloppy.rotation.y + Math.PI, rotZ: insertedFloppy.rotation.z }

        loadDefaultSelection('PERSONAL_PROFILE')
        
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

//hide GUI by default
gui.hide()

const editFloppySpacing = (spacing) => {
            selection_floppies.forEach((floppy, index) => {
                floppy.userData.idle.baseX = index * spacing + floppy.userData.idle.pivotX
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

const hoverFolder = gui.addFolder('Hover')
hoverFolder.add(HOVER_CONFIG, 'duration', 0.1, 3, 0.05)
hoverFolder.add(HOVER_CONFIG, 'focusDistance', 0.5, 10, 0.1)

const idleFolder = gui.addFolder('Idle')
idleFolder.add(IDLE_CONFIG, 'bobAmplitude', 0, 1, 0.01)
idleFolder.add(IDLE_CONFIG, 'bobSpeed', 0, 5, 0.01)
idleFolder.add(IDLE_CONFIG, 'swayAmplitude', 0, 1, 0.01)
idleFolder.add(IDLE_CONFIG, 'tiltAmplitude', 0, 0.5, 0.01)

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

const resizeCanvas = () => {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (!width || !height) return

    camera.aspect = width / height
    // Keep the desktop's horizontal field of view so the floppy row is not cropped on narrow screens.
    const referenceAspect = 960 / 360
    camera.fov = THREE.MathUtils.radToDeg(
        2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(75 / 2)) * Math.max(1, referenceAspect / camera.aspect))
    )
    camera.updateProjectionMatrix()

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(width, height, false)
}

const canvasObserver = new ResizeObserver(resizeCanvas)
canvasObserver.observe(canvas)
window.addEventListener('resize', resizeCanvas)
resizeCanvas()
// dark grey background
renderer.setClearColor('#111814')


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


/**
 * Hover
 */

const raycaster = new THREE.Raycaster()
const pointer = new THREE.Vector2()
let pointerInside = false
let hoveredFloppy = null

canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1
    pointerInside = true
})

canvas.addEventListener('pointerleave', () => {
    pointerInside = false
})

const updateHoveredFloppy = () => {
    hoverHitAreas.forEach((hitArea) => {
        const idle = hitArea.userData.floppy.userData.idle
        const [ox, oy, oz] = hitArea.userData.offset
        hitArea.position.set(idle.baseX + ox, idle.baseY + oy, idle.baseZ + oz)
    })

    let next = null
    if (pointerInside) {
        raycaster.setFromCamera(pointer, camera)
        const isIdle = (f) => f.userData.select.state === 'idle'
        // the focused floppy can cover other slots, so it keeps priority while under the cursor
        if (hoveredFloppy && isIdle(hoveredFloppy) && raycaster.intersectObject(hoveredFloppy, true).length) {
            next = hoveredFloppy
        } else {
            const hitArea = raycaster.intersectObjects(hoverHitAreas.filter((h) => isIdle(h.userData.floppy)), false)[0]
            next = hitArea ? hitArea.object.userData.floppy : null
        }
    }
    hoveredFloppy = next
    canvas.style.cursor = hoveredFloppy ? 'pointer' : 'default'
}

const easeInOutCubic = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)

/**
 * Selection
 */

const tweens = new Map()

const startTween = (object, toPose, duration, onComplete) => {
    // drop whole turns (e.g. the hover spin) so it doesn't unwind on the way
    const turns = Math.round((object.rotation.y - toPose.rotY) / (Math.PI * 2))
    tweens.set(object, {
        fromPos: object.position.clone(),
        toPos: toPose.position.clone(),
        fromRotY: object.rotation.y - turns * Math.PI * 2,
        toRotY: toPose.rotY,
        fromRotZ: object.rotation.z,
        toRotZ: toPose.rotZ,
        progress: 0,
        duration,
        onComplete
    })
}

const updateTweens = (deltaTime) => {
    tweens.forEach((tween, object) => {
        tween.progress = Math.min(1, tween.progress + deltaTime / tween.duration)
        const e = easeInOutCubic(tween.progress)
        object.position.lerpVectors(tween.fromPos, tween.toPos, e)
        object.rotation.y = THREE.MathUtils.lerp(tween.fromRotY, tween.toRotY, e)
        object.rotation.z = THREE.MathUtils.lerp(tween.fromRotZ, tween.toRotZ, e)
        if (tween.progress === 1) {
            tweens.delete(object)
            if (tween.onComplete) tween.onComplete()
        }
    })
}

const restPose = (selectionFloppy) => {
    const idle = selectionFloppy.userData.idle
    return { position: new THREE.Vector3(idle.baseX, idle.baseY, idle.baseZ), rotY: idle.baseRotY, rotZ: idle.baseRotZ }
}

let selectedFloppy = null
let pendingFloppy = null
let returningFloppy = null
let selectionBusy = false

/**
 * Monitor
 */

const monitorScreen = document.getElementById('monitor-screen')
const screenContent = document.getElementById('screen-content')
const powerLed = document.getElementById('power-led')
// option to show once the robot has inserted the floppy
let monitorPendingOption = null
// bumped on every on/off so a slow fetch can't switch the screen on after it was turned off
let monitorToken = 0

const buildScreenWindow = (option, html) => {
    const win = document.createElement('div')
    win.className = 'window screen-window'
    win.dataset.drag = 'screen'

    const titleBar = document.createElement('div')
    titleBar.className = 'title-bar'
    const titleText = document.createElement('span')
    titleText.className = 'title-bar-text'
    const fileName = option.file.split('/').pop().replace('.html', '.txt').toUpperCase()
    titleText.textContent = `MS-DOS Prompt - TYPE ${fileName}`
    const controls = document.createElement('div')
    controls.className = 'title-bar-controls'
    controls.setAttribute('aria-hidden', 'true')
    controls.innerHTML = '<span>_</span><span>&#9633;</span><span>&times;</span>'
    titleBar.append(titleText, controls)

    const body = document.createElement('div')
    body.className = 'window-body terminal'
    body.innerHTML = html

    const portrait = body.querySelector('.profile-portrait')
    if (portrait) {
        portrait.addEventListener('load', () => {
            const canvas = document.createElement('canvas')
            canvas.width = 64
            canvas.height = Math.round(canvas.width * portrait.naturalHeight / portrait.naturalWidth)
            const context = canvas.getContext('2d')
            if (!context) throw new Error('Unable to create the pixelated portrait')
            context.drawImage(portrait, 0, 0, canvas.width, canvas.height)
            portrait.src = canvas.toDataURL('image/png')
        }, { once: true })
    }

    win.append(titleBar, body)
    return win
}

const monitorOn = async (option) => {
    const token = ++monitorToken
    const html = await option.content
    if (token !== monitorToken) return

    screenContent.replaceChildren(buildScreenWindow(option, html))
    monitorScreen.classList.remove('turning-off', 'is-on')
    monitorScreen.classList.add('turning-on')
    powerLed.classList.add('is-on')
    monitorScreen.addEventListener('animationend', () => {
        if (!monitorScreen.classList.contains('turning-on')) return
        monitorScreen.classList.replace('turning-on', 'is-on')
    }, { once: true })
}

const monitorOff = () => {
    monitorToken++
    if (!monitorScreen.classList.contains('is-on') && !monitorScreen.classList.contains('turning-on')) return
    monitorScreen.classList.remove('turning-on', 'is-on')
    monitorScreen.classList.add('turning-off')
    powerLed.classList.remove('is-on')
    monitorScreen.addEventListener('animationend', () => {
        if (!monitorScreen.classList.contains('turning-off')) return
        monitorScreen.classList.remove('turning-off')
        screenContent.innerHTML = ''
    }, { once: true })
}

const checkMonitorInsert = (finished = false) => {
    if (!monitorPendingOption || !robotPickupAnimation) return
    if (finished || robotPickupAnimation.time >= INSERT_TIME) {
        monitorOn(monitorPendingOption)
        monitorPendingOption = null
    }
}

const beginSelecting = (selectionFloppy) => {
    selectionFloppy.userData.select.state = 'selecting'
    if (skipRobot.checked) {
        const aboveSlotPose = {
            ...insertPose,
            position: insertPose.position.clone().add(new THREE.Vector3(0, SELECT_CONFIG.slotClearance, 0))
        }
        startTween(selectionFloppy, aboveSlotPose, SELECT_CONFIG.toBaseDuration, () => {
            startTween(selectionFloppy, insertPose, SELECT_CONFIG.slideDuration, () => {
                setChosenLabel(selectionFloppy.name)
                selectionFloppy.visible = false
                selectionFloppy.userData.select.state = 'hidden'
                selectedFloppy = selectionFloppy
                insertedFloppy.visible = true
                selectionBusy = false
                monitorOn(FLOPPY_OPTIONS[selectionFloppy.userData.optionKey])
            })
        })
        return
    }

    startTween(selectionFloppy, basePose, SELECT_CONFIG.toBaseDuration, () => {
        setChosenLabel(selectionFloppy.name)
        selectionFloppy.visible = false
        selectionFloppy.userData.select.state = 'hidden'
        selectedFloppy = selectionFloppy
        selectionBusy = false
        monitorPendingOption = FLOPPY_OPTIONS[selectionFloppy.userData.optionKey]
        playAnimation()
    })
}

// the page opens with this floppy already in the drive, skipping the robot animation
const loadDefaultSelection = (optionKey) => {
    const selectionFloppy = selection_floppies.find((f) => f.userData.optionKey === optionKey)
    if (!selectionFloppy) return

    setChosenLabel(selectionFloppy.name)
    selectionFloppy.visible = false
    selectionFloppy.userData.select.state = 'hidden'
    selectedFloppy = selectionFloppy
    insertedFloppy.visible = true
    monitorOn(FLOPPY_OPTIONS[optionKey])
}

const selectFloppy = (next) => {
    selectionBusy = true

    if (!selectedFloppy) {
        beginSelecting(next)
        return
    }

    const previous = selectedFloppy
    selectedFloppy = null
    next.userData.select.state = skipRobot.checked ? 'waiting' : 'pending'
    pendingFloppy = next

    if (robotPickupAnimation) robotPickupAnimation.stop()
    animationPlaying = false
    monitorPendingOption = null
    monitorOff()
    ;[floppy, movingFloppy, insertedFloppy].forEach((f) => { f.visible = false })

    previous.position.copy(insertPose.position)
    previous.rotation.y = insertPose.rotY
    previous.rotation.z = insertPose.rotZ
    previous.visible = true
    previous.userData.select.state = 'returning'
    returningFloppy = previous
    startTween(previous, restPose(previous), SELECT_CONFIG.returnDuration, () => {
        previous.userData.select.state = 'idle'
        previous.userData.hover.progress = 0
        returningFloppy = null
    })
}

// Skip mode holds the clicked pose while the previous disc returns.
const updatePending = () => {
    if (pendingFloppy && !returningFloppy &&
        (pendingFloppy.userData.select.state === 'waiting' || pendingFloppy.userData.hover.progress === 0)) {
        const next = pendingFloppy
        pendingFloppy = null
        beginSelecting(next)
    }
}

canvas.addEventListener('click', () => {
    if (hoveredFloppy && !selectionBusy) selectFloppy(hoveredFloppy)
})

const idlePosition = new THREE.Vector3()
const focusPosition = new THREE.Vector3()

const updateIdleFloppies = (elapsedTime, deltaTime) =>
{
    camera.getWorldDirection(focusPosition)
    focusPosition.multiplyScalar(HOVER_CONFIG.focusDistance).add(camera.position)

    selection_floppies.forEach((selectionFloppy) => {
        const state = selectionFloppy.userData.select.state
        if (state !== 'idle' && state !== 'pending') return

        const idle = selectionFloppy.userData.idle
        const hover = selectionFloppy.userData.hover
        const t = elapsedTime * idle.speed + idle.phase

        idlePosition.set(idle.baseX, idle.baseY + Math.sin(t * IDLE_CONFIG.bobSpeed) * IDLE_CONFIG.bobAmplitude, idle.baseZ)
        // different frequencies so bob, sway and tilt never line up
        const idleRotY = idle.baseRotY + Math.sin(t * 0.7) * IDLE_CONFIG.swayAmplitude
        const idleRotZ = idle.baseRotZ + Math.sin(t * 0.9 + 1) * IDLE_CONFIG.tiltAmplitude

        // stepping progress (not restarting a tween) lets a reversal start from the current pose
        const direction = state === 'idle' && selectionFloppy === hoveredFloppy ? 1 : -1
        hover.progress = THREE.MathUtils.clamp(hover.progress + direction * deltaTime / HOVER_CONFIG.duration, 0, 1)
        const e = easeInOutCubic(hover.progress)

        selectionFloppy.position.lerpVectors(idlePosition, focusPosition, e)
        selectionFloppy.rotation.y = THREE.MathUtils.lerp(idleRotY, idle.baseRotY, e) + e * Math.PI * 2 * HOVER_CONFIG.spins
        selectionFloppy.rotation.z = THREE.MathUtils.lerp(idleRotZ, idle.baseRotZ, e)
    })
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
            mixer.update(deltaTime * Number(robotSpeed.value))
            if (robotPickupAnimation && floppy && movingFloppy && insertedFloppy && animationPlaying)
            {
                const time = robotPickupAnimation.time

                floppy.visible = time < PICK_UP_TIME
                movingFloppy.visible = time >= PICK_UP_TIME && time < INSERT_TIME
                insertedFloppy.visible = time >= INSERT_TIME
                checkMonitorInsert()
            }
        }
    }

    updateHoveredFloppy()
    updateTweens(deltaTime)
    updateIdleFloppies(elapsedTime, deltaTime)
    updatePending()

    // Render
    renderer.render(scene, camera)

    // Call tick again on the next frame
    window.requestAnimationFrame(tick)
}

tick()
