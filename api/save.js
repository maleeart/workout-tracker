export default async function handler(req, res) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    // parse body ให้ชัวร์
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

    const newContent = JSON.stringify(body, null, 2);

    // โหลด database.json เดิม
    const getRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
        },
      }
    );

    const getData = await getRes.json();

    const sha = getData.sha;

    // update github file
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: "Update workout database",
          content: Buffer.from(newContent).toString("base64"),
          sha: sha,
        }),
      }
    );

    const updateData = await updateRes.json();

    res.status(200).json(updateData);
  } catch (err) {
    res.status(500).json({
      error: err.message,
    });
  }
}
