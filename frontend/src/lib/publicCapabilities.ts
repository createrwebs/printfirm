export type PublicCapabilities = { drama_voice_generation_enabled: boolean }

export const VOICE_GENERATION_DISABLED_MESSAGE = 'การสร้างเสียงพูดถูกปิดใช้งานชั่วคราว สามารถเลือกเสียงที่มีอยู่หรืออัปโหลดไฟล์เสียงได้'

export function characterVoiceGenerationEnabled(value: unknown): boolean {
  return value !== null && typeof value === 'object' &&
    'drama_voice_generation_enabled' in value && value.drama_voice_generation_enabled === true
}

/** Failed or older capability responses must never enable a paid generation call. */
export async function requireCharacterVoiceGeneration(load: () => Promise<unknown>): Promise<void> {
  const capabilities = await load().catch(() => null)
  if (!characterVoiceGenerationEnabled(capabilities)) throw new Error(VOICE_GENERATION_DISABLED_MESSAGE)
}
