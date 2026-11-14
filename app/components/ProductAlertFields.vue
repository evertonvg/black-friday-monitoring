<script setup lang="ts">
import type { AlertSettings } from '../utils/listing'

const model = defineModel<AlertSettings>({ required: true })

// O campo mostra reais; o modelo guarda centavos.
const targetReais = computed({
  get: () => (model.value.targetPriceCents === null ? '' : (model.value.targetPriceCents / 100).toFixed(2)),
  set: (value: string | number) => {
    const n = Number(String(value).replace(',', '.'))
    model.value = { ...model.value, targetPriceCents: value === '' || !Number.isFinite(n) || n <= 0 ? null : Math.round(n * 100) }
  }
})

const dropPercent = computed({
  get: () => (model.value.dropAlertPercent === null ? '' : String(model.value.dropAlertPercent)),
  set: (value: string | number) => {
    const n = Number(value)
    model.value = { ...model.value, dropAlertPercent: value === '' || !Number.isInteger(n) || n < 1 || n > 90 ? null : n }
  }
})

const modeItems = [
  { label: 'À vista', value: 'cash' },
  { label: 'A prazo', value: 'installment' }
]
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-3">
    <UFormField label="Preço-alvo (R$)" hint="Opcional">
      <UInput v-model="targetReais" type="number" min="0" step="0.01" placeholder="ex.: 2299,00" class="w-full" />
    </UFormField>
    <UFormField label="O alvo vale para">
      <USelect
        :model-value="model.targetMode"
        :items="modeItems"
        class="w-full"
        @update:model-value="(v: any) => model = { ...model, targetMode: v }"
      />
    </UFormField>
    <UFormField label="Avisar se cair (%)" hint="Opcional">
      <UInput v-model="dropPercent" type="number" min="1" max="90" step="1" placeholder="ex.: 10" class="w-full" />
    </UFormField>
  </div>
</template>
