export class BlockedError extends Error {
  constructor(message = 'Bloqueado pela loja') {
    super(message)
    this.name = 'BlockedError'
  }
}

export class ShortLinkError extends Error {
  constructor(message = 'Abra o link no navegador e cole a URL completa do produto') {
    super(message)
    this.name = 'ShortLinkError'
  }
}

export class UnsupportedStoreError extends Error {
  constructor(message = 'Loja não suportada') {
    super(message)
    this.name = 'UnsupportedStoreError'
  }
}

export class InvalidProductUrlError extends Error {
  constructor(message = 'Esse link não é de uma página de produto') {
    super(message)
    this.name = 'InvalidProductUrlError'
  }
}
