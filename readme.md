# ICIC Resource Board

A bilingual (English/中文), public, read-only dashboard for the ICIC group's UF HiPerGator allocations and queued requests.

The project is a dependency-free static site. GitHub Pages can publish it directly, and the browser reads the existing public snapshot API. It never collects UF credentials, passwords, SSH keys, or publishing tokens.

## Publish with GitHub Pages

1. Create a **public** GitHub repository named `icic-resource-board`.
2. Upload every file and folder in this package to the repository root, including `.github`, `.nojekyll`, `assets`, `config.js`, and `index.html`.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment → Source**, choose **GitHub Actions**.
5. Push or upload the files to the `main` branch. The included workflow will publish the site.

The address will normally be:

```text
https://YOUR-GITHUB-USERNAME.github.io/icic-resource-board/
```

## Configuration

Public settings live in [`config.js`](config.js):

```js
window.ICIC_BOARD_CONFIG = {
  apiUrl: "https://duj-resource-board.qqqqqqqqqqzz.chatgpt.site/api/status",
  refreshMs: 60000,
  staleAfterMs: 15 * 60 * 1000,
  timeZone: "America/New_York"
};
```

Do not add any password, token, or SSH key to `config.js` or anywhere in this repository.

## Local preview

Any static web server can serve the folder. For example:

```powershell
python -m http.server 8080
```

Then open `http://127.0.0.1:8080/`.

## Data behavior

- The page checks for a new public snapshot once per minute.
- The HiPerGator publisher currently refreshes the upstream snapshot every five minutes.
- A successful snapshot is cached in the viewer's browser so the most recent public data remains visible during a brief API interruption.
- If neither the API nor a browser cache is available, the page shows clearly labeled preview data.

## 中文发布说明

1. 在 GitHub 创建一个名为 `icic-resource-board` 的公开仓库。
2. 将本压缩包内的所有文件和文件夹上传到仓库根目录。
3. 进入仓库的 **Settings → Pages**。
4. 将 **Build and deployment → Source** 设置为 **GitHub Actions**。
5. 等待部署任务完成，即可通过 GitHub Pages 地址访问。

页面右上角可以切换 EN/中文，并会记住访问者上一次选择的语言。项目中不包含任何 UF 密码或服务器密钥。

## License

MIT
