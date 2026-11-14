<script setup lang="ts">
import { apiErrorMessage, type PickedListing } from '../utils/listing'

// Resultados de uma loja; carrega sozinho, sem esperar as outras.
const props = defineProps<{
  store: { id: string, name: string }
  term: string
  selectedUrls: string[]
}>()
const emit = defineEmits<{ toggle: [listing: PickedListing] }>()

const results = ref<PickedListing[]>([])
const loading = ref(false)
const error = ref('')

async function search(term: string) {
  if (!term) return
  loading.value = true
  error.value = ''
  results.value = []
  try {
    const data = await $fetch<{ results: PickedListing[] }>(`/api/search/${props.store.id}`, { query: { q: term } })
    results.value = data.results.slice(0, 12)
  } catch (e) {
    error.value = apiErrorMessage(e, 'Não respondeu')
  } finally {
    loading.value = false
  }
}

watch(() => props.term, search, { immediate: true })
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="font-medium">
          {{ store.name }}
        </h3>
        <span v-if="!loading && !error" class="text-sm text-muted">{{ results.length }} resultados</span>
      </div>
    </template>

    <div v-if="loading" class="p-4 space-y-3">
      <USkeleton v-for="i in 3" :key="i" class="h-14" />
    </div>
    <p v-else-if="error" class="p-4 text-sm text-error">
      {{ error }}
    </p>
    <p v-else-if="!results.length" class="p-4 text-sm text-muted">
      Nada encontrado.
    </p>
    <ul v-else class="divide-y divide-default max-h-96 overflow-y-auto">
      <li v-for="result in results" :key="result.url">
        <label class="flex items-center gap-3 p-3 cursor-pointer hover:bg-elevated">
          <UCheckbox :model-value="selectedUrls.includes(result.url)" @update:model-value="emit('toggle', result)" />
          <img v-if="result.imageUrl" :src="result.imageUrl" alt="" class="size-12 object-contain bg-white rounded shrink-0" loading="lazy">
          <span class="min-w-0 flex-1">
            <span class="block text-sm line-clamp-2">{{ result.title }}</span>
            <span class="text-sm font-semibold">{{ result.cashPriceCents ? formatBRL(result.cashPriceCents) : 'sem preço' }}</span>
          </span>
          <UButton
            :to="result.url"
            target="_blank"
            icon="i-lucide-external-link"
            color="neutral"
            variant="ghost"
            size="xs"
            aria-label="Ver na loja"
            @click.stop
          />
        </label>
      </li>
    </ul>
  </UCard>
</template>
