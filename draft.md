对。既然准备把两边代码直接纳入 **Pipyter 单仓库长期维护**，我反而建议不要再把它看成“JupyterLab fork + Pi fork 拼接”，而是从产品层重新划分：

> **Pipyter = Jupyter 计算工作区 + Figure Studio + Pi Agent + 多用户工作区管理**

JupyterLab 和 Pi 都只是两个 engine。

另外版权这里需要稍微严谨一点：你当前的 JupyterLab fork是 BSD-3-Clause，Pi/BeauPi 上游是 MIT。
所以复制代码没问题，但对应源码里的版权和许可证声明要保留。我建议根目录统一放 `THIRD_PARTY_LICENSES/`，同时记录你从哪个 upstream commit 开始演化。

---

# 一、我建议 Pipyter 最终架构

不要把两个源码树直接混在根目录。

我会这样：

```text
Pipyter/
│
├── README.md
├── LICENSE
├── UPSTREAM.md
├── CHANGELOG.md
├── pyproject.toml
├── uv.lock
│
├── src/
│   └── pipyter/                  # Pipyter Python 控制层
│
├── packages/                     # Pipyter 自研前端/协议模块
│
├── engines/
│   ├── jupyterlab/               # 从 JupyterLab copy 过来的源码
│   └── pi/                       # 从 Pi / BeauPi copy 过来的源码
│
├── services/                     # Pipyter 后台服务
│
├── configs/
├── scripts/
├── tests/
├── docs/
│
├── THIRD_PARTY_LICENSES/
│   ├── JUPYTERLAB-BSD-3-CLAUSE.txt
│   └── PI-MIT.txt
│
└── .github/
```

这里最重要的思想是：

```text
engines/
    上游代码，允许魔改

packages/
    Pipyter 自己的产品能力

src/pipyter/
    整个产品的 Python 入口

services/
    Agent / Figure / User 等运行时服务
```

这样以后即使你把 JupyterLab 改到亲妈都认不出来，也不会把 Pipyter 自己的业务代码淹没进去。

---

# 二、整个产品我建议拆成 6 个核心系统

```text
                         Pipyter
                            │
        ┌───────────────────┼────────────────────┐
        │                   │                    │
        ▼                   ▼                    ▼
    Workspace IDE      Figure Studio         Pi Agent
        │                   │                    │
        └──────────────┬────┴───────────────┬────┘
                       ▼                    ▼
                  Pipyter Server      Runtime Bridge
                       │                    │
                       └──────────┬─────────┘
                                  ▼
                            User Workspace
```

具体就是：

### ① Workspace IDE

基于 JupyterLab。

### ② Figure Studio

这是 Pipyter 真正区别于普通 Jupyter 的核心。

### ③ Pi Agent

负责 AI 编程、绘图、分析。

### ④ Context / Runtime Bridge

把 Notebook、Kernel、文件、Figure、Terminal 和 Agent 连起来。

### ⑤ Workspace / User System

多用户、目录、配置、API Key、Session。

### ⑥ Pipyter CLI / Deployment

负责安装、启动、更新、服务化。

---

# 三、Workspace IDE：JupyterLab 负责什么

`engines/jupyterlab/` 不要承担 Pipyter 的业务逻辑。

它主要提供：

```text
Notebook
Kernel
Terminal
File Browser
Text Editor
Markdown
Tab / Dock Layout
Command Palette
Output Renderer
Jupyter Server Protocol
```

也就是：

> **JupyterLab = Pipyter 的 VS Code Shell**

你在它上面重新做产品 UX。

例如最终界面可以这样：

```text
┌────────────────────────────────────────────────────────────┐
│ Pipyter    File Edit Run Kernel Figure Agent       ● H200 │
├──────────┬──────────────────────────────────┬───────────────┤
│          │                                  │               │
│ Files    │        Notebook / Editor         │   Pi Agent    │
│          │                                  │               │
│ 📁 exp   │   x = ...                        │ context       │
│ 📄 a.py  │   plt.plot(...)                  │ current.ipynb │
│ 📄 .csv  │                                  │               │
│          │   [ Figure Output ]              │ Ask Pi...     │
│          │                                  │               │
├──────────┴──────────────────────────────────┴───────────────┤
│                  Figure Studio / Terminal                  │
└────────────────────────────────────────────────────────────┘
```

---

# 四、Figure Studio 应该是整个项目的第一核心

我觉得你这个项目如果只是：

> Jupyter + 一个 Agent sidebar

其实价值不够大。

真正有区别的是：

> **Jupyter + AI-native scientific Figure workflow**

所以建议独立：

```text
packages/
└── figure-studio/
```

---

## Figure Studio 第一层：Figure Registry

Pipyter 自动知道当前 Notebook 生成了哪些图。

例如执行：

```python
fig, ax = plt.subplots()
ax.plot(x, y)
```

不要只把它视为一张 PNG。

而要登记：

```text
Figure #17

source:
  notebook: experiments/ablation.ipynb
  cell: 24

kernel:
  python3

backend:
  matplotlib

object:
  fig variable = fig

outputs:
  PNG
  SVG

created:
  20:31:42
```

这样才能做真正的 Figure 管理。

---

# 五、Figure Inspector

点击图以后右边不应该只是图片。

可以是：

```text
Figure Inspector
─────────────────

Canvas
  Width       7.2 in
  Height      4.5 in
  DPI         300

Axes
  X Label     Sequence Length
  Y Label     VBench Score

Fonts
  Family      Times New Roman
  Base Size   10 pt

Legend
  Position    upper right
  Columns     2

Lines
  ├── Baseline
  │    width  1.5
  │    marker o
  └── Pipyter
       width  2.0
       marker s

Export
  SVG
  PDF
  PNG 300 DPI
```

注意这个 Figure Inspector **最好不要通过编辑 PNG 实现**。

应该：

```text
Figure UI
     ↓
Pipyter Figure Protocol
     ↓
Python kernel
     ↓
Matplotlib Figure object
```

直接修改 matplotlib object。

例如：

```text
UI:
Font size → 12

↓

kernel:
ax.tick_params(labelsize=12)

↓

重新 render
```

这才是真正的“科学绘图 IDE”。

---

# 六、Code ↔ Figure 双向关联

这是我特别建议做的东西。

传统 Jupyter 是：

```text
Code
 ↓
Figure
```

Pipyter 应该做：

```text
Code
 ⇅
Figure
```

比如用户点：

```text
Legend → lower center
```

Pipyter 可以：

1. 临时修改当前 Figure object；
2. 实时预览；
3. 用户点：

```text
Apply to Code
```

然后 Agent / AST 修改原代码：

```python
ax.legend(loc="lower center")
```

这样就非常强。

最终变成：

> GUI 调图 → 自动回写 Python。

---

# 七、Figure History

科研绘图非常适合版本管理：

```text
Figure: ablation_latency

v1
  raw plot

v2
  + proper labels

v3
  + error bars

v4
  + paper typography

v5
  camera-ready
```

用户可以：

```text
Compare v3 ↔ v5
Restore
Duplicate
Export
Ask Pi about this figure
```

后面甚至能接 Git。

---

# 八、Figure Gallery

建议单独提供一个页面：

```text
/pipyter/figures
```

像 Lightroom：

```text
┌────────────┐ ┌────────────┐ ┌────────────┐
│            │ │            │ │            │
│ Figure 01  │ │ Figure 02  │ │ Figure 03  │
│            │ │            │ │            │
└────────────┘ └────────────┘ └────────────┘

 latency.pdf    ablation.pdf   quality.pdf
```

每个 Figure 有：

```text
source notebook
source cell
created time
tags
version
export history
```

这个对写论文非常实用。

---

# 九、Pi Agent：不要只是 Chatbot

Pi 在 Pipyter 里应该变成：

> **具有当前科研 Workspace 完整上下文的操作型 Agent**

你当前 Pi 源码本身已经有 `agent / ai / coding-agent / server / storage / tui` 等模块，可以选择性保留这些能力。

Pipyter Agent 主要提供：

```text
Chat
Code
Plot
Data
Notebook
Shell
Research
Workspace
```

---

# 十、Agent Context

这是成败关键。

用户问：

```text
为什么这个 ablation 图第三条线不对？
```

Agent 应该自动拿到：

```text
Current workspace

Current notebook
    experiments/cache.ipynb

Current cell
    Cell 38

Selected code
    ...

Current figure
    Figure #19

Variables
    df
    results
    baseline

Recent terminal
    ...

Nearby files
    results.csv
```

而不是让用户复制粘贴。

所以建议做：

```text
packages/context/
```

统一负责：

```text
ContextProvider
├── NotebookContext
├── CellContext
├── FileContext
├── FigureContext
├── KernelContext
├── VariableContext
├── TerminalContext
└── WorkspaceContext
```

---

# 十一、Agent Tools

Pi 应该能够真正操作 Pipyter。

第一版我会提供：

```text
read_file
write_file
list_files

read_notebook
edit_notebook
insert_cell
run_cell

inspect_variable
execute_python

run_shell

inspect_figure
modify_figure
export_figure

read_csv
summarize_dataframe
```

以后：

```text
git_diff
git_commit

latex_compile
paper_search
citation_search

run_experiment
monitor_job
```

---

# 十二、Agent 权限体系

这个最好现在就设计，不然后面容易乱。

例如：

```text
Read
✓ read files
✓ inspect notebook
✓ inspect variables

Edit
✓ modify files
✓ modify cells
✓ modify figure

Execute
✓ execute Python
✓ run shell

Dangerous
□ rm
□ sudo
□ network
```

前端可以显示：

```text
Pi wants to:

Run:
python plot.py

[Allow once]
[Allow workspace]
[Deny]
```

这样未来多用户才安全。

---

# 十三、Bridge 是真正的技术核心

我建议单独建立：

```text
packages/protocol/
services/runtime-bridge/
```

因为你不能让 Pi 直接依赖 JupyterLab 内部 API。

架构：

```text
              Browser
                 │
                 │ WebSocket
                 ▼
        Pipyter Runtime Bridge
          │       │       │
          │       │       │
          ▼       ▼       ▼
       Jupyter   Kernel    Pi
       Server             Agent
```

Protocol 可以定义：

```json
{
  "type": "figure.inspect",
  "figure_id": "fig-019"
}
```

或者：

```json
{
  "type": "kernel.execute",
  "kernel_id": "...",
  "code": "df.describe()"
}
```

以后你把 Pi 换掉：

```text
Pi
Claude Code
Codex
自己训练的 Agent
```

Jupyter 这一边完全不用改。

这很重要。

---

# 十四、Python Kernel Bridge

专门建立：

```text
src/pipyter/kernel/
```

负责：

```text
execute
variables
figures
dataframe
environment
packages
```

例如 Agent 问变量：

```text
inspect_variable("results")
```

Pipyter 不应该让 Agent自己：

```python
import pickle
```

而应该通过当前 kernel。

因为用户 Notebook 里可能有：

```text
GPU tensor
model
DataFrame
Figure
custom object
```

它们只活在这个 kernel 进程中。

---

# 十五、Kernel Agent 可以做到非常强

比如：

```text
用户：

“这张图为什么第 5 个点突然下降？”
```

Pi 可以：

```text
1. inspect figure
2. 找到 plot 使用变量 results
3. inspect_variable(results)
4. 找到对应数据点
5. 定位生成数据的 cell
6. 查看附近实验结果
7. 给解释
```

这就是 Pipyter 和普通 AI IDE 最大的区别之一。

---

# 十六、用户系统

你之前提的每人一个目录，我建议直接设计两种模式：

```text
pipyter lab
```

单用户模式。

和：

```text
pipyter hub
```

多用户模式。

---

## 单用户

默认：

```text
~/Pipyter/
```

或者：

```bash
pipyter lab ~/research/project
```

---

## 多用户

不要自己从零写 Linux 用户隔离。

建议基于：

```text
JupyterHub
        │
        ├── User A Jupyter Server
        ├── User B Jupyter Server
        └── User C Jupyter Server
```

Pipyter 提供自己的 UI 和 Agent。

用户结构：

```text
/var/lib/pipyter/users/

alice/
├── workspace/
├── config/
└── cache/

bob/
├── workspace/
├── config/
└── cache/
```

逻辑上：

```text
User
├── Workspace
├── Kernels
├── Pi Session
├── API Keys
├── Figure Library
└── Preferences
```

---

# 十七、BYOK

你想让每人接自己的 API Key，这个建议独立：

```text
services/secrets/
```

例如支持：

```text
OpenAI
Anthropic
Google
OpenRouter
DeepSeek
Custom OpenAI-compatible
```

用户设置：

```text
Settings
→ AI Providers
→ Add API Key
```

Agent 使用：

```text
User Secret Store
       ↓
Provider Adapter
       ↓
Pi
```

不要：

```text
API key
 ↓
Notebook filesystem
```

更不要写进：

```text
.ipynb
.env
```

默认应该与 workspace 分开。

---

# 十八、Pipyter Server

Python 主服务可以成为整个产品的“大脑”。

```text
src/pipyter/server/
```

我会拆：

```text
server/
├── app.py
├── config.py
│
├── api/
│   ├── agent.py
│   ├── figures.py
│   ├── workspace.py
│   ├── kernels.py
│   ├── users.py
│   └── settings.py
│
├── websocket/
│   ├── agent.py
│   ├── kernel.py
│   └── events.py
│
├── auth/
├── sessions/
└── lifecycle/
```

---

# 十九、推荐最终源码目录

我会直接定成这一版：

```text
Pipyter/
│
├── src/
│   └── pipyter/
│       │
│       ├── cli/
│       │   ├── main.py
│       │   ├── lab.py
│       │   ├── hub.py
│       │   └── doctor.py
│       │
│       ├── server/
│       │   ├── app.py
│       │   ├── api/
│       │   ├── websocket/
│       │   ├── auth/
│       │   └── sessions/
│       │
│       ├── kernel/
│       │   ├── manager.py
│       │   ├── execute.py
│       │   ├── variables.py
│       │   └── figures.py
│       │
│       ├── workspace/
│       │   ├── manager.py
│       │   ├── files.py
│       │   └── users.py
│       │
│       ├── figures/
│       │   ├── registry.py
│       │   ├── metadata.py
│       │   ├── exporter.py
│       │   └── history.py
│       │
│       ├── agent/
│       │   ├── client.py
│       │   ├── context.py
│       │   ├── permissions.py
│       │   └── tools/
│       │
│       └── secrets/
│
├── packages/
│   │
│   ├── lab-extension/
│   │
│   ├── figure-studio/
│   │
│   ├── agent-panel/
│   │
│   ├── context/
│   │
│   ├── protocol/
│   │
│   └── ui/
│
├── services/
│   ├── agent-runtime/
│   └── runtime-bridge/
│
├── engines/
│   ├── jupyterlab/
│   └── pi/
│
├── configs/
│   ├── pipyter.toml
│   ├── jupyter_server_config.py
│   └── jupyterhub_config.py
│
├── scripts/
│   ├── bootstrap.sh
│   ├── build-lab.sh
│   ├── build-pi.sh
│   ├── dev.sh
│   └── update-upstream.sh
│
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── docs/
│   ├── architecture.md
│   ├── figure-system.md
│   ├── agent-system.md
│   ├── protocol.md
│   └── upstream.md
│
├── THIRD_PARTY_LICENSES/
│
├── UPSTREAM.md
├── pyproject.toml
└── README.md
```

---

# 二十、`UPSTREAM.md` 很有必要

因为你准备直接 cp，而不是保持 Git fork 关系。

建议始终记录：

```text
JupyterLab
Repository:
jupyterlab/jupyterlab

Imported version:
4.x.x

Imported commit:
xxxxxxxx

Imported:
2026-08-09


Pi
Repository:
earendil-works/pi

Imported commit:
xxxxxxxx

Imported:
2026-08-09
```

之后每次升级：

```text
Upstream Pi
     ↓
diff
     ↓
挑选变化
     ↓
Pipyter
```

否则半年以后你根本不知道自己从哪个 upstream snapshot 分出来的。

---

# 二十一、我甚至不建议直接 `cp -r repo/*`

建议：

```bash
git clone https://github.com/winbeau/jupyterlab.git /tmp/jupyterlab
git clone https://github.com/winbeau/beaupi.git /tmp/pi

mkdir -p engines

rsync -a --exclude=.git /tmp/jupyterlab/ engines/jupyterlab/
rsync -a --exclude=.git /tmp/pi/ engines/pi/
```

这样不会出现：

```text
Pipyter/.git
Pipyter/engines/pi/.git
Pipyter/engines/jupyterlab/.git
```

三个 Git repository 套娃。

---

# 二十二、第一版不要全部实现

我建议你的 **v0.1** 只做下面这条链。

```text
                Pipyter v0.1

                    Browser
                       │
                JupyterLab UI
                       │
         ┌─────────────┴─────────────┐
         ▼                           ▼
    Notebook                    Pi Sidebar
         │                           │
         ▼                           ▼
      Kernel ←── Runtime Bridge ── Pi Agent
         │
         ▼
   Matplotlib Figure
         │
         ▼
     Figure Studio
```

功能只做：

1. `pipyter lab` 能启动；
2. 自己的品牌 JupyterLab；
3. Pi sidebar；
4. Pi 能读当前 notebook；
5. Pi 能运行/修改 cell；
6. Pi 能读取当前 workspace；
7. Matplotlib 图自动进入 Figure Studio；
8. Figure 一键 SVG/PDF/PNG；
9. Figure Inspector 能改一些核心属性；
10. 每个用户可以配置自己的 AI API Key。

这个 v0.1 已经足够有产品辨识度。

---

# 二十三、然后 v0.2 再做真正厉害的部分

```text
Figure ↔ Code 双向同步

Figure history

Variable inspector for Pi

DataFrame context

Plot recipe

Agent multi-step plotting

LaTeX figure export

Paper preset
  NeurIPS
  ICML
  CVPR
  ECCV

Multi-user

JupyterHub

Figure Gallery
```

例如以后直接：

```text
Paper preset → NeurIPS Two-column
```

自动给：

```text
figure width
font size
line width
DPI
PDF/SVG export
```

这就非常贴科研绘图场景。

---

## 我最建议你明确一句项目边界

Pipyter **不是另一个 JupyterLab**。

它应该定义为：

> **Pipyter is an AI-native scientific computing and figure workspace built on Jupyter and Pi.**

Jupyter 负责 **compute**，Pi 负责 **intelligence**，而 Pipyter 自己最核心的是 **workspace + context + figure workflow**。

如果这个边界定住，后续你会发现哪些代码该改 Jupyter，哪些该改 Pi，哪些必须留在 Pipyter 自己里面，会清晰很多。
