@AGENTS.md

## Claude-specific

- 回复保持简洁；不要末尾总结"我做了什么"，diff 自己会说话。
- skill 只在用户明确触发或明显匹配时跑，不要每条消息都先过一遍 skill。
- UI 验证由用户自己看；不要自己开 dev server / 浏览器 MCP 来"确认效果"。
- 跨仓库引用后端时直接读 `/Users/david/ai-cs/` 源码，不要靠记忆推断 API 形状。
