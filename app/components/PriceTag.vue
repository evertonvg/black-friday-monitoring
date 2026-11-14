<script setup lang="ts">
// Preço no modo atual: à vista, ou a prazo com as parcelas.
const props = defineProps<{
  cash: number | null
  installment: number | null
  installmentCount: number | null
  size?: 'md' | 'lg'
}>()
const mode = usePriceMode()

const main = computed(() => (mode.value === 'cash' ? props.cash : props.installment))
const detail = computed(() => {
  if (mode.value === 'installment' && props.installment && props.installmentCount) {
    return `em até ${props.installmentCount}x`
  }
  if (mode.value === 'cash' && props.installment && props.installment !== props.cash) {
    return `ou ${formatBRL(props.installment)} a prazo`
  }
  return ''
})
</script>

<template>
  <div>
    <p :class="size === 'lg' ? 'text-3xl font-bold' : 'text-xl font-semibold'">
      {{ main !== null ? formatBRL(main) : '—' }}
    </p>
    <p v-if="detail" class="text-sm text-muted">
      {{ detail }}
    </p>
  </div>
</template>
