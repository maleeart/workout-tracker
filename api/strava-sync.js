const https = require("https");

function postJson(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => r.json());
}

module.exports = async function handler(req, res) {
  try {
    const tokenData = await postJson("https://www.strava.com/oauth/token", {
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: process.env.STRAVA_REFRESH_TOKEN
    });

    if (!tokenData.access_token) {
      return res.status(500).json({
        error: "Cannot refresh Strava token",
        detail: tokenData
      });
    }

    const activitiesRes = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=1",
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const activities = await activitiesRes.json();

    if (!Array.isArray(activities)) {
      return res.status(500).json({
        error: "Strava API Error",
        detail: activities
      });
    }

    if (activities.length === 0) {
      return res.status(200).json({
        message: "No activities found"
      });
    }

    const latest = activities[0];

    return res.status(200).json({
      id: latest.id,
      workout: latest.name,
      distance: Number((latest.distance / 1000).toFixed(2)),
      duration: Math.round(latest.moving_time / 60),
      avgHR: latest.average_heartrate || 0,
      calories: latest.calories || 0,
      date: latest.start_date
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};
