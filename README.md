# Oscilloscope

Oscilloscope is a browser-based photo-to-art tool for generating retro signal-inspired visuals. It runs in a single page, processes images locally in the browser, and exports both high-resolution `PNG` and editable `SVG`.

Primary site: [https://osc.mazzzz.art](https://osc.mazzzz.art)  
Pages fallback: [https://oscilloscope-edq.pages.dev/](https://oscilloscope-edq.pages.dev/)

## Overview

Oscilloscope turns uploaded images into a collection of experimental visual styles, including waveform-based portraits, contour-like line fields, dot-based rendering, and chaotic single-line sketches.

The app is designed as a compact instrument-style web tool with:

- in-browser image upload and square crop
- live parameter control
- multiple effect modes
- `PNG` and `SVG` export
- a shared print counter powered by Cloudflare D1

## Effects

- `Unknown Pleasures`
- `Known Pleasures`
- `Groove`
- `Fuzz`
- `Atomize`
- `Chaos`

## Tech Stack

- `HTML`
- `CSS`
- `JavaScript`
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1

## Local Development

No build step is required.

From the project root, run:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Notes:

- The artwork generator works locally.
- The shared print counter only works in the deployed environment with the D1 binding.

## Project Structure

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/
├── functions/
│   └── api/
│       └── counter.js
├── db/
│   └── schema.sql
├── wrangler.toml
└── DEPLOY.md
```

## Deployment

This project is deployed with Cloudflare Pages.

Recommended settings:

- Framework preset: `None`
- Build command: leave empty, or use `echo "No build step"`
- Build output directory: `.`

The shared counter uses:

- `functions/api/counter.js`
- `db/schema.sql`
- D1 binding: `DB`

Deployment notes:

- [DEPLOY.md](./DEPLOY.md)

## Counter API

- `GET /api/counter`
- `POST /api/counter`

The front end reads the counter on load and increments it after each successful print action.

## License

No license file has been added yet.

---

# Oscilloscope 中文说明

Oscilloscope 是一个运行在浏览器中的图片生成工具，可以将照片转换为多种复古信号感、波形感、点阵感和实验线条风格的图像。整个前端为单页应用，图像处理主要在浏览器本地完成，并支持导出高分辨率 `PNG` 与可编辑 `SVG`。

主站地址：[https://osc.mazzzz.art](https://osc.mazzzz.art)  
备用地址：[https://oscilloscope-edq.pages.dev/](https://oscilloscope-edq.pages.dev/)

## 项目简介

用户上传图片后，可以在页面内完成裁切、参数调整、实时预览与导出。项目整体界面被设计成一个小型复古电子仪器，强调“模块化工具”的体验，而不是传统图片编辑器的布局。

主要功能：

- 浏览器内上传图片并进行方形裁切
- 实时预览不同效果
- 多种艺术化 effect 可切换
- 导出 `PNG`
- 导出可编辑 `SVG`
- 共享下载计数器

## 已支持的效果

- `Unknown Pleasures`
- `Known Pleasures`
- `Groove`
- `Fuzz`
- `Atomize`
- `Chaos`

## 技术栈

- `HTML`
- `CSS`
- `JavaScript`
- Cloudflare Pages
- Cloudflare Pages Functions
- Cloudflare D1

## 本地运行

项目不需要构建工具，直接启动一个本地静态服务器即可：

```bash
python3 -m http.server 8000
```

然后访问：

```text
http://localhost:8000
```

说明：

- 本地图像生成功能可正常使用
- 共享计数器只有在 Cloudflare Pages + D1 部署环境下才会生效

## 项目结构

```text
.
├── index.html
├── styles.css
├── app.js
├── assets/
├── functions/
│   └── api/
│       └── counter.js
├── db/
│   └── schema.sql
├── wrangler.toml
└── DEPLOY.md
```

## 部署说明

项目通过 Cloudflare Pages 发布，计数器通过 Pages Functions 和 D1 实现。

关键文件：

- `functions/api/counter.js`：共享计数器接口
- `db/schema.sql`：D1 数据库初始化脚本
- `wrangler.toml`：Cloudflare 配置

更详细的部署说明见：

- [DEPLOY.md](./DEPLOY.md)

## 计数器接口

- `GET /api/counter`
- `POST /api/counter`

前端会在页面加载时读取计数器，并在用户成功执行一次打印/下载操作后递增计数。

## 许可

目前仓库中还没有加入 license 文件。
