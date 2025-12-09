import { TimeMachinePlayer } from "@/components/time-machine/TimeMachinePlayer";
import { buildTimeMachineTimeline } from "@/lib/time_machine_loader";

export const metadata = {
  title: "交易時光機",
};

export default async function TimeMachinePage() {
  const dataset = await buildTimeMachineTimeline({ timeframe: "1d" });

  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 space-y-2">
        <h1 className="text-2xl font-bold text-slate-900">交易時光機</h1>
        <p className="text-slate-600">
          將 K 線、成交、資金曲線合併到統一時間軸，支援播放/跳轉與未來 K 線顯示開關。
        </p>
      </div>

      <TimeMachinePlayer dataset={dataset} />
    </main>
  );
}
