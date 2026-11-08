/** 按การตั้งค่าบทบาทตัวละคร AI 生成น้ำเสียง并绑定到 voiceAudio（无弹窗，供卡片一键生成） */
import { dramaApi, type DramaAsset } from '../api/drama'
import { buildBoundParams } from '../pages/drama/CharacterVoiceBindModal'
import { ensureCharacterVoiceGenerationEnabled } from '../api/publicCapabilities'

export type CharacterVoiceGenerateResult = {
  character: DramaAsset
  voice: DramaAsset
}

// 根据แอสเซทตัวละคร生成น้ำเสียง描述、合成试听并写回绑定
export async function generateAndBindCharacterVoice(
  projectId: number,
  asset: DramaAsset,
): Promise<CharacterVoiceGenerateResult> {
  await ensureCharacterVoiceGenerationEnabled()
  const promptResult = await dramaApi.suggestVoicePrompt({
    project_id: projectId,
    asset_id: asset.id,
  })
  const voicePrompt = (promptResult.voice_prompt || '').trim()
  if (!voicePrompt) {
    throw new Error('คำอธิบายน้ำเสียงว่างเปล่า')
  }

  const voiceResult = await dramaApi.generateVoice({
    project_id: projectId,
    name: `${asset.name || 'ตัวละคร'}น้ำเสียง`,
    voice_prompt: voicePrompt,
    speaker: promptResult.speaker || undefined,
    sample_text: promptResult.sample_text || undefined,
    character_asset_id: asset.id,
  })
  const voice = voiceResult.asset
  if (!voice?.url) {
    throw new Error('สังเคราะห์น้ำเสียงล้มเหลว')
  }

  const character = await dramaApi.updateAsset(asset.id, {
    params: buildBoundParams(asset, voice),
  })
  return { character, voice }
}
