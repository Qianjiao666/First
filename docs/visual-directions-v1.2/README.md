# 航线 v1.2 视觉方向原型

这组三套原型用于在继续改动生产页面前确认视觉方向。每套 `index.html` 都是可直接打开的静态预览，同一份 HTML 在桌面宽度展示首页 Hero，在移动宽度展示论坛代表视图，便于比较真实内容密度、导航层级和响应式取舍。

## 预览

- `direction-a/index.html`：Precision Signal Horizon
- `direction-b/index.html`：Navigation Data Map
- `direction-c/index.html`：Light/Dark Dual-Domain Calibration Desk

本地预览服务器正在运行时，可访问：

- `http://127.0.0.1:4175/MKJ/docs/visual-directions-v1.2/direction-a/`
- `http://127.0.0.1:4175/MKJ/docs/visual-directions-v1.2/direction-b/`
- `http://127.0.0.1:4175/MKJ/docs/visual-directions-v1.2/direction-c/`

## 方向对比

| 方向 | 核心语言 | 桌面代表视图 | 移动代表视图 | 优势 | 风险 |
|---|---|---|---|---|---|
| A · Precision Signal Horizon | 冷白纸面、墨色、低饱和蓝；编辑式分栏和准备度信号盘 | Hero + 72/100 readiness dial + 社区入口 | 论坛列表与发起讨论 CTA | 品牌识别清楚，信息层级最稳，最容易复用亮/暗主题 tokens | 信号盘需要在真实业务数据接入后保持语义清晰；大标题需继续做窄屏回归 |
| B · Navigation Data Map | 薄荷纸面、路径节点、进度路线和 checkpoint feed | Hero + 路线地图 + 完成/当前/下一站图例 | 论坛 checkpoint 列表 | 任务、积分、成就等产品语义最直观，适合强化行动路径 | 地图装饰密度容易挤压正文；需要严格限制线条和状态色，避免游戏化过度 |
| C · Dual-Domain Calibration Desk | 亮色行动面板与深色信号面板并置，形成校准工作台 | 双域 Hero + 当前准备度 + 周增量 | 亮/暗面板堆叠后进入论坛 | 双主题意图最明确，科技感和主题切换识别度最高 | 深色区域对比度、焦点环和图片适配成本最高；移动端需防止面板高度过长 |

## 共同交互与约束

- 保留首页、评估、社区、任务、登录/注册等现有入口；原型中的锚点只代表入口位置，不替代真实业务路由。
- 论坛移动代表视图保留帖子标题、分类/节点和回复数，不隐藏社区操作语义。
- 生产实现必须继续使用现有 `auth.js`、`session-coordinator.js`、`form-guard`、主题控制器和 API，不在视觉层创建第二套认证状态。
- 图片只作为增强层：固定尺寸占位、`alt` 兜底、失败降级为背景色或既有 initials/avatar，不能遮盖表单、导航和列表操作。
- 动画必须遵守 `prefers-reduced-motion`；按钮、弹窗、分页和评论区保留原有键盘焦点、Escape 和读屏语义。

## Impeccable 审计

执行命令：

```powershell
node C:\Users\梁惠\.agents\skills\impeccable\scripts\detect.mjs --json docs/visual-directions-v1.2/direction-a/index.html docs/visual-directions-v1.2/direction-b/index.html docs/visual-directions-v1.2/direction-c/index.html
```

结果为 `DEGRADED`：环境缺少 `htmlparser2`、`css-select`、`css-tree`、`domutils`，工具回退到正则扫描，因此结果是 undercount，不能视为无问题证明。扫描提示主要包括：

- 原型使用了 DESIGN.md 未登记的方向色、字号和圆角；这些是方向探索中的显式色彩决策，生产落地时必须收敛为统一 tokens。
- B 的路线图使用 3px 顶边表达路线，不应原样复制为通用圆角卡片边框。
- A/C 使用大字号和局部装饰网格，落地时需以实际内容长度、对比度和移动截图重新校验。

截图已生成于 `output/direction-{a,b,c}-{desktop,mobile}.png`，尺寸分别为 1280x800 和 390x844；三套视图均无横向溢出或关键 CTA 遮挡。

## 选型门槛

本目录不替用户选定方向。收到选择后，tara 才能按 `task_plan.md` 的 allowlist 进入生产 CSS/HTML 视觉改版；在此之前不得把任一方向直接合并到业务页面。
