const ffmpeg = require('fluent-ffmpeg');
const { Transform } = require('stream');
const fs = require('fs');
const speech = require('@google-cloud/speech');
const speechClient = new speech.v1p1beta1.SpeechClient();

let recognizeStream, timeout;
let streamingLimit = 210000; // 3.5 minutes
let configurations = {
   config: { 
      encoding: 'FLAC',
      sampleRateHertz: 48000,
      languageCode: 'en-US',
      model: 'default',
      audioChannelCount: 2,
      enableWordTimeOffsets: true,
   },
   interimResults: true,
};

function startStream() {
   console.log("started recognition stream ");
   recognizeStream = speechClient
      .streamingRecognize(configurations)
      .on('error', (err) => {
         console.log(err);
      })
      .on('data', (stream) => {
         speechCallback(stream);
      });
   timeout = setTimeout(restartStream, streamingLimit);
}

function speechCallback(stream) {
   let stdoutText = stream.results[0].alternatives[0].transcript;
   if(stream.results[0] && stream.results[0].isFinal) {
      console.log("Final Result : ", stdoutText);
      fs.appendFile('transcripts.txt', stdoutText, (err) => {
         if(err) console.log(err);
      });
   } else {
      console.log("Interim Result : ", stdoutText);
   }
}

function restartStream() {
   if (recognizeStream) {
      recognizeStream.removeListener('data', speechCallback);
      recognizeStream.destroy();
      recognizeStream = null;
   }
}

let dest = new Transform({
   transform: (chunk, enc, next) => {
      if(recognizeStream) {
         recognizeStream.write(chunk);
      }
      console.log('chunk coming', chunk.length);
      next(null, chunk);
   }
}).on('data', (data) => {});

let livestream_endpoint = '/Users/noahsay/Downloads/a.m3u8'; // Update this line with the path to your file
let command = ffmpeg(livestream_endpoint)
   .on('start', () => {
      startStream();
      console.log("ffmpeg : processing Started");
   })
   .on('progress', (progress) => {
      console.log('ffmpeg : Processing: ' + progress.targetSize + ' KB converted');
   })
   .on('end', () => {
      console.log('ffmpeg : Processing finished !');
   })
   .on('error', (err) => {
      console.log('ffmpeg : ffmpeg error :' + err.message);
   })
   .format('flac')
   .audioCodec('flac')
   .output(dest);
command.run();