"use strict";

const express     = require('express');
const bodyParser  = require('body-parser');
const fs          = require('fs');
const url         = require('url');
const youtubedl   = require('youtube-dl');
const exec        = require('child_process').exec;
const serveIndex  = require('serve-index');
const mqtt        = require('mqtt');

const app = express();
const mqttClient = mqtt.connect('mqtt://0.0.0.0');

mqttClient.on('connect', function () {
  mqttClient.subscribe('readyAck/#');
});

// Parse JSON into the req.body as an object
app.use(bodyParser.json());

// Mount ./files at /files for serving music and make a visible file index
app.use('/files', express.static('files'));
app.use('/files', serveIndex('./files', {'icons': true}));

// Adds a track to the tracks
app.post('/tracks', (req, res) => {
  const videoUrl = url.parse(req.body.url, true);
  getMP3Url(videoUrl)
  .then((url)  => {
    res.status(201).send({ url });
    mqttClient.publish('sync', { url, id: videoUrl.query.v });
  })
  .catch((err) => { res.status(500).send({ 'error': err.message }); });
});

app.listen(3000, function () {
  console.log('Musi listening on port 3000!');
});

const getMP3Url = (videoUrl) => {
  const videoId  = videoUrl.query.v;

  return new Promise((resolve, reject) => {
    fs.exists(`./files/${videoId}.mp3`, (exists) => {
      if (exists) {
        resolve(`http://32a9ae58.ngrok.io/files/${videoId}.mp3`);
      } else {
        downloadAndCache(videoUrl)
        .then((url) => { resolve(url); })
        .catch((err) => { reject(err); });
      }
    });
  });
};

const downloadAndCache = (videoUrl) => {
  const videoId  = videoUrl.query.v;
  return new Promise((resolve, reject) => {
    const download = exec(`youtube-dl --format bestaudio --output '/tmp/${videoId}.m4a' ${videoUrl.href}`,
      (err) => {
        if (err !== null) { reject(err); }
        const convert = exec(`ffmpeg -i /tmp/${videoId}.m4a -b:a 256k -vn ./files/${videoId}.mp3`,
          (err) => {
            if (err !== null) { reject(err); }
            else { resolve(`http://32a9ae58.ngrok.io/files/${videoId}.mp3`); }
        });
    });
  });
};
