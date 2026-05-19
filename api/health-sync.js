```javascript id="s3"
export default async function handler(req, res) {
  try {
    const token = process.env.GITHUB_TOKEN;
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;

    // รับข้อมูลจาก Shortcut
    const body =
      typeof req.body === "string"
        ? JSON.parse(req.body)
        : req.body;

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

    const currentContent = JSON.parse(
      Buffer.from(getData.content, "base64").toString("utf8")
    );

    // สร้าง key วันที่
    const today = new Date().toISOString().slice(0, 10);

    // merge log ใหม่
    currentContent.logs[today] = {
      type: "cardio",
      duration: body.duration,
      distance: body.distance,
      avgHR: body.avgHR,
      calories: body.calories,
      source: "Apple Health",
      syncedAt: new Date().toISOString(),
    };

    const newContent = JSON.stringify(currentContent, null, 2);

    // save กลับ github
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
          message: "Apple Health Sync",
          content: Buffer.from(newContent).toString("base64"),
          sha,
        }),
      }
    );

    const result = await updateRes.json();

    res.status(200).json({
      success: true,
      result,
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });

  }
}
```
