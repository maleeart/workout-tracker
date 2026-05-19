module.exports = async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const githubToken = process.env.GITHUB_TOKEN;

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

    const activityRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=50",
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const activities = await activityRes.json();

    if (!Array.isArray(activities)) {
      return res.status(500).json({
        error: "Strava activities failed",
        detail: activities
      });
    }

    if (activities.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No Strava activities found"
      });
    }

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

    if (!dbData.content || !dbData.sha) {
      return res.status(500).json({
        error: "GitHub database load failed",
        detail: dbData
      });
    }

    const current = JSON.parse(
      Buffer.from(dbData.content, "base64").toString("utf8")
    );

    if (!current.logs) current.logs = {};

    let imported = 0;
    let skipped = 0;

    for (const activity of activities) {
      const logDate = activity.start_date_local
        ? activity.start_date_local.slice(0, 10)
        : activity.start_date.slice(0, 10);

      if (!Array.isArray(current.logs[logDate])) {
        current.logs[logDate] = current.logs[logDate]
          ? [current.logs[logDate]]
          : [];
      }

      const exists = current.logs[logDate].some(
        s => String(s.sourceId) === String(activity.id)
      );

      if (exists) {
        skipped++;
        continue;
      }

      current.logs[logDate].push({
        id: "strava_" + activity.id,
        type: "cardio",
        duration: Math.round(activity.moving_time / 60),
        distance: Number((activity.distance / 1000).toFixed(2)),
        avgHR: activity.average_heartrate || 0,
        calories: activity.calories || 0,
        notes: activity.name || "Strava Workout",
        source: "Strava",
        sourceId: String(activity.id),
        createdAt: new Date().toISOString()
      });

      imported++;
    }

    if (imported === 0) {
      return res.status(200).json({
        success: true,
        message: `No new activities. Skipped ${skipped} existing activities.`
      });
    }

    const newContent = Buffer
      .from(JSON.stringify(current, null, 2))
      .toString("base64");

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
          message: `Import ${imported} Strava activities`,
          content: newContent,
          sha: dbData.sha
        })
      }
    );

    const updateData = await updateRes.json();

    if (!updateData.commit) {
      return res.status(500).json({
        error: "GitHub database update failed",
        detail: updateData
      });
    }

    return res.status(200).json({
      success: true,
      message: `Imported ${imported} activities, skipped ${skipped} existing activities`
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};
