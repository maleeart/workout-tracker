const https = require("https");

module.exports = async function handler(req, res) {

  try {

    const token = process.env.STRAVA_ACCESS_TOKEN;

    if (!token) {
      return res.status(500).json({
        error: "Missing STRAVA_ACCESS_TOKEN"
      });
    }

    const options = {
      hostname: "www.strava.com",
      path: "/api/v3/athlete/activities?per_page=1",
      method: "GET",
      headers: {
        Authorization: "Bearer " + token
      }
    };

    const request = https.request(options, function(response) {

      let body = "";

      response.on("data", function(chunk) {
        body += chunk;
      });

      response.on("end", function() {

        try {

          const data = JSON.parse(body);

          if (!Array.isArray(data)) {
            return res.status(500).json({
              error: "Strava API Error",
              detail: data
            });
          }

          if (data.length === 0) {
            return res.status(200).json({
              message: "No activities found"
            });
          }

          const latest = data[0];

          return res.status(200).json({
            workout: latest.name,
            distance: (latest.distance / 1000).toFixed(2),
            duration: Math.round(latest.moving_time / 60),
            avgHR: latest.average_heartrate,
            calories: latest.calories,
            date: latest.start_date
          });

        } catch (err) {

          return res.status(500).json({
            error: err.message
          });

        }

      });

    });

    request.on("error", function(err) {

      return res.status(500).json({
        error: err.message
      });

    });

    request.end();

  } catch (err) {

    return res.status(500).json({
      error: err.message
    });

  }

};
```
