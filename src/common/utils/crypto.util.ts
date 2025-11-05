import crypto from 'crypto'

// AES-256-GCM helpers for encrypting/decrypting sensitive strings (e.g., WB API tokens)
// TOKEN_ENCRYPTION_KEY must be a 32-byte key in base64 (set in .env)
// Example to generate: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

const ALGO = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM recommended 12 bytes

function getKey(): Buffer {
  const b64 = process.env.TOKEN_ENCRYPTION_KEY
  if (!b64) throw new Error('TOKEN_ENCRYPTION_KEY is not set')
  const key = Buffer.from(b64, 'base64')
  if (key.length !== 32) throw new Error('TOKEN_ENCRYPTION_KEY must be 32 bytes (base64 of 32 raw bytes)')
  return key
}

export function isKeyConfigured(): boolean {
  try {
    getKey()
    return true
  } catch {
    return false
  }
}

export type EncryptedPayload = {
  iv: string // base64
  tag: string // base64 auth tag
  cipher: string // base64 ciphertext
}

// Encrypts a UTF-8 string and returns a base64-encoded JSON payload
export function encrypt(plainText: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const enc = Buffer.concat([cipher.update(Buffer.from(plainText, 'utf8')), cipher.final()])
  const tag = cipher.getAuthTag()

  const payload: EncryptedPayload = {
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    cipher: enc.toString('base64'),
  }
  const json = JSON.stringify(payload)
  return Buffer.from(json, 'utf8').toString('base64')
}

// Decrypts a payload produced by encrypt()
export function decrypt(payloadB64: string): string {
  const key = getKey()
  let payload: EncryptedPayload
  try {
    const json = Buffer.from(payloadB64, 'base64').toString('utf8')
    payload = JSON.parse(json)
  } catch (e) {
    throw new Error('Invalid encrypted payload format')
  }

  const iv = Buffer.from(payload.iv, 'base64')
  const tag = Buffer.from(payload.tag, 'base64')
  const ciphertext = Buffer.from(payload.cipher, 'base64')

  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)
  const dec = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return dec.toString('utf8')
}
