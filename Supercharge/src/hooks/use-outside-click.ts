import { useEffect, type RefObject } from 'react'

export function useOutsideClick<T extends HTMLElement>(
    ref: RefObject<T>,
    callback: (event: MouseEvent | TouchEvent) => void,
) {
    useEffect(() => {
        const listener = (event: MouseEvent | TouchEvent) => {
            if (!ref.current || ref.current.contains(event.target as Node)) {
                return
            }

            callback(event)
        }

        document.addEventListener('mousedown', listener)
        document.addEventListener('touchstart', listener)

        return () => {
            document.removeEventListener('mousedown', listener)
            document.removeEventListener('touchstart', listener)
        }
    }, [callback, ref])
}
