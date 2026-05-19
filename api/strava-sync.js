const https = require("https");

module.exports = async function handler(req, res) {

  const token = process.env.STRAVA_ACCESS_TOKEN;

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

      return res.status(200).send(body);

    });

  });

  request.on("error", function(err) {

    return res.status(500).json({
      error: err.message
    });

  });

  request.end();

};

