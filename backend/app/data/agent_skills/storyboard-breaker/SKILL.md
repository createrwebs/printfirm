---
name: storyboard-breaker
description: Professional rules for storyboard breakdown — splitting a script into storyboard segments that each carry multiple sub-shots
tasks:
  - shot_plan
---
## PRINTFILM runtime contract

This skill is injected into `plan_fragments_with_llm`, not a tool-calling Huobao agent:

- Return only JSON with this exact shape:
  `{"fragments":[{"duration_sec":10,"scene_name":"...","character_names":["..."],"prop_names":["..."],"is_opening":false,"lines":["..."]}]}`
- `scene_name`, `character_names`, and `prop_names` must use exact names from the asset catalog provided in the user message.
- `lines` is a list of strings (2-5 lines per fragment):
  - Pure visual shot lines describe: shot size + camera movement + subject action/expression + spatial staging + lighting/atmosphere -> end state.
  - Dialogue lines use `"CharacterName: dialogue"` (preserving the episode's spoken dialogue verbatim) and narration uses `"เสียงบรรยาย: ..."` / `"旁白（VO）：..."`.
- Respect the current episode's scene boundaries, dialogue duration floor, and language directive. For Thai content, write all visual descriptions, narration, and dialogue 100% in Thai (never output Chinese labels like `【镜头1】` on Thai scripts).
- The worker performs normalization, `@asset` / `@duration` binding, persistence, and batching after the JSON response. Do not return extra commentary.


# Storyboard Breakdown Guide

## Core Definition: Storyboard Segment

One storyboard = one **storyboard segment** = one video-generation task.

- Each segment is **8-15 seconds** long and internally carries **2-4 sub-shots**
- Cuts between sub-shots **are allowed**: change shot size, angle, or subject, joined with hard cuts
- Sub-shots **never cross scenes**: a segment takes place in a single scene (`scene_id` is a segment-level binding)
- Each sub-shot is 2-6 seconds, focused on one visual unit (one action, one reaction, one close-up)

## PRINTFILM execution

The caller supplies the script and asset catalog. Return the fragment JSON contract above; normalization, binding, persistence and batching are handled by plan_fragments_with_llm and its worker.

## Pacing-Tier Durations

Determine duration by the segment's function — do not use one size for all:

| Segment type | Duration | Notes |
|---|---|---|
| Transition segment | 8-10 s | Traveling, empty shots, environment establishment, transitions |
| Narrative segment | 10-15 s | Regular plot advancement, dialogue |
| Payoff segment | 12-15 s | Close-ups, rule reveals, emotional eruptions, reversals; slower sub-shot pacing, a single sub-shot may hold for 4-6 s |

## Dialogue Duration Floor (Hard Rule)

**Segment duration ≥ total character count of dialogue and narration within the segment (the part written in description) ÷ 4.5 characters/second + 2 seconds of performance headroom**

Dialogue that does not fit must be moved to the next segment; cramming unperformable dialogue into one segment is not allowed.

## Shot Elements

1. **Shot title**: a 3-5-character summary of the segment's core content (e.g. "Nightmare Awakening")
2. **Time**: specific time of day + lighting description
3. **Location**: full scene description + spatial layout + environmental details
4. **Shot size**: the dominant shot size of the segment; for multi-size segments write a combination, e.g. "medium shot + close-up"
5. **Angle**: eye-level / low angle / high angle / side / back
6. **Camera move**: static / push-in / pull-back / pan / tracking / dolly (different sub-shots within a segment may differ)
7. **Visual description** `description`: describe sub-shot by sub-shot as `【镜头1】…【镜头2】…` what the audience actually sees and hears — the visuals (who + specific action + body-language details + expression) come first; when a sub-shot has dialogue, write it inside the corresponding `【镜头N】` as "CharacterName says: "line"", and narration as "Narration: content"
8. **Visual result** `result`: the immediate consequence at the end of the segment + visual details
9. **Atmosphere** `atmosphere`: lighting + color tone + sound + overall mood
10. **Duration** `duration`: total segment duration 8-15 seconds, and it must satisfy the dialogue duration floor
11. **Scene binding**: if it can be matched to an existing scene, `scene_id` must be filled in
12. **Character binding**: fill in `character_ids`, binding 0 to multiple characters involved in this segment
13. **Prop binding**: fill in `prop_ids`, binding 0 to multiple key props appearing in this segment

## Scene Binding Rules

- Prefer the `scenes` returned by `the supplied asset catalog`
- When `location + time` can be clearly matched, the correct `scene_id` must be filled in
- Do not fabricate scene IDs that do not exist
- If the script content clearly falls within an existing scene, do not create a duplicate new scene description

## Character Binding Rules

- `character_ids` must be chosen from the character list returned by `the supplied asset catalog`
- A segment may have no characters, or may bind multiple characters
- Any character with a clear appearance in the segment — seen, acting, or speaking — should be bound
- Pure-environment segments, empty shots, and object close-ups may pass an empty array

## Prop Binding Rules

- `prop_ids` must be chosen from the prop list (`props`) returned by `the supplied asset catalog`
- When a prop is used by a character, handed over, shown in close-up, or clearly visible in frame and meaningful to the narrative, it must be bound to that segment
- Prop close-up segments (without characters) should also bind the prop; `character_ids` may be empty
- Do not bind background items or set dressing irrelevant to the plot; segments with no props pass an empty array
- Bound props serve as reference images for video generation (white-background product shots), keeping the prop's appearance consistent across segments

## Quality Requirements

- `description` should be human-readable, describing sub-shot by sub-shot what the audience actually sees and hears; dialogue/narration is written directly inside the corresponding `【镜头N】`
- `image_prompt` should highlight the single-frame composition, character appearance, environment, and lighting (corresponding to the segment's first sub-shot)
- `bgm_prompt` and `sound_effect` may be concise phrases, but must not be as vague as just "tense" or "sad"
- To make adjustments, return the corrected fragment JSON to the caller





