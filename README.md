# 同盟漫游记

一份送给朋友的 25 岁生日礼物。坐上小列车，在六角地图上慢慢走，把沿途的回忆、照片和祝福拾起来。

**[打开游戏](https://violetloveai.github.io/alliance-express/)**

![同盟漫游记实际页面预览](./preview.png)

## 怎么玩

- 点击已点亮的相邻格子，让列车向前走。
- 探访沿途地点，查看解锁的回忆与照片。
- 走到第 25 步，打开生日惊喜。

手机和电脑浏览器都可以游玩。点击「出发」后才会开始播放音乐，也可以关闭声音。

## 本地运行

需要 Node.js 22.12 或更高版本，以及 npm。在终端依次运行：

```bash
git clone https://github.com/violetloveAI/alliance-express.git
cd alliance-express
npm ci
npm run dev
```

打开终端显示的本地地址，默认是 `http://localhost:4173/`。

| 命令 | 用途 |
| --- | --- |
| `npm test` | 运行自动化测试 |
| `npm run build` | 构建静态站点，输出到 `dist/` |
| `npm run preview` | 本地预览已构建的 `dist/` |

预览正式版本时，先运行 `npm run build`，成功后再运行 `npm run preview`。

## 部署

这是一个使用 Vite 构建的纯静态游戏，无需账户、API 密钥或后端服务。图片、字体、音乐和音效随站点提供，运行时不依赖外部素材服务。

推送到 `main` 后，[部署工作流](.github/workflows/deploy.yml)会使用 Node.js 24 先运行测试，再构建并发布到 GitHub Pages。部署时通过 `--base=/alliance-express/` 设置资源路径，使游戏可以从仓库子路径正常打开。

## 素材说明

本项目用于个人生日纪念。公开仓库不代表照片、个人内容或原创美术获得了复用授权；需要使用这些内容时，请先取得权利人的许可。

第三方素材保留各自的来源和许可说明：

- [字体来源](public/assets/fonts/SOURCES.txt)、[霞鹜文楷许可](public/assets/fonts/LXGW-LICENSE.txt)、[得意黑许可](public/assets/fonts/SMILEY-LICENSE.txt)
- [音乐署名](public/audio/licenses/ATTRIBUTION.txt)与[音乐许可](public/audio/licenses/CC-BY-4.0.txt)
- [音效署名](public/audio/sfx/ATTRIBUTION.txt)及其 [CC0](public/audio/sfx/licenses/CC0-1.0.txt)、[CC BY 4.0](public/audio/sfx/licenses/CC-BY-4.0.txt) 许可
