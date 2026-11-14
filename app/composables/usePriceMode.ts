import { readStoredMode, storeMode, type PriceMode } from '../utils/price-mode'

/** Modo de preço da tela (à vista / a prazo), compartilhado e lembrado no navegador. */
export function usePriceMode() {
  const mode = useState<PriceMode>('priceMode', () => 'cash')

  if (import.meta.client) {
    onMounted(() => {
      mode.value = readStoredMode(globalThis.localStorage)
    })
    watch(mode, value => storeMode(globalThis.localStorage, value))
  }
  return mode
}
