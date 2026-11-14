<script setup lang="ts">
import { apiErrorMessage, type AlertSettings, type PickedListing } from '../utils/listing'

const { data: stores } = await useFetch('/api/stores', { default: () => [] })

const query = ref('')
const term = ref('')
const selected = ref<PickedListing[]>([])
const name = ref('')
const nameEdited = ref(false)
const alerts = ref<AlertSettings>({ targetPriceCents: null, targetMode: 'cash', dropAlertPercent: null })
const saving = ref(false)
const saveError = ref('')

const selectedUrls = computed(() => selected.value.map(s => s.url))
const canSave = computed(() => name.value.trim().length > 0 && selected.value.length > 0 && !saving.value)

function runSearch() {
  term.value = query.value.trim().length >= 2 ? query.value.trim() : ''
}

function add(listing: PickedListing) {
  if (selectedUrls.value.includes(listing.url)) return
  selected.value = [...selected.value, listing]
  if (!nameEdited.value && selected.value.length === 1) name.value = listing.title
}

function toggle(listing: PickedListing) {
  if (selectedUrls.value.includes(listing.url)) remove(listing.url)
  else add(listing)
}

function remove(url: string) {
  selected.value = selected.value.filter(s => s.url !== url)
}

async function save() {
  saving.value = true
  saveError.value = ''
  try {
    const product = await $fetch('/api/products', {
      method: 'POST',
      body: {
        name: name.value.trim(),
        targetMode: alerts.value.targetMode,
        ...(alerts.value.targetPriceCents ? { targetPriceCents: alerts.value.targetPriceCents } : {}),
        ...(alerts.value.dropAlertPercent ? { dropAlertPercent: alerts.value.dropAlertPercent } : {}),
        listings: selected.value.map(({ store, url, title, imageUrl }) => ({ store, url, title, ...(imageUrl ? { imageUrl } : {}) }))
      }
    })
    await navigateTo(`/produto/${product.id}`)
  } catch (e) {
    saveError.value = apiErrorMessage(e, 'Não foi possível salvar')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UContainer class="py-6 space-y-6">
    <div class="flex items-center gap-2">
      <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" aria-label="Voltar" />
      <h1 class="text-2xl font-semibold">
        Adicionar produto
      </h1>
    </div>

    <UCard>
      <div class="space-y-4">
        <form class="flex gap-2" @submit.prevent="runSearch">
          <UInput v-model="query" icon="i-lucide-search" placeholder="Ex.: smart tv 55 tcl" size="lg" class="flex-1" autofocus />
          <UButton type="submit" size="lg" :disabled="query.trim().length < 2">
            Buscar
          </UButton>
        </form>
        <PasteLinkField @add="add" />
      </div>
    </UCard>

    <div v-if="term" class="grid gap-4 lg:grid-cols-2">
      <StoreSearchGroup
        v-for="store in stores"
        :key="store.id"
        :store="store"
        :term="term"
        :selected-urls="selectedUrls"
        @toggle="toggle"
      />
    </div>

    <UCard>
      <template #header>
        <h2 class="font-medium">
          Selecionados ({{ selected.length }})
        </h2>
      </template>
      <div class="space-y-4">
        <p v-if="!selected.length" class="text-sm text-muted">
          Marque os anúncios que são o mesmo produto, em uma ou mais lojas.
        </p>
        <ul v-else class="divide-y divide-default">
          <li v-for="item in selected" :key="item.url" class="flex items-center gap-3 py-2">
            <UBadge color="neutral" variant="subtle">
              {{ storeName(item.store) }}
            </UBadge>
            <span class="text-sm flex-1 min-w-0 truncate">{{ item.title }}</span>
            <UButton icon="i-lucide-x" color="neutral" variant="ghost" size="xs" aria-label="Remover" @click="remove(item.url)" />
          </li>
        </ul>

        <UFormField label="Nome do produto na sua lista">
          <UInput v-model="name" class="w-full" @input="nameEdited = true" />
        </UFormField>
        <ProductAlertFields v-model="alerts" />

        <UAlert v-if="saveError" color="error" variant="subtle" :title="saveError" />
        <UButton block size="lg" :loading="saving" :disabled="!canSave" @click="save">
          Salvar
        </UButton>
      </div>
    </UCard>
  </UContainer>
</template>
