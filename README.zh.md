# Beav for DeepSeek Harness

这是 Beav 的 DeepSeek Harness 原生连接器。它通过 Cordis Service、Harness tools、background jobs、slash commands、session events 和 Web Client contributions 暴露 Beav 工作区、项目、持久化创作任务和已验证产物，不使用 MCP。

## 安装

要求：Beav 2.7.3 或更高版本、DeepSeek Harness `0.1.0-rc.6`、Node.js 22 或更高版本。

```bash
dsh plugin --profile web add beav-deepseek-harness
```

启动该 Profile 后，进入 **Settings → Plugins → Beav**，粘贴在 Beav 中创建的 Creator Gateway Token。Harness credentials provider 将它保存在 `BEAV_CREATOR_TOKEN`；插件不会把 Token 回传浏览器、写入 Session Event 或放进 Tool Result。

Beav 未运行时，第一个需要 Beav 的操作会调用一次 `beav://open`，然后进行有界健康重试。插件只接受 loopback HTTP endpoint。

## 使用

- 直接说：“用 Beav 把发布工作区里最近的资料做成文章、封面和 60 秒视频。”
- 输入 `@beav` 精确选择工作区或项目。
- 使用 `/beav status`、`/beav open`、`/beav workspaces`、`/beav new`、`/beav import`、`/beav save` 执行不需要模型轮次的快捷操作。
- 长任务显示为 Harness 原生 Job 和可重放的 Beav 任务卡。
- 只有 Beav 报告持久化产物回读验证成功，且连接器能逐个回读产物时，任务才会完成。

AI 编排、知识访问、图片/音频/视频生成、审批、计费、持久化和产物验证仍由 Beav 负责。插件不能自动批准付费或危险操作。

## 开源与闭源边界

这个公开仓库和 npm 包只包含可审计的薄连接器。Beav 桌面应用、创作运行时、知识引擎、媒体管线和商业服务仍为闭源私有实现，不进入本仓库或 npm tarball。

这是社区插件，不是 DeepSeek 官方产品，也不表示 DeepSeek 官方背书。

## 开发

将官方 Harness checkout 放在本仓库同级目录，并固定到兼容 commit：

```bash
git clone https://github.com/deepseek-ai/deepseek-harness.git ../deepseek-harness
git -C ../deepseek-harness checkout 47f943859bef60e4160492346772ded9b24f765a
pnpm -C ../deepseek-harness install
pnpm -C ../deepseek-harness run build:lib
pnpm install
pnpm check
```

发布 tarball 只包含预构建 `lib/`；Harness runtime 包全部是 peer dependency，用户安装时不执行 build 或 prepare。
