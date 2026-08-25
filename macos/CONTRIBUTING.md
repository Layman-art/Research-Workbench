# 参与贡献

感谢你愿意改进 Research Workbench。

## 提交问题

- Bug 请说明操作系统、应用版本、复现步骤、预期行为与实际行为。
- 功能建议请先描述具体科研工作流和当前痛点，避免只给出实现方案。
- 请勿在公开 Issue 中上传真实课题数据、未公开论文内容、密钥或其他敏感信息。

## 本地开发

环境要求：Node.js 20.19+，或 Node.js 22.12+。

```bash
npm ci
npm run dev:electron
```

提交 Pull Request 前请运行：

```bash
npm run lint
npm test
npm run test:e2e
npm run build
```

## 修改原则

- 每个 Pull Request 聚焦一个问题。
- 保持本地优先，不在没有明确说明和用户同意时上传业务数据。
- 新功能需要补充相应测试和 README 说明。
- 界面修改请附修改前后的截图。
