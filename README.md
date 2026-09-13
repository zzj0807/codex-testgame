# 八牌对决 · Cortana v1.3

**八张手牌、三点血量。与 Cortana 同时亮牌，抓住时机使用移花接木。**

## 🎮 点击这里直接玩

### [▶ 开始游戏：最新版 v1.3](https://zzj0807.github.io/codex-testgame/)

**无需注册、登录、下载或 API Key。** 手机与电脑浏览器均可游玩。

历史版本均独立保留：

- [Cortana v1.2](https://zzj0807.github.io/codex-testgame/cortana-v1.2/)
- [移花接木初版 v1.1](https://zzj0807.github.io/codex-testgame/swap-v1/)
- [无技能经典版 v1.0](https://zzj0807.github.io/codex-testgame/classic/)

## v1.3 更新

- C 尚未使用技能时，每回合开始独立以 **25% 概率**发动；每局最多一次。
- 技能回合按指定的最大牌、最小牌和其他牌概率选牌。
- 普通回合使用公开记牌与概率评分，同时保留随机性。
- C 在玩家操作前就锁定卡牌；取消或开启移花接木不再改变 C 的出牌。
- 游戏页面只展示玩法和必要状态，**不展示 C 的算法和运行概率**。

**[阅读完整概率判断与公平性说明](docs/cortana-v1.3.md)**：包括评分公式、所有参数、边界情况、开局概率示例与可复现模拟。

## 怎么玩

1. 点击一张手牌，确认前可以改选。
2. 查看 C 头像下的「已选牌」和技能提示框。
3. 可点击「移花接木」开启技能，再次点击可取消。
4. 点击「确认出牌」，双方同时亮牌并结算。
5. 点击「下一回合」继续，或「重新开始」重开一局。

双方初始血量均为 **3 点**，各持 **8 张牌**：

| 点数 | 数量 |
| --- | --- |
| 1 | 3 张 |
| 1.5 | 1 张 |
| 2 | 2 张 |
| 2.5 | 1 张 |
| 3 | 1 张 |

普通回合点数较小者扣 **1 血**，相同则均不扣血。普通出牌使用后弃置。血量归零立即落败；双方手牌用完时，剩余血量较多者获胜，相同则平局。

## 玩家技能：移花接木

每局一次，确认前开启，确认出牌时消耗。本回合不扣血，双方交换打出的卡牌并收回手中，下回合可继续使用。

例如：你出 1，C 出 3。交换后你获得 3，C 获得 1，双方血量不变。交换回合不减少手牌，因此最多可进行 9 回合。重开新局恢复次数。

## C 的技能：伤害 ×2

选牌时提前亮出「伤害 ×2」框，只让**发动当回合**的落败方扣 2 血，不论落败方是玩家还是 C。平局不扣血，但也消耗技能。

如果玩家同回合使用移花接木，交换卡牌、不扣血，**双方技能都消耗**。技能不会补发，也不保证每局都发动。

## 版本存档

| 版本 | Git 标签 | 本地入口 |
| --- | --- | --- |
| v1.3 公开信息决策版 | `v1.3.0-cortana` | `dist/index.html` |
| v1.2 Cortana 初版 | `v1.2.0-cortana` | `dist/cortana-v1.2/index.html` |
| v1.1 移花接木初版 | `v1.1.0-swap` | `dist/swap-v1/index.html` |
| v1.0 无技能经典版 | `v1.0.0-classic` | `dist/classic/index.html` |

## 下载后离线玩

点击仓库的 **Code → Download ZIP**，解压后用浏览器打开上表的对应入口即可，无需安装依赖或启动后端。

## 账号与 API

游戏是纯 HTML、CSS、JavaScript 静态网页，逻辑全部在浏览器运行，**不调用付费 API，也不需要密钥**。

`.openai/hosting.json` 仅含另一个托管站点的项目编号和静态目录，不是 API Key，不参与 GitHub Pages 游戏运行。

## 开发与验证

- `main` 保存完整源码、说明与测试。
- `gh-pages` 只保存网页文件，GitHub Pages 从分支根目录发布。
- `dist/ai.js` 是独立决策模块，只接收 C 自身信息和已公开的信息。
- `dist/game.js` 处理回合锁定、界面和结算。
- `docs/cortana-v1.3.md` 解释具体决策公式与参数。

安装 Node.js 后运行：

```sh
node tests/game.test.cjs
node tests/cortana.test.cjs
node tests/cortana-v1.3.test.cjs
node tests/ai-benchmark.cjs
```

修改游戏并提交后，将 `dist` 同步到网页分支：

```sh
git push origin HEAD:main
git subtree push --prefix=dist origin gh-pages
```

只修改 README 或开发文档无需重新发布网页。

## 关于仓库改名

当前仓库名为 `codex-testgame`，请收藏本文顶部的试玩地址。旧仓库链接会由 GitHub 重定向，但 GitHub Pages 项目网址包含仓库名，不能依赖旧游戏地址持续有效。网页标题及另行部署的 `chatgpt.site` 网站也不会随仓库改名自动改变。

参考：[GitHub 官方说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)。
