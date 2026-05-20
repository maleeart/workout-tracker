module.exports = async function handler(req, res) {
  try {
    const id = req.query.id;

    if (!id) {
      return res.status(400).json({
        error: "Missing activity id. Use ?id=ACTIVITY_ID"
      });
    }

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

    const detailRes = await fetch(
      "https://www.strava.com/api/v3/activities/" + id,
      {
        headers: {
          Authorization: "Bearer " + tokenData.access_token
        }
      }
    );

    const detail = await detailRes.json();

    return res.status(200).json({
      id,
      calories: detail.calories,
      kilojoules: detail.kilojoules,
      total_calories: detail.total_calories,
      sport_type: detail.sport_type,
      type: detail.type,
      name: detail.name,
      moving_time: detail.moving_time,
      elapsed_time: detail.elapsed_time,
      raw: detail
    });

  } catch (err) {
    return res.status(500).json({
      error: err.message
    });
  }
};
