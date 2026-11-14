<script setup lang="ts">
const mode = usePriceMode()
</script>

<template>
  <div class="inline-flex rounded-md ring ring-default p-0.5" role="group" aria-label="Modo de preço">
    <UButton
      size="sm"
      :variant="mode === 'cash' ? 'solid' : 'ghost'"
      :color="mode === 'cash' ? 'primary' : 'neutral'"
      :aria-pressed="mode === 'cash'"
      @click="mode = 'cash'"
    >
      À vista
    </UButton>
    <UButton
      size="sm"
      :variant="mode === 'installment' ? 'solid' : 'ghost'"
      :color="mode === 'installment' ? 'primary' : 'neutral'"
      :aria-pressed="mode === 'installment'"
      @click="mode = 'installment'"
    >
      A prazo
    </UButton>
  </div>
</template>
