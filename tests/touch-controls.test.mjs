import assert from 'node:assert/strict'
import test from 'node:test'
import { setupTouchControls } from '../src/touch-controls.mjs'

const setup = (matches = false, touchPoints = 0) => {
    const classes = new Set()
    const root = { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } }
    const media = Object.assign(new EventTarget(), { matches })
    const events = new EventTarget()
    const toggle = Object.assign(new EventTarget(), { checked: false })
    setupTouchControls(root, media, touchPoints, events, toggle)
    return {
        media, events, toggle,
        enabled: () => classes.has('touch-controls'),
        pointer: (pointerType) => events.dispatchEvent(Object.assign(new Event('pointerdown'), { pointerType }))
    }
}

test('Mouse-only devices keep the original desktop appearance', () => {
    const state = setup()
    assert.equal(state.enabled(), false)
    state.pointer('mouse')
    assert.equal(state.enabled(), false)
})

test('A coarse pointer enables controls, including on hybrid devices', () => {
    const state = setup(true)
    assert.equal(state.enabled(), true)
    assert.equal(state.toggle.checked, true)
})

test('Touch points enable controls when the browser reports a fine pointer', () => {
    assert.equal(setup(false, 5).enabled(), true)
})

for (const type of ['pointerdown', 'touchstart']) {
    test(`${type} reveals touch controls even when capability detection is masked`, () => {
        const state = setup()
        state.events.dispatchEvent(Object.assign(new Event(type), { pointerType: 'touch' }))
        assert.equal(state.enabled(), true)
        assert.equal(state.toggle.checked, true)
        state.media.dispatchEvent(new Event('change'))
        assert.equal(state.enabled(), true)
    })
}

test('Pointer capability changes update controls without reloading', () => {
    const state = setup()
    state.media.matches = true
    state.media.dispatchEvent(new Event('change'))
    assert.equal(state.enabled(), true)
    state.media.matches = false
    state.media.dispatchEvent(new Event('change'))
    assert.equal(state.enabled(), false)
})

test('Manual overrides take priority over automatic detection for this page visit', () => {
    const state = setup()
    state.toggle.checked = true
    state.toggle.dispatchEvent(new Event('change'))
    assert.equal(state.enabled(), true)
    state.toggle.checked = false
    state.toggle.dispatchEvent(new Event('change'))
    state.pointer('touch')
    state.media.matches = true
    state.media.dispatchEvent(new Event('change'))
    assert.equal(state.enabled(), false)
    assert.equal(state.toggle.checked, false)
})
