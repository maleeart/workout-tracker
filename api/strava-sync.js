module.exports = async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const githubToken = process.env.GITHUB_TOKEN;

    // 1) refresh Strava access token
    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: process.env.STRAVA_CLIENT_ID,
        client_secret: process.env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: process.env.STRAVA_REFRESH_TOKEN
      })
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: "Strava token refresh failed",
        detail: tokenData
      });
    }

    // 2) get latest Strava activity
    const activityRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=300",
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const activities = await activityRes.json();

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(200).json({
        message: "No Strava activities found"
      });
    }

    const latest = activities[0];
    const logDate = latest.start_date_local
      ? latest.start_date_local.slice(0, 10)
      : latest.start_date.slice(0, 10);

    // 3) load database.json
    const dbRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json"
        }
      }
    );

    const dbData = await dbRes.json();
    const sha = dbData.sha;

    const current = JSON.parse(
      Buffer.from(dbData.content, "base64").toString("utf8")
    );

    if (!current.logs) current.logs = {};
    if (!Array.isArray(current.logs[logDate])) {
      current.logs[logDate] = current.logs[logDate]
        ? [current.logs[logDate]]
        : [];
    }

    // 4) prevent duplicate sync
    const alreadyExists = current.logs[logDate].some(
      s => String(s.sourceId) === String(latest.id)
    );

    if (alreadyExists) {
      return res.status(200).json({
        success: true,
        message: "Activity already synced",
        activity: latest.name
      });
    }

    // 5) append session
    current.logs[logDate].push({
      id: "strava_" + latest.id,
      type: "cardio",
      duration: Math.round(latest.moving_time / 60),
      distance: Number((latest.distance / 1000).toFixed(2)),
      avgHR: latest.average_heartrate || 0,
      calories: latest.calories || 0,
      notes: latest.name || "Strava Workout",
      source: "Strava",
      sourceId: String(latest.id),
      createdAt: new Date().toISOString()
    });

    const newContent = Buffer
      .from(JSON.stringify(current, null, 2))
      .toString("base64");

    // 6) save database.json
    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: "Sync Strava workout",
          content: newContent,
          sha
        })
      }
    );

    const updateData = await updateRes.json();

    return res.status(200).json({
      success: true,
      message: "Strava synced",
      date: logDate,
      workout: latest.name,
      update: updateData
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};
