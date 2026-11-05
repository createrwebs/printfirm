---
name: script-rewriter
description: Methodology and rules for rewriting a novel into a formatted script
tasks:
  - script_rewrite
---
## PRINTFILM runtime contract

This skill is injected into PRINTFILM's Python episode authoring functions. Adapt the reference rules to this backend:

- Return only the JSON object requested by the caller, normally `{"episodes":[...]}`. Do not call tools, do not write a prose explanation, and do not emit Huobao `save_script` instructions.
- Episode body generation must preserve the existing fields `episodeNumber`, `title`, `summary`, `creative`, and `body`; the normalized body is later saved by the job worker.
- Keep the current shooting-script markers required by PRINTFILM (`### ฉากX-Y`, `ตัวละครที่ออกฉาก`, time/location line, `△`, dialogue lines and `@duration/@asset` when requested). Thai source content must remain Thai, including titles, actions, narration and dialogue.
- The caller validates length, language and episode numbers. Never satisfy a length requirement by adding a second summary or unrelated scene.


# Script Rewriting Guide

## Rewriting Principles

1. **Preserve the core plot**: do not change the main storyline or character relationships
2. **Strengthen visual quality**: turn narrative prose into visualizable scene descriptions
3. **Dialogue-driven**: use dialogue to advance the plot and reduce narration
4. **Pacing control**: keep each scene at 30-60 seconds, suitable for short video
5. **No camera language**: no shot sizes, angles, or camera moves — those belong to the storyboard-breakdown step

## Formatted-Script Format

```
## S01 | INT · Coffee Shop | Dusk

Dusk light pours through the floor-to-ceiling windows into the coffee shop; steam rises from coffee cups on the counter.

Xiaoming sits alone in a corner booth, head down over his phone, looking somewhat anxious.

The doorbell chimes as Xiaohong pushes the door open. She sees Xiaoming and walks over with a smile.

Xiaohong: (smiling) Have you been waiting long?
Xiaoming: (looking up) Not really, just got here.
```

### Format Rules

- `## S<number> | INT/EXT · Location | Time period` — scene heading
- Action description in natural paragraphs — no camera language of any kind
- `CharacterName: (state/expression) line content` — dialogue format

### Content-Volume Reference

The formatted script is about 20-30% longer than the original content; the increase mainly comes from scene-heading markers and dialogue formatting, not from expansion writing.

## PRINTFILM execution

The caller supplies the episode context and draft. Return the requested JSON object; the job worker validates and persists the normalized episode fields.

## Notes

- Inner monologue can be converted into character expressions/actions or voiceover
- Split long narrative passages into multiple short scenes
- Make sure every scene has a clear emotional turning point
- Keep each character's language style consistent
- Scene numbers increase consecutively (S01, S02, S03...)
- Time periods must be specific (dusk, late night, early morning) — do not write a vague "daytime"




