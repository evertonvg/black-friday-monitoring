<script setup lang="ts">
const { clear } = useUserSession()

async function logout() {
  await $fetch('/api/auth/logout', { method: 'POST' })
  await clear()
  await navigateTo('/login')
}
</script>

<template>
  <div class="min-h-screen bg-default">
    <header class="border-b border-default">
      <UContainer class="flex items-center justify-between gap-3 py-3">
        <NuxtLink to="/" class="font-semibold text-lg shrink-0">
          Monitor BF
        </NuxtLink>
        <div class="flex items-center gap-2">
          <PriceModeToggle />
          <UButton icon="i-lucide-log-out" color="neutral" variant="ghost" aria-label="Sair" @click="logout" />
        </div>
      </UContainer>
    </header>
    <main>
      <slot />
    </main>
  </div>
</template>
