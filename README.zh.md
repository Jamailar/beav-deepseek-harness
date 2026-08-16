# Beav Creator

Beav Creator 把小红书（RED/RedNote）、社交媒体运营和自媒体 AI 创作能力带入 DeepSeek Harness。可用于小红书选题与趋势研究、知识库管理、文案创作、封面与配图、音频、短视频，以及可恢复的多步骤内容生产。它通过 Cordis Service、Harness tools、background jobs、slash commands、session events 和 Web Client contributions 暴露 Beav 工作区、项目、任务、审批和经过验证的产物，不使用 MCP。

## 安装

要求：Beav 2.7.4 或更高版本、DeepSeek Harness `0.1.0-rc.6`、Node.js 22 或更高版本。

```bash
dsh plugin --profile web add beav-creator-dsh
```

启动该 Profile 后，进入 **Settings → Plugins → Beav Creator** 并点击 **Connect Beav**。插件会打开 `beav://connect/authorize`；Beav 未运行时会自动启动，并在 APP 内显示申请的权限。用户点击允许后，插件通过五分钟有效、只能交换一次的 PKCE 配对自动取得凭据，并由 Harness credentials provider 保存到 `BEAV_CREATOR_TOKEN`。Token 不经过剪贴板、URL、浏览器 Client、聊天、Session Event 或 Tool Result。

Beav 未运行时，第一个需要 Beav 的操作会调用一次 `beav://open`，然后进行有界健康重试。插件只接受 loopback HTTP endpoint。

## 使用

- 直接说：“用 Beav 研究一个小红书选题，把发布工作区里最近的资料做成笔记、封面和 60 秒视频。”
- 输入 `@beav` 精确选择工作区或项目。
- 使用 `/beav connect`、`/beav status`、`/beav open`、`/beav workspaces`、`/beav new`、`/beav import`、`/beav save` 执行不需要模型轮次的快捷操作。
- 长任务显示为 Harness 原生 Job 和可重放的 Beav 任务卡。
- 只有 Beav 报告持久化产物回读验证成功，且连接器能逐个回读产物时，任务才会完成。

AI 编排、知识访问、图片/音频/视频生成、审批、计费、持久化和产物验证仍由 Beav 负责。插件不能自动批准付费或危险操作。

## 开源与闭源边界

这个公开仓库和 npm 包只包含可审计的薄连接器。授权前只开放本机配对状态接口，所有创作操作仍要求可撤销的客户端凭据；Deep Link 只携带随机请求编号和 PKCE challenge，不携带 Token 或 verifier。Beav 桌面应用、创作运行时、知识引擎、媒体管线和商业服务仍为闭源私有实现，不进入本仓库或 npm tarball。

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
