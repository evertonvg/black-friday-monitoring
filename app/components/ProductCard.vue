<script setup lang="ts">
defineProps<{
  product: {
    id: number
    name: string
    imageUrl: string | null
    state: 'pending' | 'soldout' | 'stale' | 'ok'
    change7dPercent: number | null
    onTarget: boolean
    hasError: boolean
    best: {
      store: string
      cashPriceCents: number | null
      installmentPriceCents: number | null
      installmentCount: number | null
    } | null
  }
}>()
</script>

<template>
  <NuxtLink :to="`/produto/${product.id}`" class="block">
    <UCard class="h-full hover:ring-primary transition">
      <div class="flex gap-4">
        <img
          v-if="product.imageUrl"
          :src="product.imageUrl"
          :alt="product.name"
          class="size-20 object-contain shrink-0 rounded bg-white"
          loading="lazy"
        >
        <div v-else class="size-20 shrink-0 rounded bg-elevated flex items-center justify-center">
          <UIcon name="i-lucide-package" class="size-8 text-muted" />
        </div>
        <div class="min-w-0 flex-1 space-y-1">
          <div class="flex items-start justify-between gap-2">
            <h2 class="font-medium line-clamp-2">
              {{ product.name }}
            </h2>
            <UIcon
              v-if="product.hasError"
              name="i-lucide-triangle-alert"
              class="size-5 text-warning shrink-0"
              title="Algum anúncio está com erro de coleta"
            />
          </div>

          <p v-if="product.state === 'pending'" class="text-muted text-sm">
            Aguardando coleta
          </p>
          <p v-else-if="product.state === 'soldout'" class="text-muted text-sm">
            Esgotado em todas as lojas
          </p>
          <p v-else-if="product.state === 'stale'" class="text-muted text-sm">
            Sem preço atual (coleta com erro ou desatualizada)
          </p>
          <template v-else-if="product.best">
            <PriceTag
              :cash="product.best.cashPriceCents"
              :installment="product.best.installmentPriceCents"
              :installment-count="product.best.installmentCount"
            />
            <p class="text-sm text-muted">
              em {{ storeName(product.best.store) }}
            </p>
          </template>

          <div class="flex flex-wrap gap-2 pt-1">
            <UBadge v-if="product.onTarget" color="success" variant="subtle">
              No alvo
            </UBadge>
            <UBadge
              v-if="product.change7dPercent !== null && product.change7dPercent !== 0"
              :color="product.change7dPercent < 0 ? 'success' : 'error'"
              variant="subtle"
            >
              {{ product.change7dPercent < 0 ? '▼' : '▲' }} {{ Math.abs(product.change7dPercent) }}% em 7 dias
            </UBadge>
          </div>
        </div>
      </div>
    </UCard>
  </NuxtLink>
</template>
