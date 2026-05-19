
export default async function handler(req, res) {

  try {

    const accessToken = process.env.STRAVA_ACCESS_TOKEN;

    const response = await fetch(
      "https://www.strava.com/api/v3/athlete/activities?per_page=1",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const activities = await response.json();

    const latest = activities[0];

    res.status(200).json({
      workout: latest.name,
      distance: latest.distance / 1000,
      duration: Math.round(latest.moving_time / 60),
      avgHR: latest.average_heartrate,
      calories: latest.calories,
      date: latest.start_date,
    });

  } catch (err) {

    res.status(500).json({
      error: err.message,
    });

  }

}

