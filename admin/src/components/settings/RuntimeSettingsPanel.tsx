import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity } from "lucide-react";
import { toast } from "sonner";
import { api, type AdminModelSettings } from "@/api/client";
import {
  LabeledControl,
  SettingsLoading,
  SettingsPanel,
  SettingsStatusBar,
  SettingsTabShell,
} from "@/components/settings/SettingsPanel";
import { Switch } from "@/components/ui/switch";

const NUMBER_FIELDS = [
  "seedance_duration_min", "seedance_duration_max", "ark_video_poll_interval", "ark_video_poll_timeout",
  "pipeline_image_concurrency", "pipeline_video_concurrency", "pipeline_audio_concurrency",
  "task_runtime_max_concurrency", "task_user_max_concurrency", "task_poll_max_concurrency",
  "drama_user_video_job_limit", "drama_fragment_max_attempts",
] as const;
type NumberField = (typeof NUMBER_FIELDS)[number];

// 运行การกำหนดค่าพารามิเตอร์（并发、质量、Mock 等 flat 字段）
export function RuntimeSettingsPanel() {
  const [form, setForm] = useState<AdminModelSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [numberDrafts, setNumberDrafts] = useState<Partial<Record<NumberField, string>>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<AdminModelSettings>("/api/admin/settings/models");
      setForm(data);
      setNumberDrafts({});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const statusItems = useMemo(
    () =>
      (form?.readiness ?? []).map((item) => ({
        id: item.capability,
        label: item.label,
        ready: item.ready,
        readyText: item.model || "就绪",
        pendingText: "未就绪",
      })),
    [form?.readiness],
  );

  function patchField<K extends keyof AdminModelSettings>(key: K, value: AdminModelSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  const errors: Partial<Record<NumberField | "ark_image_size" | "ark_video_resolution" | "ark_video_ratio", string>> = {};
  if (form) {
    NUMBER_FIELDS.forEach((key) => {
      const raw = numberDrafts[key] ?? String(form[key]);
      const value = Number(raw);
      const seconds = key === "ark_video_poll_interval" || key === "ark_video_poll_timeout";
      if (!raw.trim() || !Number.isFinite(value) || value <= 0) errors[key] = seconds ? "请输入大于 0 的วินาที数" : "请输入不小于 1 的整数";
      else if (!seconds && !Number.isInteger(value)) errors[key] = "请输入整数";
    });
    if (!errors.seedance_duration_min && !errors.seedance_duration_max && form.seedance_duration_min > form.seedance_duration_max) {
      errors.seedance_duration_max = "最大ความยาว不能小于最小ความยาว";
    }
    if (!errors.ark_video_poll_interval && !errors.ark_video_poll_timeout && form.ark_video_poll_timeout <= form.ark_video_poll_interval) {
      errors.ark_video_poll_timeout = "超时应大于轮询间隔";
    }
    (["ark_image_size", "ark_video_resolution", "ark_video_ratio"] as const).forEach((key) => {
      if (!form[key].trim()) errors[key] = "请填写ค่าเริ่มต้น值";
    });
  }
  const hasErrors = Object.keys(errors).length > 0;

  function numberField(key: NumberField, label: string, hint: string, unit: string) {
    if (!form) return null;
    const seconds = key === "ark_video_poll_interval" || key === "ark_video_poll_timeout";
    return (
      <LabeledControl label={label} hint={hint} error={errors[key]} required>
        <div className="relative">
          <input
            className="settings-input !pr-12"
            type="number" required min={seconds ? 0 : 1} step={seconds ? "any" : 1}
            aria-invalid={Boolean(errors[key])}
            value={numberDrafts[key] ?? form[key]}
            onChange={(event) => {
              const raw = event.target.value;
              setNumberDrafts((prev) => ({ ...prev, [key]: raw }));
              if (raw.trim() && Number.isFinite(Number(raw))) patchField(key, Number(raw));
            }}
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--admin-muted)]">{unit}</span>
        </div>
      </LabeledControl>
    );
  }

  async function handleSave() {
    if (!form || saving || hasErrors) return;
    setSaving(true);
    try {
      const body = {
        ark_image_size: form.ark_image_size,
        ark_video_resolution: form.ark_video_resolution,
        ark_video_ratio: form.ark_video_ratio,
        seedance_duration_min: form.seedance_duration_min,
        seedance_duration_max: form.seedance_duration_max,
        ark_video_poll_interval: form.ark_video_poll_interval,
        ark_video_poll_timeout: form.ark_video_poll_timeout,
        pipeline_image_concurrency: form.pipeline_image_concurrency,
        pipeline_video_concurrency: form.pipeline_video_concurrency,
        pipeline_audio_concurrency: form.pipeline_audio_concurrency,
        task_runtime_max_concurrency: form.task_runtime_max_concurrency,
        task_user_max_concurrency: form.task_user_max_concurrency,
        task_poll_max_concurrency: form.task_poll_max_concurrency,
        drama_user_video_job_limit: form.drama_user_video_job_limit,
        drama_fragment_max_attempts: form.drama_fragment_max_attempts,
        ark_mock: form.ark_mock,
      };
      await api("/api/admin/settings/models", { method: "PATCH", body: JSON.stringify(body) });
      await load();
      toast.success("运行参数已บันทึก");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !form) {
    return <SettingsLoading />;
  }

  return (
    <SettingsTabShell onSave={handleSave} saving={saving} disabled={hasErrors} saveLabel="บันทึก运行ตั้งค่า">
      <SettingsStatusBar
        title="路由就绪สถานะ"
        items={
          statusItems.length > 0
            ? statusItems
            : [{ id: "empty", label: "能力路由", ready: false, pendingText: "请先在「模型」填写 Key 并เลือก模型" }]
        }
        extra={
          <span className="settings-status-extra">
            {form.readiness?.length && form.readiness.every((item) => item.ready) ? "四类能力已就绪" : "请在「模型」填写 TokenFree Key 并เลือก模型"}
          </span>
        }
      />

      <SettingsPanel title="生成ค่าเริ่มต้น值" description="ตั้งค่า新生成任务的ค่าเริ่มต้น画质、画幅和ความยาว；具体支持范围仍由所选模型决定。">
        <div className="settings-field-grid settings-field-grid--3">
          <LabeledControl label="生图尺寸" hint="沿用上游支持的尺寸，例如 2K 或 1024x1024。" error={errors.ark_image_size} required>
            <input className="settings-input" required placeholder="例如 2K" aria-invalid={Boolean(errors.ark_image_size)} value={form.ark_image_size} onChange={(e) => patchField("ark_image_size", e.target.value)} />
          </LabeledControl>
          <LabeledControl label="วิดีโอความคมชัด" hint="例如 480p、720p；以当前模型支持值为准。" error={errors.ark_video_resolution} required>
            <input className="settings-input" required placeholder="例如 720p" aria-invalid={Boolean(errors.ark_video_resolution)} value={form.ark_video_resolution} onChange={(e) => patchField("ark_video_resolution", e.target.value)} />
          </LabeledControl>
          <LabeledControl label="วิดีโอ画幅" hint="宽:高，例如 16:9 或 9:16。" error={errors.ark_video_ratio} required>
            <input className="settings-input" required placeholder="例如 16:9" aria-invalid={Boolean(errors.ark_video_ratio)} value={form.ark_video_ratio} onChange={(e) => patchField("ark_video_ratio", e.target.value)} />
          </LabeledControl>
        </div>
        <div className="settings-field-grid settings-field-grid--2 mt-5">
          {numberField("seedance_duration_min", "Seedance 最小ความยาว", "不小于 1 วินาที，与最大ความยาว一起限制单段生成ความยาว。", "วินาที")}
          {numberField("seedance_duration_max", "Seedance 最大ความยาว", "不小于最小ความยาว；最终仍受模型ความยาว范围限制。", "วินาที")}
        </div>
      </SettingsPanel>

      <SettingsPanel title="任务并发" description="控制同时执行的任务数量，以及单个用户可占用的资源。">
        <div className="settings-field-grid settings-field-grid--3">
          {numberField("task_runtime_max_concurrency", "全站执行槽位", "全站可同时运行的 Worker 任务数，不小于 1。", "个")}
          {numberField("task_user_max_concurrency", "单用户执行槽位", "单个用户可占用的任务数，仍受全站槽位约束。", "个")}
          {numberField("drama_user_video_job_limit", "单用户ละครซีรีส์วิดีโอ在途上限", "限制排队与กำลังประมวลผล的วิดีโอ任务总数，不小于 1。", "个")}
        </div>
        <div className="settings-runtime-note mt-5">
          <Activity className="h-4 w-4 shrink-0 text-[var(--admin-forest)]" />
          <span>当前ฉบับร่าง：全站 <strong>{form.task_runtime_max_concurrency}</strong> 个执行槽位，单用户最多 <strong>{form.task_user_max_concurrency}</strong> 个；等待上游轮询的任务不占 Worker 槽位。</span>
        </div>
      </SettingsPanel>

      <details className="settings-advanced">
        <summary><span>高级运行参数</span><span>管线分配、轮询与模拟模式</span></summary>
        <SettingsPanel title="生成管线" description="分别控制各类媒体任务的并行处理数；均为不小于 1 的整数。">
          <div className="settings-field-grid settings-field-grid--3">
            {numberField("pipeline_image_concurrency", "生图并发", "同时处理的图像任务数。", "路")}
            {numberField("pipeline_video_concurrency", "วิดีโอ并发", "同时处理的วิดีโอ任务数。", "路")}
            {numberField("pipeline_audio_concurrency", "เสียงพากย์并发", "同时处理的เสียงพากย์任务数。", "路")}
          </div>
        </SettingsPanel>
        <SettingsPanel title="上游轮询与ลองใหม่" description="在查询频率和等待ความยาว之间取得平衡；超时应大于查询间隔。">
          <div className="settings-field-grid settings-field-grid--2">
            {numberField("ark_video_poll_interval", "วิดีโอ轮询间隔", "大于 0 วินาที；间隔越短，上游查询频率越高。", "วินาที")}
            {numberField("ark_video_poll_timeout", "วิดีโอ轮询超时", "大于轮询间隔；超过此ความยาว后结束等待。", "วินาที")}
            {numberField("task_poll_max_concurrency", "每轮上游查询并发", "Selector 每轮非阻塞查询的最大路数，不小于 1。", "路")}
            {numberField("drama_fragment_max_attempts", "分镜วิดีโอ最大尝试次数", "包含首次生成与ล้มเหลว后的ลองใหม่，不小于 1。", "次")}
          </div>
        </SettingsPanel>
        <SettingsPanel title="开发与调试" description="切换生成请求的运行方式。">
          <div className="settings-toggle-row">
            <div><strong>ARK Mock 模式</strong><span>使用模拟结果调试 ARK 接口，开启后不调用对应真实上游。</span></div>
            <Switch aria-label="ARK Mock 模式" checked={form.ark_mock} onCheckedChange={(v) => patchField("ark_mock", v)} />
          </div>
        </SettingsPanel>
      </details>
    </SettingsTabShell>
  );
}
