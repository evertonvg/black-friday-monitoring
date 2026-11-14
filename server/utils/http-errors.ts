import type { H3Event } from 'h3'
import { z, ZodError } from 'zod'
import { DuplicateListingError, NotFoundError } from '../services/products'
import { BlockedError, InvalidProductUrlError, ShortLinkError, UnsupportedStoreError } from '../stores/errors'

/** Converte erros conhecidos do domínio em respostas HTTP com mensagem em pt-BR. */
export function toHttpError(error: unknown) {
  if (error instanceof DuplicateListingError) return createError({ statusCode: 409, statusMessage: error.message })
  if (error instanceof NotFoundError) return createError({ statusCode: 404, statusMessage: error.message })
  if (error instanceof ShortLinkError || error instanceof UnsupportedStoreError || error instanceof InvalidProductUrlError) {
    return createError({ statusCode: 400, statusMessage: error.message })
  }
  if (error instanceof ZodError) return createError({ statusCode: 400, statusMessage: 'Dados inválidos', data: error.issues })
  if (error instanceof BlockedError) return createError({ statusCode: 502, statusMessage: error.message })
  return error
}

const idParams = z.object({ id: z.coerce.number().int().positive() })

/** Lê o :id da rota (400 se inválido). */
export async function readIdParam(event: H3Event): Promise<number> {
  return (await getValidatedRouterParams(event, idParams.parse)).id
}
