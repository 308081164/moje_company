import { ref, onMounted, onUnmounted } from 'vue'

/** 监听 CSS media query，用于桌面/移动布局切换 */
export function useMediaQuery(query: string) {
  const matches = ref(false)

  let mql: MediaQueryList | null = null

  const update = () => {
    matches.value = mql?.matches ?? false
  }

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    mql = window.matchMedia(query)
    update()
    mql.addEventListener('change', update)
  })

  onUnmounted(() => {
    mql?.removeEventListener('change', update)
  })

  return matches
}
