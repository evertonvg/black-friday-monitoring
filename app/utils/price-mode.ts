export type PriceMode = 'cash' | 'installment'

export const PRICE_MODE_KEY = 'bfm.priceMode'

export function readStoredMode(storage: Pick<Storage, 'getItem'> | undefined): PriceMode {
  try {
    const value = storage?.getItem(PRICE_MODE_KEY)
    return value === 'installment' ? 'installment' : 'cash'
  } catch {
    return 'cash'
  }
}

export function storeMode(storage: Pick<Storage, 'setItem'> | undefined, mode: PriceMode): void {
  try {
    storage?.setItem(PRICE_MODE_KEY, mode)
  } catch {
    // Storage indisponível (aba anônima, bloqueio): o modo vale só nesta visita.
  }
}
