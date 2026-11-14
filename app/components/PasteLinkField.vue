<script setup lang="ts">
import { apiErrorMessage, type PickedListing } from '../utils/listing'

// Alternativa à busca: colar o link do produto em qualquer loja suportada.
const emit = defineEmits<{ add: [listing: PickedListing] }>()

const url = ref('')
const loading = ref(false)
const error = ref('')

async function resolve() {
  if (!url.value.trim()) return
  loading.value = true
  error.value = ''
  try {
    const listing = await $fetch<PickedListing>('/api/resolve-link', { method: 'POST', body: { url: url.value.trim() } })
    emit('add', listing)
    url.value = ''
  } catch (e) {
    error.value = apiErrorMessage(e, 'Não foi possível ler esse link')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <UFormField label="Ou cole o link do produto" :error="error || undefined">
    <form class="flex gap-2" @submit.prevent="resolve">
      <UInput v-model="url" type="url" placeholder="https://www.amazon.com.br/dp/..." class="flex-1" />
      <UButton type="submit" :loading="loading" :disabled="!url.trim()" color="neutral" variant="outline">
        Adicionar link
      </UButton>
    </form>
  </UFormField>
</template>
