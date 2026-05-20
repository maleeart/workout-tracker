module.exports = async function handler(req, res) {
  try {

    const owner = process.env.GITHUB_OWNER;
    const repo = process.env.GITHUB_REPO;
    const githubToken = process.env.GITHUB_TOKEN;

    // =========================
    // REFRESH STRAVA TOKEN
    // =========================

    const tokenRes = await fetch(
      "https://www.strava.com/oauth/token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          client_id:
            process.env.STRAVA_CLIENT_ID,

          client_secret:
            process.env.STRAVA_CLIENT_SECRET,

          grant_type: "refresh_token",

          refresh_token:
            process.env.STRAVA_REFRESH_TOKEN
        })
      }
    );

    const tokenData =
      await tokenRes.json();

    if (!tokenData.access_token) {

      return res.status(500).json({
        error:
          "Strava token refresh failed",
        detail: tokenData
      });

    }

    // =========================
    // GET ACTIVITIES LIST
    // =========================

    const activityRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=30",
      {
        headers: {
          Authorization:
            "Bearer " +
            tokenData.access_token
        }
      }
    );

    const activities =
      await activityRes.json();

    if (!Array.isArray(activities)) {

      return res.status(500).json({
        error:
          "Strava activities failed",
        detail: activities
      });

    }

    if (activities.length === 0) {

      return res.status(200).json({
        success: true,
        message:
          "No Strava activities found"
      });

    }

    // =========================
    // LOAD DATABASE.JSON
    // =========================

    const dbRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        headers: {
          Authorization:
            `token ${githubToken}`,

          Accept:
            "application/vnd.github.v3+json"
        }
      }
    );

    const dbData =
      await dbRes.json();

    if (!dbData.content || !dbData.sha) {

      return res.status(500).json({
        error:
          "GitHub database load failed",
        detail: dbData
      });

    }

    const current = JSON.parse(
      Buffer
        .from(
          dbData.content,
          "base64"
        )
        .toString("utf8")
    );

    if (!current.logs) {
      current.logs = {};
    }

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    // =========================
    // PROCESS ACTIVITIES
    // =========================

    for (const activity of activities) {

      const logDate =
        activity.start_date_local
          ? activity.start_date_local
              .slice(0, 10)
          : activity.start_date
              .slice(0, 10);

      if (
        !Array.isArray(
          current.logs[logDate]
        )
      ) {

        current.logs[logDate] =
          current.logs[logDate]
            ? [current.logs[logDate]]
            : [];

      }

      // =========================
      // GET CALORIES
      // =========================

      let calories =
        activity.calories ||
        activity.total_calories ||
        0;

      // fetch detail ONLY if needed
      if (!calories || calories <= 0) {

        try {

          const detailRes = await fetch(
            "https://www.strava.com/api/v3/activities/" +
              activity.id,
            {
              headers: {
                Authorization:
                  "Bearer " +
                  tokenData.access_token
              }
            }
          );

          const detail =
            await detailRes.json();

          calories =
            detail.calories ||
            detail.kilojoules ||
            detail.total_calories ||
            calories;

        } catch (e) {

          console.log(
            "detail fetch failed",
            activity.id
          );

        }
      }

      // =========================
      // FIND EXISTING
      // =========================

      const existingIndex =
        current.logs[logDate]
          .findIndex(
            s =>
              String(s.sourceId) ===
              String(activity.id)
          );

      // =========================
      // UPDATE EXISTING
      // =========================

      if (existingIndex !== -1) {

        current.logs[logDate][
          existingIndex
        ] = {

          ...current.logs[logDate][
            existingIndex
          ],

          duration:
            Math.round(
              activity.moving_time / 60
            ),

          distance:
            Number(
              (
                activity.distance /
                1000
              ).toFixed(2)
            ),

          avgHR:
            activity.average_heartrate ||
            current.logs[logDate][
              existingIndex
            ].avgHR ||
            0,

          calories: calories,

          totalCalories:
            calories,

          notes:
            activity.name ||
            "Strava Workout",

          updatedAt:
            new Date()
              .toISOString()
        };

        updated++;
        continue;
      }

      // =========================
      // INSERT NEW
      // =========================

      current.logs[logDate].push({

        id:
          "strava_" +
          activity.id,

        type: "cardio",

        duration:
          Math.round(
            activity.moving_time / 60
          ),

        distance:
          Number(
            (
              activity.distance /
              1000
            ).toFixed(2)
          ),

        avgHR:
          activity.average_heartrate ||
          0,

        calories: calories,

        totalCalories:
          calories,

        notes:
          activity.name ||
          "Strava Workout",

        source: "Strava",

        sourceId:
          String(activity.id),

        createdAt:
          new Date()
            .toISOString()
      });

      imported++;
    }

    // =========================
    // SAVE DATABASE
    // =========================

    const newContent =
      Buffer
        .from(
          JSON.stringify(
            current,
            null,
            2
          )
        )
        .toString("base64");

    const updateRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/database.json`,
      {
        method: "PUT",

        headers: {
          Authorization:
            `token ${githubToken}`,

          Accept:
            "application/vnd.github.v3+json",

          "Content-Type":
            "application/json"
        },

        body: JSON.stringify({

          message:
            `Sync Strava activities`,

          content:
            newContent,

          sha:
            dbData.sha

        })
      }
    );

    const updateData =
      await updateRes.json();

    if (!updateData.commit) {

      return res.status(500).json({
        error:
          "GitHub database update failed",
        detail: updateData
      });

    }

    // =========================
    // DONE
    // =========================

    return res.status(200).json({

      success: true,

      imported,

      updated,

      skipped,

      message:
        `Imported ${imported}, updated ${updated}`

    });

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }
};
