<script setup lang="ts">
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import type { PriceMode } from '../utils/price-mode'

use([CanvasRenderer, LineChart, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent])

interface Series {
  listingId: number
  store: string
  title: string
  points: { t: string, cash: number | null, installment: number | null, available: boolean }[]
}

const props = defineProps<{
  series: Series[]
  mode: PriceMode
  targetCents: number | null
}>()

const colorMode = useColorMode()

const option = computed(() => {
  // Mesma loja com mais de um anúncio: o nome da série leva o começo do título.
  const perStore = new Map<string, number>()
  for (const s of props.series) perStore.set(s.store, (perStore.get(s.store) ?? 0) + 1)

  const lines = props.series.map((s, index) => ({
    name: (perStore.get(s.store) ?? 0) > 1 ? `${storeName(s.store)} · ${s.title.slice(0, 24)}` : storeName(s.store),
    type: 'line' as const,
    showSymbol: true,
    symbolSize: 5,
    connectNulls: false,
    // Indisponível vira lacuna no gráfico.
    data: s.points.map((p) => {
      const cents = p.available ? (props.mode === 'cash' ? p.cash : p.installment) : null
      return [p.t, cents === null ? null : cents / 100]
    }),
    markLine: index === 0 && props.targetCents
      ? {
          symbol: 'none',
          silent: true,
          lineStyle: { type: 'dashed' as const },
          label: { formatter: 'alvo' },
          data: [{ yAxis: props.targetCents / 100 }]
        }
      : undefined
  }))

  const brl = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  return {
    backgroundColor: 'transparent',
    grid: { left: 8, right: 16, top: 40, bottom: 8, containLabel: true },
    legend: { top: 0, type: 'scroll' as const },
    tooltip: {
      trigger: 'axis' as const,
      valueFormatter: (value: unknown) => (typeof value === 'number' ? brl(value) : 'indisponível')
    },
    xAxis: { type: 'time' as const },
    yAxis: { type: 'value' as const, scale: true, axisLabel: { formatter: (v: number) => brl(v) } },
    series: lines
  }
})
</script>

<template>
  <VChart
    :option="option"
    :theme="colorMode.value === 'dark' ? 'dark' : undefined"
    autoresize
    class="h-80 w-full"
  />
</template>
