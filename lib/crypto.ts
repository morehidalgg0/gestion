import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('CRITICAL: ENCRYPTION_KEY environment variable is required in production.');
    }
    // Safe fallback 32-byte key for local development
    return Buffer.from('8f2a6b29d10e53a7bc21f8a7e0a2d591b84cd12a3ef56e9c9b19e28f30ad1890', 'hex');
  }
  
  // Check if hexKey is 64 hex characters (which equals 32 bytes)
  if (hexKey.length !== 64) {
    throw new Error('CRITICAL: ENCRYPTION_KEY must be a 64-character hex string (32 bytes).');
  }
  
  return Buffer.from(hexKey, 'hex');
}

/**
 * Encrypts a string using AES-256-GCM.
 * Returns the combined tag and ciphertext, and the IV as a hex string.
 */
export function encrypt(text: string): { encrypted: string; iv: string } {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const tag = cipher.getAuthTag().toString('hex');
  
  return {
    encrypted: `${tag}:${encrypted}`,
    iv: iv.toString('hex'),
  };
}

/**
 * Decrypts a ciphertext using AES-256-GCM with the corresponding IV.
 */
export function decrypt(encryptedWithTag: string, ivHex: string): string {
  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    
    const parts = encryptedWithTag.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid cipher format. Expected tag:ciphertext.');
    }
    
    const [tagHex, encryptedHex] = parts;
    const tag = Buffer.from(tagHex, 'hex');
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error: any) {
    throw new Error(`Failed to decrypt AFIP keys: ${error.message}`);
  }
}
