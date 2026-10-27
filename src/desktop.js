import creditsText from './credits.txt?raw'

const ICON_MARGIN = 16
const ICON_SPACING = 80
// movement before a press counts as a drag rather than a click
const DRAG_THRESHOLD = 4

const icons = [...document.querySelectorAll('.desktop-icon')]
const iconLayer = document.querySelector('.desktop-icons')
const noDropZones = [document.querySelector('canvas.webgl'), document.getElementById('monitor')]

const isOverNoDropZone = (element) => {
    const a = element.getBoundingClientRect()
    return noDropZones.some((zone) => {
        const b = zone.getBoundingClientRect()
        return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
    })
}

const creditsWindow = document.getElementById('credits-window')
document.getElementById('credits-content').textContent = creditsText
const openCredits = () => {
    if (creditsWindow.open) return
    setOffset(creditsWindow, 0, 0)
    creditsWindow.showModal()
}
document.getElementById('credits-close').addEventListener('click', () => creditsWindow.close())

const settingsWindow = document.getElementById('settings-window')
const openSettings = () => {
    if (settingsWindow.open) return
    setOffset(settingsWindow, 0, 0)
    settingsWindow.showModal()
}
document.getElementById('settings-close').addEventListener('click', () => settingsWindow.close())
;[['credits', openCredits], ['settings', openSettings]].forEach(([name, open]) => {
    const icon = document.getElementById(`${name}-icon`)
    let pointerType = 'mouse'
    icon.addEventListener('pointerdown', (event) => { pointerType = event.pointerType })
    icon.addEventListener('dblclick', open)
    icon.addEventListener('click', (event) => {
        if (event.defaultPrevented) return
        if (event.detail === 0 || (event.pointerType || pointerType) !== 'mouse') open()
    })
    document.getElementById(`${name}-launch`).addEventListener('click', open)
})

const clampToLayer = (icon, left, top) => {
    icon.style.left = `${Math.min(Math.max(0, left), iconLayer.clientWidth - icon.offsetWidth)}px`
    icon.style.top = `${Math.min(Math.max(0, top), iconLayer.clientHeight - icon.offsetHeight)}px`
}

// the layer is display:none on narrow screens, where sizes read as 0 and clamping would stack every icon at 0,0
const iconsVisible = () => getComputedStyle(iconLayer).display !== 'none'
const layoutIcons = () => {
    if (!iconsVisible()) return
    const pageLeft = document.querySelector('.page').getBoundingClientRect().left
    const columnSpacing = ICON_SPACING * 1.1
    const availableColumns = Math.max(1, Math.floor((pageLeft - ICON_MARGIN) / columnSpacing))
    // Let icons extend down the scrollable desktop rather than overlap the content.
    const perColumn = Math.max(
        1,
        Math.floor((window.innerHeight - ICON_MARGIN * 2) / ICON_SPACING),
        Math.ceil(icons.length / availableColumns)
    )
    icons.forEach((icon, index) => {
        const column = Math.floor(index / perColumn)
        const row = index % perColumn
        clampToLayer(icon, ICON_MARGIN + column * columnSpacing, ICON_MARGIN + row * ICON_SPACING)
    })
}

layoutIcons()

icons.forEach((icon) => {
    let drag = null
    let dragged = false

    icon.addEventListener('pointerdown', (event) => {
        dragged = false
        if (event.button !== 0 || event.pointerType !== 'mouse') return
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
        dragged = true
        icon.classList.add('dragging')
        clampToLayer(icon, drag.left + dx, drag.top + dy)
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
    icon.addEventListener('lostpointercapture', endDrag)
    icon.addEventListener('click', (event) => {
        if (dragged && event.detail !== 0) {
            event.preventDefault()
            event.stopImmediatePropagation()
        }
    })
})

window.addEventListener('resize', () => {
    layoutIcons()
})

/**
 * Windows: dragged by the title bar using a transform, so they keep their space in the page layout.
 * data-drag="page": viewport except the canvas/monitor; "overlay": viewport; "screen": inside its parent.
 */

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const getOffset = (win) => ({ x: parseFloat(win.dataset.dx || 0), y: parseFloat(win.dataset.dy || 0) })

const setOffset = (win, x, y) => {
    win.dataset.dx = x
    win.dataset.dy = y
    win.style.transform = `translate(${x}px, ${y}px)`
}

window.addEventListener('resize', () => {
    document.querySelectorAll('[data-drag]').forEach((win) => setOffset(win, 0, 0))
})

// delegated because the monitor's window is recreated each time a floppy loads
document.addEventListener('pointerdown', (event) => {
    const handle = event.target.closest('.title-bar')
    const win = handle && handle.closest('[data-drag]')
    if (!win || event.button !== 0 || event.pointerType !== 'mouse' || event.target.closest('button')) return

    event.preventDefault()
    handle.setPointerCapture(event.pointerId)

    const isPage = win.dataset.drag === 'page'
    const isViewport = isPage || win.dataset.drag === 'overlay'
    const start = getOffset(win)
    const startRect = win.getBoundingClientRect()
    const bounds = isViewport
        ? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
        : win.parentElement.getBoundingClientRect()

    const move = (moveEvent) => {
        const dx = clamp(moveEvent.clientX - event.clientX, bounds.left - startRect.left, bounds.right - startRect.right)
        const dy = clamp(moveEvent.clientY - event.clientY, bounds.top - startRect.top, bounds.bottom - startRect.bottom)
        setOffset(win, start.x + dx, start.y + dy)
        if (isPage) win.classList.toggle('blocked', isOverNoDropZone(win))
    }

    const end = () => {
        handle.removeEventListener('pointermove', move)
        handle.removeEventListener('pointerup', end)
        handle.removeEventListener('pointercancel', end)
        if (isPage && isOverNoDropZone(win)) {
            win.classList.add('returning')
            win.addEventListener('transitionend', () => win.classList.remove('returning'), { once: true })
            setOffset(win, start.x, start.y)
        }
        win.classList.remove('blocked')
    }

    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', end)
    handle.addEventListener('pointercancel', end)
    handle.addEventListener('lostpointercapture', end, { once: true })
})
