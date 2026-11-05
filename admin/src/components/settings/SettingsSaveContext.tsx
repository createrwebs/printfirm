import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type SettingsSaveAction = {
  onSave: () => void | Promise<void>;
  saving?: boolean;
  label?: string;
  disabled?: boolean;
};

type SettingsSaveContextValue = {
  action: SettingsSaveAction | null;
  registerSave: (action: SettingsSaveAction | null) => void;
};

const SettingsSaveContext = createContext<SettingsSaveContextValue | null>(null);

// ตั้งค่า页：子 Tab 注册บันทึก动作，页头เรนเดอร์统一「บันทึก」按钮
export function SettingsSaveProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<SettingsSaveAction | null>(null);
  const registerSave = useCallback((next: SettingsSaveAction | null) => {
    setAction((prev) => {
      if (!prev && !next) return prev;
      if (
        prev &&
        next &&
        prev.saving === next.saving &&
        prev.disabled === next.disabled &&
        (prev.label ?? "บันทึก") === (next.label ?? "บันทึก")
      ) {
        // 同步最新 onSave，避免闭包过期；不触发无意义重เรนเดอร์依赖
        prev.onSave = next.onSave;
        return prev;
      }
      return next;
    });
  }, []);
  const value = useMemo(() => ({ action, registerSave }), [action, registerSave]);
  return <SettingsSaveContext.Provider value={value}>{children}</SettingsSaveContext.Provider>;
}

export function useSettingsSaveSlot() {
  const ctx = useContext(SettingsSaveContext);
  if (!ctx) {
    throw new Error("useSettingsSaveSlot must be used within SettingsSaveProvider");
  }
  return ctx;
}

// Tab 挂载时注册บันทึก；卸载时ล้างข้อมูล
export function useRegisterSettingsSave(action: SettingsSaveAction | null) {
  const { registerSave } = useSettingsSaveSlot();
  useEffect(() => {
    registerSave(action);
    return () => registerSave(null);
  }, [action, registerSave]);
}
