/** โปรเจกต์全局成片ตั้งค่า读取：โปรเจกต์ params 优先，再回退分集历史值 */
import {
  readEpisodeCharacterIntroMode,
  type DramaCharacterIntroMode,
} from './dramaCharacterIntro'
import { readEpisodeSubtitleMode, type DramaSubtitleMode } from './dramaSubtitleSettings'

/** 有效คำบรรยาย (ซับไตเติล)方式：โปรเจกต์全局优先，再回退分集历史值 */
export function readEffectiveSubtitleMode(
  episodeParams?: Record<string, unknown> | null,
  projectParams?: Record<string, unknown> | null,
): DramaSubtitleMode {
  const fromProject = projectParams?.subtitleMode
  if (fromProject === 'model' || fromProject === 'post') return fromProject
  return readEpisodeSubtitleMode(episodeParams)
}

/** 有效人物介绍：โปรเจกต์全局优先，再回退分集历史值 */
export function readEffectiveCharacterIntroMode(
  episodeParams?: Record<string, unknown> | null,
  projectParams?: Record<string, unknown> | null,
): DramaCharacterIntroMode {
  const fromProject = projectParams?.characterIntroMode
  if (fromProject === 'model' || fromProject === 'off') return fromProject
  return readEpisodeCharacterIntroMode(episodeParams)
}
