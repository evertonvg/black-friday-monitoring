import { listAdapters } from '../stores/registry'

export default defineEventHandler(() => listAdapters().map(a => ({ id: a.id, name: a.name })))
