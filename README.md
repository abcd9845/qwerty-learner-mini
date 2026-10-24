# Qwerty Learner Mini

外研版英语**七年级上册**（Starter + Unit 1 ~ Unit 6）单词/短语打字练习：看中文释义打英文，深色大字号、手机友好。灵感来自 [RealKai42/qwerty-learner](https://github.com/RealKai42/qwerty-learner)，仅借鉴思路，迷你版全部重写。

## 功能

- 词库：外研版七上 Starter + Unit 1~6 的单词与重点短语/句型（`src/words.ts`，共 461 条）
- 按单元选择练习：全部七上（默认）/ Starter / Unit 1~6，选择会自动记住
- 单词逐字母高亮：已输入变绿、当前字母蓝色下划线光标
- 支持短语与整句：空格用空格键输入，大小写不敏感，标点直接输入
- 严格模式默认开启：打错显示红色错误按键，必须退格后才能继续
- 打完当前词自动进入下一词；空格键跳到下一词
- 实时统计：正确 / 错误 / 准确率 / 简单 WPM（正确按键数 ÷ 5 ÷ 分钟）
- 顺序 / 随机练习，深色主题、大字号，适合手机浏览器使用

技术栈：Vite + React + TypeScript，无路由、无状态库、无 UI 库。

## 本地开发

```bash
npm install
npm run dev
```

打开终端提示的地址（默认 http://localhost:5173 ）即可练习。

构建产物预览：

```bash
npm run build
npm run preview
```

## 词库更新

`src/words.ts` 由 `scripts/extract-words.mjs` 从教材词汇/短语数据一次性提取生成（英文 + 中文释义 + 单元，超长整句与重复条目已剔除）：

```bash
node scripts/extract-words.mjs --out src/words.ts --vocab-dir <词汇数据目录> --phrases <短语库文件> [--phrases <短语库文件> …]
```

## 在线地址

https://abcd9845.github.io/qwerty-learner-mini/

推送到 `main` 分支后，GitHub Actions 会自动构建并部署到 GitHub Pages（`.github/workflows/deploy.yml`）。

## License

MIT
