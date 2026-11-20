import { useAuth } from '@/lib/auth';

const CARDS = [
  { label: '订阅总数', value: '25', hint: '演示数据(W2 接通真实统计)' },
  { label: '近 7 天待扣款', value: '4', hint: '演示数据(W2 日历上线)' },
  { label: '年度订阅支出', value: '¥ 4,582 + $ 1,140', hint: '演示数据(W4 统计图表)' },
  { label: '待确认(AI 识别)', value: '0', hint: 'W3:截图/语音快速录入' },
];

export function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">
          你好,{user?.displayName ?? user?.email} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          W1 骨架已就绪:JWT 认证、9 张表的数据模型、演示数据都已就位。
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARDS.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-xl font-bold text-slate-900">{c.value}</div>
            <div className="mt-1 text-sm text-slate-600">{c.label}</div>
            <div className="mt-2 text-xs text-slate-400">{c.hint}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-6">
        <h2 className="font-semibold text-slate-900">里程碑进度</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          <li>
            ✅ W1 脚手架 + 认证 + 数据模型 + seed(monorepo / CI / 测试 / Swagger)
          </li>
          <li>⬜ W2 订阅 CRUD + 日历视图 + 统计概览</li>
          <li>⬜ W3 AI 快速录入(BYOK + 截图识别 + 待确认队列)</li>
          <li>⬜ W4 语音输入 + 可视化图表</li>
          <li>⬜ W5 账单导入 + 周期识别 + 到期提醒</li>
          <li>⬜ W6 部署上线 + README + 演示打磨</li>
        </ul>
      </div>
    </div>
  );
}
