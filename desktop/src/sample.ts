import type { RecordItem, TypeDef, Workspace } from './types';
import { pickNote } from './types';

export const BUILTIN_TYPES: TypeDef[] = [
  { id: 'project', name: '科研项目', kind: 'project', icon: 'flask', note: '♪', builtin: true },
  { id: 'direction', name: '科研方向', kind: 'direction', icon: 'compass', note: '𝄞', builtin: true },
  { id: 'todo', name: '待办事项', kind: 'todo', icon: 'list-checks', note: '♬', builtin: true },
  { id: 'note', name: '心得笔记', kind: 'generic', icon: 'notebook', note: '𝅘𝅥', builtin: true },
  { id: 'literature', name: '文献笔记', kind: 'generic', icon: 'book-open', note: '♭', builtin: true },
  { id: 'data', name: '数据记录', kind: 'generic', icon: 'database', note: '𝅘𝅥𝅮', builtin: true },
  { id: 'file', name: '文件资料', kind: 'generic', icon: 'folder', note: '𝄢', builtin: true },
  { id: 'review', name: '复盘总结', kind: 'generic', icon: 'history', note: '𝅘𝅥𝅯', builtin: true },
  { id: 'schedule', name: '日程安排', kind: 'schedule', icon: 'calendar', note: '𝅝', builtin: true },
];

/** 老数据升级时补齐「日程安排」类型（幂等） */
export function ensureScheduleType(types: TypeDef[]): TypeDef[] {
  const def = BUILTIN_TYPES.find((b) => b.id === 'schedule');
  if (!def || types.some((t) => t.id === 'schedule')) return types;
  return [...types, { ...def }];
}

/**
 * 老数据升级：把「纵向项目」「横向项目」两个类型合并为「科研项目」（幂等）。
 * 原类型下的记录改挂 project，并用 sub 字段保留纵向 / 横向细分。
 */
export function mergeProjectTypes(
  types: TypeDef[],
  records: RecordItem[],
): { types: TypeDef[]; records: RecordItem[] } {
  const oldIds = ['vertical', 'horizontal'];
  const removedIdx = types
    .map((t, i) => (oldIds.includes(t.id) ? i : -1))
    .filter((i) => i >= 0);
  if (removedIdx.length === 0) return { types, records };

  const newRecords = records.map((r) =>
    r.typeId === 'vertical' || r.typeId === 'horizontal'
      ? { ...r, typeId: 'project', sub: r.typeId as 'vertical' | 'horizontal' }
      : r,
  );

  const rest = types.filter((t) => !oldIds.includes(t.id));
  if (rest.some((t) => t.id === 'project')) return { types: rest, records: newRecords };

  const def = BUILTIN_TYPES.find((b) => b.id === 'project')!;
  const taken = rest.map((t) => t.note);
  const projectType: TypeDef = {
    ...def,
    note: taken.includes(def.note) ? pickNote(def.id, taken) : def.note,
  };
  // 插回到原来两个类型中更靠前的位置
  const before = types.slice(0, Math.min(...removedIdx)).filter((t) => !oldIds.includes(t.id)).length;
  const newTypes = [...rest.slice(0, before), projectType, ...rest.slice(before)];
  return { types: newTypes, records: newRecords };
}

export const BUILTIN_WORKSPACES: Workspace[] = [
  { id: 'ws-default', name: '默认工作区', builtin: true },
];

const DAY = 24 * 60 * 60 * 1000;

function isoDate(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * DAY);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

let seq = 0;
function sampleRecord(partial: Partial<RecordItem> & Pick<RecordItem, 'typeId' | 'title'>): RecordItem {
  seq += 1;
  const now = Date.now() - seq * 60_000;
  return {
    id: `sample-${seq}`,
    workspaceId: 'ws-default',
    content: '',
    status: 'active',
    starred: false,
    archived: false,
    fields: [],
    priority: 'none',
    dueDate: null,
    done: false,
    planDate: null,
    planStart: null,
    planEnd: null,
    projectId: null,
    recurrence: null,
    literature: null,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export function buildSampleRecords(): RecordItem[] {
  return [
    sampleRecord({
      typeId: 'project',
      sub: 'vertical',
      title: '国家自然科学基金青年科学基金项目',
      content: '围绕「高效大模型推理」开展基础研究，三年期。\n\n本年度目标：\n1. 完成稀疏注意力原型系统\n2. 投稿 CCF-A 类会议论文 1 篇\n3. 撰写年度进展报告',
      starred: true,
      fields: [
        { id: 'f1', name: '项目编号', value: '62XXXXXX' },
        { id: 'f2', name: '直接经费', value: '30 万元' },
        { id: 'f3', name: '执行期', value: '2026.01 – 2028.12' },
        { id: 'f4', name: '当前阶段', value: '第一年 · 方案设计' },
      ],
    }),
    sampleRecord({
      typeId: 'project',
      sub: 'vertical',
      title: '省重点研发计划子课题：边缘智能推理引擎',
      status: 'planned',
      fields: [
        { id: 'f1', name: '课题经费', value: '50 万元' },
        { id: 'f2', name: '牵头单位', value: 'XX 大学' },
        { id: 'f3', name: '分工', value: '负责推理加速算法与评测' },
      ],
    }),
    sampleRecord({
      typeId: 'project',
      sub: 'horizontal',
      title: '企业合作：工业质检视觉系统开发',
      content: '甲方要求 12 月底前交付首版 Demo，验收指标：缺陷召回率 ≥ 95%。',
      starred: true,
      fields: [
        { id: 'f1', name: '合同额', value: '40 万元' },
        { id: 'f2', name: '甲方', value: 'XX 科技有限公司' },
        { id: 'f3', name: '交付节点', value: '首期 Demo 2026.12 / 终验 2027.06' },
        { id: 'f4', name: '到账情况', value: '首款 50% 已到账' },
      ],
    }),
    sampleRecord({
      typeId: 'direction',
      title: '大模型推理加速（KV Cache 压缩 / 投机解码）',
      content: '核心假设：KV Cache 的重要性具有强稀疏性，可在不损失精度的前提下压缩 4 倍以上。\n\n关键文献：H2O、SnapKV、StreamingLLM、Medusa。\n\n下一步：在 LLaMA-3-8B 上复现 SnapKV 基线。',
      priority: 'high',
      fields: [
        { id: 'f1', name: '关键词', value: 'LLM Inference, KV Cache, Speculative Decoding' },
        { id: 'f2', name: '目标会议', value: 'ICLR / MLSys' },
      ],
    }),
    sampleRecord({
      typeId: 'direction',
      title: '多模态具身智能（探索中）',
      status: 'planned',
      content: '关注 VLA 模型与仿真到真机的迁移问题，先做一次系统的文献调研再决定是否投入。',
      fields: [{ id: 'f1', name: '状态', value: '文献调研阶段' }],
    }),
    sampleRecord({
      typeId: 'todo',
      title: '回复审稿人意见并提交 rebuttal',
      priority: 'high',
      dueDate: isoDate(0),
      starred: true,
      content: '重点回应 Reviewer 2 关于实验对照组不足的质疑，补充两组消融。',
    }),
    sampleRecord({
      typeId: 'todo',
      title: '整理上周实验数据并归档到 NAS',
      priority: 'medium',
      dueDate: isoDate(1),
    }),
    sampleRecord({
      typeId: 'todo',
      title: '精读 3 篇 KV Cache 压缩论文并写读书笔记',
      priority: 'medium',
      dueDate: isoDate(3),
    }),
    sampleRecord({
      typeId: 'todo',
      title: '准备组会汇报 PPT（项目中期进展）',
      priority: 'high',
      dueDate: isoDate(5),
    }),
    sampleRecord({
      typeId: 'todo',
      title: '预约高性能计算中心 A100 机时',
      priority: 'low',
      done: true,
    }),
    sampleRecord({
      typeId: 'note',
      title: '实验心得：投机解码中小模型大小的权衡',
      content: 'Draft 模型并非越小越好：过小导致接受率骤降，过大则单步成本上升。\n\n在 8B 目标模型上，0.5B draft 的端到端加速比最优（约 1.8×）。\n\n教训：跑全量评测前先用 100 条样本扫一遍接受率，能省大量机时。',
      starred: false,
    }),
    sampleRecord({
      typeId: 'note',
      title: '写作心得：Introduction 的「倒三角」结构',
      content: '先大背景（为什么重要）→ 现有方法的缺口 → 本文的核心 idea 一句话 → 贡献列表。\n\n写完每一段自问：这一段是否在回答「so what」。',
    }),
    sampleRecord({
      typeId: 'data',
      title: 'LLaMA-3-8B 长文本吞吐基准（2026-08 批次）',
      fields: [
        { id: 'f1', name: '数据集', value: 'LongBench v2' },
        { id: 'f2', name: '硬件', value: 'A100 80G × 2' },
        { id: 'f3', name: '存储位置', value: 'NAS:/benchmarks/2026-08/' },
        { id: 'f4', name: '结论速览', value: '压缩 4× 时吞吐提升 2.1×，精度损失 < 0.5pt' },
      ],
    }),
    sampleRecord({
      typeId: 'file',
      title: '基金申请书相关模板与往年范文',
      fields: [
        { id: 'f1', name: '位置', value: 'OneDrive:/基金申请/' },
        { id: 'f2', name: '包含', value: '申请书模板、技术路线图 PPT、预算编制说明' },
      ],
    }),
    sampleRecord({
      typeId: 'schedule',
      title: '组会：项目中期进展汇报',
      planDate: isoDate(0),
      planStart: '14:00',
      planEnd: '15:30',
      content: '汇报稀疏注意力原型进展，准备 10 页 PPT。',
    }),
    sampleRecord({
      typeId: 'schedule',
      title: '与导师讨论 SnapKV 复现方案',
      planDate: isoDate(1),
      planStart: '10:00',
      planEnd: '11:00',
    }),
    sampleRecord({
      typeId: 'schedule',
      title: '学术讲座：AI Systems Frontiers（全天）',
      planDate: isoDate(2),
    }),
    sampleRecord({
      typeId: 'schedule',
      title: 'Rebuttal 最终检查并提交',
      planDate: isoDate(4),
      planStart: '20:00',
    }),
    sampleRecord({
      typeId: 'review',
      title: '2026 上半年复盘',
      status: 'done',
      content: '做得好的：论文投稿按计划完成；横向项目首款顺利到账。\n\n不足：实验记录不够及时，有两次结果无法复现；文献阅读断断续续。\n\n下半年改进：\n1. 实验当天必须写入数据记录\n2. 每周五固定 2 小时文献时间\n3. 每月底做一次小复盘',
    }),
  ];
}
