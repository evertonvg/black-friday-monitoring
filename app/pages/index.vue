<script setup lang="ts">
const mode = usePriceMode()
const { data: products, status, error } = await useFetch('/api/products', { query: { mode } })
</script>

<template>
  <UContainer class="py-6 space-y-6">
    <div class="flex items-center justify-between gap-3">
      <h1 class="text-2xl font-semibold">
        Minha lista
      </h1>
      <UButton to="/adicionar" icon="i-lucide-plus">
        Adicionar produto
      </UButton>
    </div>

    <UAlert
      v-if="error"
      color="error"
      variant="subtle"
      title="Não foi possível carregar a lista"
      :description="error.statusMessage"
    />

    <div v-else-if="status === 'pending' && !products" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <USkeleton v-for="i in 3" :key="i" class="h-32" />
    </div>

    <div v-else-if="products?.length" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <ProductCard v-for="product in products" :key="product.id" :product="product" />
    </div>

    <UCard v-else class="text-center py-10">
      <p class="text-lg font-medium">
        Sua lista está vazia
      </p>
      <p class="text-muted mb-4">
        Busque um produto nas lojas e acompanhe o preço até a Black Friday.
      </p>
      <UButton to="/adicionar" icon="i-lucide-plus">
        Adicionar produto
      </UButton>
    </UCard>
  </UContainer>
</template>
