<script setup>
import { onMounted, ref } from 'vue'

const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const health = ref('carregando...')
const expenses = ref([])
const loading = ref(false)
const error = ref('')

async function loadData() {
  loading.value = true
  error.value = ''

  try {
    const [healthResponse, expensesResponse] = await Promise.all([
      fetch(`${apiBaseUrl}/api/health`),
      fetch(`${apiBaseUrl}/api/expenses`),
    ])

    if (!healthResponse.ok || !expensesResponse.ok) {
      throw new Error('Não foi possível carregar os dados da API.')
    }

    const healthPayload = await healthResponse.json()
    const expensesPayload = await expensesResponse.json()

    health.value = healthPayload.status
    expenses.value = expensesPayload.data || []
  } catch (exception) {
    health.value = 'erro'
    error.value = exception instanceof Error ? exception.message : 'Erro inesperado.'
  } finally {
    loading.value = false
  }
}

onMounted(loadData)
</script>

<template>
  <main>
    <h1>Projeto de Prestação de Contas</h1>
    <p><strong>API:</strong> {{ apiBaseUrl }}</p>
    <p><strong>Status do backend:</strong> {{ health }}</p>

    <p v-if="loading">Carregando informações...</p>
    <p v-if="error">{{ error }}</p>

    <section>
      <h2>Despesas cadastradas</h2>
      <ul v-if="expenses.length">
        <li v-for="expense in expenses" :key="expense.id">
          {{ expense.description }} — R$ {{ Number(expense.amount).toFixed(2) }}
        </li>
      </ul>
      <p v-else>Nenhuma despesa encontrada.</p>
    </section>
  </main>
</template>
