# 背词课 · qwerty-learner-mini

七年级上册（外研版）单词/短语背诵训练，纯前端、无后端，进度存 `localStorage`（本机浏览器），手机浏览器上好用，可「添加到主屏幕」离线使用（PWA）。

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

### 本地多用户（profile）

无后端、无密码、不收集任何个人信息——数据只存在本机浏览器的 localStorage：

- 首次打开引导输入名字建用户（默认「同学」）；首页顶部显示当前用户，点击可切换/新建/重命名/删除（删除需二次确认，会连同该用户全部数据）
- 每个用户独立保存：SRS 进度、错题本、每日统计/打卡、全部设置；切换后所有页面立即刷新为该用户数据
- 存储位置：用户列表+当前用户存 `qlm:profiles`；每个用户的数据存 `qlm:v2:<profileId>:data`；旧版未分用户数据（`qwerty-learner-mini:data`）首次建用户时自动搬到该用户名下，不丢数据
- 导出/导入按当前用户进行：导出文件带用户名但不含其它用户数据；同时兼容导入旧版纯 AppData JSON

### Leitner 5 盒记忆盒

答对升一盒（盒 5 封顶），答错回盒 1；间隔：盒 1 当天/下次，盒 2 = 1 天，盒 3 = 3 天，盒 4 = 7 天，盒 5 = 14 天。
首页「今日复习」先出到期词，再补新词（每日新词数 5/10/20/30 可设）。

### 其它

- 每词掌握度条（0~5）、今日完成、连续打卡、正确率、错题本专项练习
- 首页可直接多选单元（Starter / Unit 1~6，全选/清空快捷，与设置页同步，至少保留 1 个）并开关「打乱出题顺序」：开=随机出题（到期复习仍优先于新词），关=按课本顺序（Starter→Unit 6）出题
- 设置：单元多选、每日新词、打乱出题顺序、自动朗读、显示中文、语速/音量、键盘音效（WebAudio 合成）、清空进度（仅当前用户）
- 进度导出/导入 JSON（文本框复制粘贴，按当前用户）
- 深浅色主题跟随系统；练习层常驻隐藏 input（不随切词重挂载）、手势内聚焦、按钮不抢焦点，软键盘不收起；`autocapitalize/autocorrect/spellcheck` 全关
- PWA：manifest + service worker 离线缓存静态资源（注意 GitHub Pages 子路径 `/qwerty-learner-mini/`）

## 开发

```bash
npm install
npm test        # vitest：srs / util / pool / profiles（本地用户、隔离、迁移）单元测试
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
    profiles.ts        # 本地用户注册表 + 按用户分 key 读写（含 profiles.test.ts 单测）
    storage.ts         # 按当前用户持久化 AppData（进度/设置/统计/错题本）
    speech.ts          # speechSynthesis 朗读封装
    sound.ts           # WebAudio 键盘音效
    pool.ts            # 单元筛选 + 出题顺序（shuffle 开/关）+ 今日队列（含 pool.test.ts 单测）
    util.ts            # 洗牌 / 干扰项挑选等
  modes/               # 四种练习模式 + 会话/打字状态机
  pages/               # 首页 / 统计 / 错题本 / 设置 / 首次建用户引导
  components/          # 常驻隐藏输入、用户管理弹层、字母槽、掌握度条等
public/                # PWA：manifest / sw.js / SVG 图标
scripts/extract-words.mjs  # 词库生成脚本（一次性）
```

## 隐私

无后端、无统计埋点、无密码登录。所有数据（用户名、学习记录、设置）仅存于本机浏览器的 localStorage，不上传任何服务器；清除浏览器数据或删除用户即彻底移除。
