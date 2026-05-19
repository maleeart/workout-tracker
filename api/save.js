```javascript id="qlg3ow"
export default async function handler(req, res) {

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  try {

    const currentFile = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const currentData = await currentFile.json();

    const sha = currentData.sha;

    const content = Buffer
      .from(JSON.stringify(req.body, null, 2))
      .toString("base64");

    const update = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        },
        body: JSON.stringify({
          message: "Update database",
          content,
          sha
        })
      }
    );

    const result = await update.json();

    res.status(200).json(result);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

}
```
