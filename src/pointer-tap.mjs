const TAP_THRESHOLD = 10

export const onPointerTap = (element, select) => {
    let press = null
    element.addEventListener('pointerdown', (event) => {
        if (!event.isPrimary || event.button !== 0 || press) {
            press = null
            return
        }
        press = { id: event.pointerId, x: event.clientX, y: event.clientY }
    })
    element.addEventListener('pointermove', (event) => {
        if (press && event.pointerId === press.id &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) > TAP_THRESHOLD) press = null
    })
    element.addEventListener('pointerup', (event) => {
        const start = press
        press = null
        if (!start || start.id !== event.pointerId ||
            Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_THRESHOLD) return
        select(event.clientX, event.clientY)
    })
    ;['pointercancel', 'pointerleave', 'lostpointercapture'].forEach((type) => {
        element.addEventListener(type, () => { press = null })
    })
}
