<script setup lang="ts">
import { apiErrorMessage, type PickedListing } from '../utils/listing'

// Adicionar (busca ou link) e remover anúncios de um produto existente.
const props = defineProps<{
  productId: number
  listings: { listingId: number, store: string, title: string, url: string }[]
}>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const { data: stores } = await useFetch('/api/stores', { default: () => [] })
const query = ref('')
const term = ref('')
const busy = ref(false)

const existingUrls = computed(() => props.listings.map(l => l.url))

async function add(listing: PickedListing) {
  if (existingUrls.value.includes(listing.url)) return
  busy.value = true
  try {
    await $fetch(`/api/products/${props.productId}/listings`, {
      method: 'POST',
      body: { store: listing.store, url: listing.url, title: listing.title, ...(listing.imageUrl ? { imageUrl: listing.imageUrl } : {}) }
    })
    toast.add({ title: 'Anúncio adicionado', color: 'success' })
    emit('changed')
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Não foi possível adicionar'), color: 'error' })
  } finally {
    busy.value = false
  }
}

async function remove(listingId: number, title: string) {
  if (!confirm(`Remover "${title}" deste produto? O histórico desse anúncio será apagado.`)) return
  try {
    await $fetch(`/api/listings/${listingId}`, { method: 'DELETE' })
    emit('changed')
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Não foi possível remover'), color: 'error' })
  }
}
</script>

<template>
  <div class="space-y-4">
    <ul class="divide-y divide-default">
      <li v-for="listing in listings" :key="listing.listingId" class="flex items-center gap-3 py-2">
        <UBadge color="neutral" variant="subtle">
          {{ storeName(listing.store) }}
        </UBadge>
        <span class="text-sm flex-1 min-w-0 truncate">{{ listing.title }}</span>
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          aria-label="Remover anúncio"
          @click="remove(listing.listingId, listing.title)"
        />
      </li>
    </ul>

    <form class="flex gap-2" @submit.prevent="term = query.trim().length >= 2 ? query.trim() : ''">
      <UInput v-model="query" icon="i-lucide-search" placeholder="Buscar em outras lojas" class="flex-1" />
      <UButton type="submit" color="neutral" variant="outline" :disabled="query.trim().length < 2">
        Buscar
      </UButton>
    </form>
    <PasteLinkField @add="add" />

    <div v-if="term" class="grid gap-4 lg:grid-cols-2">
      <StoreSearchGroup
        v-for="store in stores"
        :key="store.id"
        :store="store"
        :term="term"
        :selected-urls="existingUrls"
        @toggle="add"
      />
    </div>
    <p v-if="busy" class="text-sm text-muted">
      Adicionando…
    </p>
  </div>
</template>
