```javascript id="3q4a7o"
export default async function handler(req, res) {

  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const token = process.env.GITHUB_TOKEN;

  try {

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json"
        }
      }
    );

    const data = await response.json();

    const content = JSON.parse(
      Buffer.from(data.content, "base64").toString()
    );

    res.status(200).json(content);

  } catch (err) {

    res.status(500).json({
      error: err.message
    });

  }

}
```
