# 🐻 小熊写字本 (xiezi-bear)

[![Live Demo](https://img.shields.io/badge/%E5%9C%A8%E7%BA%BF%E4%BD%93%E9%AA%8C-GitHub%20Pages-FF7477?style=flat-square&logo=github)](https://melotusme.github.io/xiezi-bear/)
[![License: MIT](https://img.shields.io/badge/License-MIT-4CD2A4?style=flat-square)](./LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/Dependencies-0-5CB8F5?style=flat-square)](#%E6%9C%AC%E5%9C%B0%E8%BF%90%E8%A1%8C%E4%B8%8E%E6%9E%84%E5%BB%BA)

**小熊写字本**是一款专为学龄前及低年级小朋友设计的**绘本萌系互动汉字写字本**。支持规范笔顺动画演示、27 种基础与复合笔画自然语音播报、米字格触控描红闯关以及任意中文名字输入练习。项目采用**纯前端零第三方 npm 依赖**架构，所有练习与名字记录仅保存在本地浏览器 `localStorage` 中，不向任何服务器上传个人数据。

👉 **在线体验地址**：<https://melotusme.github.io/xiezi-bear/>

---

## 🚀 一键部署到免费平台 (One-Click Deploy)

仓库已内置各主流静态托管平台的零配置构建文件（`node build.mjs` -> `./dist`），点击下方按钮即可一键克隆并部署属于你自己的实例：

### 1. 无需绑卡 · 永久免费一键部署

| 平台 | 一键部署按钮 | 免费额度与特点说明 |
| :--- | :--- | :--- |
| **Cloudflare Workers** | [![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/melotusme/xiezi-bear) | 静态资源流量与请求数**不限**，支持自定义域名与免费自动 HTTPS（配置见 `wrangler.jsonc`） |
| **腾讯云 EdgeOne Pages** | [![Deploy to EdgeOne Pages](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Fmelotusme%2Fxiezi-bear&build-command=npm%20run%20build&output-directory=dist) | GitHub 直接登录免绑卡，亚太边缘节点（香港/新加坡/东京）**国内直连延迟低**（配置见 `edgeone.json`） |
| **Vercel** | [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fmelotusme%2Fxiezi-bear&project-name=xiezi-bear&repository-name=xiezi-bear) | Hobby 个人免费版含 100 GB/月流量与 PR 预览环境（配置见 `vercel.json`） |
| **Netlify** | [![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/melotusme/xiezi-bear) | 原生读取 `_headers` 缓存规则，支持一键原子回滚，超出免费额度自动暂停不扣费（配置见 `netlify.toml`） |
| **Render Static** | [![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/melotusme/xiezi-bear) | 纯静态 CDN 托管**永不休眠**，基于 `render.yaml` Blueprint 自动配置 |
| **Deno Deploy** | [![Deploy on Deno](https://deno.com/button)](https://console.deno.com/new?clone=https://github.com/melotusme/xiezi-bear) | GitHub 免绑卡登录，20 GiB/月流量，静态模式见 `deno.json`（注：官方计划于 2027 年 4 月下线迁移） |
| **GitHub Pages** | [![Fork & Deploy to GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Fork%20%E4%B8%80%E9%94%AE%E9%83%A8%E7%BD%B2-24292F?style=for-the-badge&logo=githubpages&logoColor=white)](https://github.com/melotusme/xiezi-bear/fork) | 点击 Fork 仓库后，在仓库 `Settings -> Pages -> Build and deployment -> Source` 选择 **`GitHub Actions`** 即可自动发布（工作流见 `.github/workflows/deploy-pages.yml`） |

### 2. 需绑卡验证的免费静态套餐（$0 账单）

| 平台 | 一键部署按钮 | 免费额度与特点说明 |
| :--- | :--- | :--- |
| **DigitalOcean App Platform** | [![Deploy to DO](https://www.deploytodo.com/do-btn-blue.svg)](https://cloud.digitalocean.com/apps/new?repo=https://github.com/melotusme/xiezi-bear/tree/main) | Starter 套餐免费托管最多 3 个纯静态站点，自动识别 `.do/app.yaml` |
| **Azure Static Web Apps** | [![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.StaticApp) | Free 套餐含 100 GB/月全球边缘流量（创建时选择仓库并填 `App location: /`、`Output location: dist`；学生认证免绑卡） |

### 3. 浏览器免安装在线运行 / 实时预览

无需注册部署平台，直接在浏览器沙盒中运行 `npm start` 预览或二次修改代码：

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/melotusme/xiezi-bear)
[![Open in CodeSandbox](https://codesandbox.io/static/img/play-codesandbox.svg)](https://codesandbox.io/p/github/melotusme/xiezi-bear/main)

> 💡 **阿里云 ESA Pages 与国内访问提示**
> - **阿里云 ESA Pages**：仓库已内置 `esa.jsonc`（自动识别构建命令 `npm run build` 与产物目录 `./dist`），可在阿里云 ESA 控制台新建 Pages 项目并关联 GitHub 仓库直接导入。
> - **中国大陆访问建议**：腾讯云 EdgeOne Pages 默认域名在亚太区域直连速度较快；Cloudflare Workers（`*.workers.dev`）与 Vercel（`*.vercel.app`）的默认分配域名在部分地区可能受 DNS 干扰，**绑定任意自定义域名**后即可在国内稳定访问（启用国内节点加速则需完成域名 ICP 备案）。

---

## ✨ 功能特色

- 🎨 **绘本级萌系交互界面**：柔和蓝天草地背景、大圆角按钮与小熊老师伴读气泡，专为平板触控屏（iPad / Android 平板）与桌面浏览器优化。
- ✍️ **两种练字模式自由切换**：
  - **跟着看**：支持慢速逐笔报笔画名称、快速连看、上一笔/下一笔单步跳转、空格键随时“写完本笔停”以及“连看 3 字”笔顺秀。
  - **自己写**：米字格描红引导（可开关描红轮廓）、写错自动闪红提示、“帮帮我”高亮当前笔画，写完集齐星星触发奖杯礼花庆祝。
- 🔊 **自然语音报笔画 + 任意汉字兜底**：
  - 内置 **27 种汉字基础与复合笔画**（横、竖、撇、捺、点、提、横折钩、竖弯钩、卧钩等）及常用示例字的高清离线 MP3 语音；
  - 输入**任意其他汉字**时，自动通过 `hanzi-writer-data` 加载笔顺路径、几何识别每一笔的笔画名称，并无缝回退至浏览器原生中文语音合成（Web Speech API）。
- 🧩 **隐私安全的自定义名字管理**：支持直接输入任意小朋友名字或通过常用字积木拼字，所有保存的名字仅存储在当前设备本地浏览器 `localStorage` 中。

---

## 🛠️ 本地运行与构建

本项目使用 Node.js 原生内置模块（`node:fs`、`node:path`、`node:http`）构建与预览，**无需执行 `npm install` 安装任何第三方依赖**（需 Node.js 18+）：

```bash
# 构建静态产物到 ./dist 并启动本地预览服务 (默认 http://localhost:3000)
npm start

# 仅构建静态产物到 ./dist 目录
npm run build
```

如需使用 Cloudflare Wrangler 在本地模拟 Workers 边缘静态环境（需本机或全局安装 `wrangler`）：

```bash
npm run dev      # 本地启动 wrangler dev
npm run deploy   # 部署至 Cloudflare Workers
```

---

## 📁 项目结构

```text
.
├── index.html          # 应用主页面与 SVG 绘本插画结构
├── styles.css          # 响应式绘本风格样式与小熊动画
├── app.js              # 笔顺播放、描红测验、几何笔画识别与语音控制逻辑
├── hanzi-writer.min.js # Hanzi Writer v3.5.0 汉字笔顺渲染引擎
├── stroke-data.js      # 内置示例汉字离线笔顺数据（其余汉字自动按需加载）
├── audio/              # 27 种笔画名称与内置示例字离线语音 MP3
├── favicon.svg         # 小熊图标
├── build.mjs           # 零依赖静态打包脚本（含 --serve 本地预览服务与 _headers 生成）
├── wrangler.jsonc      # Cloudflare Workers Static Assets 配置
├── edgeone.json        # 腾讯云 EdgeOne Pages 配置
├── vercel.json         # Vercel 构建配置
├── netlify.toml        # Netlify 构建配置
├── render.yaml         # Render Static Blueprint 配置
├── deno.json           # Deno Deploy 静态模式配置
├── esa.jsonc           # 阿里云 ESA Pages 配置
├── .do/app.yaml        # DigitalOcean App Platform 配置
└── .github/workflows/  # GitHub Pages 自动构建与部署工作流
```

---

## 📄 开源协议

本项目基于 [MIT License](./LICENSE) 开源。汉字笔顺渲染基于开源库 [Hanzi Writer](https://github.com/chanind/hanzi-writer)（MIT License）。
