# 背词课 · qwerty-learner-mini

七年级上册（外研版）单词/短语背诵训练，纯前端、无后端，进度存 `localStorage`，手机浏览器上好用，可「添加到主屏幕」离线使用（PWA）。

在线使用：GitHub Pages <https://abcd9845.github.io/qwerty-learner-mini/>

## 功能

### 四种练习模式（首页可切换，记住上次选择）

| 模式 | 玩法 |
| --- | --- |
| ✍️ 看中文默写 | 看中文释义输英文；首错提示首字母+长度（`a _ _ _`），再错显示答案并要求重打一遍 |
| 🎧 听音默写 | 浏览器 TTS 朗读（en-US，语速 ≤ 0.85），可重播/慢速（0.6）；默认不显示中文（设置可开） |
| ⚡️ 选择题速刷 | 看英文（可自动朗读）四选一中文释义；干扰项优先同单元同词性 |
| 🧩 句子填空 | 短语/句子挖掉关键词补全，有关键词中文释义提示 |

答错立刻反馈：错误提示 + 读音 + 正确拼写，并自动加入错题本。

### Leitner 5 盒记忆盒

答对升一盒（盒 5 封顶），答错回盒 1；间隔：盒 1 当天/下次，盒 2 = 1 天，盒 3 = 3 天，盒 4 = 7 天，盒 5 = 14 天。
首页「今日复习」先出到期词，再补新词（每日新词数 5/10/20/30 可设）。

### 其它

- 每词掌握度条（0~5）、今日完成、连续打卡、正确率、错题本专项练习
- 设置：单元多选、每日新词、自动朗读、显示中文、语速/音量、键盘音效（WebAudio 合成）、清空进度
- 进度导出/导入 JSON（文本框复制粘贴）
- 深浅色主题跟随系统；隐藏 input 自动聚焦，`autocapitalize/autocorrect/spellcheck` 全关
- PWA：manifest + service worker 离线缓存静态资源（注意 GitHub Pages 子路径 `/qwerty-learner-mini/`）

## 开发

```bash
npm install
npm test        # vitest：srs.ts 纯函数单元测试
npm run dev     # 本地开发
npm run build   # tsc --noEmit && vite build
npm run preview # 本地预览 dist
```

## 目录

```
src/
  data/words.ts        # 词库（外研版七上 Starter + Unit 1~6，脚本生成）
  lib/
    srs.ts             # Leitner 记忆盒纯函数（含 srs.test.ts 单测）
    storage.ts         # localStorage 持久化（进度/设置/统计/错题本）
    speech.ts          # speechSynthesis 朗读封装
    sound.ts           # WebAudio 键盘音效
    pool.ts            # 单元筛选 + 今日队列
    util.ts            # 洗牌 / 干扰项挑选等
  modes/               # 四种练习模式 + 会话/打字状态机
  pages/               # 首页 / 统计 / 错题本 / 设置
  components/          # 隐藏输入、字母槽、掌握度条等
public/                # PWA：manifest / sw.js / SVG 图标
scripts/extract-words.mjs  # 词库生成脚本（一次性）
```
