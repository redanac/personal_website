const ICON_MARGIN = 16
const ICON_SPACING = 80
// movement before a press counts as a drag rather than a click
const DRAG_THRESHOLD = 4

const icons = [...document.querySelectorAll('.desktop-icon')]
const noDropZones = [document.querySelector('canvas.webgl'), document.getElementById('monitor')]

const isOverNoDropZone = (icon) => {
    const a = icon.getBoundingClientRect()
    return noDropZones.some((zone) => {
        const b = zone.getBoundingClientRect()
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    })
}

const clampToViewport = (icon, left, top) => {
    icon.style.left = `${Math.min(Math.max(0, left), window.innerWidth - icon.offsetWidth)}px`
    icon.style.top = `${Math.min(Math.max(0, top), window.innerHeight - icon.offsetHeight)}px`
}

const perColumn = Math.max(1, Math.floor((window.innerHeight - ICON_MARGIN * 2) / ICON_SPACING))
icons.forEach((icon, index) => {
    const column = Math.floor(index / perColumn)
    const row = index % perColumn
    clampToViewport(icon, ICON_MARGIN + column * ICON_SPACING * 1.1, ICON_MARGIN + row * ICON_SPACING)
})

icons.forEach((icon) => {
    let drag = null

    icon.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) return
        icon.focus()
        icon.setPointerCapture(event.pointerId)
        drag = { x: event.clientX, y: event.clientY, left: parseFloat(icon.style.left), top: parseFloat(icon.style.top), moved: false }
    })

    icon.addEventListener('pointermove', (event) => {
        if (!drag) return
        const dx = event.clientX - drag.x
        const dy = event.clientY - drag.y
        if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        drag.moved = true
        icon.classList.add('dragging')
        clampToViewport(icon, drag.left + dx, drag.top + dy)
        icon.classList.toggle('blocked', isOverNoDropZone(icon))
    })

    const endDrag = () => {
        if (drag && drag.moved && isOverNoDropZone(icon)) {
            icon.classList.add('returning')
            icon.addEventListener('transitionend', () => icon.classList.remove('returning'), { once: true })
            icon.style.left = `${drag.left}px`
            icon.style.top = `${drag.top}px`
        }
        drag = null
        icon.classList.remove('dragging', 'blocked')
    }
    icon.addEventListener('pointerup', endDrag)
    icon.addEventListener('pointercancel', endDrag)
})

// read from style, not offsetLeft/Top, which are 0 while the icons are hidden on narrow screens
window.addEventListener('resize', () => {
    icons.forEach((icon) => clampToViewport(icon, parseFloat(icon.style.left), parseFloat(icon.style.top)))
})
