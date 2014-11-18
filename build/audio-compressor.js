'use strict';

window.AudioCompresser = (function() {
  var AudioCompresser = function AudioCompresser(fileName, fileBuffer) {
    this.worker = null;
    this.workerRunning = false;
    this.fileName = null;
    this.fileBuffer = null;
    this.bitRate = '96k';
    this.format = 'mp3';
    this.events = {};

    this._init(fileName, fileBuffer);
  };

  AudioCompresser.prototype = {
    _init: function(fileName, fileBuffer) {
      this.fileName = fileName;
      this.fileBuffer = fileBuffer;

      var extension = this.fileName.replace(/^.*\./, '');
      if(extension) {
        this.format = extension.toLowerCase();
      }

      this.initWorker();

      return this;
    },

    _getArguments: function() {
      var args = [],
          name = this.fileName.replace(/\..*?$/, '');

      args.push('-i');
      args.push(this.fileName);

      args.push('-b:a');
      args.push(this.bitRate);

      switch (this.format) {
        case 'mp3':
          args.push('-acodec');
          args.push('libmp3lame');
          args.push(name + '.mp3');
          break;

        case 'ogg':
          args.push('-acodec');
          args.push('libvorbis');
          args.push(name + '.ogg');
          break;

        case 'aac':
          args.push('-acodec');
          args.push('libfdk_aac');
          args.push(name + '.mp4');
          break;

        case 'wma':
          args.push('-acodec');
          args.push('wmav1');
          args.push(name + '.asf');
          break;
      }

      return args;
    },

    _getMimeType: function() {
      return 'audio/' + this.format;
    },

    convert: function() {
      this.worker.postMessage({
        type: 'command',
        arguments: this._getArguments(),
        files: [{
          'name': this.fileName,
          'buffer': this.fileBuffer
        }]
      });
    },

    on: function(name, fn) {
      if(!this.events[name]) {
        this.events[name] = [];
      }
      this.events[name].push(fn);

      return this;
    },

    off: function(name, fn) {
      // remove ALL the handlers for a certain type of event
      // jQuery style
      if(arguments.length === 1) {
        this.events[name] = [];
      } else {
        // remove that particullar event handler
        var index = this.events[name].indexOf(fn);
        if(index !== -1) {
          this.events[name].splice(index, 1);
        }
      }

      return this;
    },

    initWorker: function() {
       // terminate any existing worker
      if (this.worker && this.workerRunning) {
        this.worker.terminate();
      }
      this.worker = this._getFFMPEGWorker();
      this.workerRunning = true;

      return this;
    },

    trigger: function(eventName, data) {
      if(this.events[eventName]) {
        this.events[eventName].forEach(function(fn) {
          fn({type:eventName, data: data}, data);
        });
      }

      return this;
    },

    // create ffmpeg worker
    _getFFMPEGWorker: function () {
      // regexps for extracting time from ffmpeg logs
      var self = this,
        durationRegexp = /Duration: (.*?), /,
        duration,
        timeRegexp = /time=(.*?) /,
        ffmpegWorker = new Worker('scripts/worker.js');

      ffmpegWorker.addEventListener('message', function(event) {
        var message = event.data,
            time,
            progress;

        self.trigger(message.type, message);

        if(message.type === 'stderr') {

          // try to extract duration
          if (!duration && durationRegexp.exec(message.data)) {
            duration = timeToSeconds(durationRegexp.exec(message.data)[1]);
          }
          // try to extract time
          if (duration && timeRegexp.exec(message.data)) {
            time = timeToSeconds(timeRegexp.exec(message.data)[1]);
            progress = Math.floor(time / duration * 100);
            self.trigger('progress', progress);
          }
        } else if (message.type === 'done') {
          var code = message.data.code,
              outFileNames = Object.keys(message.data.outputFiles);

          if (code === 0 && outFileNames.length) {
            var outFileName = outFileNames[0],
                outFileBuffer = message.data.outputFiles[outFileName],
                blob = new Blob([outFileBuffer], {type: self._getMimeType()}),
                src = window.URL.createObjectURL(blob),
                data = {
                  name: outFileName,
                  buffer: outFileBuffer,
                  blob: blob,
                  url: src
                };
            self.trigger('success', data);

          } else {
            self.trigger('fail', message.data);
          }
        }
      }, false);
      return ffmpegWorker;
    }
  };

  function timeToSeconds(time) {
    var parts = time.split(':');
    return parseFloat(parts[0]) * 60 * 60 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]) + parseFloat('0.' + parts[3]);
  }

  return AudioCompresser;
})();
