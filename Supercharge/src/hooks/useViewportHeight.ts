import { useEffect, useState } from 'react'

export function useViewportHeight(onResize?: () => void) {
    const [viewportHeight, setViewportHeight] = useState('100dvh')

    useEffect(() => {
        const visualViewport = window.visualViewport

        const updateHeight = () => {
            setViewportHeight(`${visualViewport?.height ?? window.innerHeight}px`)
            onResize?.()
        }

        updateHeight()

        if (visualViewport) {
            visualViewport.addEventListener('resize', updateHeight)
            visualViewport.addEventListener('scroll', updateHeight)
        } else {
            window.addEventListener('resize', updateHeight)
        }

        return () => {
            if (visualViewport) {
                visualViewport.removeEventListener('resize', updateHeight)
                visualViewport.removeEventListener('scroll', updateHeight)
            } else {
                window.removeEventListener('resize', updateHeight)
            }
        }
    }, [onResize])

    return viewportHeight
}
