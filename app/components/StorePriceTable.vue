<script setup lang="ts">
interface StoreRow {
  listingId: number
  store: string
  title: string
  url: string
  status: string
  cashPriceCents: number | null
  installmentPriceCents: number | null
  installmentCount: number | null
  available: boolean
  freeShipping: boolean
  capturedAt: string | null
  lastError: string | null
}

defineProps<{ rows: StoreRow[] }>()

const installmentText = (row: StoreRow) =>
  row.installmentPriceCents && row.installmentCount
    ? `${row.installmentCount}x de ${formatBRL(Math.round(row.installmentPriceCents / row.installmentCount))} (${formatBRL(row.installmentPriceCents)})`
    : row.installmentPriceCents ? formatBRL(row.installmentPriceCents) : '—'
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-left text-muted">
        <tr>
          <th class="py-2 pr-3 font-medium">
            Loja
          </th>
          <th class="py-2 pr-3 font-medium">
            À vista
          </th>
          <th class="py-2 pr-3 font-medium">
            A prazo
          </th>
          <th class="py-2 font-medium">
            Situação
          </th>
        </tr>
      </thead>
      <tbody class="divide-y divide-default">
        <tr v-for="row in rows" :key="row.listingId" class="align-top">
          <td class="py-2 pr-3">
            <a :href="row.url" target="_blank" rel="noopener" class="font-medium hover:underline">{{ storeName(row.store) }}</a>
            <p class="text-muted line-clamp-1 max-w-56">
              {{ row.title }}
            </p>
          </td>
          <td class="py-2 pr-3 font-semibold whitespace-nowrap">
            {{ row.available && row.cashPriceCents ? formatBRL(row.cashPriceCents) : '—' }}
          </td>
          <td class="py-2 pr-3 whitespace-nowrap">
            {{ row.available ? installmentText(row) : '—' }}
          </td>
          <td class="py-2 space-y-1">
            <div class="flex flex-wrap gap-1">
              <UBadge v-if="row.status === 'pending'" color="neutral" variant="subtle">
                Aguardando coleta
              </UBadge>
              <UBadge v-else-if="row.status === 'error'" color="error" variant="subtle">
                Erro
              </UBadge>
              <UBadge v-else-if="!row.available" color="warning" variant="subtle">
                Esgotado
              </UBadge>
              <UBadge v-else color="success" variant="subtle">
                Disponível
              </UBadge>
              <UBadge v-if="row.available && row.freeShipping" color="info" variant="subtle">
                Frete grátis
              </UBadge>
            </div>
            <p v-if="row.status === 'error' && row.lastError" class="text-error text-xs">
              {{ row.lastError }}
            </p>
            <p v-if="row.capturedAt" class="text-muted text-xs">
              checado {{ formatAgo(row.capturedAt) }}
            </p>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
