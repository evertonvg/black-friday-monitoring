<script setup lang="ts">
import { apiErrorMessage, type AlertSettings } from '../../utils/listing'

const route = useRoute()
const id = Number(route.params.id)
const mode = usePriceMode()
const toast = useToast()

const { data: detail, error, refresh } = await useFetch(`/api/products/${id}`, { query: { mode } })

const range = ref<'7d' | '30d' | 'all'>('30d')
const { data: history, refresh: refreshHistory } = await useFetch(`/api/products/${id}/history`, { query: { range }, default: () => [] })

const rangeItems = [
  { label: '7 dias', value: '7d' },
  { label: '30 dias', value: '30d' },
  { label: 'Tudo', value: 'all' }
]

const alerts = ref<AlertSettings>({ targetPriceCents: null, targetMode: 'cash', dropAlertPercent: null })
watch(() => detail.value?.product, (product) => {
  if (product) {
    alerts.value = {
      targetPriceCents: product.targetPriceCents,
      targetMode: product.targetMode,
      dropAlertPercent: product.dropAlertPercent
    }
  }
}, { immediate: true })

async function reload() {
  await Promise.all([refresh(), refreshHistory()])
}

// Enquanto houver anúncio aguardando a primeira coleta, recarrega a cada 5 s.
const hasPending = computed(() => detail.value?.stores.some(s => s.status === 'pending') ?? false)
let timer: ReturnType<typeof setInterval> | undefined
watch(hasPending, (pending) => {
  if (import.meta.server) return
  clearInterval(timer)
  if (pending) timer = setInterval(reload, 5000)
}, { immediate: true })
onBeforeUnmount(() => clearInterval(timer))

const collecting = ref(false)
async function collectNow() {
  collecting.value = true
  try {
    const results = await $fetch<{ ok: boolean }[]>(`/api/products/${id}/collect`, { method: 'POST' })
    const failed = results.filter(r => !r.ok).length
    toast.add({ title: failed ? `Coleta concluída com ${failed} erro(s)` : 'Coleta concluída', color: failed ? 'warning' : 'success' })
    await reload()
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Falha na coleta'), color: 'error' })
  } finally {
    collecting.value = false
  }
}

const savingAlerts = ref(false)
async function saveAlerts() {
  savingAlerts.value = true
  try {
    await $fetch(`/api/products/${id}`, { method: 'PATCH', body: alerts.value })
    toast.add({ title: 'Alerta salvo', color: 'success' })
    await refresh()
  } catch (e) {
    toast.add({ title: apiErrorMessage(e, 'Não foi possível salvar'), color: 'error' })
  } finally {
    savingAlerts.value = false
  }
}

async function archive() {
  if (!confirm('Arquivar este produto? Ele sai da lista, mas o histórico é mantido.')) return
  await $fetch(`/api/products/${id}`, { method: 'PATCH', body: { archived: true } })
  await navigateTo('/')
}

const chartTarget = computed(() =>
  detail.value?.product.targetMode === mode.value ? detail.value.product.targetPriceCents : null)
</script>

<template>
  <UContainer class="py-6 space-y-6">
    <div class="flex items-center gap-2">
      <UButton to="/" icon="i-lucide-arrow-left" color="neutral" variant="ghost" aria-label="Voltar" />
      <h1 class="text-2xl font-semibold line-clamp-2">
        {{ detail?.name ?? 'Produto' }}
      </h1>
    </div>

    <UAlert v-if="error" color="error" variant="subtle" :title="apiErrorMessage(error, 'Produto não encontrado')" />

    <template v-else-if="detail">
      <UCard>
        <div class="flex flex-col sm:flex-row gap-6 sm:items-center">
          <img v-if="detail.imageUrl" :src="detail.imageUrl" :alt="detail.name" class="size-28 object-contain bg-white rounded">
          <div class="flex-1 space-y-1">
            <p class="text-sm text-muted">
              Melhor preço {{ mode === 'cash' ? 'à vista' : 'a prazo' }} agora
            </p>
            <p v-if="detail.state === 'pending'" class="text-lg">
              Aguardando coleta…
            </p>
            <p v-else-if="detail.state === 'soldout'" class="text-lg">
              Esgotado em todas as lojas
            </p>
            <p v-else-if="detail.state === 'stale'" class="text-lg">
              Sem preço atual — veja os erros na tabela abaixo
            </p>
            <template v-else-if="detail.best">
              <PriceTag
                size="lg"
                :cash="detail.best.cashPriceCents"
                :installment="detail.best.installmentPriceCents"
                :installment-count="detail.best.installmentCount"
              />
              <p class="text-sm">
                em <strong>{{ storeName(detail.best.store) }}</strong>
              </p>
            </template>
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted pt-1">
              <span v-if="detail.lowestEver">
                Menor preço já visto: {{ formatBRL(detail.lowestEver.cents) }} ({{ storeName(detail.lowestEver.store) }}, {{ formatDate(detail.lowestEver.at) }})
              </span>
              <span v-if="detail.price7dAgo">Há 7 dias: {{ formatBRL(detail.price7dAgo) }}</span>
              <UBadge v-if="detail.onTarget" color="success" variant="subtle">
                No alvo
              </UBadge>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <UButton v-if="detail.best" :to="detail.best.url" target="_blank" icon="i-lucide-shopping-cart">
              Ir para a loja
            </UButton>
            <UButton color="neutral" variant="outline" icon="i-lucide-refresh-cw" :loading="collecting" @click="collectNow">
              Coletar agora
            </UButton>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-medium">
            Hoje em cada loja
          </h2>
        </template>
        <StorePriceTable :rows="detail.stores" />
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-medium">
              Histórico de preço
            </h2>
            <div class="inline-flex rounded-md ring ring-default p-0.5">
              <UButton
                v-for="item in rangeItems"
                :key="item.value"
                size="xs"
                :variant="range === item.value ? 'solid' : 'ghost'"
                :color="range === item.value ? 'primary' : 'neutral'"
                @click="range = item.value as typeof range"
              >
                {{ item.label }}
              </UButton>
            </div>
          </div>
        </template>
        <p v-if="!history.some(s => s.points.length)" class="text-sm text-muted">
          Ainda sem histórico. Ele cresce a cada coleta.
        </p>
        <PriceHistoryChart v-else :series="history" :mode="mode" :target-cents="chartTarget" />
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-medium">
            Alerta
          </h2>
        </template>
        <div class="space-y-4">
          <ProductAlertFields v-model="alerts" />
          <UButton :loading="savingAlerts" @click="saveAlerts">
            Salvar alerta
          </UButton>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-medium">
            Anúncios
          </h2>
        </template>
        <ListingManager :product-id="id" :listings="detail.stores" @changed="reload" />
      </UCard>

      <div class="flex justify-end">
        <UButton color="error" variant="ghost" icon="i-lucide-archive" @click="archive">
          Arquivar produto
        </UButton>
      </div>
    </template>
  </UContainer>
</template>
