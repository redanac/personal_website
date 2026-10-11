import * as THREE from 'three'

const scene = new THREE.Scene()

const sizes = {
    width: 800, 
    height: 600
}

const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height)
scene.add(camera)