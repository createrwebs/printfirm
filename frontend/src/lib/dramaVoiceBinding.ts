/** การผูกเสียงตัวละคร (ปิดเป็นค่าเริ่มต้น เพราะโมเดลวิดีโอสร้างเสียงพูดภาษาไทยได้เองโดยตรง; เปิดได้ผ่าน localStorage drama_voice_binding_enabled=true) */
export const DRAMA_VOICE_BINDING_ENABLED =
  typeof window !== 'undefined' &&
  window.localStorage?.getItem('drama_voice_binding_enabled') === 'true'

