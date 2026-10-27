export const setupTouchControls = (root, coarsePointer, touchPoints, events, toggle) => {
    let touchSeen = false
    let manualChoice = null
    const update = () => {
        const enabled = manualChoice ?? (coarsePointer.matches || touchPoints > 0 || touchSeen)
        root.classList.toggle('touch-controls', enabled)
        toggle.checked = enabled
    }

    coarsePointer.addEventListener('change', update)
    events.addEventListener('pointerdown', (event) => {
        if (event.pointerType !== 'touch' || touchSeen) return
        touchSeen = true
        update()
    }, { capture: true })
    events.addEventListener('touchstart', () => {
        if (touchSeen) return
        touchSeen = true
        update()
    }, { passive: true, capture: true })
    toggle.addEventListener('change', () => {
        manualChoice = toggle.checked
        update()
    })
    update()
}
