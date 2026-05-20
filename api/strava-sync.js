module.exports = async function handler(req, res) {
  try {
    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const githubToken = process.env.GITHUB_TOKEN;

    const tokenRes = await fetch("https://www.strava.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
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

    const listRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=1",
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const activities = await listRes.json();

    if (!Array.isArray(activities) || activities.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No Strava activities found"
      });
    }

    const activity = activities[0];

    const detailRes = await fetch(
      "https://www.strava.com/api/v3/activities/" + activity.id,
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const detail = await detailRes.json();

    if (!detail || detail.message || detail.errors) {
      return res.status(500).json({
        error: "Strava detail activity failed",
        activityId: activity.id,
        detail
      });
    }

    let calories = 0;
    let caloriesSource = "none";

    if (Number(detail.calories) > 0) {
      calories = Number(detail.calories);
      caloriesSource = "detail.calories";
    } else if (Number(detail.total_calories) > 0) {
      calories = Number(detail.total_calories);
      caloriesSource = "detail.total_calories";
    } else if (Number(activity.calories) > 0) {
      calories = Number(activity.calories);
      caloriesSource = "activity.calories";
    } else if (Number(activity.total_calories) > 0) {
      calories = Number(activity.total_calories);
      caloriesSource = "activity.total_calories";
    }

    const logDate = detail.start_date_local
      ? detail.start_date_local.slice(0, 10)
      : activity.start_date_local
        ? activity.start_date_local.slice(0, 10)
        : activity.start_date.slice(0, 10);

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

    if (!Array.isArray(current.logs[logDate])) {
      current.logs[logDate] = current.logs[logDate]
        ? [current.logs[logDate]]
        : [];
    }

    const existingIndex = current.logs[logDate].findIndex(
      s => String(s.sourceId) === String(activity.id)
    );

    const sessionData = {
      type: "cardio",
      duration: Math.round((detail.moving_time || activity.moving_time || 0) / 60),
      distance: Number(((detail.distance || activity.distance || 0) / 1000).toFixed(2)),
      avgHR: detail.average_heartrate || activity.average_heartrate || 0,
      calories: calories,
      totalCalories: calories,
      caloriesSource: caloriesSource,
      notes: detail.name || activity.name || "Strava Workout",
      source: "Strava",
      sourceId: String(activity.id),
      sportType: detail.sport_type || activity.sport_type || detail.type || activity.type || "",
      updatedAt: new Date().toISOString()
    };

    if (existingIndex !== -1) {
      current.logs[logDate][existingIndex] = {
        ...current.logs[logDate][existingIndex],
        ...sessionData
      };
    } else {
      current.logs[logDate].push({
        id: "strava_" + activity.id,
        ...sessionData,
        createdAt: new Date().toISOString()
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
          message: "Sync latest Strava activity with detail calories",
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
      message: existingIndex !== -1 ? "Updated existing Strava activity" : "Imported latest Strava activity",
      date: logDate,
      workout: sessionData.notes,
      calories,
      caloriesSource,
      activityId: activity.id
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};
