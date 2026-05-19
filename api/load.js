module.exports = async function handler(req, res) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const data = await response.json();

    if (!data.content) {
      return res.status(500).json({
        error: "database.json not found",
        github: data,
      });
    }

    const content = Buffer.from(data.content, "base64").toString("utf8");

    res.status(200).json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
