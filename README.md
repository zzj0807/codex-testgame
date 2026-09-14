# 八牌对决 · Cortana v1.4.1

**八张手牌、三点血量。选择你的牌，在公开技能与隐藏交换之间做出判断。**

## 🎮 点击这里直接玩

### [▶ 开始游戏：最新版 v1.4.1](https://zzj0807.github.io/codex-testgame/?v=1.4.1)

无需注册、登录、下载或 API Key，手机和电脑浏览器均可游玩。

历史版本独立保留：

- [Cortana v1.4](https://zzj0807.github.io/codex-testgame/cortana-v1.4/)
- [Cortana v1.3](https://zzj0807.github.io/codex-testgame/cortana-v1.3/)
- [Cortana v1.2](https://zzj0807.github.io/codex-testgame/cortana-v1.2/)
- [移花接木初版 v1.1](https://zzj0807.github.io/codex-testgame/swap-v1/)
- [无技能经典版 v1.0](https://zzj0807.github.io/codex-testgame/classic/)

## v1.4.1 更新

- **确定斩杀必定执行。** 玩家 2 血、无法合法交换且 C 有压过全部剩余牌的牌时，必定配合技能结束对局；玩家 1 血时优先普通斩杀。
- **连续斩杀与残局必胜。** 识别保留大牌应对交换、逼掉平局牌、普通连续攻击及安全承受一击后的斩杀。
- 大手牌证明搜索覆盖三回合；四张牌及以下搜索至终局。只有检查玩家全部合法应对后才能判定必胜。
- 保留公开信息推算、回合开始锁牌、隐藏交换和亮牌后学习的公平性规则。
- v1.4 保留独立入口，旧版测试继续运行对应存档。

[查看 v1.4.1 的斩杀场景、搜索范围和验证结果](docs/cortana-v1.4.1.md)。

## v1.4 更新

- **1 点牌不能与移花接木同时使用。** 选中 1 点时按钮禁用；已开启技能再选 1 点会自动取消，不消耗次数。
- **你是否使用移花接木对 Cortana 隐藏。** C 只根据公开局势猜测，回合开始锁定唯一出牌，不随你的当前选择更换。
- C 根据局势调整技能发动与出牌概率，考虑两血斩杀、反杀风险和交换后的牌组。
- 玩家用过移花接木后，C 不再猜测是否使用；只剩 1 点牌时也不考虑交换。
- C 仅根据已亮出的公开行动小幅调整模型权重，每局重新开始学习。
- 游戏页面不展示 AI 的概率、算法或评分，只保留玩法与状态提示。

[查看 1.4 的完整算法、公平性和验证说明](docs/cortana-v1.4.md)。[1.3 算法存档](docs/cortana-v1.3.md)也继续保留。

## 怎么玩

1. 点击一张手牌，确认前可改选。
2. 查看 C 头像下的选牌及技能状态；「伤害 ×2」亮起时，C 已发动技能。
3. 若选择的牌大于 1 点，可开启移花接木，再次点击可取消。
4. 确认出牌，双方同时亮牌并结算。
5. 点击「下一回合」继续，或「重新开始」重开一局。

双方初始血量均为 **3 点**，各持 **8 张牌**：

| 点数 | 数量 |
| --- | --- |
| 1 | 3 张 |
| 1.5 | 1 张 |
| 2 | 2 张 |
| 2.5 | 1 张 |
| 3 | 1 张 |

普通回合点数较小者扣 1 血，相同则不扣血。普通出牌使用后弃置。血量归零立即落败；双方手牌用完时，剩余血量较多者获胜，相同则平局。

## 玩家技能：移花接木

每局一次，**仅能搭配大于 1 点的牌**。确认前开启，确认时消耗。本回合不扣血，双方交换打出的牌并拿回手中，下回合可继续使用。

例如：你出 1.5，C 出 3。交换后你获得 3，C 获得 1.5，双方血量不变。不能使用 1 点发起交换，但可以在交换中获得 C 的 1 点牌。

交换回合不减少手牌，所以最多可进行 9 回合。你的技能开关对 C 隐藏，双方亮牌时才公开。

## C 的技能：伤害 ×2

每局最多一次，发动时在选牌阶段提前亮出。本回合落败方扣 2 血，无论落败的是你还是 C。平局也消耗技能。

若玩家同回合使用移花接木，正常交换卡牌、不扣血，双方技能都消耗。重开新局后双方次数恢复。

## 版本存档

| 版本 | Git 标签 | 本地入口 |
| --- | --- | --- |
| v1.4.1 确定斩杀版 | `v1.4.1-cortana` | `dist/index.html` |
| v1.4 隐藏换牌预测版 | `v1.4.0-cortana` | `dist/cortana-v1.4/index.html` |
| v1.3 公开信息决策版 | `v1.3.0-cortana` | `dist/cortana-v1.3/index.html` |
| v1.2 Cortana 初版 | `v1.2.0-cortana` | `dist/cortana-v1.2/index.html` |
| v1.1 移花接木初版 | `v1.1.0-swap` | `dist/swap-v1/index.html` |
| v1.0 无技能经典版 | `v1.0.0-classic` | `dist/classic/index.html` |

## 下载后离线玩

点击仓库的 **Code → Download ZIP**，解压后用浏览器打开上表的对应入口，无需安装依赖或启动后端。

## 账号与 API

这是纯 HTML、CSS、JavaScript 静态游戏，逻辑在浏览器本地运行，不调用付费 API，也不需要密钥。

`.openai/hosting.json` 仅含另一个托管站点的项目编号和静态目录，不是 API Key，也不是 GitHub Pages 游戏运行依赖。

## 开发与验证

`main` 保存完整源码、文档与测试；`gh-pages` 保存发布网页。`dist/ai.js` 处理公开信息决策，`dist/game.js` 处理界面和真实结算。

安装 Node.js 后运行：

```sh
node tests/game.test.cjs
node tests/cortana.test.cjs
node tests/cortana-v1.3.test.cjs
node tests/cortana-v1.4.test.cjs
node tests/cortana-v1.4.1.test.cjs
node tests/ai-v1.4.1-benchmark.cjs 10000 250
```

修改游戏并提交后发布：

```sh
git push origin HEAD:main
git subtree push --prefix=dist origin gh-pages
```

只修改 README 或开发文档无需重新发布网页。

## 关于仓库改名

当前仓库名是 `codex-testgame`，请收藏本文顶部的试玩地址。GitHub 会重定向旧仓库链接，但 GitHub Pages 的路径包含仓库名，不能依赖旧游戏地址持续有效。网页标题及单独部署的 `chatgpt.site` 网站不会随仓库改名自动改变。

参考：[GitHub 官方说明](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository)。
