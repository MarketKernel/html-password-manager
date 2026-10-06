# html-password-manager

<!-- languages -->
<h3 align="center">
<a href="../../README.md">🇬🇧 English</a> ·
<b>🇨🇳 中文</b> ·
<a href="README.hi.md">🇮🇳 हिन्दी</a> ·
<a href="README.es.md">🇪🇸 Español</a> ·
<a href="README.fr.md">🇫🇷 Français</a> ·
<a href="README.ar.md">🇸🇦 العربية</a> ·
<a href="README.bn.md">🇧🇩 বাংলা</a> ·
<a href="README.pt.md">🇧🇷 Português</a> ·
<a href="README.ru.md">🇷🇺 Русский</a> ·
<a href="README.ur.md">🇵🇰 اردو</a> ·
<a href="README.id.md">🇮🇩 Bahasa Indonesia</a> ·
<a href="README.de.md">🇩🇪 Deutsch</a> ·
<a href="README.ja.md">🇯🇵 日本語</a> ·
<a href="README.mr.md">🇮🇳 मराठी</a> ·
<a href="README.te.md">🇮🇳 తెలుగు</a> ·
<a href="README.tr.md">🇹🇷 Türkçe</a> ·
<a href="README.uk.md">🇺🇦 Українська</a>
</h3>
<!-- /languages -->

**Deterministic Password** 不只是存储密码，而是计算密码。网站的密码由你的主密码、网站、用户名和版本号通过 Argon2id 和 HMAC-SHA-256 推导得出。即使数据库文件丢失，相同的输入在任何电脑上都会再次得出相同的密码——丢失文件不再可怕。要更换某个网站的密码，只需提高版本号。工作原理参见“[推导密码](#推导密码)”。

它同时也是一个完整的 KeePass 密码管理器：可以打开、编辑并保存普通的 `.kdbx` 文件（KDBX 4、AES-256、Argon2id），因此同一个数据库仍可继续在 KeePassXC、KeePass 或 KeeWeb 中使用。推导出的密码像其他密码一样存储在条目中，其他 KeePass 应用也会同样显示它。

一切都离线运行：无需账户，没有云端，也没有任何网络请求。整个应用就是一个独立的 HTML 文件；数据库在页面内存中解密，并直接保存回磁盘，主密码从不离开页面。同一个页面也是一个 [Chrome 扩展程序](#chrome-扩展程序)，可以把登录信息填入旁边的标签页——**[从 Chrome 应用商店安装](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**。

**[在线版本](https://password.marketkernel.com/)**——同一个页面的 PWA（Progressive Web App，渐进式 Web 应用）形式：它可以安装到系统中，之后作为独立的应用运行，拥有自己的窗口和图标，并且可以离线使用。在电脑上的 Chrome、Edge 和 Arc 中，使用地址栏中的安装按钮；在 Android 上，使用 Chrome 的 ⋮ 菜单 → 安装应用；在 iOS 上，在 Safari 或 Chrome 中使用共享 → 添加到主屏幕。在电脑上安装到 Chrome 或 Edge 后，它还可以从访达或文件资源管理器（打开方式）打开 `.kdbx`，并直接保存回原处。在那里数据库同样保留在你的磁盘上——参见“[GitHub Pages](#github-pages)”。

![html-password-manager：群组、条目以及一个正在编辑的条目](../password-manager.jpg)

## 使用方法

1. 构建 `build/password-manager.html`（参见“[构建](#构建)”），并在浏览器中打开它——直接从磁盘打开即可。
2. “打开文件” → 选择一个 `.kdbx` 数据库，或将其拖入窗口。
3. 输入主密码（如果数据库带有密钥文件，再选择密钥文件）→ “解锁”。

在 Chrome、Edge 和 Arc 中，文件通过 File System Access API 打开：更改会写回同一个文件——如果开启了自动保存，则在每次编辑后片刻写入——并且下次访问时会再次提供该文件：只记住它的句柄，绝不记住其内容或密码。在 Safari 和 Firefox 中，文件以只读方式打开，“保存”会下载数据库的更新副本——在手机上也是如此：Android 上的 Chrome 没有 File System Access，而 iOS 上的所有浏览器（包括 Chrome）都运行在 Safari 的引擎上。在 iOS 上，“保存”则会把副本交给共享菜单——参见“[在手机上](#在手机上)”。

“新建数据库”会创建一个空的 KDBX 4 数据库，使用 AES-256 和 Argon2id 加密（64 MiB、10 轮——KeePassXC 的默认值，在浏览器中约需半秒）。

### 在手机上

宽度在 900 像素以内时——手机，或竖着拿的平板——页面一次只显示一项内容。条目列表占满屏幕；轻点一个条目会在单独的屏幕上打开它，工具栏中的 ‹、系统的返回按钮或向后轻扫都会返回列表。返回时会保留编辑内容，就像在电脑上选择另一个条目时会保留一样；留空的新条目会被丢弃。☰ 会让群组、标签和回收站从列表上方滑入。菜单、生成器和设置从屏幕底部升起；返回会先关闭它们，也会取消对话框。生成器、设置和锁定位于工具栏的 ⋯ 菜单中。

触摸屏没有右键，也没有拖动：群组旁边的 ⋯ 会打开在电脑上右键打开的那个菜单，其中的“移动到群组…”起到拖动的作用。条目的菜单是条目屏幕上的 ⋯。

文件以只读方式打开。在 iOS 上，“保存”会把更新后的数据库交给共享菜单，在其中选择“存储到‘文件’”即可用它替换原文件；关闭共享菜单则更改不会保存。Android 上的 Chrome 只能共享图片、音频、视频和文本，因此在那里“保存”会下载副本。

屏幕更宽时以及在平板上，三个窗格保持与电脑上一样；任何尺寸的触摸屏都会获得更大的按钮以及群组旁边的 ⋯。

## Chrome 扩展程序

**[从 Chrome 应用商店安装](https://chromewebstore.google.com/detail/hiahfdknjchamepclnokcalkcjcfhahf)**

`npm run build` 还会生成 `build/extension/`：作为 Chrome 扩展程序的同一个应用，以及供 Chrome 应用商店使用的打包文件 `build/password-manager-extension-<version>.zip`。要试用你自己构建的版本：`chrome://extensions` → 开发者模式 → 加载已解压的扩展程序 → `build/extension`。

工具栏图标会打开一个紧凑的弹出窗口：标签页所在网站的条目，点击其中一个即可填充；用于复制其用户名、密码或一次性验证码的按钮；以及对整个数据库的搜索。底部的 **完整模式** 会在 Chrome 的侧边栏中、页面旁边打开应用——采用手机布局，因为侧边栏很窄——切换标签页时它会一直保持打开。那里的一切都与文件中一样；扩展程序增加的是填充登录信息：

- **弹出窗口** 只需主密码即可解锁侧边栏最近打开的那个文件：选择文件和密钥文件、进行每一项更改都由侧边栏完成。在没有条目的网站上，它的 **新建密码** 会在生成器上打开侧边栏，就像菜单中的“填充”那样。
- 页面右键菜单（在页面上或在字段中右键）中的 **填充** 会填入标签页所在网站对应条目的用户名和密码——在登录流程中要求一次性验证码的那一步，则填入一次性验证码。如果该网站只有一个条目，无论侧边栏是否打开都会立即填充；如果有多个、一个也没有，或者数据库已锁定，它会打开侧边栏，以便选择一个条目、生成密码或解锁——然后从那里继续。分两步的登录（Google、Microsoft）在第一步填入用户名，在第二步填入密码：为该标签页选定的条目会被记住。侧边栏中条目的 **填充** 按钮会把该条目填入标签页。
- 侧边栏关闭后 **数据库保持打开**，直到它被锁定：达到设置中的闲置时间后、电脑锁屏时、从侧边栏、从弹出窗口，或者通过工具栏图标菜单中的 **锁定**。再次打开时，侧边栏无需密码即可接着使用它，弹出窗口也会立即显示它。
- 群组面板顶部的 **当前网站** 列出标签页所在网站的条目，列表一打开就显示它；它会随标签页而变化。
- **为页面新建密码。** 在没有条目的网站上，“填充”会打开“推导 v3”生成器，并带上标签页的网站和页面上输入的用户名。它的“填充”按钮会把密码填进去——注册表单的两个密码字段都会填——并将其保存为普通条目。

只有当条目的网址恰好指向标签页所在的网站时，该条目才与标签页匹配：两个地址都会经过生成器 3 的 `siteOf()` 处理——去掉协议、端口、路径和 `www.`，IDN 转为 punycode。`google.com` 不匹配 `accounts.google.com`，`mail.site.com` 也不匹配 `site.com`。带有 `https://` 或没有协议的条目绝不会填入 `http://` 页面：通过 http 使用的网站需要在网址中写明 `http://`。回收站中的条目不会出现在候选中，而为其他网站手动选择的条目只有在一条同时指明两个网站的警告之后才会填充。

**实现方式。** 侧边栏就是页面本身：`panel.html`，其脚本位于 `panel.js`，这是 Manifest V3 的要求。每次解锁和保存时，它都会把文件及其密钥——放在 `ProtectedValue` 中的密码，以及密钥文件——交给一个 offscreen 文档，后者把它们以及据此解密出的数据库只读副本保存在内存中，直到锁定；锁定会关闭该文档，密钥也随之消失。不会向任何地方写入任何内容。菜单由 service worker 负责。点击“填充”时，只有在等待任何异步操作之前才能打开侧边栏，因此 worker 必须立刻知道能否填充：它保存着由 offscreen 文档发送过来的条目网址——没有名称，没有密码——而 offscreen 文档会让它保持运行。弹出窗口（`popup.html`、`popup.js`）不解密任何内容：它先向 offscreen 文档请求与标签页匹配的标题和用户名，再请求被点击的那一个条目；处于锁定状态时，它读取最近的文件，并将其连同密码交给该文档打开。

**什么会到达页面。**

- 只有点击所请求的内容，并且只有一个条目的值。任何地方都不运行内容脚本：点击时，`chrome.scripting.executeScript` 先询问标签页的每个框架它位于哪个地址、有哪些登录字段，此时不发送任何值；然后只有条目所属网站的框架才会得到这些值，并且函数在输入之前会再次检查自己的地址。同一页面上其他网站的框架什么也得不到。
- 只填充用户能看到的字段：显示的、启用的、可写的、有一定尺寸的、位于窗口内的。作为陷阱而隐藏的字段保持为空。
- 值从扩展程序的隔离环境（isolated world）中设置，绕过页面在其输入框上设置的任何 setter，并通过 `input` 和 `change` 事件通知 React、Vue 或 Angular。
- 主密码、其他条目和网站列表绝不会发送到页面。

**权限。** 使用 `activeTab` 而不是所有网站：点击图标或“填充”会把那一个标签页授予扩展程序。因此侧边栏从弹出窗口或菜单打开，绝不通过 Chrome 自己的设置（`openPanelOnActionClick`）打开：以那种方式打开的侧边栏根本得不到任何标签页。在未被授予的标签页上使用侧边栏中的“填充”时，会为该条目的网站请求一次权限（`optional_host_permissions`）。`contextMenus`、`scripting` 和 `sidePanel` 用于上述功能，`offscreen` 用于该文档，`idle` 用于锁屏，`clipboardWrite` 用于在侧边栏关闭时清除已复制的机密。没有 `externally_connectable`：扩展程序的各部分通过 `chrome.runtime` 通信，并且每个部分只接受来自扩展程序自身页面的消息。它的页面与文件一样带有 `connect-src 'none'`；构建会检查这一点，并检查没有任何页面包含内联脚本或外部地址。

与文件版的一个区别：再次打开时，只有 Chrome 仍然允许，侧边栏才会直接写入数据库；否则状态栏会提示这一点，第一次“保存”时会请求权限。

## 安全性

- **没有任何内容离开页面。** 文件中的 Content-Security-Policy 禁止一切网络请求、表单提交和外部资源；如果该策略缺失或出现外部引用，构建就会失败。PWA 版本额外放行三样东西，全部来自它自己的源：manifest、service worker 和图标——`connect-src` 仍为 `'none'`。
- 格式代码是 [kdbxweb](https://github.com/keeweb/kdbxweb)，即 KeeWeb 所基于的库；Argon2 使用 [hash-wasm](https://github.com/Daninet/hash-wasm) 的 WebAssembly，它同样嵌入在文件中。
- 受保护字段在内存中以 XOR 掩码形式保存（kdbxweb 的 `ProtectedValue`），在屏幕上也会被遮盖，直到点击显示。搜索从不查找受保护字段。
- **任何语言的密码。** 当浏览器把某个字段当作密码时，macOS 会开启 Secure Input 并强制使用拉丁键盘布局，于是无法输入西里尔字母的主密码。Chrome 不仅把 `type=password` 当作密码，还会通过启发式规则把任何使用 `-webkit-text-security` 样式或值为圆点的字段当作密码——而且一旦这样认定就会一直如此。这里的机密字段不给出任何此类提示：它们是文字透明的普通文本输入框，上面覆盖绘制一层圆点（使用等宽字体，使光标保持在正确位置）。一个标记会显示隐藏的文本正在以西里尔字母（РУС）还是拉丁字母（ENG）输入。代价是：Secure Input 永远不会启用，而它还能对其他应用隐藏按键。
- 复制的机密会在 30 秒后以及锁定时从剪贴板中清除。
- 数据库在闲置 15 分钟后以及按下 `⌘L` 时锁定。锁定会从内存中丢弃已解密的数据库；如果有无法写入的未保存更改，锁定会等待，而不是丢弃这些更改。
- 条目中的链接只在协议为 `http`、`https`、`ftp` 和 `mailto` 时才会打开，并带有 `noopener`。
- 密码使用 `crypto.getRandomValues` 和拒绝采样生成：每个字符出现的概率都相同。

## 功能

- **群组**：可折叠的树，通过右键菜单创建、重命名、删除，通过拖放移动（条目和群组），面板可调整大小、可隐藏（`⌘\`）。
- **条目**：标题、用户名、密码、网址、备注、自定义字段（明文或受保护）、标签、过期时间、附件。可按标题、用户名、网址、日期排序。
- **一次性验证码**（TOTP）：来自 `otp` 字段（`otpauth://` URL 或裸密钥，KeePassXC 和 KeeWeb 就是这样存储的）、KeePass 的 `TimeOtp-*` 字段，或 TrayTOTP 的 `TOTP Seed`。支持 SHA-1、SHA-256、SHA-512；验证码随倒计时刷新。编辑器中的 **+ 一次性验证码** 接受网站在二维码旁显示的设置密钥（或 `otpauth://` 链接），并立即显示验证码，以便在网站上确认；裸密钥会保存为 `otpauth://` 链接，即 KeePassXC 能读取的格式。
- **编辑** 在草稿上进行：“保存”会先把之前的状态存入条目的历史记录，KeePass 也是这样做的；“取消”会丢弃草稿。可以浏览并恢复较早的版本。
- **回收站**：删除会移入回收站；在那里可以恢复或永久删除。
- **搜索** 涵盖标题、用户名、网址、备注、标签、自定义字段和附件名称；查询中的每个词都必须匹配。
- **密码生成器**（骰子图标，`⌘G`）生成在其列表中所选类型的密码，最新的推导算法排在最前；会记住上次的选择：
  - **推导 v3**——由主密码、用户名、网站和版本计算得出，因此没有文件也能重新计算——参见“[推导密码](#推导密码)”；
  - **推导 v2** 和 **推导 v1**——两个旧程序（旧版 2 和旧版 1）的计算器，在开启 设置 → “显示旧版密码算法”后才会列出——参见“[旧版算法](#旧版算法)”；
  - **随机**——长度、字符集、形似字符、熵估计。

  为输入的密码显示强度指示。
- **数据库**：重命名，更改主密码和密钥文件，另存副本。
- **语言**：English、中文、हिन्दी、Español、Français、العربية、বাংলা、Português、Русский、اردو、Bahasa Indonesia、Deutsch、日本語、मराठी、తెలుగు、Türkçe——使用人数最多的十六种语言——以及 Українська。可在“设置”中选择，或沿用浏览器的语言；阿拉伯语和乌尔都语会让窗口从右到左排列。
- **主题**：跟随系统、浅色、深色，在“设置”中选择。语言、主题、面板宽度、排序、生成器选项以及折叠的群组都会被记住。

## 推导密码

生成器中的 **推导 v3** 根据以下内容计算密码：

- 数据库的主密码（密钥文件，如果有的话，不参与计算），或在此输入的另一个主密码，
- 用户名，
- 网站——账户所在的域名（`https://www.github.com/login` → `github.com`），
- 版本——1、2、…… 直到 2³² − 1；“+1”会为同一个账户生成新密码。

这四项构成 32 字节的熵。要求——长度、字符集、形似字符——只是把这些字节塑造成字符：改变它们不会改变熵。**使用** 会把结果作为普通的已存储密码放入条目。密码是如何生成的，不会留下任何记录：该条目与其他条目无异，其他 KeePass 应用也会显示相同的密码。万一文件丢失，相同的主密码、用户名、网站、版本和要求在任何机器上都会得出相同的密码。默认值为 20 个字符、全部四种字符集、不含形似字符；用其他设置生成的密码还需要记住这些设置。

生成器先询问用户名——从条目打开时，就是条目自己的用户名：在那里输入的内容也会显示在条目表单中——然后是网站；两者都是必填项，由它们得出的密码显示在底部，位于 **使用** 上方。

- 作为电子邮件地址的用户名本身就指明了网站：`test@site.com` 会填入 `site.com`，而条目的网址保持不变——它很可能是 `mail.site.com`。不过，同一个地址可以登录许多网站，生成器会在字段下方提示这一点：用 `test@gmail.com` 登录 GitHub 时，请把它填入的 `gmail.com` 改写为 `github.com`。
- 其他用户名需要手动输入网站，而从条目打开时，输入的内容也会成为条目的网址。一开始会填入条目已有的网址。

在作为网站输入的内容中，协议、路径、端口和开头的 `www.` 都无关紧要；子域名则不然——`login.github.com` 和 `github.com` 是两个网站。不是 URL 的网站（“我的银行”）按原样使用。从工具栏打开时，生成器的工作方式相同，使用它自己的字段，并复制结果。

每次打开生成器时，“使用数据库的主密码”都是勾选的。取消勾选即可从另一个主密码推导——该主密码在此输入，且不会保存在任何地方——用于找回在另一个数据库中、或在更改主密码之前生成的密码。更改主密码不会改变文件中已有的密码；只有生成器此后计算出的结果会有所不同。

### 算法：生成器 3

以下所有内容都已冻结：更改任何常量都会使所有用它生成的密码无法再次计算。未来的生成器会作为列表中的新类型出现，而这一个保持不变。代码位于 `src/core/derived.ts`；`npm test` 会用固定向量，以及一个根据本说明、使用 Node 自带 `crypto` 独立编写的实现，对其进行检查。所用的原语都是标准的——SHA-256、HMAC-SHA-256、Argon2id——因此该算法可以用任何语言重新实现。

它分两个阶段运行：机密信息先变成 32 字节的熵，然后由要求从这些字节中切分出字符。

**阶段 1——熵。**

1. *规范化输入。* 所有字符串均为 UTF-8。
   - `site`——作为网站输入的内容的主机名：将文本按 WHATWG URL 解析（文本中没有 `scheme://` 时在前面加上 `https://`）：小写、IDN 转为 punycode、无端口、无用户名或密码、去掉开头的 `www.`；无法解析为 URL 的文本按原样使用。然后去除首尾空白、进行 NFC 规范化、转为小写。
   - `user`——用户名，去除首尾空白并进行 NFC 规范化；保留大小写。
   - `master`——主密码，进行 NFC 规范化，不去除任何空白。以单个字符输入的“é”与以“e”加组合重音符输入的“é”会得出相同的密码。
2. *盐。*
   ```
   salt = SHA-256( "html-password-manager/derived/v3" ‖ 0x00
                   ‖ u32be(byte length of site) ‖ site
                   ‖ u32be(byte length of user) ‖ user
                   ‖ u32be(version) )
   ```
   长度前缀使 `ab` + `c` 与 `a` + `bc` 区分开来；标签使这些字节与相同输入的任何其他用途区分开来。`u32be` 是 4 字节的大端整数。
3. *拉伸。*
   ```
   entropy = Argon2id(password = master, salt, memory = 64 MiB, passes = 3,
                      lanes = 1, version 0x13, output = 32 bytes)
   ```
   Argon2id 让每一次猜测主密码都要耗费 64 MiB 内存，这正是拖慢 GPU 和 ASIC 的关键。由于网站、用户名和版本都在盐中，每个账户都有自己的盐：无法预先计算任何表，每个账户都必须单独攻击。

**阶段 2——塑形。** 要求只在这里使用，因此它们改变的是密码的外观，而不是其背后的熵。

4. *随机字节流*，需要多长就生成多长——32 字节不足以生成长密码并完成洗牌：
   ```
   block(i) = HMAC-SHA-256(key = entropy, "hpm-v3-stream" ‖ u32be(i)),  i = 0, 1, 2, …
   ```
5. *小于 n 的无偏数。* 取字节流中接下来的 4 个字节，作为大端 u32 `x`。如果 `x ≥ 2³² − (2³² mod n)`，就丢弃它并取下一个；否则结果为 `x mod n`。（直接使用 `x mod n` 会偏向字母表的开头。）
6. *字符。* 字符集按以下顺序排列，每个仅在被选中时使用：
   ```
   A–Z      ABCDEFGHIJKLMNOPQRSTUVWXYZ
   a–z      abcdefghijklmnopqrstuvwxyz
   0–9      0123456789
   符号     !#$%&*+-=?@^_~.,:;()[]{}<>/|
   ```
   不含形似字符时，会从中移除 `O 0 o I l 1 |`。然后：
   ```
   chars = []
   for each chosen set:            chars.push(set[draw(|set|)])      # 每个字符集都会出现
   while |chars| < length:         chars.push(all[draw(|all|)])      # all = 所有字符集合并
   for i = length − 1 down to 1:   j = draw(i + 1); swap chars[i], chars[j]   # Fisher–Yates
   password = chars joined
   ```
   长度为 4 到 128。先从每个字符集中各取一个字符，才能保证“含有数字”和“含有符号”；洗牌则隐藏了这些字符的位置。

**测试向量。** 主密码 `Тестовый пароль`，网站 `https://www.github.com/login`（`github.com`），用户名 `me@example.com`，版本 1，默认要求（20 个字符、全部四种字符集、不含形似字符）：

```
password  A6qVXXF]7<%a)aa<x7*U
```

相同的熵在 12 个字符且不含符号时得出 `yaM6VJaJFYUQ`；版本 2 使用默认值时得出 `3q_bwppbE8P2+ufKr:P6`。

### 强度如何

- 推导密码最多有 256 位熵（32 字节）；由全部四种字符集、不含形似字符组成的 20 个字符约为 128 位。实际上，上限取决于主密码。
- **任何推导密码方案的弱点：** 某个网站泄露的密码可以让攻击者离线猜测主密码，因为网站和用户名是已知的。每次猜测需要运行一次 64 MiB 的 Argon2id——在浏览器中约 0.15–0.4 秒，在专用硬件上更短。短的或常见的主密码会被找到；长的密码短语则不会。随机密码没有这一弱点，这也是生成器同时提供两者的原因。
- 只要主密码没有被攻破，一个泄露的密码就不会透露其他网站或版本的任何信息：它们来自不同的盐，因此来自不同的 Argon2 运算。

数据库打开期间，主密码以 XOR 掩码形式保存在内存中，连同迄今为止计算出的熵；锁定会将两者一并丢弃。

## 旧版算法

两个较早的 Windows 程序根据秘密短语计算密码；生成器中的 **推导 v1**（旧版 1）和 **推导 v2**（旧版 2）精确地重现了它们，因此可以找回用它们生成的密码。它们只是计算器：在其中输入的任何内容都不会保存，生成器关闭后短语即被清除，**使用** 会把结果作为普通的已存储密码放入条目。设置 → “显示旧版密码算法”会让它们出现。

从条目打开时，两者都会建议一个标识符：本身已指明网站的用户名（`mail@site.com`）按原样使用，否则为用户名、`@` 和去掉 `www.` 的网站（`dmytro@github.com`）；它可以修改。每个短语——主密钥和次要密钥、主要秘密短语和次要秘密短语——都有各自的“在数据库锁定前记住”复选框：勾选的短语会以 XOR 掩码形式保存在页面内存中，下次自动填入；第一个短语被记住时，密钥会立即计算出来。两者也都可以把数据库自己的主密码——即解锁它时使用的密码——作为第一个短语，即旧版 1 的主密钥或旧版 2 的主要秘密短语（“使用数据库的主密码”，在设置中分别为二者记住）：此时该字段及其复选框会被停用。这些都不会写入磁盘；锁定、关闭数据库或关闭旧版算法都会把它们全部清除。代码位于 `src/core/legacy.ts`；`npm test` 会用原始 .NET 程序计算出的向量对其进行检查。

**旧版 1**——主密钥、标识符、主要密钥、次要密钥、结果：

```
short(bytes) = Base64(bytes) without "=", "/", "+", first 10 characters
primary key  = short(SHA-1 applied 1 000 000 times to UTF-8(master key ‖ identifier))
result       = short(SHA-1(UTF-8(primary key ‖ secondary key)))
```

主要密钥与标识符绑定，可以与主密钥分开保存（写在纸上），因此主密钥无需在任何地方输入：可以直接输入主要密钥。次要密钥使被盗的纸条本身毫无用处。

**旧版 2**（Password.Generator 1.0）——主要保护：标识符、主要秘密短语、密钥长度、字符集；次要保护：密钥、次要秘密短语、密码版本、密码长度、字符集：

```
digest(a, b, v, n) = SHA-1 applied n times to UTF-8(a) ‖ UTF-8(b) ‖ (v > 0 ? u32le(v) : nothing)
key                = select(digest(identifier, primary phrase, 1, 100 000), key length + 2)
password           = select(digest(key, secondary phrase, version, 1), password length + 2)
```

`select` 把摘要读作五个小端 u32，将每个的最高位置 1，再以字母表的 N 进制写出——`!#$%&'()+,-.`（如已选择）、数字（始终包含）、A–Z、a–z（如已选择）——最低位在前，每个保留 5 个字符，并截取到指定长度（1–18）。前两个字符是签名，用于与原程序显示的签名目视比对；其余部分是密钥或密码。密钥的版本始终为 1：原程序没有这个字段。标识符 `1`、短语 `1`、长度 10、数字和字母，得出密钥 `E8 8pgYm9fZha`。

两者都比版本 3 弱得多：攻击者猜测一次短语只需运行几次 SHA-1，而不是一次 64 MiB 的 Argon2id，而且旧版 1 的结果只有 10 个字符，约 60 位。请用它们找回旧密码，不要用来生成新密码。

## 键盘快捷键

| 操作 | 按键 |
| --- | --- |
| 保存 | `⌘S` |
| 锁定 | `⌘L` |
| 搜索 | `⌘F` |
| 新建条目 | `⌘N` |
| 编辑 · 保存编辑 | `⌘E` 或 `Enter` · `⌘Enter` |
| 取消编辑 | `Esc` |
| 密码生成器 | `⌘G` |
| 复制密码 · 用户名 · 网址 | `⌘C` · `⌘B` · `⌘U` |
| 上一个 · 下一个条目 | `↑` · `↓` |
| 删除条目 | `⌫` |
| 群组面板 | `⌘\` |

## 翻译

英文文本保留在代码中：`t('menu', 'Delete')`、`tn('status', '{count} entry', '{count} entries', n)`，以及模板中的 `data-i18n="context"` / `data-i18n-attr="context"`。第一个参数是上下文——字符串所属的那部分界面，这样同一个英文单词在两个地方可以有不同的译法。词典 `src/locales/<code>.json` 按 上下文 → 英文文本 → 译文 的方式对应：

```json
{
  "menu": { "Delete": "Удалить" },
  "status": { "{count} entries": { "one": "{count} запись", "few": "{count} записи", "many": "{count} записей", "other": "{count} записи" } }
}
```

词典中缺少的字符串以英文显示。带数字的文本针对该语言的每个复数类别（`Intl.PluralRules`）各有一种形式，以英文的复数形式为键。`npm run i18n` 按语言列出尚未翻译的字符串以及不再使用的字符串；`npm test` 检查每条译文是否保留了英文的占位符并具备所有复数形式。

Chrome 显示的扩展程序自身的内容——名称和描述、工具栏按钮的标题——通过 `chrome.i18n` 跟随浏览器的语言，而不是侧边栏的语言。这些文本是 `src/extension/manifest.json` 中的英文文本，在同样的词典中以上下文 `manifest` 翻译；构建会把它们写入 `_locales/<code>/messages.json`，并在 manifest 中放入 `__MSG_appName__` 之类的引用。Chrome 有自己的语言代码，并忽略其余的：`pt` 变为 `pt_BR` 和 `pt_PT`，`zh` 变为 `zh_CN`，而乌尔都语没有对应的代码，因此在那里 Chrome 以英文显示扩展程序的名称。名称超过 75 个字符或描述超过 132 个字符时，构建会停止。

本 README 同样有翻译：`docs/readme/README.<code>.md`，每种语言一份，每份顶部都有语言列表。对 README 的改动也应同步到各个译文中。

## 构建

```sh
./build.sh         # 如有需要先安装依赖，然后构建 build/password-manager.html
npm install
npm run build      # -> build/password-manager.html
npm run watch      # src/ 中有更改时重新构建
npm run typecheck  # tsc --noEmit
npm test           # 打开、编辑和保存 .kdbx 文件，生成器、TOTP、推导密码、标签页匹配、词典
npm run test:browser  # 在 headless Chrome 中测试构建出的页面和扩展程序
npm run i18n       # 各词典缺少或不再需要的字符串
npm run check      # 依次运行 typecheck、test、build 和 test:browser
npm run shots -- shots/after  # 先构建，再把主要界面的截图保存到 shots/after
```

`build.mjs` 使用 esbuild 将 `src/app/main.ts` 打包为 IIFE，并将其连同样式和图标（data URI）一起替换进 `src/app/template.html`。kdbxweb 针对 Node 的后备依赖（`crypto`、`@xmldom/xmldom`）被替换为空桩——浏览器自带 `crypto.subtle` 和 `DOMParser`。结果是 `build/password-manager.html`，约 500 KB，其中四分之一是词典。

同一次运行还会生成 `build/pages/`：该页面的可安装 PWA 版本——带有 manifest 链接、以及告诉页面去注册自己 worker 的 `<meta name="service-worker">` 的 `index.html`、`manifest.webmanifest`、图标，以及缓存页面以便离线打开的 `sw.js`。`build/password-manager.html` 本身仍是一个没有外部引用的单一文件。

还有 `build/extension/`：`panel.html` 是模板，其脚本位于 `panel.js`——同样是 `src/app/main.ts`，只是用 `src/extension/extension.ts` 代替了 `src/app/platform.ts`（后者的钩子在文件版中什么也不做）——旁边是 `popup.html`（带有页面的样式和 `popup.css`）和 `popup.js`、`background.js`、`offscreen.html` 和 `offscreen.js`、图标，以及 `manifest.json`，其版本号取自 `package.json`。`build/password-manager-extension-<version>.zip` 包含相同的文件，且日期固定：相同的源码得出相同的字节。

`tests/extension.mjs` 通过 DevTools 协议将该扩展程序加载到 headless Chrome 中（通过管道调用 `Extensions.loadUnpacked`；Chrome 自 137 版起已移除 `--load-extension`），并在本地服务器上的测试网站中进行填充：普通表单、类似 React 的表单、带一次性验证码的三步登录、网站自身和其他网站的框架、作为陷阱隐藏的字段、用于 https 条目的 http 页面、用“推导 v3”密码填写的注册表单——分别在侧边栏关闭时以及锁定之后；还有弹出窗口，测试它的解锁、填充、搜索、复制和锁定。右键菜单无法从 DevTools 点击，因此测试会自己触发 worker 的 `onClicked`；没有真实的点击，Chrome 就不会授予 `activeTab`，因此被测试的副本可以把测试网站 `*.test` 作为主机权限访问。工具栏图标可以从 DevTools 点击（`Extensions.triggerAction`）：由一个单独的 Chrome 加载按原样构建的扩展程序，检查这次点击是否把标签页交给了弹出窗口。Headless Chrome 153 在这次点击时会崩溃，与扩展程序无关，此时会跳过该检查；Chrome for Testing 可以运行它（`CHROME=/path/to/chrome-for-testing npm run test:browser`）。

`tests/fixtures/Database.kdbx` 是供测试使用的示例数据库；其密码为 `Тестовый пароль`。

## 版本与发布

版本号只写在一个地方：`package.json`。构建会把它放进页面（解锁界面下方的那一行、设置的底部）、扩展程序的 `manifest.json` 以及 PWA 的缓存名称中。对打了 `v<version>` 标签的提交进行构建时，版本号按原样显示；其他任何构建都会附加其提交，如 `0.8.0+1a2b3c4`，这样 GitHub Pages 上来自 `main` 的页面就不会被误认为是正式发布版本。Chrome 的 `version` 只能包含数字，因此在那里提交信息放入 `version_name`。

```sh
npm version minor           # 0.7.2 -> 0.8.0：package.json、package-lock.json、一次提交和标签 v0.8.0
git push --follow-tags      # 该标签会启动 .github/workflows/release.yml
```

如果标签与 `package.json` 不一致，发布工作流会停止；否则它会附上 `password-manager-<tag>.html`、`password-manager-extension-<tag>.zip` 和 `SHA256SUMS.txt`。

## GitHub Pages

`.github/workflows/pages.yml` 会对每次推送到 `main` 的内容进行构建和测试，并将 `build/pages/` 部署到 GitHub Pages（Settings → Pages → Source: GitHub Actions），地址为
<https://password.marketkernel.com/>。文件的打开方式与单文件版相同；最近的文件、设置和记住的句柄属于该地址，与从磁盘打开的副本的那些相互独立。

每次部署都会更改 `sw.js` 中的缓存名称，因此浏览器会自行获取新的 worker——在有网络连接时启动、应用保持打开期间每隔几小时一次，或者在“设置 → 检查更新”发出请求时。新的 worker 会把自己的版本下载到专属的缓存中并等待；正在运行的那个则继续提供旧页面，离线时也是如此。此后，按钮上带有一个小点的设置页面和解锁界面会显示“版本 … 已准备就绪。更新”：点击“更新”会锁定数据库（和任何锁定一样，保存它或询问是否保存），放新的 worker 接管，并重新加载页面，页面会提示一次已完成更新。如果不点这个按钮，等应用的所有窗口都关闭后，新版本会自行启动——或者，如果在设置中勾选了“锁定且在后台时自动安装更新”，那么一旦没有数据库处于打开状态且窗口不可见，新版本就会立即启动。这也是一种取舍：已安装的 PWA 运行的是最近一次部署放在那里的版本，而下载的文件则始终是原来的版本。如需一个固定在磁盘上的版本，请从某个发布中获取 `password-manager-<tag>.html`，并用 `SHA256SUMS.txt` 进行核对。

Manifest 将 `.kdbx` 指定为应用要打开的文件类型（`file_handlers`），并把它限制在一个窗口内（`launch_handler`、`focus-existing`）：从系统打开的文件会进入已经打开的那个窗口——同一个文件对应两个窗口会相互覆盖彼此的保存内容——如果该窗口打开的是另一个数据库，会先将其锁定。已安装的应用会要求浏览器保留其存储空间（`navigator.storage.persist()`），这和记住一个数据库在任何地方的做法一样：否则，磁盘空间不足时可能会把离线副本、最近的文件以及记住的数据库一并清除。

`npm run test:browser` 也会打开 `build/pages/`：service worker 接管页面，Chrome 认定 manifest 可安装，并且在服务器关闭后，页面仍能加载并解锁示例数据库；随后会发现一次新的部署，等待它，并由“更新”放它接管，或者在页面隐藏后自行进入。Headless Chrome 不会把文件交给应用，因此一个替代的 `launchQueue` 会给页面一个真正的文件句柄，并以可写方式打开。

## 目录结构

```
src/core/             无 DOM：测试在 Node 中运行它
  kdbx.ts             kdbxweb + Argon2：打开、保存、创建；字段、群组、回收站
  generator.ts        密码生成器和强度估计
  derived.ts          推导密码：生成器 3、电子邮件地址对应的网站、本次会话的主密码
  site.ts             siteOf()：网址对应的网站，用于生成器 3 和标签页匹配
  legacy.ts           旧版算法：旧版 1 和旧版 2
  otp.ts              TOTP（RFC 6238）以及机密的各种存储方式
  match.ts            哪些条目与标签页匹配
  i18n.ts             t()/tn()、语言列表、翻译页面的标记
src/app/              页面：单文件版、PWA 和扩展程序的侧边栏
  template.html       带有 __STYLES__/__APP__/__ICON__ 占位符的标记、CSP；也是扩展程序的 panel.html
  styles.css          配色、浅色和深色主题、三个窗格；手机上一次一屏
  main.ts             解锁界面、解锁、保存、锁定、工具栏、快捷键、设置
  files.ts            File System Access API、拖放、文件输入；最近的文件；系统用该应用打开的文件
  groups.ts           左侧面板中的群组树、标签和回收站
  list.ts             条目列表
  details.ts          单个条目：查看、在草稿上编辑、历史记录、附件、TOTP
  search.ts           搜索、排序、安全链接
  genpanel.ts         生成器弹出框：随机、版本 3、旧版 1 和 2
  clipboard.ts        复制并定时清除
  avatar.ts           条目图标：数据库中的自定义图标或彩色字母
  settings.ts         localStorage：语言、主题、面板、锁定和剪贴板计时器
  ui.ts               对话框、右键菜单、弹出框、提示消息、图标；手机上的底部面板
  screens.ts          手机布局：列表或条目、群组抽屉、返回按钮
  platform.ts         页面在自身之外所做的事：在文件版和 PWA 中什么也不做
  update.ts           PWA 的更新：注册 sw.js，不时检查一次，找到等待中的版本，放它接管
src/extension/        Chrome 扩展程序
  manifest.json       它的 manifest；构建时添加版本号
  extension.ts        侧边栏的 platform.ts：offscreen 文档、标签页、填充
  popup.ts            工具栏图标的弹出窗口（popup.html、popup.css）：网站的条目、完整模式
  background.ts       service worker：菜单、锁屏、填充标签页
  offscreen.ts        offscreen 文档（offscreen.html）：锁定前一直打开的数据库
  fill.ts             注入页面的函数：查找登录字段并填充
  messages.ts         扩展程序各部分之间的通信方式
src/pwa/sw.js         Pages 构建的 service worker
src/locales/          每种语言一个词典
assets/               图标；pwa/，PWA 所用的各尺寸 PNG；extension/，扩展程序的图标
tests/                .kdbx 往返读写、生成器和 TOTP、推导密码、旧版算法、标签页匹配、
                      词典、headless Chrome 中的页面和扩展程序；fixtures/，示例数据库
tools/                load.mjs 为测试编译 src/ 模块；i18n.mjs 将词典与代码进行比对
docs/                 上面的截图；readme/，本 README 的其他语言版本；工作笔记（不在 git 中）
build/                构建输出；build/pages/ 是用于 GitHub Pages 的 PWA，build/extension/ 是扩展程序
```

## 限制

- 支持 KDBX 3.1 和 4.x；不支持 Twofish 加密的文件和 KeePass 1（`.kdb`）文件。
- 不支持同步、自动输入，也不支持合并已更改的副本。
- 扩展程序仅适用于 Chrome，不提供字段内的建议，不会在提交表单时保存密码，没有键盘快捷键，并且每个条目只能有一个网址。
- 只有基于 Chromium 的浏览器才能直接写入文件。

## 许可证

MIT——参见 [LICENSE](../../LICENSE)。kdbxweb 和 hash-wasm 同样采用 MIT 许可证。
