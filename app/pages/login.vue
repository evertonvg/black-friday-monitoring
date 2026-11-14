<script setup lang="ts">
definePageMeta({ layout: false })

const password = ref('')
const error = ref('')
const loading = ref(false)
const { fetch: refreshSession } = useUserSession()

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: { password: password.value } })
    await refreshSession()
    await navigateTo('/')
  } catch (e: any) {
    error.value = e?.data?.statusMessage ?? e?.statusMessage ?? 'Não foi possível entrar'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center p-4">
    <UCard class="w-full max-w-sm">
      <template #header>
        <h1 class="text-xl font-semibold">
          Monitor BF
        </h1>
      </template>
      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Senha" :error="error || undefined">
          <UInput v-model="password" type="password" autocomplete="current-password" class="w-full" autofocus />
        </UFormField>
        <UButton type="submit" block :loading="loading" :disabled="!password">
          Entrar
        </UButton>
      </form>
    </UCard>
  </div>
</template>
