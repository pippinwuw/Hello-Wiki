import Link from "next/link";
import { Clock, Cpu, ListChecks, Settings } from "lucide-react";

import { PageShell } from "@/components/page-shell";
import { SectionCard } from "@/components/section-card";
import { StatCard } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { compileJobs, compileLogs, compileSteps } from "@/lib/mock-data";

export default function CompilePage() {
  return (
    <PageShell
      title="知识编译"
      eyebrow="Compile"
      description="展示文档从解析、分块、概念提取到 Wiki 生成与审核入队的编译流程。触发编译接口 `/api/v1/ingest/compile` 目前仍为 501，因此本页先展示队列与日志结构。"
      actions={
        <Button asChild variant="outline">
          <Link href="/settings">
            <Settings className="size-4" />
            规则设置
          </Link>
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard
          label="编译服务"
          value="在线"
          hint="Worker 健康聚合待接入"
          tone="green"
          icon={<Cpu className="size-4" />}
        />
        <StatCard
          label="队列长度"
          value="3"
          hint="1 个进行中，2 个等待/异常"
          tone="amber"
          icon={<ListChecks className="size-4" />}
        />
        <StatCard label="今日编译" value="27" hint="较昨日 +8" tone="blue" />
        <StatCard
          label="平均耗时"
          value="4m 18s"
          hint="近 24 小时"
          tone="zinc"
          icon={<Clock className="size-4" />}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <SectionCard
          title="编译队列"
          description="进度后续由 Worker 状态或轮询接口驱动"
        >
          <div className="space-y-4">
            {compileJobs.map((job) => (
              <div
                key={job.id}
                className="rounded-2xl border border-zinc-200 p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium text-zinc-950">{job.name}</div>
                  <StatusBadge
                    status={job.status}
                    label={
                      job.status === "running"
                        ? "编译中"
                        : job.status === "waiting"
                          ? "等待"
                          : "失败"
                    }
                  />
                </div>
                <div className="mt-3 h-2 rounded-full bg-zinc-100">
                  <div
                    className="h-2 rounded-full bg-blue-600"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-zinc-500">
                  进度 {job.progress}%
                </p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="实时编译日志"
          description="终端风格流水，后续接 WebSocket 或分页日志"
        >
          <div className="min-h-[320px] rounded-2xl bg-zinc-950 p-4 font-mono text-xs leading-6 text-zinc-100">
            {compileLogs.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </SectionCard>
      </div>

      <SectionCard title="7 步编译流水线">
        <div className="grid gap-3 md:grid-cols-7">
          {compileSteps.map((step, index) => (
            <div
              key={step}
              className="rounded-2xl bg-white p-4 ring-1 ring-zinc-200"
            >
              <div className="flex size-8 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
                {index + 1}
              </div>
              <div className="mt-3 text-sm font-medium text-zinc-950">
                {step}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </PageShell>
  );
}
