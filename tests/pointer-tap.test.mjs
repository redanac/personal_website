import assert from 'node:assert/strict'
import test from 'node:test'
import { onPointerTap } from '../src/pointer-tap.mjs'

const setup = (pointerType = 'touch') => {
    const element = new EventTarget()
    const selections = []
    onPointerTap(element, (x, y) => selections.push([x, y]))
    const send = (type, properties = {}) => {
        const event = Object.assign(new Event(type, { cancelable: true }), {
            pointerId: 1, isPrimary: true, button: 0,
            clientX: 100, clientY: 100, pointerType, ...properties
        })
        element.dispatchEvent(event)
        assert.equal(event.defaultPrevented, false, 'Native scrolling and zoom must remain available')
    }
    return { selections, send }
}

for (const pointerType of ['mouse', 'touch', 'pen']) {
    test(`${pointerType}: a single press selects using release coordinates without a prior hover`, () => {
        const { send, selections } = setup(pointerType)
        send('pointerdown')
        send('pointerup', { clientX: 106, clientY: 108 })
        assert.deepEqual(selections, [[106, 108]])
        send('pointerup')
        assert.equal(selections.length, 1)
    })
}

test('Movement beyond 10 pixels is a swipe, even if it returns to the start', () => {
    const { send, selections } = setup()
    send('pointerdown')
    send('pointermove', { clientX: 107, clientY: 108 })
    send('pointerup')
    assert.deepEqual(selections, [])
})

test('A release beyond the threshold cancels even without a pointermove', () => {
    const { send, selections } = setup()
    send('pointerdown')
    send('pointerup', { clientY: 111 })
    assert.deepEqual(selections, [])
})

for (const type of ['pointercancel', 'pointerleave', 'lostpointercapture']) {
    test(`${type} cancels selection and allows the next tap`, () => {
        const { send, selections } = setup()
        send('pointerdown')
        send(type)
        send('pointerup')
        assert.deepEqual(selections, [])
        send('pointerdown')
        send('pointerup')
        assert.deepEqual(selections, [[100, 100]])
    })
}

test('Multi-finger gestures cancel the pending tap', () => {
    const { send, selections } = setup()
    send('pointerdown')
    send('pointerdown', { pointerId: 2, isPrimary: false })
    send('pointerup', { pointerId: 2, isPrimary: false })
    send('pointerup')
    assert.deepEqual(selections, [])
})

test('Right clicks and mismatched pointer releases do not select', () => {
    const { send, selections } = setup('mouse')
    send('pointerdown', { button: 2 })
    send('pointerup', { button: 2 })
    send('pointerdown')
    send('pointerup', { pointerId: 2 })
    assert.deepEqual(selections, [])
})
