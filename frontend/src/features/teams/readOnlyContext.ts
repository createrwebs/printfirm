import { createContext, useContext } from 'react'

/** ดู和แก้ไข复用同一页面；只读สถานะ仅限制写การดำเนินการ。 */
export const TeamReadOnlyContext = createContext(false)
export function useTeamReadOnly(): boolean { return useContext(TeamReadOnlyContext) }
